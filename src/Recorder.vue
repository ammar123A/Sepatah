<script setup>
// Video wish: record (30 s hard stop) → review → send. Used by the QR guestbook and the pre-event wish.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { pickMime, sendMedia, sendErr, newJob, camera, fmt, buzz, lastName, keepName } from './lib.js'
import { t, LangToggle } from './i18n.js'
import { resolve, bouquet, cover, recLayers, REC } from './themes.js'
import CamError from './CamError.vue'

const props = defineProps({ slug: String, source: { type: String, default: 'event' }, couple: String, art: String, artSize: Array, theme: Object })
const emit = defineEmits(['back', 'done'])

const MAX = 30
const C = 276.46 // ring circumference, r = 44
const showDebug = location.search.includes('debug') // format/bitrate panel for testing on real phones: add ?debug to the URL
const phase = ref('record') // record | review
const { el: camEl, ok: camOk, err: camErr, open: openCam, stop: stopCam, flip, facing, stream } = camera()

onMounted(() => { openCam(true); prepare() })
onBeforeUnmount(() => { countRun++; stopRec(); stopCam() })
watch(phase, (p) => (p === 'record' ? openCam(true) : stopCam()), { flush: 'post' })
const back = () => (phase.value === 'review' ? (phase.value = 'record') : emit('back'))
watch(phase, () => { countRun++; count.value = 0 }) // leaving the camera cancels a countdown

// ---- record ----
const rec = ref('idle')
const elapsed = ref(0)
const tooLong = ref(false)
const fileEl = ref(null)
const clip = ref(null)
let mr, chunks, t0, timer

// The wedding's design goes into the video too: the camera is drawn into the frame on a canvas and that canvas is recorded.
// Falls back to the plain camera if anything here fails (old browser, artwork blocked).
let layers = null, raf = 0, canvasTrack = null
const img = (src) => new Promise((ok, no) => Object.assign(new Image(), { crossOrigin: 'anonymous', onload() { ok(this) }, onerror: no, src }))
async function prepare() {
  try {
    const r = resolve(props.theme)
    const svg = bouquet(r).replace('<svg ', '<svg width="400" height="400" ') // canvas needs a pixel size
    const [art, sprig] = await Promise.all([
      props.art ? img(props.art).catch(() => null) : null,
      img('data:image/svg+xml,' + encodeURIComponent(svg)).catch(() => null),
      document.fonts.load(`56px "${r.font}"`),
      document.fonts.load('21px Figtree'),
    ])
    layers = recLayers(r, { couple: props.couple, label: t('wishFor'), art, sprig })
  } catch (e) {
    console.warn('video frame off', e)
  }
}
function recStream() {
  const cam = stream()
  if (!layers || !HTMLCanvasElement.prototype.captureStream) return cam
  const c = Object.assign(document.createElement('canvas'), REC), g = c.getContext('2d'), v = camEl.value, [x, y, w, h] = layers.win
  const draw = () => {
    g.drawImage(layers.bg, 0, 0)
    if (v.videoWidth) {
      g.save()
      layers.clip(g)
      g.clip()
      g.drawImage(v, ...cover(v.videoWidth, v.videoHeight, w, h), x, y, w, h)
      g.restore()
    }
    if (layers.top) g.drawImage(layers.top, 0, 0)
    raf = requestAnimationFrame(draw)
  }
  draw()
  canvasTrack = c.captureStream(30).getVideoTracks()[0]
  return new MediaStream([canvasTrack, ...cam.getAudioTracks()])
}
function endDraw() {
  cancelAnimationFrame(raf)
  canvasTrack?.stop()
  canvasTrack = null
}

function setClip(blob, dur, via) {
  if (clip.value) URL.revokeObjectURL(clip.value.url)
  clip.value = { blob, url: URL.createObjectURL(blob), dur, mime: blob.type, size: blob.size, via }
  job = null
  err.value = ''
  uploadError.value = ''
  phase.value = 'review'
}
function startRec() {
  tooLong.value = false
  try {
    chunks = []
    mr = new MediaRecorder(recStream(), { mimeType: pickMime() || undefined, videoBitsPerSecond: 1_500_000 })
  } catch (e) {
    endDraw()
    camOk.value = false
    camErr.value = e.name
    return
  }
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.onstop = () => {
    clearInterval(timer)
    endDraw()
    rec.value = 'idle'
    setClip(new Blob(chunks, { type: mr.mimeType }), Math.min(MAX, (Date.now() - t0) / 1000), 'browser recorder')
  }
  mr.start()
  buzz()
  t0 = Date.now()
  elapsed.value = 0
  rec.value = 'recording'
  timer = setInterval(() => {
    elapsed.value = Math.min(MAX, (Date.now() - t0) / 1000)
    if (elapsed.value >= MAX) stopRec() // hard stop at 30 s
  }, 100)
}
const stopRec = () => mr?.state === 'recording' && (buzz(), mr.stop())

