import { ref } from 'vue'
import { createClient } from '@supabase/supabase-js'

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

// Reserve a slot (server checks window + rate limit), upload the file, then mark it live.
export async function sendMedia(blob, { slug, kind, source = 'event', name, dur }, onProgress) {
  const { data: slot, error } = await sb.rpc('start_upload', {
    p_slug: slug, p_kind: kind, p_source: source, p_ext: extOf(blob.type),
    p_name: name || '', p_device: device, p_duration: dur ?? null,
  })
  if (error) throw new Error(error.message)
  await upload(blob, slot.path, onProgress)
  const { error: e2 } = await sb.rpc('finish_upload', { p_id: slot.id })
  if (e2) throw new Error(e2.message)
}

export const isAdmin = async () => !!(await sb.rpc('is_admin')).data

// Public event by slug. state: loading | ok | missing | error (network); call load() to retry.
export function useEvent(slug, onLoad) {
  const ev = ref(null), state = ref('loading')
  async function load() {
    state.value = 'loading'
    const { data, error } = await sb.from('public_events').select().eq('slug', slug).maybeSingle()
    ev.value = data
    state.value = error ? 'error' : data ? 'ok' : 'missing'
    if (data) onLoad?.(data)
  }
  load()
  return { ev, state, load }
}

// Camera stream bound to a <video> ref. Call stop() when leaving the screen.
export function camera() {
  const el = ref(null), ok = ref(true), err = ref('')
  let stream = null
  const stop = () => {
    stream?.getTracks().forEach((tr) => tr.stop())
    stream = null
  }
  async function open(audio) {
    stop()
    ok.value = true
    err.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', height: { ideal: 720 } }, audio })
      if (el.value) el.value.srcObject = stream
    } catch (e) {
      ok.value = false
      err.value = e.name
    }
  }
  return { el, ok, err, open, stop, stream: () => stream }
}

export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
