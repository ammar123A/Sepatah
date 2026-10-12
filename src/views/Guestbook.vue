<script setup>
// QR guestbook: what guests open from the table card during the event.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useEvent, sendMedia, camera } from '../lib.js'
import { t, initLang, dateStr, timeStr, LangToggle } from '../i18n.js'
import Recorder from '../Recorder.vue'

const FR = [
  { p: 14, bg: '#FBF8F2', bd: '#D9D3C7', fg: '#1C221E', sub: '#5C635D' },
  { p: 14, bg: '#1F3A2D', bd: null, fg: '#EDE6D6', sub: '#B9C4BB' },
  { p: 22, bg: '#F2EDE3', bd: '#C4472D', fg: '#1C221E', sub: '#C4472D' },
]

const slug = useRoute().params.slug
const { ev, state, load } = useEvent(slug, (e) => initLang(e.default_lang))
const couple = computed(() => ev.value && `${ev.value.bride} & ${ev.value.groom}`)
const date = computed(() => ev.value && dateStr(ev.value.event_date))

// same rule as upload_open('event') on the server; ticks so the landing flips open/closed on its own
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(timer))
const phase = computed(() => !ev.value ? null
  : now.value < Date.parse(ev.value.window_start) ? 'before'
  : now.value > Date.parse(ev.value.window_end) ? 'after' : 'open')
const opensAt = computed(() => ev.value && `${dateStr(ev.value.window_start)}, ${timeStr(ev.value.window_start)}`)

const screen = ref('landing') // landing | video | done | photo
const go = (s) => (screen.value = s)
const doneKind = ref('video')

// ---- photo ----
const { el: camEl, ok: camOk, open: openCam, stop: stopCam } = camera()
watch(screen, (s) => (s === 'photo' ? openCam(false) : stopCam()), { flush: 'post' })
onBeforeUnmount(stopCam)

const frame = ref(0)
const sending = ref(false)
const err = ref('')

