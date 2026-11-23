<script setup>
// Create / edit one wedding. Times are entered in the browser's local time (MYT for Mato).
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { sb, assetUrl, fmt } from '../lib.js'
import MapPicker from '../MapPicker.vue'
import { PRESETS, FONTS, LAYOUTS, resolve, themeVars, loadFont, contrast, textPairs, template, frameProblem, artWarnings, compose, findHole, findHoles, photoMask, fitHoles, fitBox, fitSingle, fitStrip, placeWin } from '../themes.js'

const route = useRoute()
const router = useRouter()
const id = route.params.id
const isNew = id === 'new'
// jump list for the long form (wide screens); saved-event-only sections drop out for a new event,
// invitation-only ones when the wedding is guestbook only
const sections = computed(() => [
  ['rsvp', 'RSVP', 1, 1], ['videos', 'Video wishes', 1], ['photos', 'Photos', 1], ['couple', 'Couple'], ['design', 'Design'], ['majlis', 'Majlis', 0, 1],
  ['aturcara', 'Aturcara', 0, 1], ['contacts', 'Contacts', 0, 1], ['guestbook', 'Guestbook'], ['music', 'Music', 1, 1], ['delete', 'Delete event', 1],
].filter(([, , saved, inv]) => !(saved && isNew) && !(inv && !f.value.rsvp)))

const TS = ['window_start', 'window_end', 'expires_at']
const toLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)
}
const toIso = (v) => (v ? new Date(v).toISOString() : null)
// Majlis start/end are times on event_date; an end before the start means it runs past midnight
function span(v) {
  const at = (t) => t && new Date(`${v.event_date}T${t}`)
  const s = at(v.start_time), e = at(v.end_time)
  if (s && e && e <= s) e.setDate(e.getDate() + 1)
  return { starts_at: s ? s.toISOString() : null, ends_at: e ? e.toISOString() : null }
}

// every key the Design section edits; empty = use the preset's value
const NO_THEME = { preset: 'zamrud', deep: '', accent: '', paper: '', font: '', art: '', art_size: '', art_mode: '', frame: '', strip: '', frame_fit: '', strip_fit: '', rights_at: '' }
const f = ref({
  slug: '', bride: '', groom: '', event_date: '', start_time: '', end_time: '', venue: '', address: '',
  window_start: '', window_end: '', expires_at: '', default_lang: 'ms', published: false, couple_email: '', rsvp: false,
  content: { hosts: '', aturcara: [], contacts: [], music_path: '', lat: null, lng: null, place_id: null },
  theme: { ...NO_THEME },
})
const state = ref(isNew ? 'ok' : 'loading') // loading | ok | missing
const busy = ref(false)
const err = ref('')
const saved = ref(false)

if (!isNew) {
  sb.from('events').select().eq('id', id).maybeSingle().then(({ data }) => {
    if (!data) return (state.value = 'missing')
    for (const k of TS) data[k] = toLocal(data[k])
    data.start_time = toLocal(data.starts_at).slice(11)
    data.end_time = toLocal(data.ends_at).slice(11)
    data.content = { hosts: '', aturcara: [], contacts: [], music_path: '', lat: null, lng: null, place_id: null, ...data.content }
    data.theme = { ...NO_THEME, ...data.theme }
    for (const k in data) if (data[k] === null) data[k] = ''
    f.value = data
    savedEv.value = { slug: data.slug, bride: data.bride, groom: data.groom, event_date: data.event_date }
    state.value = 'ok'
  })
}

const rsvps = ref(null)
const rsvpErr = ref('')
const coming = computed(() => rsvps.value?.filter((r) => r.attending) || [])
const heads = computed(() => coming.value.reduce((n, r) => n + r.guests, 0))
if (!isNew) {
  sb.from('rsvps').select('id, name, attending, guests, message').eq('event_id', id).order('created_at', { ascending: false })
    .then(({ data, error }) => (error ? (rsvpErr.value = error.message) : (rsvps.value = data)))
}

// ---- moderation: hidden videos/photos stay out of the couple's gallery, only approved photos reach the live screen,
// delete removes the file for good ----
const wishes = ref(null), photos = ref(null)
const wishErr = ref(''), photoErr = ref('')
const modBusy = ref('')
const MOD = {
  wishes: [wishes, wishErr, 'id, source, guest_name, path, duration, status, created_at', 'video'],
  photos: [photos, photoErr, 'id, guest_name, path, status, created_at', 'photo'],
}
async function loadMedia(table) {
  const [list, errR, cols] = MOD[table]
  errR.value = ''
  const { data, error } = await sb.from(table).select(cols)
    .eq('event_id', id).neq('status', 'uploading').order('created_at', { ascending: false })
  if (error) return (errR.value = error.message)
  // ponytail: signed for 1 h, reload the page if a video stops playing
  const { data: urls, error: e2 } = data.length ? await sb.storage.from('media').createSignedUrls(data.map((w) => w.path), 3600) : { data: [] }
  if (e2) return (errR.value = e2.message)
  list.value = data.map((w, i) => ({ ...w, url: urls[i]?.signedUrl }))
}
if (!isNew) ['wishes', 'photos'].forEach(loadMedia)

