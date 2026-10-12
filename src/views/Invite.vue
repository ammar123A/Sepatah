<script setup>
// Invitation: "Buka Undangan" cover → details, countdown, RSVP → optional pre-event video wish.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { sb, assetUrl, useEvent } from '../lib.js'
import { t, initLang, dateStr, timeStr, LangToggle } from '../i18n.js'
import { ics, intl, left } from '../invite.js'
import Recorder from '../Recorder.vue'

const UNITS = ['days', 'hours', 'mins', 'secs']

const slug = useRoute().params.slug
const { ev, state, load } = useEvent(slug, (e) => initLang(e.default_lang))
const couple = computed(() => ev.value && `${ev.value.bride} & ${ev.value.groom}`)
const c = computed(() => ev.value?.content || {})

const screen = ref('cover') // cover | main | wish | done
function go(s) {
  screen.value = s
  window.scrollTo(0, 0)
}
function backToRsvp() {
  go('main')
  nextTick(() => document.getElementById('rsvp')?.scrollIntoView())
}

// ---- when + where ----
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 1000)
const target = computed(() => ev.value && new Date(ev.value.starts_at || ev.value.event_date + 'T00:00+08:00').getTime())
const time = computed(() => ev.value?.starts_at && timeStr(ev.value.starts_at) + (ev.value.ends_at ? ` – ${timeStr(ev.value.ends_at)}` : ''))
const q = computed(() => encodeURIComponent(ev.value?.address || ev.value?.venue || ''))
const pin = computed(() => c.value.lat != null && `${c.value.lat},${c.value.lng}`) // map pin beats address text for directions
const calHref = computed(() => 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics(ev.value, t('icsTitle', { couple: couple.value }), location.href)))
// same rule as upload_open('pre') on the server
const preOpen = computed(() => ev.value && now.value < Date.parse(ev.value.window_start))

// ---- RSVP ----
const KEY = `sepatah-rsvp-${slug}`
const rsvpDone = ref((() => { try { return !!localStorage.getItem(KEY) } catch { return false } })())
const r = ref({ name: '', attending: null, guests: 1, message: '' })
const busy = ref(false)
const err = ref(false)

async function rsvp() {
  busy.value = true
  err.value = false
  const { error } = await sb.rpc('submit_rsvp', { p_slug: slug, p_name: r.value.name, p_attending: r.value.attending, p_guests: r.value.guests, p_message: r.value.message })
  busy.value = false
  if (error) return (err.value = true)
  rsvpDone.value = true
  try { localStorage.setItem(KEY, '1') } catch {}
}

// ---- envelope: seal → flap → card slides out → main. Timings match the CSS transition delays ----
const opening = ref(false)
const leaving = ref(false)
const initials = computed(() => ev.value && `${ev.value.bride[0]}${ev.value.groom[0]}`)

const pad = (n) => String(n).padStart(2, '0')

// ---- music: browsers only allow play() after a tap, which opening the envelope is ----
let audio = null
const playing = ref(false)
function openInvite() {
  if (opening.value) return
  opening.value = true
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1300
  setTimeout(() => (leaving.value = true), ms)
  setTimeout(() => go('main'), ms && ms + 350)
  if (!c.value.music_path) return
  audio = new Audio(assetUrl(c.value.music_path))
  audio.loop = true
  audio.onplay = () => (playing.value = true)
  audio.onpause = () => (playing.value = false)
  audio.play().catch(() => {})
}
const toggleMusic = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause())
const onHide = () => document.hidden && audio?.pause()
document.addEventListener('visibilitychange', onHide)
watch(screen, (s) => s === 'wish' && audio?.pause()) // or the recorder picks it up

onBeforeUnmount(() => {
  clearInterval(timer)
  audio?.pause()
  document.removeEventListener('visibilitychange', onHide)
})
</script>

