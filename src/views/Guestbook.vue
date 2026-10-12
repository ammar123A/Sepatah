<script setup>
// QR guestbook: what guests open from the table card during the event.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useEvent, sendMedia, camera, assetUrl } from '../lib.js'
import { t, initLang, dateStr, timeStr, LangToggle } from '../i18n.js'
import { LAYOUTS, resolve, frameStyles, compose } from '../themes.js'
import Recorder from '../Recorder.vue'

const slug = useRoute().params.slug
const { ev, state, load } = useEvent(slug, (e) => {
  initLang(e.default_lang)
  loadOverlays(e.theme)
})
const couple = computed(() => ev.value && `${ev.value.bride} & ${ev.value.groom}`)
const date = computed(() => ev.value && dateStr(ev.value.event_date))
const art = computed(() => ev.value?.theme?.art && assetUrl(ev.value.theme.art)) // the couple's own design
const kadMode = computed(() => ev.value?.theme?.art_mode === 'kad') // the image already has the names; otherwise it's a frame we write in

// same rule as upload_open('event') on the server; ticks so the landing flips open/closed on its own
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(timer))
const phase = computed(() => !ev.value ? null
  : now.value < Date.parse(ev.value.window_start) ? 'before'
  : now.value > Date.parse(ev.value.window_end) ? 'after' : 'open')
const opensAt = computed(() => ev.value && `${dateStr(ev.value.window_start)}, ${timeStr(ev.value.window_start)}`)

const screen = ref('landing') // landing | video | done | photo
const go = (s) => {
  dropShot()
  screen.value = s
}
const doneKind = ref('video')

// ---- photo: shoot (one, or three for a strip) → review → send ----
const { el: camEl, ok: camOk, open: openCam, stop: stopCam, flip, facing } = camera()
const shot = ref(null) // { blob, url, tall } waiting for the guest's OK
watch([screen, shot], ([s, p]) => (s === 'photo' && !p ? openCam(false) : stopCam()), { flush: 'post' })
onBeforeUnmount(() => { stopCam(); dropShot() })

const layout = ref('single') // single | strip

// The couple's frame PNGs. crossOrigin keeps the canvas exportable; one that fails to load just isn't offered.
const overlays = ref({})
function loadOverlays(th) {
  for (const [k, key] of [['single', 'frame'], ['strip', 'strip']]) {
    if (!th?.[key]) continue
    const img = Object.assign(new Image(), { crossOrigin: 'anonymous' })
    img.onload = () => (overlays.value = { ...overlays.value, [k]: img })
    img.src = assetUrl(th[key])
  }
}
// the couple's design comes first, so it's the default. A design not made from the template brings its own
// fitted layout (theme.frame_fit / strip_fit, set in admin); our colours fill its caption.
const styles = computed(() => {
  const r = resolve(ev.value?.theme), own = overlays.value[layout.value]
  const fit = ev.value?.theme?.[layout.value === 'single' ? 'frame_fit' : 'strip_fit']
  return [...(own ? [{ overlay: own, L: fit || null, bg: r.card, fg: r.deep, sub: r.mut }] : []), ...frameStyles(r)]
})
const frame = ref(0)
watch(layout, () => (frame.value = 0))
const style = computed(() => styles.value[frame.value] || styles.value[0])
const L = computed(() => style.value.L || LAYOUTS[layout.value])

// Live preview in layout pixels: the whole single frame, or one strip window with its side margin all round
const pct = (v, of) => (v / of) * 100 + '%'
const pv = computed(() => {
  const strip = layout.value === 'strip', [x, y, w, h] = L.value.wins[0]
  const box = { w: L.value.w, h: strip ? h + 2 * x : L.value.h }, top = strip ? x : y
  return { ...box, win: { left: pct(x, box.w), top: pct(top, box.h), width: pct(w, box.w), height: pct(h, box.h) } }
})

const sending = ref(false)
const err = ref('')
const running = ref(false)
const count = ref(0) // countdown digit over the camera (strip only)
const taken = ref(0) // strip shots so far
let run = 0 // bumped to cancel a strip in progress
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function dropShot() {
  run++
  running.value = false
  count.value = taken.value = 0
  if (shot.value) URL.revokeObjectURL(shot.value.url)
  shot.value = null
  err.value = ''
}

// one video frame, mirrored like the preview (selfie camera only)
function grab() {
  const v = camEl.value
  const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight })
  const g = c.getContext('2d')
  if (facing.value === 'user') {
    g.translate(c.width, 0)
    g.scale(-1, 1)
  }
  g.drawImage(v, 0, 0)
  return c
}