async function setStatus(table, w, status) {
  modBusy.value = w.id
  const { error } = await sb.from(table).update({ status }).eq('id', w.id)
  modBusy.value = ''
  if (error) return (MOD[table][1].value = error.message)
  w.status = status
}
// file first: a failed row delete can be retried, a failed file delete would leave a guest's video behind
async function delMedia(table, w) {
  const [list, errR, , noun] = MOD[table]
  if (!confirm(`Delete ${w.guest_name || 'this'} ${noun} for good?`)) return
  modBusy.value = w.id
  errR.value = ''
  const { error } = await sb.storage.from('media').remove([w.path])
  const { error: e2 } = error ? {} : await sb.from(table).delete().eq('id', w.id)
  modBusy.value = ''
  if (error || e2) return (errR.value = (error || e2).message)
  list.value = list.value.filter((x) => x !== w)
}
// Same order as the expire function: files first, so a failure leaves the rows to retry with; the row delete cascades
async function delEvent() {
  if (prompt(`This deletes the invitation, RSVPs, every video and photo, and the couple's gallery. It can't be undone.\n\nType ${f.value.slug} to confirm.`)?.trim() !== f.value.slug) return
  busy.value = true
  err.value = ''
  try {
    const paths = []
    for (const t of ['wishes', 'photos']) {
      const { data, error } = await sb.from(t).select('path').eq('event_id', id)
      if (error) throw error
      paths.push(...data.map((r) => r.path))
    }
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await sb.storage.from('media').remove(paths.slice(i, i + 1000))
      if (error) throw error
    }
    const { data: assets, error } = await sb.storage.from('assets').list(id, { limit: 1000 })
    if (error) throw error
    if (assets.length) {
      const { error } = await sb.storage.from('assets').remove(assets.map((a) => `${id}/${a.name}`))
      if (error) throw error
    }
    const { error: e2 } = await sb.from('events').delete().eq('id', id)
    if (e2) throw e2
    router.push('/admin')
  } catch (e) {
    err.value = `Delete stopped part way: ${e.message}. Try again to finish.`
  } finally {
    busy.value = false
  }
}

const when = (iso) => new Date(iso).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// stay = true for the music upload's auto-save, so the new song can be checked here
async function save(stay = false) {
  busy.value = true
  err.value = ''
  saved.value = false
  const v = f.value
  const row = {
    slug: v.slug.trim().toLowerCase(), bride: v.bride.trim(), groom: v.groom.trim(), event_date: v.event_date,
    venue: v.venue || null, address: v.address || null, default_lang: v.default_lang, published: v.published,
    couple_email: v.couple_email || null, rsvp: v.rsvp, ...span(v),
    content: { ...v.content, aturcara: v.content.aturcara.filter((a) => a.time || a.item), contacts: v.content.contacts.filter((c) => c.name || c.phone) },
    theme: Object.fromEntries(Object.entries(v.theme).filter(([, x]) => x)),
  }
  for (const k of TS) row[k] = toIso(v[k])
  if (isNew) delete row.expires_at // DB default: window_end + 3 days
  const q = isNew ? sb.from('events').insert(row).select('id').single() : sb.from('events').update(row).eq('id', id)
  const { data, error } = await q
  busy.value = false
  if (error) return (err.value = error.message)
  savedEv.value = { slug: row.slug, bride: row.bride, groom: row.groom, event_date: row.event_date }
  if (stay) saved.value = true
  else router.push('/admin')
}

async function onMusic(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  busy.value = true
  err.value = ''
  const path = `${id}/music-${Date.now()}.mp3` // new name each time so the CDN never serves the old song
  const { error } = await sb.storage.from('assets').upload(path, file, { contentType: 'audio/mpeg' })
  busy.value = false
  if (error) return (err.value = error.message)
  f.value.content.music_path = path
  save(true)
}

// ---- design: preset, custom colours/font, the couple's artwork and photo frames ----
FONTS.forEach(loadFont) // the preset swatches show each font
const th = computed(() => resolve(f.value.theme))
const presetFont = computed(() => PRESETS.find((p) => p.id === f.value.theme.preset)?.font || PRESETS[0].font)
const customised = computed(() => ['deep', 'accent', 'paper', 'font'].some((k) => f.value.theme[k]))
const lowContrast = computed(() => textPairs(th.value).filter(([, a, b]) => contrast(a, b) < 4.5).map(([what]) => what))
const pickPreset = (id) => Object.assign(f.value.theme, { preset: id, deep: '', accent: '', paper: '', font: '' })
const ASSETS = [
  ['art', 'Kad artwork', 'PNG or JPG. Replaces the arch on the invitation and guestbook', null],
  ['frame', 'Single photo frame', 'any PNG or JPG. A see-through hole becomes the photo window', 'single'],
  ['strip', 'Photo strip frame', 'any PNG or JPG. Three empty photo boxes are used as is; one box is stretched to fit three photos', 'strip'],
]
const designErr = ref('')
const designWarn = ref('')
const rightsOk = ref(false) // ticked per visit; uploads stay locked until Mato confirms