// 3-2-1 before recording, so nobody is caught mid-breath; a tap during the count cancels it
const count = ref(0)
let countRun = 0
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function tapRec() {
  if (rec.value === 'recording') return stopRec()
  if (count.value) return (countRun++, (count.value = 0))
  const id = ++countRun
  for (count.value = 3; count.value; count.value--) {
    await wait(1000)
    if (id !== countRun) return
  }
  startRec()
}

// Native camera fallback: some in-app browsers block getUserMedia.
// Phone camera files run 30-65 MB for 30 s at 1080p (more at 4K), over the 50 MB bucket limit, so anything bigger
// than a 30 s recorder clip is played through a canvas and re-recorded at the recorder's bitrate (about 7 MB at most).
// That takes as long as the clip.
const SHRINK = 8e6
const LIMIT = 52428800 // the media bucket's file_size_limit
const shrinking = ref(null) // null, or progress 0..1
const tooBig = ref(false)
let alive = true
onBeforeUnmount(() => (alive = false))

const duration = (f) => new Promise((ok) => {
  const url = URL.createObjectURL(f), v = Object.assign(document.createElement('video'), { preload: 'metadata' })
  v.onloadedmetadata = v.onerror = () => (URL.revokeObjectURL(url), ok(v.duration || 0))
  v.src = url
})

async function onFile(e) {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f || shrinking.value !== null) return
  tooLong.value = tooBig.value = false
  const dur = await duration(f)
  if (dur > MAX + 1) return (tooLong.value = true)
  if (f.size <= SHRINK) return setClip(f, dur, 'phone camera')
  shrinking.value = 0
  // ponytail: leaving mid-shrink lets it run out in the background (≤30 s); pass an abort if that ever matters
  const small = await shrink(f, (p) => (shrinking.value = p)).catch((e) => (console.warn('shrink failed', e), null))
  shrinking.value = null
  if (!alive) return
  if (small) setClip(small, dur, 'phone camera, re-recorded')
  else if (f.size <= LIMIT) setClip(f, dur, 'phone camera')
  else tooBig.value = true
}

function shrink(file, onProgress) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file)
    const v = Object.assign(document.createElement('video'), { playsInline: true, src: url }) // unmuted, or the audio graph gets silence
    const ac = new AudioContext()
    let mr, raf, tracks = [], dog
    const end = (fn, x) => {
      clearTimeout(dog)
      cancelAnimationFrame(raf)
      v.pause()
      tracks.forEach((tr) => tr.stop())
      ac.close().catch(() => {})
      URL.revokeObjectURL(url)
      fn(x)
    }
    v.onerror = () => end(no, v.error)
    v.onloadedmetadata = async () => {
      try {
        // short side down to 720 px, like the live camera; even sizes for the encoder
        const k = Math.min(1, 720 / Math.min(v.videoWidth, v.videoHeight)), even = (n) => Math.round((n * k) / 2) * 2
        const c = Object.assign(document.createElement('canvas'), { width: even(v.videoWidth), height: even(v.videoHeight) })
        const g = c.getContext('2d'), out = ac.createMediaStreamDestination()
        ac.createMediaElementSource(v).connect(out) // into the recording only, never the speaker
        tracks = [c.captureStream(30).getVideoTracks()[0], ...out.stream.getAudioTracks()]
        const chunks = []
        mr = new MediaRecorder(new MediaStream(tracks), { mimeType: pickMime() || undefined, videoBitsPerSecond: 1_500_000 })
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
        mr.onstop = () => end(ok, new Blob(chunks, { type: mr.mimeType }))
        v.onended = () => mr.state === 'recording' && mr.stop()
        const draw = () => {
          g.drawImage(v, 0, 0, c.width, c.height)
          onProgress(Math.min(1, v.currentTime / v.duration))
          raf = requestAnimationFrame(draw)
        }
        await ac.resume()
        await v.play()
        draw()
        mr.start()
        // a phone that pauses the hidden video (locked screen) never reaches 'ended'
        dog = setTimeout(() => end(no, new Error('shrink stalled')), (v.duration + 15) * 1000)
      } catch (e) {
        end(no, e)
      }
    }
  })
}

// ---- review + send ----
const name = ref(lastName())
let job = null // one per clip, so a retry reuses its upload slot
const sending = ref(false)
const pct = ref(0)
const err = ref('')
const uploadError = ref('')

async function send() {
  sending.value = true
  err.value = ''
  pct.value = 0
  try {
    job ??= newJob({ slug: props.slug, kind: 'video', source: props.source, dur: clip.value.dur, blob: clip.value.blob })
    job.name = name.value.trim()
    keepName(job.name)
    await sendMedia(job, (p) => (pct.value = p))
    emit('done')
  } catch (e) {
    err.value = sendErr(e)
    uploadError.value = e.message
  } finally {
    sending.value = false
  }
}

