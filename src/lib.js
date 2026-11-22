import { ref } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { applyTheme } from './themes.js'

const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example)')

export const sb = createClient(URL_, KEY)

export const assetUrl = (path) => sb.storage.from('assets').getPublicUrl(path).data.publicUrl

// First format this browser can record: iPhone Safari gives mp4, Chrome gives webm
export const pickMime = () =>
  ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((t) => window.MediaRecorder?.isTypeSupported(t)) || ''

export const extOf = (mime) =>
  mime.includes('mp4') ? 'mp4' : mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : mime.includes('jpeg') ? 'jpg' : 'bin'

// Anonymous per-device id for the server-side rate limit
const device = (() => {
  try {
    let d = localStorage.getItem('sepatah-device')
    if (!d) localStorage.setItem('sepatah-device', (d = crypto.randomUUID()))
    return d
  } catch {
    return crypto.randomUUID()
  }
})()

// XHR instead of fetch because fetch cannot report upload progress.
function upload(blob, path, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest()
    x.open('POST', `${URL_}/storage/v1/object/media/${path}`)
    x.setRequestHeader('apikey', KEY)
    // legacy anon keys are JWTs and go in Authorization too; new publishable keys must not
    if (KEY.startsWith('eyJ')) x.setRequestHeader('Authorization', `Bearer ${KEY}`)
    x.setRequestHeader('Content-Type', (blob.type || 'application/octet-stream').split(';')[0])
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    x.onload = () => (x.status < 300 ? res() : rej(new Error(`${x.status} ${x.responseText}`)))
    x.onerror = () => rej(new Error('network error'))
    x.send(blob)
  })
}

// ---- unsent uploads: kept on the phone until the server has them, so a dropped signal or a locked phone doesn't lose a wish ----
function idb(mode, fn) {
  return new Promise((res, rej) => {
    const o = indexedDB.open('sepatah', 1)
    o.onupgradeneeded = () => o.result.createObjectStore('unsent', { keyPath: 'id' })
    o.onerror = () => rej(o.error)
    o.onsuccess = () => {
      const tx = o.result.transaction('unsent', mode), r = fn(tx.objectStore('unsent'))
      tx.oncomplete = () => (o.result.close(), res(r.result))
      tx.onerror = () => rej(tx.error)
    }
  })
}
// best effort: a phone that can't store (old Safari, storage full) still sends, it just can't resume later
export const unsent = {
  put: (job) => idb('readwrite', (st) => st.put(job)).catch(() => {}),
  del: (id) => idb('readwrite', (st) => st.delete(id)).catch(() => {}),
  list: (slug) => idb('readonly', (st) => st.getAll()).then((all) => all.filter((j) => j.slug === slug)).catch(() => []),
}

// While a send runs: keep the screen on and ask before the page is closed (iPhone ignores the ask; unsent covers it)
function guardSend() {
  let lock
  navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
  const warn = (e) => { e.preventDefault(); e.returnValue = '' }
  addEventListener('beforeunload', warn)
  return () => { lock?.release(); removeEventListener('beforeunload', warn) }
}

// errors a retry can't fix: the job is dropped from the phone
const FATAL = /closed|not_found|bad_type|bad_request|too_long/
// job: { id, slug, kind, source, name, dur, blob } — a plain object (never a Vue proxy: IndexedDB can't store those).
// Reserve a slot (server checks window + rate limit), upload the file, then mark it live. A retry reuses the reserved
// slot while it's fresh (the server allows 30 min), so failed tries don't use up the hourly limit.
export async function sendMedia(job, onProgress = () => {}) {
  const release = guardSend()
  try {
    await unsent.put(job)
    if (!job.slot || Date.now() - job.slot.at > 25 * 60_000) {
      const { data, error } = await sb.rpc('start_upload', {
        p_slug: job.slug, p_kind: job.kind, p_source: job.source || 'event', p_ext: extOf(job.blob.type),
        p_name: job.name || '', p_device: device, p_duration: job.dur ?? null,
      })
      if (error) throw new Error(error.message)
      job.slot = { ...data, at: Date.now() }
      await unsent.put(job)
    }
    // a try that reached storage but lost the reply leaves the file there: carry on to finish
    await upload(job.blob, job.slot.path, onProgress).catch((e) => { if (!/Duplicate|409/.test(e.message)) throw e })
    const { error: e2 } = await sb.rpc('finish_upload', { p_id: job.slot.id })
    if (e2) throw new Error(e2.message)
    await unsent.del(job.id)
  } catch (e) {
    if (FATAL.test(e.message)) await unsent.del(job.id)
    throw e
  } finally {
    release()
  }
}
// what to tell the guest: closed / rate / fail
export const sendErr = (e) => (/closed/.test(e.message) ? 'upClosed' : /rate_limited/.test(e.message) ? 'upRate' : 'upFail')
export const newJob = (o) => ({ id: crypto.randomUUID(), at: Date.now(), ...o })

// QR scanners and social apps open links in their own browser, where the camera is often blocked
const UA = navigator.userAgent
export const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|musical_ly|Bytedance|Snapchat|Twitter|; wv\)/i.test(UA)
export const isAndroid = /Android/i.test(UA)
export const isIOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// Android only: hands this page to Chrome
export const chromeUrl = () => `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`

export const buzz = (ms = 30) => navigator.vibrate?.(ms) // no-op on iPhone
// the guest's name, typed once and offered again on the next video or photo
export const lastName = () => { try { return localStorage.getItem('sepatah-name') || '' } catch { return '' } }
export const keepName = (n) => { try { n && localStorage.setItem('sepatah-name', n) } catch {} }

export const isAdmin = async () => !!(await sb.rpc('is_admin')).data

// Public event by slug. state: loading | ok | missing | error (network); call load() to retry.
export function useEvent(slug, onLoad) {
  const ev = ref(null), state = ref('loading')
  async function load() {
    state.value = 'loading'
    const { data, error } = await sb.from('public_events').select().eq('slug', slug).maybeSingle()
    ev.value = data
    state.value = error ? 'error' : data ? 'ok' : 'missing'
    if (data) {
      applyTheme(data.theme)
      onLoad?.(data)
    }
  }
  load()
  return { ev, state, load }
}

// Camera stream bound to a <video> ref. Call stop() when leaving the screen.
export function camera() {
  const el = ref(null), ok = ref(true), err = ref(''), facing = ref('user')
  let stream = null, withAudio = false
  const stop = () => {
    stream?.getTracks().forEach((tr) => tr.stop())
    stream = null
  }
  async function open(audio = withAudio) {
    withAudio = audio
    stop()
    ok.value = true
    err.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing.value, height: { ideal: 720 } }, audio })
      if (el.value) el.value.srcObject = stream
    } catch (e) {
      ok.value = false
      err.value = e.name
    }
  }
  // front <-> back; facingMode is a hint, so single-camera laptops just reopen the same camera
  const flip = () => {
    facing.value = facing.value === 'user' ? 'environment' : 'user'
    open()
  }
  return { el, ok, err, open, stop, flip, facing, stream: () => stream }
}

export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