async function onAsset(e, key, layout) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  designErr.value = designWarn.value = ''
  const bmp = await createImageBitmap(file).catch(() => null)
  if (!bmp) return (designErr.value = "That file isn't an image this browser can read. Use PNG or JPG.")
  const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(bmp, 0, 0)
  let fit = ''
  if (layout) {
    const L = LAYOUTS[layout], k = bmp.width / L.w
    // a PNG made from the template (right shape, see-through windows) fits as is, at any size
    const fromTemplate = file.type === 'image/png' && Math.abs(bmp.height / k - L.h) <= L.h * 0.01 && !frameProblem(L, (x, y) => g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data[3])
    if (!fromTemplate && layout === 'single') {
      // any other design: its see-through hole becomes the photo window, else the design goes behind the photo.
      // Searched on a small copy: fast, and plenty accurate for placing a photo.
      const sw = Math.min(360, bmp.width), sh = Math.round((bmp.height * sw) / bmp.width)
      const s = Object.assign(document.createElement('canvas'), { width: sw, height: sh }).getContext('2d', { willReadFrequently: true })
      s.drawImage(bmp, 0, 0, sw, sh)
      fit = fitSingle(sw, sh, findHole(s.getImageData(0, 0, sw, sh).data.filter((_, i) => i % 4 === 3), sw, sh))
    } else if (!fromTemplate) {
      // the design's own photo boxes (see-through, or blank in its centre colour): three → used as is;
      // one wide box → stretched to hold three; otherwise its top and bottom become header and footer
      const sw = Math.min(540, bmp.width), sh = Math.round((bmp.height * sw) / bmp.width)
      const s = Object.assign(document.createElement('canvas'), { width: sw, height: sh }).getContext('2d', { willReadFrequently: true })
      s.drawImage(bmp, 0, 0, sw, sh)
      const { mask, solid } = photoMask(s.getImageData(0, 0, sw, sh).data, sw, sh), holes = findHoles(mask, sw, sh, 0.03)
      const [r, gr, b, a] = g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data
      fit = holes.length === 3 ? fitHoles(sw, sh, holes, solid)
        : holes[0]?.[2] >= sw * 0.5 ? fitBox(sw, sh, holes[0])
        : fitStrip(bmp.width, bmp.height, a === 255 ? '#' + [r, gr, b].map((v) => v.toString(16).padStart(2, '0')).join('') : th.value.card)
    }
    if (k < 1) designWarn.value = `It's ${bmp.width} px wide, smaller than the ${L.w} px photo, so the frame may look soft. Use a bigger file if you have one.`
  } else {
    designWarn.value = artWarnings(file.type, bmp.width, g.getImageData(0, 0, c.width, c.height).data).join(' ')
  }
  busy.value = true
  // new name each time so the CDN never serves the old file
  const path = `${id}/${key}-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`
  const { error } = await sb.storage.from('assets').upload(path, file, { contentType: file.type })
  busy.value = false
  if (error) return (designErr.value = error.message)
  f.value.theme[key] = path
  if (key === 'art') f.value.theme.art_size = [bmp.width, bmp.height] // lets the pages reserve the image's space before it loads
  if (layout) f.value.theme[`${key}_fit`] = fit // frame_fit / strip_fit; '' = made from the template
  f.value.theme.rights_at = new Date().toISOString() // when Mato last confirmed the couple's rights to an upload
  save(true)
}
// ponytail: replaced/removed files stay in the assets bucket, like replaced music
function dropAsset(key) {
  f.value.theme[key] = ''
  if (key === 'art') f.value.theme.art_size = ''
  if (key !== 'art') f.value.theme[`${key}_fit`] = ''
  designWarn.value = ''
  save(true)
}

// Photo box over a fitted single frame: drag to move, drag the corner to resize (layout px, so it matches the photo)
const boxStyle = (L, [x, y, w, h]) => ({ left: `${(x / L.w) * 100}%`, top: `${(y / L.h) * 100}%`, width: `${(w / L.w) * 100}%`, height: `${(h / L.h) * 100}%` })
function dragWin(e, resize) {
  const fit = f.value.theme.frame_fit, k = fit.w / e.currentTarget.closest('.fit-box').getBoundingClientRect().width
  const [x, y, w, h] = fit.wins[0], x0 = e.clientX, y0 = e.clientY
  const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)))
  const move = (ev) => {
    const dx = (ev.clientX - x0) * k, dy = (ev.clientY - y0) * k
    f.value.theme.frame_fit = placeWin(fit, resize ? [x, y, clamp(w + dx, 120, fit.w - x), clamp(h + dy, 120, fit.h - y)] : [clamp(x + dx, 0, fit.w - w), clamp(y + dy, 0, fit.h - h), w, h])
  }
  addEventListener('pointermove', move)
  addEventListener('pointerup', () => removeEventListener('pointermove', move), { once: true })
}

// What a guest's strip will look like, with grey stand-ins for the photos
const stripSample = ref('')
watch(() => [f.value.theme.strip, f.value.theme.strip_fit], async ([path, fit]) => {
  stripSample.value = ''
  if (!path) return
  const img = Object.assign(new Image(), { crossOrigin: 'anonymous', src: assetUrl(path) })
  const r = th.value
  const logo = Object.assign(new Image(), { src: '/favicon.svg' })
  if (!(await img.decode().then(() => true, () => false))) return
  await Promise.all([document.fonts.load(`80px "${r.font}"`), document.fonts.load('400 30px "Young Serif"'), logo.decode().catch(() => {})])
  const shot = Object.assign(document.createElement('canvas'), { width: 4, height: 3 })
  const sg = shot.getContext('2d')
  sg.fillStyle = '#9AA39C'
  sg.fillRect(0, 0, 4, 3)
  const c = compose(fit || LAYOUTS.strip, [shot, shot, shot], { overlay: img, bg: r.card, fg: r.deep, sub: r.mut }, { couple: `${f.value.bride} & ${f.value.groom}`, date: f.value.event_date, font: r.font, logo: logo.naturalWidth ? logo : null })
  if (path === f.value.theme.strip) stripSample.value = c.toDataURL('image/jpeg', 0.7)
}, { immediate: true })
const dlTemplate = (name) => Object.assign(document.createElement('a'), { href: template(name), download: `sepatah-${name}-template.png` }).click()

