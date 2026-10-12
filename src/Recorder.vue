<script setup>
// Video wish: record (30 s hard stop) → review → send. Used by the QR guestbook and the pre-event wish.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { pickMime, sendMedia, camera, fmt } from './lib.js'
import { t, LangToggle } from './i18n.js'

const props = defineProps({ slug: String, source: { type: String, default: 'event' } })
const emit = defineEmits(['back', 'done'])

const MAX = 30
const C = 276.46 // ring circumference, r = 44
const phase = ref('record') // record | review
const { el: camEl, ok: camOk, err: camErr, open: openCam, stop: stopCam, flip, facing, stream } = camera()

onMounted(() => openCam(true))
onBeforeUnmount(() => { stopRec(); stopCam() })
watch(phase, (p) => (p === 'record' ? openCam(true) : stopCam()), { flush: 'post' })
const back = () => (phase.value === 'review' ? (phase.value = 'record') : emit('back'))

// ---- record ----
const rec = ref('idle')
const elapsed = ref(0)
const tooLong = ref(false)
const fileEl = ref(null)
const clip = ref(null)
let mr, chunks, t0, timer

function setClip(blob, dur, via) {
  if (clip.value) URL.revokeObjectURL(clip.value.url)
  clip.value = { blob, url: URL.createObjectURL(blob), dur, mime: blob.type, size: blob.size, via }
  err.value = ''
  uploadError.value = ''
  phase.value = 'review'
}
function startRec() {
  tooLong.value = false
  try {
    chunks = []
    mr = new MediaRecorder(stream(), { mimeType: pickMime() || undefined, videoBitsPerSecond: 2_500_000 })
  } catch (e) {
    camOk.value = false
    camErr.value = e.name
    return
  }
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.onstop = () => {
    clearInterval(timer)
    rec.value = 'idle'
    setClip(new Blob(chunks, { type: mr.mimeType }), Math.min(MAX, (Date.now() - t0) / 1000), 'browser recorder')
  }
  mr.start()
  t0 = Date.now()
  elapsed.value = 0
  rec.value = 'recording'
  timer = setInterval(() => {
    elapsed.value = Math.min(MAX, (Date.now() - t0) / 1000)
    if (elapsed.value >= MAX) stopRec() // hard stop at 30 s
  }, 100)
}
const stopRec = () => mr?.state === 'recording' && mr.stop()

// Native camera fallback: some in-app browsers block getUserMedia
function onFile(e) {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  const url = URL.createObjectURL(f)
  const v = document.createElement('video')
  v.preload = 'metadata'
  const done = () => {
    URL.revokeObjectURL(url)
    if (v.duration > MAX + 1) tooLong.value = true
    else setClip(f, v.duration || 0, 'phone camera')
  }
  v.onloadedmetadata = done
  v.onerror = done
  v.src = url
}

// ---- review + send ----
const name = ref('')
const sending = ref(false)
const pct = ref(0)
const err = ref('')
const uploadError = ref('')

async function send() {
  sending.value = true
  err.value = ''
  pct.value = 0
  try {
    await sendMedia(clip.value.blob, { slug: props.slug, kind: 'video', source: props.source, name: name.value.trim(), dur: clip.value.dur }, (p) => (pct.value = p))
    emit('done')
  } catch (e) {
    err.value = 'fail'
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
  <div class="shell" :class="{ dark: phase === 'record' }">
    <div class="app">
      <header class="bar">
        <button class="back" :aria-label="t('back')" :disabled="sending" @click="back">
          <svg class="ic"><use href="#i-back" /></svg>
        </button>
        <div v-if="phase === 'record'" class="pill">{{ fmt(elapsed) }} / {{ fmt(MAX) }}</div>
        <LangToggle />
      </header>

      <main :key="phase" class="screen">
        <template v-if="phase === 'record'">
          <div class="cam">
            <video ref="camEl" class="feed" :class="{ rear: facing !== 'user' }" autoplay muted playsinline v-show="camOk"></video>
            <!-- hidden while recording: swapping the stream would cut the recording -->
            <button v-if="camOk && rec !== 'recording'" class="flip" :aria-label="t('flip')" @click="flip"><svg class="ic"><use href="#i-flip" /></svg></button>
            <div v-if="!camOk" class="state">
              <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
              <h2>{{ t('errTitle') }}</h2>
              <p>{{ t('errBody') }}</p>
              <button class="btn sm" @click="openCam(true)">{{ t('retry') }}</button>
            </div>
            <div v-if="camOk && rec === 'recording'" class="cam-top"><i class="dot"></i>{{ t('rec') }}</div>
            <div v-if="camOk" class="cam-bottom"><p class="prompt">{{ t('prompt') }}</p></div>
          </div>
          <p v-if="tooLong" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('tooLong') }}</p>
          <div class="rec-wrap">
            <button class="recbtn" :disabled="!camOk" :aria-label="rec === 'recording' ? t('stop') : t('start')" @click="rec === 'recording' ? stopRec() : startRec()">
              <svg class="ring" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="44" class="track" />
                <circle cx="48" cy="48" r="44" class="prog" :style="{ strokeDashoffset: C * (1 - elapsed / MAX) }" />
              </svg>
              <i class="core" :class="{ stop: rec === 'recording' }"></i>
            </button>
            <p class="hint dim">{{ rec === 'recording' ? '' : t('tap') }}</p>
            <button class="linkbtn" @click="fileEl.click()">{{ t('phoneCam') }}</button>
            <input ref="fileEl" type="file" accept="video/*" capture="user" hidden @change="onFile" />
          </div>
        </template>

        <template v-else-if="clip">
          <h1 class="h1">{{ t('reviewTitle') }}</h1>
          <video class="preview" :src="clip.url" controls playsinline></video>
          <label class="field">
            <span>{{ t('nameLabel') }} <em>{{ t('optional') }}</em></span>
            <input v-model="name" type="text" :placeholder="t('ph')" autocomplete="name" maxlength="60" />
          </label>
          <p class="hint left">{{ t('consent') }}</p>
          <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('upFail') }}</p>
          <div v-if="sending" class="progress"><i :style="{ width: pct * 100 + '%' }"></i></div>
          <details class="debug">
            <summary>{{ t('debug') }}</summary>
            <pre>{{ info }}</pre>
            <button class="btn sm" @click="copyInfo">{{ copied ? t('copied') : t('copy') }}</button>
          </details>
          <div class="grow"></div>
          <button class="btn primary" :disabled="sending" @click="send">
            {{ sending ? `${t('sending')} ${Math.round(pct * 100)}%` : err ? t('retry') : t('send') }}
          </button>
          <button class="linkbtn" :disabled="sending" @click="phase = 'record'">{{ t('retake') }}</button>
        </template>
      </main>
    </div>
  </div>
</template>
