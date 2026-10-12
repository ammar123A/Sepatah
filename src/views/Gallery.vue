<script setup>
// Couple gallery, opened by the secret link /g/:token. The gallery Edge Function checks the token and signs the URLs.
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { downloadZip } from 'client-zip'
import { sb, fmt } from '../lib.js'
import { applyTheme } from '../themes.js'
import { t, initLang, dateStr, timeStr, LangToggle } from '../i18n.js'

const TABS = [['pre', 'galPre'], ['event', 'galEvent'], ['photo', 'galPhoto']]
const token = useRoute().params.token
const g = ref(null)
const state = ref('loading') // loading | ok | missing | expired | error
const tab = ref('pre')
let loadedAt = 0

const list = (k) => (k === 'photo' ? g.value.photos : g.value.wishes.filter((w) => w.source === k))
const items = computed(() => (g.value ? list(tab.value) : []))

async function load(quiet) {
  if (!quiet) state.value = 'loading'
  const { data, error } = await sb.functions.invoke('gallery', { body: { token } })
  if (error) return (state.value = { 410: 'expired', 404: 'missing' }[error.context?.status] || 'error')
  const first = !g.value
  g.value = data
  loadedAt = Date.now()
  if (first) {
    initLang(data.default_lang)
    applyTheme(data.theme)
    tab.value = TABS.find(([k]) => list(k).length)?.[0] || 'pre'
  }
  state.value = 'ok'
}
load()

// signed URLs last 1 h: refresh quietly when the couple comes back to a tab left open
const onVis = () => !document.hidden && state.value === 'ok' && Date.now() - loadedAt > 50 * 60e3 && load(true)
document.addEventListener('visibilitychange', onVis)
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVis))

// numbered so "download all" lands in order: 003-Puan Rosnah.mp4
const fileName = (it, i) => `${String(i + 1).padStart(3, '0')}-${(it.guest_name || t('anon')).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 40)}.${it.ext}`
const dl = (it, i) => `${it.url}&download=${encodeURIComponent(fileName(it, i))}`

// One zip per tab, files fetched one at a time. Chrome/Edge stream it straight to disk;
// ponytail: other browsers (iPhone Safari) build the zip in memory, so a big video tab can fail there; per-file buttons still work
const saving = ref(null) // null | { done, total }
const zipErr = ref(false)
async function saveAll() {
  const label = TABS.find(([k]) => k === tab.value)[1]
  const name = `${g.value.bride}-${g.value.groom}-${t(label)}.zip`.replace(/[^\p{L}\p{N}.-]+/gu, '-')
  zipErr.value = false
  let out
  try {
    // the picker needs the click's user gesture, so it comes before any await
    out = window.showSaveFilePicker && (await showSaveFilePicker({ suggestedName: name }).then((h) => h.createWritable()))
  } catch (e) {
    if (e.name === 'AbortError') return
  }
  if (Date.now() - loadedAt > 30 * 60e3) await load(true) // URLs are checked when each fetch starts
  const files = items.value
  saving.value = { done: 0, total: files.length }
  async function* entries() {
    for (const [i, it] of files.entries()) {
      const res = await fetch(it.url)
      if (!res.ok) throw new Error(res.status)
      yield { name: fileName(it, i), lastModified: new Date(it.created_at), input: res }
      saving.value.done = i + 1
    }
  }
  try {
    const zip = downloadZip(entries())
    if (out) await zip.body.pipeTo(out)
    else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await zip.blob())
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 60e3)
    }
  } catch {
    zipErr.value = true
  } finally {
    saving.value = null
  }
}

const copied = ref(false)
async function share() {
  const url = location.href
  if (navigator.share) return navigator.share({ title: `${g.value.bride} & ${g.value.groom}`, url }).catch(() => {})
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {}
}

const box = ref(null)
const cur = ref(null)
function show(it, i) {
  cur.value = { it, i }
  box.value.showModal()
}
</script>