// a searched place replaces the address; a map click only fills it when empty, so typed text survives fine-tuning
function onPlace(addr, fromSearch) {
  if (fromSearch || !f.value.address) f.value.address = addr
}

const origin = location.origin
const host = location.host

// Table card, built from the saved event so an unsaved edit never gets printed.
// ponytail: encodes location.origin, so open admin on the production domain before downloading for print
const savedEv = ref(null) // { slug, bride, groom, event_date }
const mediaBox = ref(null)
const viewing = ref(null) // { it, kind }
function view(it, kind) {
  viewing.value = { it, kind }
  mediaBox.value.showModal()
}

const qrUrl = computed(() => savedEv.value && `${origin}/${savedEv.value.slug}/tetamu`)
const qr = ref(null) // { svg, card, sheet }
const qrBox = ref(null)
const qrErr = ref('')
watch(savedEv, async (ev) => {
  qr.value = null
  qrErr.value = ''
  if (!ev) return
  const url = qrUrl.value
  try {
    const [svg, card] = await Promise.all([QRCode.toString(url, { errorCorrectionLevel: 'M', margin: 4, type: 'svg' }), drawCard(ev, url)])
    if (ev === savedEv.value) qr.value = { svg, card: card.toDataURL('image/png'), sheet: drawSheet(card) }
  } catch (e) {
    if (ev === savedEv.value) qrErr.value = `Could not build the table card: ${e.message || e}`
  }
})

// Print the A4 sheet straight from the browser. @page pins the paper to A4 with no margin so the cards come out at true 4R.
function printSheet() {
  const w = window.open('', '_blank')
  if (!w) return (qrErr.value = 'Allow pop-ups for this site to print the sheet.')
  w.document.write(`<!doctype html><title>${savedEv.value.slug} table cards A4</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}</style><body onafterprint="close()"><img src="${qr.value.sheet}" onload="print()">`)
  w.document.close()
}

// 4R photo (4 x 6 in, 102 x 152 mm) at 300 dpi, so it drops straight into a 4R frame. Canvas rather than SVG so the brand fonts are baked into the print file.
async function drawCard(ev, url) {
  const W = 1200, H = 1800, cx = W / 2
  const [code, icon] = await Promise.all([
    QRCode.toCanvas(document.createElement('canvas'), url, { errorCorrectionLevel: 'M', margin: 4, width: 800 }),
    new Promise((ok, no) => Object.assign(new Image(), { onload() { ok(this) }, onerror: () => no(new Error('logo did not load')), src: '/favicon.svg' })),
    ...['400 10px "Young Serif"', '10px Gloock', '400 10px Figtree', '700 10px Figtree'].map((f) => document.fonts.load(f)),
  ])
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const g = c.getContext('2d')
  g.fillStyle = '#F2EDE3'
  g.fillRect(0, 0, W, H)
  g.textAlign = 'center'
  // '#' in font is the px size; long names shrink to fit the card
  const text = (s, font, px, color, y) => {
    g.font = font.replace('#', px)
    while (g.measureText(s).width > W - 200) g.font = font.replace('#', (px -= 4))
    g.fillStyle = color
    g.fillText(s, cx, y)
  }
  const date = new Date(ev.event_date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  text('Video guestbook', '#px "Young Serif"', 56, '#C4472D', 216)
  // full names (binti/bin) go on two lines rather than shrinking to nothing
  const names = `${ev.bride} & ${ev.groom}`
  g.font = '110px Gloock'
  const one = g.measureText(names).width <= W - 200
  if (one) text(names, '#px Gloock', 110, '#1F3A2D', 346)
  else {
    text(ev.bride, '#px Gloock', 88, '#1F3A2D', 308)
    text(`& ${ev.groom}`, '#px Gloock', 88, '#1F3A2D', 398)
  }
  text(date, '700 #px Figtree', 38, '#5C635D', one ? 418 : 462)
  // rounded corners only cut into the quiet zone, never the code
  g.save()
  g.beginPath()
  g.roundRect(cx - 400, 496, 800, 800, 36)
  g.clip()
  g.drawImage(code, cx - 400, 496, 800, 800)
  g.restore()
  text('Scan to record a video wish', '700 #px Figtree', 50, '#1C221E', 1406)
  text('Open during the event only', '#px "Young Serif"', 44, '#5C635D', 1468)
  // logo lockup: square icon + "sepatah." (the dot is the only accent on the card)
  g.font = '400 46px "Young Serif"'
  const wWord = g.measureText('sepatah').width, wDot = g.measureText('.').width
  const x = cx - (60 + 16 + wWord + wDot) / 2, y = 1676
  g.drawImage(icon, x, y - 47, 60, 60)
  g.textAlign = 'left'
  g.fillStyle = '#1F3A2D'
  g.fillText('sepatah', x + 76, y)
  g.fillStyle = '#C4472D'
  g.fillText('.', x + 76 + wWord, y)
  return c
}

// A4 at 300 dpi fits three 4R cards: two upright on top, one turned sideways below. Print at 100%, then cut.
// ponytail: 2.4 mm side margins, a printer that can't reach that close clips a sliver of beige edge, which the frame covers
function drawSheet(card) {
  const s = Object.assign(document.createElement('canvas'), { width: 2480, height: 3508 })
  const g = s.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 2480, 3508)
  g.drawImage(card, 28, 60)
  g.drawImage(card, 1252, 60)
  g.translate(340, 3120)
  g.rotate(-Math.PI / 2)
  g.drawImage(card, 0, 0)
  return s.toDataURL('image/png')
}
</script>