async function shoot() {
  if (!camEl.value?.videoWidth || shot.value || running.value) return
  const id = ++run, n = L.value.wins.length, shots = [], { font } = resolve(ev.value.theme)
  running.value = true
  const fonts = Promise.all([document.fonts.load(`80px "${font}"`), document.fonts.load('600 43px Figtree')])
  for (let i = 0; i < n; i++) {
    if (n > 1) {
      for (count.value = 3; count.value; count.value--) {
        await wait(1000)
        if (id !== run) return
      }
    }
    if (!camEl.value?.videoWidth) return dropShot() // camera dropped mid-strip
    shots.push(grab())
    if (n > 1) taken.value = shots.length
  }
  await fonts
  if (id !== run) return
  const c = compose(L.value, shots, style.value, { couple: couple.value, date: date.value, font })
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))
  if (id !== run) return
  running.value = false
  taken.value = 0
  shot.value = { blob, url: URL.createObjectURL(blob), tall: L.value.h > L.value.w * 1.5 }
}

async function send() {
  sending.value = true
  err.value = ''
  try {
    await sendMedia(shot.value.blob, { slug, kind: 'photo' }, () => {})
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
        <button v-if="screen === 'photo'" class="back" :aria-label="t('back')" :disabled="sending" @click="shot ? dropShot() : go('landing')">
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
          <div v-if="art" class="hero">
            <img v-if="kadMode" class="kad sm" :src="art" :alt="t('kadAlt', { couple })" />
            <div v-else class="framed sm">
              <img :src="art" alt="" />
              <div><div class="eyebrow">{{ t('eyebrow') }}</div><div class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></div></div>
            </div>
            <p class="lede">{{ t('lede') }}</p>
          </div>
          <div v-else class="hero arch">
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

        <template v-else-if="screen === 'photo' && shot">
          <h1 class="h1 sm">{{ t('photoReview') }}</h1>
          <img class="polaroid" :class="{ tall: shot.tall }" :src="shot.url" :alt="t('photoReview')" />
          <div class="grow"></div>
          <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('upFail') }}</p>
          <button class="btn primary" :disabled="sending" @click="send">
            {{ sending ? t('sending') : err ? t('retry') : t('sendPhoto') }}
          </button>
          <button class="linkbtn" :disabled="sending" @click="dropShot">{{ t('retakePhoto') }}</button>
        </template>

        <template v-else-if="screen === 'photo'">
          <h1 class="h1 sm">{{ t('photoTitle') }}</h1>
          <fieldset class="seg sm">
            <legend class="sr">{{ t('layout') }}</legend>
            <label v-for="k in ['single', 'strip']" :key="k"><input v-model="layout" type="radio" name="layout" :value="k" :disabled="running" />{{ t(k) }}</label>
          </fieldset>
          <div class="polaroid" :style="{ aspectRatio: `${pv.w} / ${pv.h}`, background: L.fill || style.bg || 'var(--card)', border: '1px solid ' + (style.bd || 'transparent') }">
            <img v-if="layout === 'single' && style.overlay && L.under" class="ovl" :src="style.overlay.src" alt="" />
            <div class="shot" :style="pv.win">
              <video ref="camEl" class="feed" :class="{ rear: facing !== 'user' }" autoplay muted playsinline v-show="camOk"></video>
              <button v-if="camOk" class="flip" :aria-label="t('flip')" @click="flip"><svg class="ic"><use href="#i-flip" /></svg></button>
              <div v-if="count" :key="count" class="cdown" aria-live="assertive">{{ count }}</div>
              <div v-if="!camOk" class="state">
                <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
                <h2>{{ t('errTitle') }}</h2>
                <p>{{ t('errBody') }}</p>
                <button class="btn sm" @click="openCam(false)">{{ t('retry') }}</button>
              </div>
            </div>
            <template v-if="layout === 'single'">
              <img v-if="style.overlay && !L.under" class="ovl" :src="style.overlay.src" alt="" />
              <div v-if="style.overlay ? L.own && L.cap : L.cap" class="cap" :style="{ top: pct(L.cap[0], L.h), color: style.fg }"><div class="cn">{{ couple }}</div><div class="cd" :style="{ color: style.sub }">{{ date }}</div></div>
            </template>
          </div>
          <div v-if="layout === 'strip'" class="dots" aria-hidden="true"><i v-for="i in 3" :key="i" :class="{ on: i <= taken }"></i></div>
          <div class="frames">
            <button v-for="(f, i) in styles" :key="i" class="thumb" :class="{ on: frame === i, own: f.overlay }" :aria-label="f.overlay ? t('theirFrame') : `${t('frame')} ${i + 1}`" :aria-pressed="frame === i" :disabled="running"
              :style="f.overlay ? { backgroundImage: `url(${f.overlay.src})` } : { background: f.bg }" @click="frame = i">
              <i v-if="!f.overlay"></i>
            </button>
          </div>
          <div class="grow"></div>
          <button class="shutter" :disabled="!camOk || running" :aria-label="t('shutter')" @click="shoot"><i></i></button>
          <p class="hint">{{ t(layout === 'strip' ? 'stripHint' : 'photoHint') }}</p>
        </template>
      </main>
    </div>
  </div>
</template>
