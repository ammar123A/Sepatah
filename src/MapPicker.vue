<script setup>
// Venue pin: search OpenStreetMap (Nominatim, no API key) or click / drag on the map.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const lat = defineModel('lat')
const lng = defineModel('lng')
const emit = defineEmits(['place']) // (address, fromSearch)

const NOM = 'https://nominatim.openstreetmap.org'
const icon = L.divIcon({ className: 'pin', html: '<svg viewBox="0 0 24 24"><use href="#i-pin"/></svg>', iconSize: [36, 36], iconAnchor: [18, 34] })

const el = ref()
const q = ref('')
const hits = ref(null)
const busy = ref(false)
const err = ref('')
let map, marker

function put(la, ln, zoom) {
  lat.value = +la.toFixed(6)
  lng.value = +ln.toFixed(6)
  if (marker) marker.setLatLng([la, ln])
  else marker = L.marker([la, ln], { icon, draggable: true }).addTo(map).on('dragend', () => drop(marker.getLatLng()))
  if (zoom) map.setView([la, ln], zoom)
}

async function drop({ lat: la, lng: ln }) {
  put(la, ln)
  try {
    const r = await (await fetch(`${NOM}/reverse?format=json&lat=${la}&lon=${ln}`)).json()
    if (r.display_name) emit('place', r.display_name, false)
  } catch {} // the pin is what matters, address is a bonus
}

async function search() {
  if (!q.value.trim()) return
  busy.value = true
  err.value = ''
  hits.value = null
  try {
    // ponytail: Malaysia only, drop countrycodes when weddings happen elsewhere
    hits.value = await (await fetch(`${NOM}/search?format=json&limit=5&countrycodes=my&q=${encodeURIComponent(q.value)}`)).json()
    if (!hits.value.length) err.value = 'No places found. Try a shorter name, or click the map.'
  } catch {
    err.value = 'Search failed. Click the map to drop the pin instead.'
  }
  busy.value = false
}

function pick(h) {
  put(+h.lat, +h.lon, 17)
  emit('place', h.display_name, true)
  hits.value = null
}

function clear() {
  marker?.remove()
  marker = null
  lat.value = lng.value = null
}

onMounted(() => {
  const has = typeof lat.value === 'number'
  map = L.map(el.value, { scrollWheelZoom: false }).setView(has ? [lat.value, lng.value] : [3.139, 101.687], has ? 16 : 11)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map)
  if (has) put(lat.value, lng.value)
  map.on('click', (e) => drop(e.latlng))
})
onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div class="rows">
    <div class="row">
      <input v-model="q" placeholder="Search a hall, mosque or address" aria-label="Search place" @keydown.enter.prevent="search" />
      <button type="button" class="btn sm" :disabled="busy" @click="search">{{ busy ? 'Searching' : 'Search' }}</button>
    </div>
    <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ err }}</p>
    <ul v-if="hits?.length" class="list">
      <li v-for="h in hits" :key="h.place_id"><button type="button" @click="pick(h)">{{ h.display_name }}</button></li>
    </ul>
    <div ref="el" class="map"></div>
    <p class="hint left">
      {{ lat != null ? 'Drag the pin to fine-tune. Guests get directions to this exact spot.' : 'Click the map to drop a pin. Without one, directions use the address text.' }}
      <button v-if="lat != null" type="button" class="linkbtn" style="min-height: 0" @click="clear">Remove pin</button>
    </p>
  </div>
</template>