<template>
  <Recorder v-if="screen === 'wish'" :slug="slug" source="pre" @back="backToRsvp" @done="go('done')" />

  <div v-else class="shell">
    <div class="app">
      <header class="bar">
        <div class="mark">Sepatah</div>
        <div class="row">
          <button v-if="screen !== 'cover' && c.music_path" class="back" :aria-label="t('music')" :aria-pressed="playing" @click="toggleMusic">
            <svg class="ic"><use href="#i-music" /></svg>
          </button>
          <LangToggle />
        </div>
      </header>

      <main v-if="state === 'loading'" class="screen" :aria-label="t('loading')">
        <div class="hero"><div class="skel" style="width: 200px; height: 150px"></div><div class="skel" style="width: 160px; height: 20px"></div></div>
        <div class="skel" style="height: 60px"></div>
      </main>

      <main v-else-if="state !== 'ok'" class="screen">
        <div class="state light">
          <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
          <h2>{{ t(state === 'error' ? 'loadFail' : 'notFound') }}</h2>
          <p>{{ t(state === 'error' ? 'loadFailSub' : 'notFoundSub') }}</p>
          <button v-if="state === 'error'" class="btn sm" @click="load">{{ t('retry') }}</button>
        </div>
      </main>

      <main v-else-if="screen === 'cover'" class="screen cover" :class="{ out: leaving }">
        <div class="eyebrow">{{ t('coverTo') }}</div>
        <button class="env" :class="{ open: opening }" :aria-label="t('open')" @click="openInvite">
          <span class="env-back"></span>
          <span class="env-card">
            <small>{{ t('inviteEyebrow') }}</small>
            <b>{{ ev.bride }} <i>&amp;</i> {{ ev.groom }}</b>
            <small>{{ dateStr(ev.event_date) }}</small>
          </span>
          <span class="env-front"></span>
          <span class="env-flap"></span>
          <span class="seal">{{ initials }}</span>
        </button>
        <p class="hint tap">{{ t('tapOpen') }}</p>
      </main>

      <main v-else-if="screen === 'done'" class="screen">
        <div class="hero">
          <div class="check"><svg class="ic"><use href="#i-check" /></svg></div>
          <h1 class="h1 xl">{{ t('thanks') }}</h1>
          <div class="orn"><i></i></div>
          <p class="lede">{{ t('donePre', { couple }) }}</p>
        </div>
        <button class="btn primary" @click="backToRsvp">{{ t('backInvite') }}</button>
      </main>

      <main v-else class="screen invite">
        <div class="hero arch">
          <div class="eyebrow">{{ t('inviteEyebrow') }}</div>
          <p v-if="c.hosts" class="txt" style="white-space: pre-line"><b>{{ c.hosts }}</b></p>
          <p v-if="c.hosts" class="lede">{{ t('inviteIntro') }}</p>
          <div class="names"><span>{{ ev.bride }}</span><span class="amp">&amp;</span><span>{{ ev.groom }}</span></div>
          <div class="orn"></div>
          <p class="lede">{{ dateStr(ev.event_date) }}</p>
        </div>

        <div v-if="target > now" class="count">
          <div v-for="(n, i) in left(target, now)" :key="i">
            <span class="roll"><Transition name="roll"><b :key="n">{{ pad(n) }}</b></Transition></span>
            <small>{{ t(UNITS[i]) }}</small>
          </div>
        </div>

        <section class="sec">
          <h2>{{ t('whenWhere') }}</h2>
          <p class="big">{{ dateStr(ev.event_date) }}<template v-if="time"><br />{{ time }}</template></p>
          <p v-if="ev.venue || ev.address" class="txt" style="white-space: pre-line"><b v-if="ev.venue">{{ ev.venue }}</b>{{ ev.venue && ev.address ? '\n' : '' }}{{ ev.address }}</p>
          <div v-if="pin || q" class="duo">
            <a class="btn sm" :href="`https://www.google.com/maps/search/?api=1&query=${pin || q}`" target="_blank" rel="noopener"><svg class="ic sm"><use href="#i-pin" /></svg>Google Maps</a>
            <a class="btn sm" :href="`https://waze.com/ul?${pin ? `ll=${pin}` : `q=${q}`}&navigate=yes`" target="_blank" rel="noopener"><svg class="ic sm"><use href="#i-pin" /></svg>Waze</a>
          </div>
          <!-- ponytail: data: URL download; check on a real iPhone that it offers "Add to Calendar" -->
          <a class="btn sm" :href="calHref" :download="`${slug}.ics`"><svg class="ic sm"><use href="#i-calendar" /></svg>{{ t('addCal') }}</a>
        </section>

        <section v-if="c.aturcara?.length" class="sec">
          <h2>{{ t('agenda') }}</h2>
          <dl class="agenda">
            <template v-for="(a, i) in c.aturcara" :key="i"><dt>{{ a.time }}</dt><dd>{{ a.item }}</dd></template>
          </dl>
        </section>

        <section id="rsvp" class="sec">
          <h2>{{ t('rsvp') }}</h2>
          <template v-if="rsvpDone">
            <p class="txt">{{ t('rsvpDone') }}</p>
            <button v-if="preOpen" class="btn primary two" @click="go('wish')">
              <svg class="ic"><use href="#i-video" /></svg>
              <span><b>{{ t('btnVideo') }}</b><small>{{ t('btnVideoSub') }}</small></span>
            </button>
          </template>
          <form v-else class="stack" @submit.prevent="rsvp">
            <label class="field">
              <span>{{ t('nameLabel') }}</span>
              <input v-model="r.name" type="text" required maxlength="80" autocomplete="name" :placeholder="t('ph')" />
            </label>
            <fieldset class="seg">
              <legend class="sr">{{ t('rsvp') }}</legend>
              <label><input v-model="r.attending" type="radio" name="attending" :value="true" required />{{ t('yes') }}</label>
              <label><input v-model="r.attending" type="radio" name="attending" :value="false" />{{ t('no') }}</label>
            </fieldset>
            <label v-if="r.attending" class="field">
              <span>{{ t('guests') }}</span>
              <input v-model.number="r.guests" type="number" inputmode="numeric" min="1" max="20" required />
            </label>
            <label class="field">
              <span>{{ t('message') }} <em>{{ t('optional') }}</em></span>
              <textarea v-model="r.message" maxlength="500" :placeholder="t('messagePh')"></textarea>
            </label>
            <p class="hint left">{{ t('rsvpConsent') }}</p>
            <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('upFail') }}</p>
            <button class="btn primary" :disabled="busy">{{ busy ? t('sending') : t('rsvpSend') }}</button>
          </form>
        </section>

        <section v-if="c.contacts?.length" class="sec">
          <h2>{{ t('contact') }}</h2>
          <ul class="list">
            <li v-for="(p, i) in c.contacts" :key="i" class="item">
              <span>{{ p.name }}</span>
              <span v-if="p.phone" class="row">
                <a class="back" :href="`tel:+${intl(p.phone)}`" :aria-label="`${t('call')} ${p.name}`"><svg class="ic sm"><use href="#i-phone" /></svg></a>
                <a class="back" :href="`https://wa.me/${intl(p.phone)}`" target="_blank" rel="noopener" :aria-label="`WhatsApp ${p.name}`"><svg class="ic sm"><use href="#i-chat" /></svg></a>
              </span>
            </li>
          </ul>
        </section>

        <details class="debug">
          <summary>{{ t('privacy') }}</summary>
          <p class="hint left">{{ t('privacyBody') }}</p>
        </details>
        <footer class="made">{{ t('madeWith') }} <span class="mark sm">Sepatah</span></footer>
      </main>
    </div>
  </div>
</template>