<template>
  <div class="admin wide">
    <header class="bar">
      <RouterLink class="back" to="/admin" aria-label="Back"><svg class="ic"><use href="#i-back" /></svg></RouterLink>
      <div class="mark">Sepatah</div>
    </header>

    <div v-if="state === 'loading'" class="rows"><div class="skel" style="height: 52px" v-for="i in 6" :key="i"></div></div>

    <div v-else-if="state === 'missing'" class="state light">
      <div class="badge"><svg class="ic"><use href="#i-alert" /></svg></div>
      <h2>Event not found</h2>
      <p>It may have been deleted.</p>
    </div>

    <div v-else class="ae">
    <nav class="ae-nav" aria-label="Sections"><a v-for="[sid, label] in sections" :key="sid" :href="`#${sid}`">{{ label }}</a></nav>
    <form class="form" @submit.prevent="save()">
      <div class="stack">
        <h1 class="h1">{{ isNew ? 'New event' : `${f.bride} & ${f.groom}` }}</h1>
        <p v-if="!isNew" class="hint left">
          <template v-if="f.rsvp">Invitation: <a :href="`/${f.slug}`" target="_blank">{{ origin }}/{{ f.slug }}</a><br /></template>
          QR guestbook: <a :href="`/${f.slug}/tetamu`" target="_blank">{{ origin }}/{{ f.slug }}/tetamu</a><br />
          Live screen <em>(venue laptop, signed in; double-click for full screen)</em>: <a :href="`/admin/e/${id}/live`" target="_blank">{{ origin }}/admin/e/{{ id }}/live</a><br />
          Couple gallery <em>(secret, send to the couple only)</em>: <a :href="`/g/${f.gallery_token}`" target="_blank">{{ origin }}/g/{{ f.gallery_token }}</a>
        </p>
      </div>

      <section v-if="!isNew && f.rsvp" id="rsvp" class="fs">
        <header><h2>RSVP</h2></header>
        <div class="fs-body">
          <p v-if="rsvpErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ rsvpErr }}</p>
          <div v-else-if="!rsvps" class="skel" style="height: 44px"></div>
          <p v-else-if="!rsvps.length" class="hint left">No replies yet. They show up here once guests answer on the invitation.</p>
          <details v-else class="debug">
            <summary>{{ coming.length }} attending ({{ heads }} guests) · {{ rsvps.length - coming.length }} not attending</summary>
            <ul class="list">
              <li v-for="r in rsvps" :key="r.id" class="item">
                <span>{{ r.name }}<template v-if="r.message"><br /><small style="white-space: pre-line">“{{ r.message }}”</small></template></span><small style="flex-shrink: 0">{{ r.attending ? `${r.guests} guest${r.guests > 1 ? 's' : ''}` : 'Not attending' }}</small>
              </li>
            </ul>
          </details>
        </div>
      </section>

      <section v-if="!isNew" id="videos" class="fs">
        <header><h2>Video wishes</h2><p class="hint left">Hidden videos stay out of the couple's gallery. Delete is permanent.</p></header>
        <div class="fs-body">
          <p v-if="wishErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ wishErr }} <button type="button" class="linkbtn" @click="loadMedia('wishes')">Reload</button></p>
          <div v-if="!wishes && !wishErr" class="vids"><div class="skel" style="aspect-ratio: 3 / 4" v-for="i in 2" :key="i"></div></div>
          <p v-else-if="wishes && !wishes.length" class="hint left">No videos yet. Pre-event wishes and QR guestbook videos show up here.</p>
          <div v-else-if="wishes" class="vids">
            <figure v-for="w in wishes" :key="w.id" class="vid" :class="{ hid: w.status === 'hidden' }">
              <button type="button" class="vid-open" aria-label="Watch video" @click="view(w, 'video')">
                <video :src="`${w.url}#t=0.1`" muted playsinline preload="metadata" tabindex="-1"></video><span class="play"><svg class="ic"><use href="#i-video" /></svg></span>
              </button>
              <figcaption>
                <span>{{ w.guest_name || 'Anonymous' }}<br /><small>{{ w.source === 'pre' ? 'Pre-event' : 'Guestbook' }} · {{ when(w.created_at) }}<template v-if="w.duration"> · {{ fmt(w.duration) }}</template><template v-if="w.status === 'hidden'"> · Hidden</template></small></span>
                <span class="row">
                  <button type="button" class="btn sm" :disabled="modBusy === w.id" @click="setStatus('wishes', w, w.status === 'hidden' ? 'visible' : 'hidden')">{{ w.status === 'hidden' ? 'Show' : 'Hide' }}</button>
                  <button type="button" class="back" aria-label="Delete" :disabled="modBusy === w.id" @click="delMedia('wishes', w)"><svg class="ic sm"><use href="#i-x" /></svg></button>
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <dialog ref="mediaBox" class="box" @click.self="mediaBox.close()" @close="viewing = null">
        <template v-if="viewing">
          <img v-if="viewing.kind === 'photo'" :src="viewing.it.url" :alt="`Photo from ${viewing.it.guest_name || 'a guest'}`" />
          <video v-else :src="viewing.it.url" controls autoplay playsinline></video>
          <div class="row">
            <span>{{ viewing.it.guest_name || 'Anonymous' }}</span>
            <button type="button" class="back" aria-label="Close" @click="mediaBox.close()"><svg class="ic sm"><use href="#i-x" /></svg></button>
          </div>
        </template>
      </dialog>

      <section v-if="!isNew" id="photos" class="fs">
        <header><h2>Photos</h2><p class="hint left">Approved photos go on the live screen. Pending ones are only in the couple's gallery, hidden ones nowhere. Delete is permanent.</p></header>
        <div class="fs-body">
          <p v-if="photoErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ photoErr }} <button type="button" class="linkbtn" @click="loadMedia('photos')">Reload</button></p>
          <div v-if="!photos && !photoErr" class="vids"><div class="skel" style="aspect-ratio: 3 / 4" v-for="i in 2" :key="i"></div></div>
          <p v-else-if="photos && !photos.length" class="hint left">No photos yet. QR guestbook photos show up here.</p>
          <button v-if="photos" type="button" class="linkbtn" style="align-self: start" @click="loadMedia('photos')">Check for new photos</button>
          <div v-if="photos?.length" class="vids">
            <figure v-for="p in photos" :key="p.id" class="vid" :class="{ hid: p.status === 'hidden' }">
              <button type="button" class="vid-open" aria-label="View photo" @click="view(p, 'photo')"><img :src="p.url" :alt="`Photo from ${p.guest_name || 'a guest'}`" loading="lazy" /></button>
              <figcaption>
                <span>{{ p.guest_name || 'Anonymous' }}<br /><small>{{ when(p.created_at) }} · {{ { pending: 'Pending', approved: 'On live screen', hidden: 'Hidden' }[p.status] }}</small></span>
                <span class="row">
                  <button v-if="p.status !== 'approved'" type="button" class="btn sm" :disabled="modBusy === p.id" @click="setStatus('photos', p, 'approved')">Approve</button>
                  <button v-if="p.status !== 'hidden'" type="button" class="btn sm" :disabled="modBusy === p.id" @click="setStatus('photos', p, 'hidden')">Hide</button>
                  <button type="button" class="back" aria-label="Delete" :disabled="modBusy === p.id" @click="delMedia('photos', p)"><svg class="ic sm"><use href="#i-x" /></svg></button>
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="couple" class="fs">
        <header><h2>Couple</h2><p class="hint left">Names as they appear on the guestbook and table card.</p></header>
        <div class="fs-body">
          <label class="check-row"><input v-model="f.rsvp" type="checkbox" /> Invitation + RSVP <em>(add-on: venue, aturcara, contacts, music)</em></label>
          <div class="cols c3">
            <label class="field"><span>Bride</span><input v-model="f.bride" required maxlength="40" /></label>
            <label class="field"><span>Groom</span><input v-model="f.groom" required maxlength="40" /></label>
            <label class="field"><span>Wedding date</span><input v-model="f.event_date" type="date" required /></label>
          </div>
          <label class="field"><span>Wedding link</span>
            <span class="affix"><span>{{ host }}/</span><input v-model="f.slug" required pattern="[a-z0-9\-]{2,60}" placeholder="aina-hakim" /></span>
          </label>
          <label class="field"><span>Couple email <em>(gallery reminders)</em></span><input v-model="f.couple_email" type="email" /></label>
          <label v-if="f.rsvp" class="field"><span>Hosts <em>(parents' names, one per line)</em></span><textarea v-model="f.content.hosts"></textarea></label>
        </div>
      </section>

      <section id="design" class="fs">
        <header><h2>Design</h2><p class="hint left">Colours, font and the couple's artwork. Used on the invitation, guestbook, photo frames and couple gallery.</p></header>
        <div class="fs-body">
          <div class="swatches" role="radiogroup" aria-label="Preset">
            <button v-for="p in PRESETS" :key="p.id" type="button" class="swatch" role="radio" :aria-checked="f.theme.preset === p.id" :style="{ background: p.paper, color: p.mut }" @click="pickPreset(p.id)">
              <span class="chips"><i :style="{ background: p.deep }"></i><i :style="{ background: p.accent }"></i></span>
              <b :style="{ fontFamily: `'${p.font}', serif`, color: p.deep }">A &amp; H</b>
              <small>{{ p.name }}</small>
            </button>
          </div>
          <div class="cols c3">
            <label class="field"><span>Main colour</span><input type="color" :value="th.deep" @input="f.theme.deep = $event.target.value" /></label>
            <label class="field"><span>Accent</span><input type="color" :value="th.accent" @input="f.theme.accent = $event.target.value" /></label>
            <label class="field"><span>Paper</span><input type="color" :value="th.paper" @input="f.theme.paper = $event.target.value" /></label>
          </div>
          <label class="field"><span>Names font</span>
            <select v-model="f.theme.font"><option value="">{{ presetFont }} (preset)</option><option v-for="x in FONTS" :key="x" :value="x">{{ x }}</option></select>
          </label>
          <button v-if="customised" type="button" class="linkbtn" style="align-self: start" @click="pickPreset(f.theme.preset)">Reset to preset</button>
          <p v-for="w in lowContrast" :key="w" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ w }} is hard to read (under 4.5:1). Pick a darker or lighter colour.</p>
          <div class="theme-pv" :style="themeVars(f.theme)" aria-label="Preview">
            <img v-if="f.theme.art && f.theme.art_mode === 'kad'" class="kad" :src="assetUrl(f.theme.art)" alt="Kad artwork" />
            <div v-else-if="f.theme.art" class="framed">
              <img :src="assetUrl(f.theme.art)" alt="" />
              <div><div class="eyebrow">Walimatul Urus</div><div class="names"><span>{{ f.bride || 'Aina' }}</span><span class="amp">&amp;</span><span>{{ f.groom || 'Hakim' }}</span></div><p class="lede">{{ f.event_date || 'Tarikh majlis' }}</p></div>
            </div>
            <div v-else class="arch"><div class="names"><span>{{ f.bride || 'Aina' }}</span><span class="amp">&amp;</span><span>{{ f.groom || 'Hakim' }}</span></div></div>
            <span class="btn primary">Hantar jawapan</span>
          </div>
          <template v-if="!isNew">
            <label class="check-row"><input v-model="rightsOk" type="checkbox" /> The couple confirmed they made or paid for this artwork. Not from Google or a watermarked preview.</label>
            <div v-for="[key, label, hint, lay] in ASSETS" :key="key" class="field">
              <span>{{ label }} <em>({{ hint }})</em></span>
              <div v-if="f.theme[key]" class="row">
                <img class="asset-thumb" :src="assetUrl(f.theme[key])" :alt="label" />
                <button type="button" class="btn sm" :disabled="busy" @click="dropAsset(key)">Remove</button>
              </div>
              <div class="row">
                <input type="file" accept="image/png,image/jpeg" :aria-label="`${f.theme[key] ? 'Replace' : 'Upload'} ${label}`" :disabled="busy || !rightsOk" @change="onAsset($event, key, lay)" />
                <button v-if="lay" type="button" class="btn sm" @click="dlTemplate(lay)">Template</button>
              </div>
              <div v-if="key === 'frame' && f.theme.frame && f.theme.frame_fit" class="fit">
                <div class="fit-box" :style="{ aspectRatio: `${f.theme.frame_fit.w} / ${f.theme.frame_fit.h}` }">
                  <img :src="assetUrl(f.theme.frame)" alt="" />
                  <div v-if="f.theme.frame_fit.cap" class="fit-cap" :style="boxStyle(f.theme.frame_fit, [0, f.theme.frame_fit.cap[0], f.theme.frame_fit.w, f.theme.frame_fit.cap[1]])">{{ f.bride || 'Aina' }} &amp; {{ f.groom || 'Hakim' }}</div>
                  <div class="fit-win" :style="boxStyle(f.theme.frame_fit, f.theme.frame_fit.wins[0])" @pointerdown.prevent="dragWin($event, false)"><span class="fit-handle" @pointerdown.stop.prevent="dragWin($event, true)"></span></div>
                </div>
                <label class="check-row"><input type="checkbox" :checked="!!f.theme.frame_fit.cap" @change="f.theme.frame_fit = placeWin(f.theme.frame_fit, f.theme.frame_fit.wins[0], $event.target.checked)" /> Names and date under the photo</label>
                <p class="hint left">{{ f.theme.frame_fit.under ? "No see-through hole in this design, so it goes behind the photo. Drag the box onto the design's empty area, and drag its corner to resize. Save when done." : "Found the see-through hole: guests' photos fill it. Drag the box to fine-tune if needed, then Save." }}</p>
              </div>
              <img v-if="key === 'strip' && stripSample" class="strip-sample" :src="stripSample" alt="Sample strip with grey stand-in photos" />
              <select v-if="key === 'art' && f.theme.art" v-model="f.theme.art_mode" aria-label="Artwork type">
                <option value="">Frame only: we write the names inside</option>
                <option value="kad">Full kad: the names are already in the image</option>
              </select>
            </div>
            <p v-if="designWarn" class="hint left" role="status">{{ designWarn }}</p>
            <p v-if="designErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ designErr }}</p>
            <p v-if="f.theme.rights_at" class="hint left">Rights last confirmed {{ when(f.theme.rights_at) }}.</p>
          </template>
          <p v-else class="hint left">Save the event first, then upload the couple's artwork and frames.</p>
        </div>
      </section>

      <section v-if="f.rsvp" id="majlis" class="fs">
        <header><h2>Majlis</h2><p class="hint left">When and where, on the invitation. Guests get Google Maps and Waze buttons.</p></header>
        <div class="fs-body">
          <div class="cols">
            <label class="field"><span>Starts</span><input v-model="f.start_time" type="time" /></label>
            <label class="field"><span>Ends</span><input v-model="f.end_time" type="time" /></label>
          </div>
          <label class="field"><span>Venue</span><input v-model="f.venue" placeholder="Dewan Seri Melati" /></label>
          <div class="field"><span>Location</span>
            <MapPicker v-model:lat="f.content.lat" v-model:lng="f.content.lng" v-model:place-id="f.content.place_id" @place="onPlace" />
          </div>
          <label class="field"><span>Address <em>(shown on the invitation)</em></span><textarea v-model="f.address"></textarea></label>
        </div>
      </section>

      <section v-if="f.rsvp" id="aturcara" class="fs">
        <header><h2>Aturcara</h2><p class="hint left">The day's programme.</p></header>
        <div class="fs-body">
          <div v-for="(a, i) in f.content.aturcara" :key="i" class="row">
            <input v-model="a.time" type="time" class="narrow" aria-label="Time" />
            <input v-model="a.item" placeholder="Ketibaan tetamu" aria-label="Item" />
            <button type="button" class="back" aria-label="Remove" @click="f.content.aturcara.splice(i, 1)"><svg class="ic sm"><use href="#i-x" /></svg></button>
          </div>
          <button type="button" class="linkbtn" style="align-self: start" @click="f.content.aturcara.push({ time: '', item: '' })">Add item</button>
        </div>
      </section>

      <section v-if="f.rsvp" id="contacts" class="fs">
        <header><h2>Contacts</h2><p class="hint left">Who guests can call or WhatsApp.</p></header>
        <div class="fs-body">
          <div v-for="(c, i) in f.content.contacts" :key="i" class="row">
            <input v-model="c.name" placeholder="Encik Ahmad (bapa)" aria-label="Name" />
            <input v-model="c.phone" type="tel" placeholder="60123456789" aria-label="Phone" />
            <button type="button" class="back" aria-label="Remove" @click="f.content.contacts.splice(i, 1)"><svg class="ic sm"><use href="#i-x" /></svg></button>
          </div>
          <button type="button" class="linkbtn" style="align-self: start" @click="f.content.contacts.push({ name: '', phone: '' })">Add contact</button>
        </div>
      </section>

      <section id="guestbook" class="fs">
        <header><h2>Guestbook</h2><p class="hint left">When the QR takes video wishes, and when the gallery is wiped.</p></header>
        <div class="fs-body">
          <div class="cols">
            <label class="field"><span>QR opens</span><input v-model="f.window_start" type="datetime-local" required /></label>
            <label class="field"><span>QR closes</span><input v-model="f.window_end" type="datetime-local" required /></label>
            <label v-if="!isNew" class="field"><span>Gallery deleted at</span><input v-model="f.expires_at" type="datetime-local" required /></label>
            <label class="field"><span>Default language</span>
              <select v-model="f.default_lang"><option value="ms">Bahasa Melayu</option><option value="en">English</option></select>
            </label>
          </div>
          <p v-if="isNew" class="hint left">Gallery is deleted 3 days after the QR closes. You can change it after saving.</p>
          <div v-if="qrUrl" class="qr">
            <button v-if="qr" type="button" class="qr-open" aria-label="View table card" @click="qrBox.showModal()">
              <img class="qr-card" :src="qr.card" :alt="`Table card, scans open ${qrUrl}`" />
            </button>
            <div v-else class="skel qr-card"></div>
            <dialog ref="qrBox" class="box" @click.self="qrBox.close()">
              <template v-if="qr">
                <img :src="qr.card" :alt="`Table card, scans open ${qrUrl}`" />
                <div class="row">
                  <div class="row" style="flex-wrap: wrap">
                    <a class="btn sm" :href="qr.card" :download="`${savedEv.slug}-table-card.png`">Table card (PNG)</a>
                    <a class="btn sm" :href="qr.sheet" :download="`${savedEv.slug}-table-card-a4.png`">A4 sheet, 3 cards</a>
                    <button type="button" class="btn sm" @click="printSheet">Print A4</button>
                    <a class="btn sm" :href="`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`" :download="`${savedEv.slug}-qr.svg`">QR only (SVG)</a>
                  </div>
                  <button type="button" class="back" aria-label="Close" @click="qrBox.close()"><svg class="ic sm"><use href="#i-x" /></svg></button>
                </div>
              </template>
            </dialog>
            <div class="stack">
              <p class="hint left">Table card, 4R (4 x 6 in) at 300 dpi. The A4 sheet holds 3, print at 100% and cut. Scans open {{ qrUrl }}.</p>
              <p v-if="qrErr" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ qrErr }}</p>
              <div class="row">
                <a class="btn sm" :class="{ off: !qr }" :href="qr?.card" :download="`${savedEv.slug}-table-card.png`">Table card (PNG)</a>
                <a class="btn sm" :class="{ off: !qr }" :href="qr?.sheet" :download="`${savedEv.slug}-table-card-a4.png`">A4 sheet, 3 cards</a>
                <button type="button" class="btn sm" :disabled="!qr" @click="printSheet">Print A4</button>
                <a class="btn sm" :class="{ off: !qr }" :href="qr && `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`" :download="`${savedEv.slug}-qr.svg`">QR only (SVG)</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="!isNew && f.rsvp" id="music" class="fs">
        <header><h2>Music</h2><p class="hint left">Plays after "Buka Undangan".</p></header>
        <div class="fs-body">
          <audio v-if="f.content.music_path" :src="assetUrl(f.content.music_path)" controls style="width: 100%"></audio>
          <label class="field"><span>{{ f.content.music_path ? 'Replace' : 'Upload' }} MP3 <em>(max 10 MB)</em></span>
            <input type="file" accept="audio/mpeg" :disabled="busy" @change="onMusic" />
          </label>
        </div>
      </section>

      <section v-if="!isNew" id="delete" class="fs">
        <header><h2>Delete event</h2><p class="hint left">Removes the invitation, RSVPs, every video and photo, and the couple's gallery for good. To only end the gallery sooner, change "Gallery deleted at" instead.</p></header>
        <div class="fs-body">
          <button type="button" class="btn sm" style="align-self: start; color: var(--err)" :disabled="busy" @click="delEvent">Delete event</button>
        </div>
      </section>

      <p v-if="err" class="err" role="alert"><svg class="ic sm"><use href="#i-alert" /></svg>{{ err }}</p>
      <div class="savebar">
        <label class="check-row"><input v-model="f.published" type="checkbox" /> Published</label>
        <p v-if="saved" class="ok" role="status">Saved</p>
        <button class="btn primary" :disabled="busy">{{ busy ? 'Saving' : isNew ? 'Create event' : 'Save' }}</button>
      </div>
    </form>
    </div>
  </div>
</template>