async function shoot() {
  const v = camEl.value
  if (!v?.videoWidth || sending.value) return
  await Promise.all([document.fonts.load('36px "Great Vibes"'), document.fonts.load('800 11px Nunito')])
  const k = 3, f = FR[frame.value], W = 326, camH = 320, camW = W - f.p * 2, H = f.p * 2 + camH + 84
  const c = document.createElement('canvas')
  c.width = W * k
  c.height = H * k
  const g = c.getContext('2d')
  g.scale(k, k)
  g.fillStyle = f.bg
  g.fillRect(0, 0, W, H)
  if (f.bd) { g.strokeStyle = f.bd; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1) }
  // cover-crop the video, mirrored like the preview
  const r = Math.max(camW / v.videoWidth, camH / v.videoHeight), sw = camW / r, sh = camH / r
  g.save()
  g.translate(f.p + camW, f.p)
  g.scale(-1, 1)
  g.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, camW, camH)
  g.restore()
  g.textAlign = 'center'
  g.fillStyle = f.fg
  // shrink long couple names to fit the caption
  let size = 36
  do g.font = `${size}px "Great Vibes", cursive`
  while (g.measureText(couple.value).width > W - 32 && --size > 16)
  g.fillText(couple.value, W / 2, f.p + camH + 44)
  g.fillStyle = f.sub
  g.font = '800 11px Nunito, sans-serif'
  g.letterSpacing = '1.8px'
  g.fillText(date.value.toUpperCase(), W / 2, f.p + camH + 68)
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))

  sending.value = true
  err.value = ''
  try {
    await sendMedia(blob, { slug, kind: 'photo' }, () => {})
    doneKind.value = 'photo'
    go('done')
  } catch {
    err.value = 'fail'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <Recorder v-if="screen === 'video'" :slug="slug" source="event" @back="go('landing')" @done="doneKind = 'video'; go('done')" />

  <div v-else class="shell">
    <div class="app">
      <header class="bar">
        <button v-if="screen === 'photo'" class="back" :aria-label="t('back')" @click="go('landing')">
          <svg class="ic"><use href="#i-back" /></svg>
        </button>
        <div v-else class="mark">Sepatah</div>
        <LangToggle />
      </header>

      <main v-if="state === 'loading'" class="screen" :aria-label="t('loading')">
        <div class="hero"><div class="skel" style="width: 200px; height: 150px"></div><div class="skel" style="width: 240px; height: 48px"></div></div>
        <div class="stack"><div class="skel" style="height: 60px"></div><div class="skel" style="height: 60px"></div></div>
      </main>

      <main v-else-if="state !== 'ok'" class="screen">
        <div class="state light">
          <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
          <h2>{{ t(state === 'error' ? 'loadFail' : 'notFound') }}</h2>
          <p>{{ t(state === 'error' ? 'loadFailSub' : 'notFoundSub') }}</p>
          <button v-if="state === 'error'" class="btn sm" @click="load">{{ t('retry') }}</button>
        </div>
      </main>

      <main v-else :key="screen" class="screen">
        <template v-if="screen === 'landing' && phase !== 'open'">
          <div class="hero">
            <div class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></div>
            <div class="orn"><i></i></div>
          </div>
          <div class="state light">
            <div class="badge"><svg class="ic"><use :href="phase === 'before' ? '#i-calendar' : '#i-check'" /></svg></div>
            <h2>{{ t(phase === 'before' ? 'notOpen' : 'closed') }}</h2>
            <p>{{ phase === 'before' ? t('notOpenSub', { when: opensAt }) : t('closedSub', { couple }) }}</p>
            <RouterLink v-if="phase === 'before'" :to="`/${slug}`" class="btn sm">{{ t('toInvite') }}</RouterLink>
          </div>
        </template>

        <template v-else-if="screen === 'landing'">
          <div class="hero">
            <div class="eyebrow">{{ t('eyebrow') }}</div>
            <div class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></div>
            <div class="orn"><i></i></div>
            <p class="lede">{{ t('lede') }}</p>
          </div>
          <div class="stack">
            <button class="btn primary two" @click="go('video')">
              <svg class="ic"><use href="#i-video" /></svg>
              <span><b>{{ t('btnVideo') }}</b><small>{{ t('btnVideoSub') }}</small></span>
            </button>
            <button class="btn outline" @click="go('photo')">
              <svg class="ic"><use href="#i-camera" /></svg>{{ t('btnPhoto') }}
            </button>
            <p class="hint">{{ t('foot') }}</p>
          </div>
        </template>

        <template v-else-if="screen === 'done'">
          <div class="hero">
            <div class="check"><svg class="ic"><use href="#i-check" /></svg></div>
            <h1 class="h1 xl">{{ t('thanks') }}</h1>
            <div class="orn"><i></i></div>
            <p class="lede">{{ doneKind === 'video' ? t('doneVideo', { couple }) : t('donePhoto') }}</p>
          </div>
          <div class="stack">
            <button class="btn primary" @click="go(doneKind === 'video' ? 'photo' : 'video')">{{ t(doneKind === 'video' ? 'nextPhoto' : 'nextVideo') }}</button>
            <button class="btn outline" @click="go('landing')">{{ t('back') }}</button>
          </div>
        </template>

        <template v-else-if="screen === 'photo'">
          <h1 class="h1 sm">{{ t('photoTitle') }}</h1>
          <div class="polaroid" :style="{ padding: FR[frame].p + 'px', background: FR[frame].bg, border: '1px solid ' + (FR[frame].bd || 'transparent') }">
            <div class="shot" :style="{ aspectRatio: 326 - FR[frame].p * 2 + ' / 320' }">
              <video ref="camEl" class="feed" autoplay muted playsinline v-show="camOk"></video>
              <div v-if="!camOk" class="state">
                <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
                <h2>{{ t('errTitle') }}</h2>
                <p>{{ t('errBody') }}</p>
                <button class="btn sm" @click="openCam(false)">{{ t('retry') }}</button>
              </div>
            </div>
            <div class="cap" :style="{ color: FR[frame].fg }"><div class="cn">{{ couple }}</div><div class="cd" :style="{ color: FR[frame].sub }">{{ date }}</div></div>
          </div>
          <div class="frames">
            <button v-for="(f, i) in FR" :key="i" class="thumb" :class="{ on: frame === i }" :aria-label="`${t('frame')} ${i + 1}`" :aria-pressed="frame === i" :style="{ background: f.bg }" @click="frame = i">
              <i :style="{ inset: f.p / 3 + 'px', bottom: f.p / 3 + 8 + 'px' }"></i>
            </button>
          </div>
          <div class="grow"></div>
          <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('upFail') }}</p>
          <button class="shutter" :disabled="!camOk || sending" :aria-label="t('shutter')" @click="shoot"><i></i></button>
          <p class="hint">{{ t('photoHint') }}</p>
        </template>
      </main>
    </div>
  </div>
</template>