<template>
  <div class="gal">
    <header class="bar">
      <div class="mark">Sepatah</div>
      <LangToggle />
    </header>

    <main v-if="state === 'loading'" class="screen" :aria-label="t('loading')">
      <div class="gal-head"><div class="skel" style="width: 260px; height: 56px"></div><div class="skel" style="width: 180px; height: 20px"></div></div>
      <div class="skel" style="height: 54px; border-radius: 27px"></div>
      <div class="vids"><div v-for="i in 6" :key="i" class="skel" style="aspect-ratio: 3 / 4"></div></div>
    </main>

    <main v-else-if="state !== 'ok'" class="screen">
      <div class="state light">
        <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
        <h2>{{ t({ expired: 'galExpired', missing: 'galMissing', error: 'loadFail' }[state]) }}</h2>
        <p>{{ t({ expired: 'galExpiredSub', missing: 'notFoundSub', error: 'loadFailSub' }[state]) }}</p>
        <button v-if="state === 'error'" class="btn sm" @click="load()">{{ t('retry') }}</button>
      </div>
    </main>

    <main v-else class="screen">
      <div class="gal-head">
        <div class="eyebrow">{{ t('galEyebrow') }}</div>
        <h1 class="h1">{{ g.bride }} <i class="amp">&amp;</i> {{ g.groom }}</h1>
        <p class="hint">{{ dateStr(g.event_date) }}</p>
        <p class="lede">{{ t('galExpires', { when: dateStr(g.expires_at) }) }}</p>
        <button class="btn sm" @click="share"><svg class="ic sm"><use href="#i-share" /></svg>{{ t(copied ? 'copied' : 'share') }}</button>
      </div>

      <div class="tabs" role="group">
        <button v-for="[k, label] in TABS" :key="k" :aria-pressed="tab === k" @click="tab = k">{{ t(label) }}<small>{{ list(k).length }}</small></button>
      </div>

      <div v-if="!items.length" class="state light">
        <div class="badge"><svg class="ic"><use :href="tab === 'photo' ? '#i-camera' : '#i-video'" /></svg></div>
        <h2>{{ t('galEmpty') }}</h2>
        <p>{{ t({ pre: 'galEmptyPre', event: 'galEmptyEvent', photo: 'galEmptyPhoto' }[tab]) }}</p>
      </div>

      <template v-else>
        <div class="row gal-bar">
          <p class="hint left">{{ t('dlHint') }}</p>
          <button class="btn sm" :disabled="!!saving" @click="saveAll">
            <svg class="ic sm"><use href="#i-download" /></svg>{{ saving ? t('downloading', saving) : t('downloadAll', { n: items.length }) }}
          </button>
        </div>
        <p v-if="zipErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ t('zipFail') }}</p>
        <div v-if="saving" class="progress" role="progressbar" :aria-valuenow="saving.done" :aria-valuemax="saving.total"><i :style="{ width: (saving.done / saving.total) * 100 + '%' }"></i></div>
        <div :key="tab" class="vids">
          <figure v-for="(it, i) in items" :key="it.id" class="vid" :style="{ animationDelay: Math.min(i, 12) * 40 + 'ms' }">
            <button v-if="tab === 'photo'" class="vid-open" :aria-label="t('view')" @click="show(it, i)"><img :src="it.url" alt="" loading="lazy" /></button>
            <video v-else :src="it.url" controls playsinline preload="metadata"></video>
            <figcaption class="inline">
              <span>{{ it.guest_name || t('anon') }}<br /><small>{{ tab === 'pre' ? dateStr(it.created_at) : timeStr(it.created_at) }}<template v-if="it.duration"> · {{ fmt(it.duration) }}</template></small></span>
              <a class="back" :href="dl(it, i)" :aria-label="t('download')"><svg class="ic sm"><use href="#i-download" /></svg></a>
            </figcaption>
          </figure>
        </div>
      </template>
    </main>

    <dialog ref="box" class="box" @click.self="box.close()">
      <template v-if="cur">
        <img :src="cur.it.url" :alt="cur.it.guest_name || ''" />
        <div class="row">
          <a class="btn sm" :href="dl(cur.it, cur.i)"><svg class="ic sm"><use href="#i-download" /></svg>{{ t('download') }}</a>
          <button class="back" :aria-label="t('close')" @click="box.close()"><svg class="ic sm"><use href="#i-x" /></svg></button>
        </div>
      </template>
    </dialog>
  </div>
</template>
