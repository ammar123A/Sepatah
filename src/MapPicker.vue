<script setup>
// Venue pin: Google Places search (best coverage for Malaysian halls and mosques), or click / drag on the map.
import { ref, onMounted, onBeforeUnmount } from 'vue'

const lat = defineModel('lat')
const lng = defineModel('lng')
const placeId = defineModel('placeId') // lets the guest's Google Maps link open the venue listing, not a bare pin
const emit = defineEmits(['place']) // (address, fromSearch)

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY
const MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'
let api
const load = () => (api ??= new Promise((ok, no) => {
  window.__gmReady = ok
  document.head.append(Object.assign(document.createElement('script'), {
    src: `https://maps.googleapis.com/maps/api/js?key=${KEY}&loading=async&region=MY&callback=__gmReady`,
    async: true,
    onerror: no,
  }))
}))

const el = ref()
const box = ref()
const err = ref('')
const off = ref(false)
const fail = () => {
  off.value = true
  err.value = 'Map unavailable. Directions will use the address text.'
}
let map, marker, Marker, geocoder

function put(la, ln, zoom) {
  lat.value = +la.toFixed(6)
  lng.value = +ln.toFixed(6)
  const position = { lat: lat.value, lng: lng.value }
  if (marker) marker.position = position
  else {
    const pin = Object.assign(document.createElement('div'), { className: 'pin', innerHTML: '<svg viewBox="0 0 24 24"><use href="#i-pin"/></svg>' })
    marker = new Marker({ map, position, content: pin, gmpDraggable: true })
    marker.addListener('dragend', (e) => drop(e.latLng))
  }
  if (zoom) map.setOptions({ center: position, zoom })
}

async function drop(at, id = null) {
  put(at.lat(), at.lng())
  placeId.value = id // a moved pin no longer marks the listed place
  try {
    const { results } = await geocoder.geocode({ location: at })
    if (results[0]) emit('place', results[0].formatted_address, false)
  } catch {} // the pin is what matters, address is a bonus
}

async function pick({ placePrediction }) {
  err.value = ''
  try {
    const place = placePrediction.toPlace()
    await place.fetchFields({ fields: ['id', 'formattedAddress', 'location'] })
    put(place.location.lat(), place.location.lng(), 17)
    placeId.value = place.id
    emit('place', place.formattedAddress, true)
  } catch {
    err.value = 'Could not load that place. Click the map to drop the pin instead.'
  }
}

function clear() {
  if (marker) marker.map = null
  marker = null
  lat.value = lng.value = placeId.value = null
}

onMounted(async () => {
  window.gm_authFailure = fail // Google calls this for a bad key, a referrer not allowed or billing off
  try {
    if (!KEY) throw 0
    await load()
    const [{ Map }, { AdvancedMarkerElement }, { PlaceAutocompleteElement }, { Geocoder }] = await Promise.all(
      ['maps', 'marker', 'places', 'geocoding'].map((l) => google.maps.importLibrary(l)),
    )
    if (!el.value) return // left the page while loading
    Marker = AdvancedMarkerElement
    geocoder = new Geocoder()
    const has = typeof lat.value === 'number'
    map = new Map(el.value, {
      mapId: MAP_ID,
      center: has ? { lat: lat.value, lng: lng.value } : { lat: 3.139, lng: 101.687 },
      zoom: has ? 16 : 11,
      gestureHandling: 'cooperative',
      streetViewControl: false,
      mapTypeControl: false,
    })
    if (has) put(lat.value, lng.value)
    map.addListener('click', (e) => {
      e.stop() // clicking a venue icon on the map picks it instead of opening Google's info window
      drop(e.latLng, e.placeId || null)
    })
    // shortcut: Malaysia only, widen includedRegionCodes when weddings happen elsewhere
    const ac = new PlaceAutocompleteElement({ includedRegionCodes: ['my'] })
    ac.setAttribute('placeholder', 'Search a hall, mosque or address')
    ac.addEventListener('gmp-select', pick)
    box.value.append(ac)
  } catch {
    fail()
  }
})
onBeforeUnmount(() => {
  if (marker) marker.map = null
})
</script>

<template>
  <div class="rows">
    <div ref="box" class="gsearch"></div>
    <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ err }}</p>
    <div v-show="!off" ref="el" class="map"></div>
    <p class="hint left">
      {{ lat != null ? 'Drag the pin to fine-tune. Guests get directions to this exact spot.' : 'Search, or click the map to drop a pin. Without one, directions use the address text.' }}
      <button v-if="lat != null" type="button" class="linkbtn" style="min-height: 0" @click="clear">Remove pin</button>
    </p>
  </div>
</template>