const info = computed(() => JSON.stringify({
  secureContext: window.isSecureContext,
  via: clip.value?.via,
  mime: clip.value?.mime,
  sizeMB: clip.value && +(clip.value.size / 1e6).toFixed(2),
  seconds: clip.value && +clip.value.dur.toFixed(1),
  kbps: clip.value?.dur && Math.round((clip.value.size * 8) / clip.value.dur / 1000),
  uploadError: uploadError.value || undefined,
  ua: navigator.userAgent,
}, null, 2))
const copied = ref(false)
async function copyInfo() {
  await navigator.clipboard?.writeText(info.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
onBeforeUnmount(() => clip.value && URL.revokeObjectURL(clip.value.url))
</script>

<template>
  <div class="shell">
    <div class="app">
      <header class="bar">
        <button class="back" :aria-label="t('back')" :disabled="sending" @click="back">
          <svg class="ic"><use href="#i-back" /></svg>
        </button>
        <div v-if="phase === 'record'" class="pill">{{ fmt(elapsed) }} / {{ fmt(MAX) }}</div>
        <LangToggle />
      </header>

      <main :key="phase" class="screen" :class="{ tight: phase === 'review' }">
        <template v-if="phase === 'record'">
          <!-- the wedding's design around the camera: their names, then their own frame artwork around it, or else the arch and their bouquet -->
          <p v-if="couple" class="rec-head"><span>{{ t('wishFor') }}</span><b>{{ couple }}</b></p>
          <CamError v-if="!camOk" :err="camErr" :fallback="t('useCamApp')" @retry="openCam(true)" @fallback="fileEl.click()" />
          <!-- v-show, not v-if: the video element must stay so a retry can attach the camera to it -->
          <div v-show="camOk" class="cam-frame" :class="{ art }" :style="art && { '--art': `url(${art})`, '--ar': artSize ? artSize[0] / artSize[1] : .71 }">
          <div class="cam">
            <video ref="camEl" class="feed" :class="{ rear: facing !== 'user' }" autoplay muted playsinline v-show="camOk"></video>
            <!-- hidden while recording: swapping the stream would cut the recording -->
            <button v-if="camOk && rec !== 'recording'" class="flip" :aria-label="t('flip')" @click="flip"><svg class="ic"><use href="#i-flip" /></svg></button>
            <div v-if="count" :key="count" class="cdown" aria-live="assertive">{{ count }}</div>
            <div v-if="camOk && rec === 'recording'" class="cam-top"><i class="dot"></i>{{ t('rec') }}</div>
            <!-- hidden while recording, so it never sits over the guests' faces -->
            <div v-if="camOk && rec !== 'recording'" class="cam-bottom"><p class="prompt">{{ t('prompt') }}</p></div>
          </div>
          </div>
          <p v-if="tooLong" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('tooLong') }}</p>
          <p v-if="tooBig" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('tooBig') }}</p>
          <template v-if="shrinking !== null">
            <div class="progress"><i :style="{ width: shrinking * 100 + '%' }"></i></div>
            <p class="hint" aria-live="polite">{{ t('shrinking') }} {{ Math.round(shrinking * 100) }}%. {{ t('keepOpen') }}</p>
          </template>
          <div v-if="camOk" class="rec-wrap">
            <button class="recbtn" :aria-label="rec === 'recording' ? t('stop') : t('start')" @click="tapRec">
              <svg class="ring" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" class="track" />
                <circle cx="48" cy="48" r="44" class="prog" :style="{ strokeDashoffset: C * (1 - elapsed / MAX) }" />
              </svg>
              <i class="core" :class="{ stop: rec === 'recording' }"></i>
            </button>
            <p class="hint dim">{{ rec === 'recording' || count ? '' : t('tap') }}</p>
            <button class="linkbtn" @click="fileEl.click()">{{ t('phoneCam') }}</button>
          </div>
          <input ref="fileEl" type="file" accept="video/*" capture="user" hidden @change="onFile" />
        </template>

        <template v-else-if="clip">
          <h1 class="h1 sm">{{ t('reviewTitle') }}</h1>
          <video class="preview" :src="clip.url" controls playsinline></video>
          <label class="field">
            <span>{{ t('nameLabel') }} <em>{{ t('optional') }}</em></span>
            <input v-model="name" type="text" :placeholder="t('ph')" autocomplete="name" maxlength="60" />
          </label>
          <p class="hint left">{{ t('consent') }}</p>
          <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t(err) }}</p>
          <div v-if="sending" class="progress"><i :style="{ width: pct * 100 + '%' }"></i></div>
          <p v-if="sending" class="hint">{{ t('keepOpen') }}</p>
          <details v-if="showDebug" class="debug">
            <summary>{{ t('debug') }}</summary>
            <pre>{{ info }}</pre>
            <button class="btn sm" @click="copyInfo">{{ copied ? t('copied') : t('copy') }}</button>
          </details>
          <div class="grow"></div>
          <button class="btn primary" :disabled="sending || err === 'upClosed'" @click="send">
            {{ sending ? `${t('sending')} ${Math.round(pct * 100)}%` : err && err !== 'upClosed' ? t('retry') : t('send') }}
          </button>
          <button class="linkbtn" :disabled="sending" @click="phase = 'record'">{{ t('retake') }}</button>
        </template>
      </main>
    </div>
  </div>
</template>
