<script setup>
// QR guestbook: what guests open from the table card during the event.
import { ref, shallowRef, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useEvent, sendMedia, camera, assetUrl } from '../lib.js'
import { t, initLang, dateStr, timeStr, LangToggle } from '../i18n.js'
import { LAYOUTS, resolve, frameStyles, compose, kadBox } from '../themes.js'
import Recorder from '../Recorder.vue'

const slug = useRoute().params.slug
const { ev, state, load } = useEvent(slug, (e) => {
  initLang(e.default_lang)
  document.title = `${e.bride} & ${e.groom} | Sepatah`
  loadOverlays(e.theme)
})
const couple = computed(() => ev.value && `${ev.value.bride} & ${ev.value.groom}`)
const date = computed(() => ev.value && dateStr(ev.value.event_date))
const art = computed(() => ev.value?.theme?.art && assetUrl(ev.value.theme.art)) // the couple's own design
const artSize = computed(() => ev.value?.theme?.art_size || null)
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

// ---- photo: shoot one → review → send. A strip: each of the three is shot (or picked) and checked on its own, then the whole strip is reviewed ----
const { el: camEl, ok: camOk, open: openCam, stop: stopCam, flip, facing } = camera()
const shot = ref(null) // { blob, url, tall } waiting for the guest's OK
watch([screen, shot], ([s, p]) => (s === 'photo' && !p ? openCam(false) : stopCam()), { flush: 'post' })
onBeforeUnmount(() => { stopCam(); dropShot() })

const layout = ref('single') // single | strip
const galEl = ref(null)
const logo = Object.assign(new Image(), { src: '/favicon.svg' }) // printed on strips

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
const strip = computed(() => L.value.wins.length > 1)
const picked = shallowRef([]) // strip photos the guest has OK'd (canvases / bitmaps: shallow, so Vue never proxies them)
const pending = shallowRef(null) // { src, url }: the strip photo on screen waiting for OK / retake
const busy = computed(() => running.value || !!pending.value || picked.value.length > 0) // layout and frame are locked mid-strip
let run = 0 // bumped to cancel a strip in progress
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function dropShot() {
  run++
  running.value = false
  count.value = 0
  dropPending()
  picked.value = []
  if (shot.value) URL.revokeObjectURL(shot.value.url)
  shot.value = null
  err.value = ''
}
function dropPending() {
  if (pending.value) URL.revokeObjectURL(pending.value.url) // no-op for the camera's data: URL
  pending.value = null
}
// photo OK'd: next one, or the finished strip once all windows are filled
function accept() {
  picked.value = [...picked.value, pending.value.src]
  dropPending()
  if (picked.value.length < L.value.wins.length) return
  const { font } = resolve(ev.value.theme)
  running.value = true
  finish(++run, picked.value, loadFonts(font), font)
}
const back = () => (pending.value ? dropPending() : shot.value || picked.value.length ? dropShot() : go('landing'))

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

const loadFonts = (font) => Promise.all([document.fonts.load(`80px "${font}"`), document.fonts.load('600 43px Figtree'), document.fonts.load('400 30px "Young Serif"'), logo.decode().catch(() => {})])

async function shoot() {
  if (!camEl.value?.videoWidth || shot.value || pending.value || running.value) return
  const id = ++run, { font } = resolve(ev.value.theme)
  running.value = true
  if (!strip.value) return finish(id, [grab()], loadFonts(font), font)
  for (count.value = 3; count.value; count.value--) {
    await wait(1000)
    if (id !== run) return
  }
  if (!camEl.value?.videoWidth) return dropShot() // camera dropped mid-strip
  const c = grab()
  running.value = false
  pending.value = { src: c, url: c.toDataURL('image/jpeg', 0.85) }
}

// gallery pick: the single photo, or the strip's current photo (checked like a camera shot)
async function pick(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file || shot.value || pending.value || running.value) return
  const id = ++run, { font } = resolve(ev.value.theme)
  running.value = true
  err.value = ''
  try {
    const bmp = await createImageBitmap(file)
    if (id !== run) return
    if (!strip.value) return await finish(id, [bmp], loadFonts(font), font)
    running.value = false
    pending.value = { src: bmp, url: URL.createObjectURL(file) }
  } catch {
    if (id !== run) return
    running.value = false
    err.value = 'pick'
  }
}

