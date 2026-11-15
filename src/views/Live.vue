<script setup>
// Live screen for the venue projector: approved photos, one at a time, new approvals jump the queue.
// Admin-only (Mato's laptop), so RLS and the admin storage policy cover reading; guests never get read access.
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { sb } from '../lib.js'
import { applyTheme } from '../themes.js'

const id = useRoute().params.id
const ev = ref(null)
const state = ref('loading') // loading | ok | missing | error
const photos = ref([])
const i = ref(0)
const cur = computed(() => photos.value[i.value % photos.value.length])

// ponytail: URLs signed for 12 h, longer than any majlis; every reconnect re-signs anyway
const sign = async (rows) => {
  if (!rows.length) return []
  const { data, error } = await sb.storage.from('media').createSignedUrls(rows.map((p) => p.path), 12 * 3600)
  if (error) throw error
  return rows.map((p, k) => ({ ...p, url: data[k].signedUrl }))
}

// full reload on start and on every (re)connect, so approvals missed while offline still show
async function load() {
  try {
    const [{ data: e, error }, { data: rows, error: e2 }] = await Promise.all([
      sb.from('events').select('bride, groom, theme').eq('id', id).maybeSingle(),
      sb.from('photos').select('id, guest_name, path').eq('event_id', id).eq('status', 'approved').order('created_at'),
    ])
    if (error || e2) throw error || e2
    if (!e) return (state.value = 'missing')
    if (!ev.value) applyTheme(e.theme)
    ev.value = e
    const keep = cur.value?.id
    photos.value = await sign(rows)
    i.value = Math.max(0, photos.value.findIndex((p) => p.id === keep))
    state.value = 'ok'
  } catch {
    if (state.value !== 'ok') state.value = 'error' // once running, keep showing what we have
  }
}

async function onChange({ eventType, new: row, old }) {
  const gone = eventType === 'DELETE' ? old.id : row.status !== 'approved' && row.id
  if (gone) {
    const k = photos.value.findIndex((p) => p.id === gone)
    if (k < 0) return
    photos.value.splice(k, 1)
    if (k < i.value % (photos.value.length + 1)) i.value-- // keep showing the same photo
    return
  }
  if (photos.value.some((p) => p.id === row.id)) return
  const [p] = await sign([row])
  photos.value.splice(photos.value.length ? (i.value % photos.value.length) + 1 : 0, 0, p) // straight after the current one
}

// DELETE events can't be filtered by column, so they come unfiltered and are matched by id
const ch = sb.channel(`live-${id}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` }, onChange)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` }, onChange)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, onChange)
  .subscribe((s) => s === 'SUBSCRIBED' && load())
load()

const timer = setInterval(() => {
  if (photos.value.length < 2) return
  i.value = (i.value + 1) % photos.value.length
  new Image().src = photos.value[(i.value + 1) % photos.value.length].url // preload the next one
}, 7000)

// keep the laptop awake; the lock drops whenever the tab is hidden, so take it again on return
let lock
const wake = () => !document.hidden && navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {})
wake()
document.addEventListener('visibilitychange', wake)

onBeforeUnmount(() => {
  clearInterval(timer)
  sb.removeChannel(ch)
  lock?.release()
  document.removeEventListener('visibilitychange', wake)
})

const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())
</script>

<template>
  <main class="live" @dblclick="full">
    <div v-if="state === 'loading'" class="state"><div class="skel" style="width: min(60vw, 480px); aspect-ratio: 4 / 5"></div></div>

    <div v-else-if="state !== 'ok'" class="state">
      <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
      <h2>{{ state === 'missing' ? 'Event not found' : 'Could not load photos' }}</h2>
      <p>{{ state === 'missing' ? 'It may have been deleted.' : 'Check the connection, then try again.' }}</p>
      <button v-if="state === 'error'" class="btn sm" @click="load">Retry</button>
    </div>

    <div v-else-if="!photos.length" class="state">
      <h2 class="live-names">{{ ev.bride }} <i class="amp">&amp;</i> {{ ev.groom }}</h2>
      <p>Guests' photos appear here once approved.</p>
    </div>

    <Transition v-else name="live" mode="out-in">
      <figure :key="cur.id" class="live-shot">
        <img :src="cur.url" :alt="`Photo from ${cur.guest_name || 'a guest'}`" />
        <figcaption v-if="cur.guest_name">{{ cur.guest_name }}</figcaption>
      </figure>
    </Transition>

    <div class="live-foot">
      <span v-if="ev && photos.length" class="live-couple">{{ ev.bride }} &amp; {{ ev.groom }}</span>
      <div class="mark sm">Sepatah</div>
    </div>
  </main>
</template>