async function finish(id, shots, fonts, font) {
  const n = shots.length
  await fonts
  if (id !== run) return
  // a logo that failed to load is left off rather than blocking the photo
  const c = compose(L.value, shots, style.value, { couple: couple.value, date: date.value, font, logo: n > 1 && logo.naturalWidth ? logo : null })
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))
  if (id !== run) return
  running.value = false
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
  <Recorder v-if="screen === 'video'" :slug="slug" source="event" :couple="couple" :art="kadMode ? null : art" :art-size="artSize" :theme="ev?.theme" @back="go('landing')" @done="doneKind = 'video'; go('done')" />

  <div v-else class="shell">
    <div class="app">
      <header class="bar">
        <button v-if="screen === 'photo'" class="back" :aria-label="t('back')" :disabled="sending" @click="back">
          <svg class="ic"><use href="#i-back" /></svg>
        </button>
        <div v-else class="mark sm quiet">Sepatah</div>
        <h1 v-if="screen === 'photo' && !shot && state === 'ok'" class="bar-title">{{ t('photoTitle') }}</h1>
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

      <main v-else :key="screen" class="screen" :class="{ tight: screen === 'photo' }">
        <template v-if="screen === 'landing' && phase !== 'open'">
          <div class="hero">
            <h1 class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></h1>
            <div class="orn"><i></i></div>
          </div>
          <div class="state light">
            <div class="badge"><svg class="ic"><use :href="phase === 'before' ? '#i-calendar' : '#i-check'" /></svg></div>
            <h2>{{ t(phase === 'before' ? 'notOpen' : 'closed') }}</h2>
            <p>{{ phase === 'before' ? t(ev.rsvp !== false ? 'notOpenSub' : 'notOpenSubSolo', { when: opensAt }) : t('closedSub', { couple }) }}</p>
            <RouterLink v-if="phase === 'before' && ev.rsvp !== false":to="`/${slug}`" class="btn sm">{{ t('toInvite') }}</RouterLink>
          </div>
        </template>

        <template v-else-if="screen === 'landing'">
          <div v-if="art" class="hero">
            <template v-if="kadMode"><h1 class="sr">{{ couple }}</h1><img class="kad sm" :src="art" :style="kadBox(artSize, 40)" :alt="t('kadAlt', { couple })" /></template>
            <div v-else class="framed sm" :style="artSize && { '--ar': artSize[0] / artSize[1] }">
              <img :src="art" :width="artSize?.[0]" :height="artSize?.[1]" alt="" />
              <div><div class="eyebrow">{{ t('eyebrow') }}</div><h1 class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></h1></div>
            </div>
            <p class="lede">{{ t('lede') }}</p>
          </div>
          <div v-else class="hero arch">
            <div class="eyebrow">{{ t('eyebrow') }}</div>
            <h1 class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></h1>
            <div class="orn"><i></i></div>
            <p class="lede">{{ t('lede') }}</p>
          </div>
          <div class="stack">
            <button class="btn primary two" @click="go('video')">
              <svg class="ic"><use href="#i-video" /></svg>
              <span><b>{{ t('btnVideo') }}</b><small>{{ t('btnVideoSub') }}</small></span>
            </button>
            <button class="btn" @click="go('photo')">
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
            <button class="btn" @click="go('landing')">{{ t('back') }}</button>
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
          <button class="linkbtn" :disabled="sending" @click="dropShot">{{ t(picked.length ? 'startOver' : 'retakePhoto') }}</button>
        </template>

        <template v-else-if="screen === 'photo'">
          <fieldset class="seg sm">
            <legend class="sr">{{ t('layout') }}</legend>
            <label v-for="k in ['single', 'strip']" :key="k"><input v-model="layout" type="radio" name="layout" :value="k" :disabled="busy" />{{ t(k) }}</label>
          </fieldset>
          <div class="polaroid live" :class="{ strip }" :style="{ aspectRatio: `${pv.w} / ${pv.h}`, '--ar': pv.w / pv.h, background: L.fill || style.bg || 'var(--card)', border: '1px solid ' + (style.bd || 'transparent') }">
            <img v-if="layout === 'single' && style.overlay && L.under" class="ovl" :src="style.overlay.src" alt="" />
            <div class="shot" :style="pv.win">
              <video ref="camEl" class="feed" :class="{ rear: facing !== 'user' }" autoplay muted playsinline v-show="camOk && !pending"></video>
              <!-- already mirrored by grab(), so never flipped again -->
              <img v-if="pending" class="feed rear" :src="pending.url" :alt="t('stripStep', { n: picked.length + 1 })" />
              <button v-if="camOk && !pending" class="flip" :aria-label="t('flip')" @click="flip"><svg class="ic"><use href="#i-flip" /></svg></button>
              <div v-if="count" :key="count" class="cdown" aria-live="assertive">{{ count }}</div>
              <div v-if="!camOk && !pending" class="state">
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
          <div v-if="strip" class="steps">
            <div class="dots" aria-hidden="true"><i v-for="i in 3" :key="i" :class="{ on: i <= picked.length }"></i></div>
            <span>{{ t('stripStep', { n: picked.length + 1 }) }}</span>
          </div>
          <div class="frames">
            <button v-for="(f, i) in styles" :key="i" class="thumb" :class="{ on: frame === i, own: f.overlay }" :aria-label="f.overlay ? t('theirFrame') : `${t('frame')} ${i + 1}`" :aria-pressed="frame === i" :disabled="busy"
              :style="f.overlay ? { backgroundImage: `url(${f.overlay.src})` } : { background: f.bg }" @click="frame = i">
              <i v-if="!f.overlay"></i>
            </button>
          </div>
          <div class="grow"></div>
          <template v-if="pending">
            <button class="btn primary" @click="accept">{{ t(picked.length === 2 ? 'useLast' : 'usePhoto') }}</button>
            <button class="linkbtn" @click="dropPending">{{ t('retakePhoto') }}</button>
          </template>
          <template v-else>
            <!-- gallery beside the shutter, not under it, so both stay on a short screen -->
            <div class="shoot">
              <button class="linkbtn gal-btn" :disabled="running" @click="galEl.click()"><svg class="ic"><use href="#i-image" /></svg>{{ t(strip ? 'fromGalleryStrip' : 'fromGallery') }}</button>
              <button class="shutter" :disabled="!camOk || running" :aria-label="t('shutter')" @click="shoot"><i></i></button>
            </div>
            <p class="hint">{{ t(strip ? 'stripHint' : 'photoHint') }}</p>
            <p v-if="err === 'pick'" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('pickFail') }}</p>
          </template>
          <input ref="galEl" type="file" accept="image/*" hidden @change="pick" />
        </template>
      </main>
    </div>
  </div>
</template>
