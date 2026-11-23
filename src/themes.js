// Wedding designs: 10 preset palettes, the couple's own colours/font/artwork (events.theme), and the photo frame layouts.
// No browser access at import time, so `npm run check` can load it in Node.

// Every preset keeps a light paper; ink/mut, on-deep and on-accent must stay >= 4.5:1 (themes.check.js)
export const PRESETS = [
  { id: 'zamrud', name: 'Zamrud', paper: '#F2EDE3', card: '#FBF8F2', ink: '#1C221E', mut: '#5C635D', deep: '#1F3A2D', deep2: '#2A4C3B', deep3: '#142A1F', onDeep: '#EDE6D6', accent: '#C4472D', accent2: '#A93A23', onAccent: '#FFF4EC', font: 'Gloock', petal: '#E8A48F' },
  { id: 'sage', name: 'Sage', paper: '#EEF0E8', card: '#F9FAF5', ink: '#1E241F', mut: '#59615A', deep: '#4A5F4C', deep2: '#5A715C', deep3: '#33443A', onDeep: '#F3F1E6', accent: '#9C5236', accent2: '#84432B', onAccent: '#FFF6EF', font: 'Cormorant Garamond', petal: '#E3B09A' },
  { id: 'mawar', name: 'Mawar', paper: '#F6ECE8', card: '#FDF7F4', ink: '#2A1E20', mut: '#6B5A5C', deep: '#7A3E4B', deep2: '#8C4C5A', deep3: '#5A2B36', onDeep: '#FBEDEB', accent: '#A8475A', accent2: '#8F3A4B', onAccent: '#FFF5F5', font: 'Parisienne', petal: '#E7A9B4' },
  { id: 'songket', name: 'Songket', paper: '#F5EEE2', card: '#FCF8F0', ink: '#2A1A18', mut: '#6A5850', deep: '#5B1E26', deep2: '#6E2832', deep3: '#3F1219', onDeep: '#F4E6CC', accent: '#82631B', accent2: '#6C5216', onAccent: '#FFF9EC', font: 'Playfair Display', petal: '#D9BE84' },
  { id: 'diraja', name: 'Diraja', paper: '#EFEFEA', card: '#FAFAF6', ink: '#1A1F2B', mut: '#5A6070', deep: '#1F2E4D', deep2: '#2B3D61', deep3: '#141F36', onDeep: '#EDE8DA', accent: '#82631B', accent2: '#6C5216', onAccent: '#FFF9EC', font: 'Playfair Display', petal: '#D8C48E' },
  { id: 'terakota', name: 'Terakota', paper: '#F4EBE1', card: '#FCF6EF', ink: '#2A1D17', mut: '#6B5B50', deep: '#8A3F24', deep2: '#9C4C2F', deep3: '#66301B', onDeep: '#FAEDE2', accent: '#4A5F4C', accent2: '#3B4C3D', onAccent: '#F6F3EA', font: 'Cormorant Garamond', petal: '#E9A784' },
  { id: 'lembayung', name: 'Lembayung', paper: '#F1EEF2', card: '#FAF8FB', ink: '#221E26', mut: '#625C69', deep: '#4F4064', deep2: '#5E4E75', deep3: '#382C49', onDeep: '#F1ECF4', accent: '#9A5A6E', accent2: '#834A5C', onAccent: '#FFF5F8', font: 'Great Vibes', petal: '#C9B2D9' },
  { id: 'champagne', name: 'Champagne', paper: '#F5F0E8', card: '#FDFAF4', ink: '#29241E', mut: '#6A6157', deep: '#6E5B44', deep2: '#806B52', deep3: '#4F4130', onDeep: '#F8F1E6', accent: '#9C5B3C', accent2: '#844B30', onAccent: '#FFF7F0', font: 'Parisienne', petal: '#E8C4A4' },
  { id: 'biru', name: 'Biru Kabus', paper: '#EDF0F2', card: '#F8FAFB', ink: '#1C2228', mut: '#59636C', deep: '#3F5A73', deep2: '#4D6A85', deep3: '#2B4055', onDeep: '#EEF2F5', accent: '#A4513F', accent2: '#8B4333', onAccent: '#FFF5F0', font: 'Cormorant Garamond', petal: '#B5C8DE' },
  { id: 'pandan', name: 'Pandan', paper: '#F1F2E6', card: '#FAFBF3', ink: '#1D2318', mut: '#5B6352', deep: '#3D5A2A', deep2: '#4A6B34', deep3: '#2A401C', onDeep: '#F2F3E4', accent: '#A84B24', accent2: '#8E3F1E', onAccent: '#FFF6EE', font: 'Gloock', petal: '#EDB48F' },
]

export const FONTS = ['Gloock', 'Cormorant Garamond', 'Playfair Display', 'Great Vibes', 'Parisienne']

// Preset + the couple's overrides, as plain hex colours (canvas needs literals, not color-mix)
export function resolve(theme) {
  const th = theme || {}
  const p = PRESETS.find((x) => x.id === th.preset) || PRESETS[0]
  const paper = th.paper || p.paper
  return { ...p, paper, card: th.paper ? paper : p.card, deep: th.deep || p.deep, accent: th.accent || p.accent, font: th.font || p.font, custom: th }
}

// CSS variables for a theme. Custom colours derive their shades with color-mix, so there is no colour maths here.
export function themeVars(theme) {
  const r = resolve(theme), c = r.custom
  const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`
  return {
    '--paper': r.paper, '--card': c.paper ? mix(r.paper, 40, 'white') : r.card, '--ink': r.ink, '--mut': r.mut,
    '--line': mix(r.ink, 12, 'transparent'), '--ctl': mix(r.ink, 22, 'transparent'), '--tint': mix(r.ink, 5, 'transparent'),
    '--deep': r.deep, '--deep-2': c.deep ? mix(r.deep, 85, 'white') : r.deep2, '--deep-3': c.deep ? mix(r.deep, 70, 'black') : r.deep3,
    '--on-deep': r.onDeep, '--on-deep-mut': mix(r.onDeep, 72, 'transparent'),
    '--accent': r.accent, '--accent-2': c.accent ? mix(r.accent, 85, 'black') : r.accent2, '--on-accent': r.onAccent,
    '--names': `'${r.font}', Georgia, serif`, '--ring': `0 0 0 3px ${mix(r.deep, 18, 'transparent')}`,
    '--sprig': `url("data:image/svg+xml,${encodeURIComponent(bouquet(r))}")`,
  }
}

// #RRGGBB a with t of b mixed in
export const hexMix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

// The envelope's corner bouquet in the wedding's colours: petals from the preset (or the couple's accent), leaves from the main colour.
// Bouquet centred at (110 95), stems trail to the bottom left; style.css offsets rely on that.
export function bouquet(r) {
  const c = r.custom
  const leaf = c.deep ? hexMix(r.deep, '#FFFFFF', 0.15) : r.deep2
  const petal = c.accent ? hexMix(r.accent, '#FFFFFF', 0.55) : r.petal
  const sage = hexMix(leaf, r.paper, 0.4), inner = hexMix(petal, r.accent, 0.5), line = hexMix(petal, r.card, 0.5)
  const leaves = (fill, list) => `<g fill="${fill}">${list.map((t) => `<use href="#l" transform="${t}"/>`).join('')}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>
<path id="l" d="M0 0C8-10 21-10 30 0C21 10 8 10 0 0Z"/>
<g id="p"><ellipse rx="7" ry="10" cy="-9"/><ellipse rx="7" ry="10" cy="-9" transform="rotate(72)"/><ellipse rx="7" ry="10" cy="-9" transform="rotate(144)"/><ellipse rx="7" ry="10" cy="-9" transform="rotate(216)"/><ellipse rx="7" ry="10" cy="-9" transform="rotate(288)"/></g>
<g id="f"><use href="#p" fill="${petal}"/><use href="#p" fill="${inner}" fill-opacity=".35" transform="scale(.55)"/><circle r="3.4" fill="#C9A15B"/></g>
<g id="g"><use href="#p" fill="${r.card}" stroke="${line}" stroke-width=".8"/><use href="#p" fill="${petal}" fill-opacity=".45" transform="scale(.5)"/><circle r="3" fill="#C9A15B"/></g>
</defs>
<g fill="none" stroke="${leaf}" stroke-width="1.6" stroke-linecap="round"><path d="M104 104C80 130 52 160 22 188"/><path d="M98 108C76 116 52 126 30 146"/><path d="M106 110C98 136 86 160 72 184"/></g>
${leaves(leaf, ['translate(80.5 89.8) rotate(-170)', 'translate(104.8 65.5) rotate(-100)', 'translate(138.2 84.7) rotate(-20)', 'translate(125 121) rotate(60)', 'translate(52 160) rotate(-150) scale(.8)', 'translate(84 152) rotate(110) scale(.75)'])}
${leaves(sage, ['translate(87 75.7) rotate(-140)', 'translate(125 69) rotate(-60)', 'translate(138.2 105.3) rotate(20)', 'translate(84 110) rotate(150)', 'translate(48 134) rotate(-120) scale(.75)', 'translate(40 172) rotate(170) scale(.7)'])}
<use href="#g" transform="translate(88 80) scale(1.05) rotate(15)"/><use href="#f" transform="translate(132 78) scale(1.15) rotate(30)"/><use href="#g" transform="translate(128 113) scale(.95) rotate(50)"/><use href="#f" transform="translate(96 114) scale(.9) rotate(5)"/><use href="#f" transform="translate(110 95) scale(1.45)"/>
<g fill="${petal}"><circle cx="152" cy="58" r="4.5"/><circle cx="68" cy="68" r="4"/><circle cx="156" cy="126" r="3.5"/><circle cx="30" cy="146" r="3.5"/><circle cx="72" cy="184" r="3"/></g></svg>`
}

// Gloock ships in index.html; the others load only when a theme uses them
export function loadFont(name) {
  if (name === 'Gloock' || document.querySelector(`link[data-font="${name}"]`)) return
  const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}&display=swap` })
  l.dataset.font = name
  document.head.append(l)
}

let applied = []
// Themes the whole page: Invite, Guestbook (and the Recorder inside them), Gallery
export function applyTheme(theme) {
  const s = document.documentElement.style
  for (const k of applied) s.removeProperty(k)
  const v = themeVars(theme)
  applied = Object.keys(v)
  for (const k of applied) s.setProperty(k, v[k])
  loadFont(resolve(theme).font)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', v['--paper'])
}

// WCAG contrast ratio of two #RRGGBB colours
const lum = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((x) => {
    const c = parseInt(x, 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Pairs that carry text; anything under 4.5:1 gets a warning in admin
export const textPairs = (r) => [['Text on paper', r.ink, r.paper], ['Muted text on paper', r.mut, r.paper], ['Text on main colour', r.onDeep, r.deep], ['Text on accent', r.onAccent, r.accent]]

// ---- photo frames ----
// Output pixels. A couple's overlay PNG must have this shape (any size, it's scaled) and be transparent over the windows ([x, y, w, h]).
export const LAYOUTS = {
  single: { ratio: '4:5', w: 1080, h: 1350, wins: [[60, 60, 960, 1000]], cap: [1060, 290] },
  strip: { ratio: '1:3', w: 1080, h: 3240, wins: [[60, 60, 960, 933], [60, 1033, 960, 933], [60, 2006, 960, 933]], cap: [2939, 301] },
}

// The three built-in frames, in the wedding's colours (#RRGGBBAA for the soft ones)
export const frameStyles = (r) => [
  { bg: r.card, bd: r.ink + '33', fg: r.ink, sub: r.mut },
  { bg: r.deep, bd: null, fg: r.onDeep, sub: r.onDeep + 'B8' },
  { bg: r.paper, bd: r.accent, fg: r.ink, sub: r.accent },
]

// Source rect that fills a w x h window from a sw x sh image (centre crop)
export function cover(sw, sh, w, h) {
  const k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k
  return [(sw - cw) / 2, (sh - ch) / 2, cw, ch]
}

// shots: canvases/images, already mirrored for the selfie camera. style: a frameStyles entry, or { overlay: Image, ...colours }.
// L is a LAYOUTS entry, or a couple's own fit (fitSingle/fitStrip): `under` puts the design behind the photos,
// `parts` copies slices of the design ([sy, sh, dy, flip?] in layout px, design scaled to width L.w; flip mirrors it top to bottom),
// `fill` colours the gaps. logo: the Sepatah icon (an Image), drawn as a small lockup at L.logoY, or at the foot of the caption,
// or of the design if it owns the caption.
export function compose(L, shots, style, { couple, date, font, logo }) {
  const c = Object.assign(document.createElement('canvas'), { width: L.w, height: L.h })
  const g = c.getContext('2d')
  const art = style.overlay
  g.fillStyle = L.fill || style.bg || '#fff'
  g.fillRect(0, 0, L.w, L.h)
  const drawArt = () => {
    const k = art.width / L.w
    for (const [sy, sh, dy, flip] of L.parts || [[0, L.h, 0]]) {
      g.save()
      if (flip) {
        g.translate(0, 2 * dy + sh)
        g.scale(1, -1)
      }
      g.drawImage(art, 0, sy * k, art.width, sh * k, 0, dy, L.w, sh)
      g.restore()
    }
  }
  if (art && L.under) drawArt()
  L.wins.forEach(([x, y, w, h], i) => g.drawImage(shots[i], ...cover(shots[i].width, shots[i].height, w, h), x, y, w, h))
  if (art && !L.under) drawArt()
  // a template-made design carries its own caption; a fitted one gets ours only if Mato left it on
  const ours = art ? L.own && L.cap : L.cap
  if (ours) {
    if (!art && style.bd) {
      g.strokeStyle = style.bd
      g.lineWidth = 4
      g.strokeRect(2, 2, L.w - 4, L.h - 4)
    }
    const [cy, ch] = L.cap, up = logo ? 0.1 : 0 // names and date move up to leave the logo room
    g.textAlign = 'center'
    g.fillStyle = style.fg
    // long couple names shrink to fit the caption; a short caption band starts smaller
    let size = Math.min(86, Math.round(ch * 0.32))
    do g.font = `${size}px "${font}", Georgia, serif`
    while (g.measureText(couple).width > L.w - 100 && (size -= 4) > 30)
    g.fillText(couple, L.w / 2, cy + ch * (0.48 - up))
    g.fillStyle = style.sub
    g.font = `600 ${Math.min(43, Math.round(ch * 0.16))}px Figtree, sans-serif`
    g.fillText(date, L.w / 2, cy + ch * (0.8 - up))
  }
  if (logo) {
    // icon + "sepatah." on a pill in the frame colour, so it reads over a couple's artwork too
    const s = 36, y = L.logoY ?? (ours ? L.cap[0] + L.cap[1] : L.h) - 40
    g.font = '400 30px "Young Serif", Georgia, serif'
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    const tw = g.measureText('sepatah.').width, x = (L.w - s - 10 - tw) / 2
    g.fillStyle = style.bg
    g.beginPath()
    g.roundRect(x - 14, y - s / 2 - 8, s + tw + 38, s + 16, (s + 16) / 2)
    g.fill()
    g.drawImage(logo, x, y - s / 2, s, s)
    g.fillStyle = style.sub
    g.fillText('sepatah.', x + s + 10, y)
  }
  return c
}

// ---- a couple's own frame in any size or shape ----
// See-through areas that don't touch the image edge (holes in the frame), as [x, y, w, h], biggest first.
// alpha: one 0..255 value per pixel, w x h. Holes smaller than `min` of the image don't count.
export function findHoles(alpha, w, h, min = 0.05) {
  const mark = new Int32Array(w * h) // 0 = not visited, -1 = outside, >0 = a hole
  const fill = (start, id) => {
    const stack = [start]
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0
    mark[start] = id
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (const [j, ok] of [[i - 1, x > 0], [i + 1, x < w - 1], [i - w, y > 0], [i + w, y < h - 1]]) {
        if (ok && !mark[j] && alpha[j] < 128) {
          mark[j] = id
          stack.push(j)
        }
      }
    }
    return { n, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] }
  }
  for (let x = 0; x < w; x++) for (const i of [x, (h - 1) * w + x]) if (!mark[i] && alpha[i] < 128) fill(i, -1)
  for (let y = 0; y < h; y++) for (const i of [y * w, y * w + w - 1]) if (!mark[i] && alpha[i] < 128) fill(i, -1)
  const out = []
  let id = 0
  for (let i = 0; i < w * h; i++) {
    if (mark[i] || alpha[i] >= 128) continue
    const r = fill(i, ++id)
    if (r.n >= w * h * min) out.push(r)
  }
  return out.sort((a, b) => b.n - a.n).map((r) => r.box)
}
export const findHole = (alpha, w, h) => findHoles(alpha, w, h)[0] || null

// Where photos can go in a design: see-through pixels, plus pixels the colour of its centre when that's solid
// (the empty boxes a designer leaves for photos). rgba: 4 bytes per pixel → { mask: alpha-like for findHoles, solid }.
export function photoMask(rgba, w, h) {
  const c = ((h >> 1) * w + (w >> 1)) * 4, solid = rgba[c + 3] === 255, mask = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const near = solid && rgba[p + 3] === 255 && Math.abs(rgba[p] - rgba[c]) + Math.abs(rgba[p + 1] - rgba[c + 1]) + Math.abs(rgba[p + 2] - rgba[c + 2]) < 48
    mask[i] = rgba[p + 3] < 128 || near ? 0 : 255
  }
  return { mask, solid }
}

// A design with its own photo areas, used as is: photos fill them top to bottom. Solid areas (under) take the photo on top
// of the design; see-through ones get a little bleed under the design's edge. holes: [x, y, w, h] in the design's bw x bh pixels.
export function fitHoles(bw, bh, holes, under = false) {
  const w = 1080, k = w / bw, h = Math.round(bh * k), b = under ? 0 : 4
  const wins = holes.map((hole) => {
    const [x, y, hw, hh] = hole.map((v) => Math.round(v * k)), x0 = Math.max(0, x - b), y0 = Math.max(0, y - b)
    return [x0, y0, Math.min(w, x + hw + b) - x0, Math.min(h, y + hh + b) - y0]
  })
  return { own: true, w, h, under, cap: null, wins: wins.sort((p, q) => p[1] - q[1] || p[0] - q[0]) }
}

// Strip from a design with one empty box (a kad with a blank middle): the box grows to hold three photos and the logo.
// The design above and below the box stays as is; the rows across the box repeat, every other copy mirrored so the
// sides join without a seam. The design's own names stay in its footer, so no caption of ours.
export function fitBox(bw, bh, box) {
  const w = 1080, k = w / bw, d = Math.round(bh * k), [bx, by, bW, bH] = box.map((v) => Math.round(v * k))
  const pad = Math.max(24, Math.round(bW * 0.05)), ww = bW - 2 * pad, wh = Math.round((ww * 933) / 960), foot = 110
  const T = Math.max(bH, pad + 3 * wh + 2 * pad + foot), parts = []
  for (let y = 0; y < T; y += bH) parts.push([by, bH, by + y, parts.length % 2 === 1])
  parts.push([0, by, 0], [by + bH, d - by - bH, by + T]) // header and footer last: they cover the last copy's overhang
  return {
    own: true, w, h: d - bH + T, under: true, cap: null, parts, logoY: by + T - foot / 2,
    wins: [0, 1, 2].map((i) => [bx + pad, by + pad + i * (wh + pad), ww, wh]),
  }
}

// Window moved or resized in admin; the caption (if on) fills the space below it
export const placeWin = (L, win, capOn = !!L.cap) => ({ ...L, wins: [win], cap: capOn && L.h - win[1] - win[3] >= 120 ? [win[1] + win[3], L.h - win[1] - win[3]] : null })

// Single photo from a design of any size (bw x bh). hole: findHole's box in the same pixels, or null.
export function fitSingle(bw, bh, hole) {
  if (hole) return fitHoles(bw, bh, [hole]) // photo fills the hole; the design goes on top
  const w = 1080, h = Math.round(bh * (w / bw))
  // no hole: the design is the background, the photo sits on top where Mato drags it, names underneath
  const ww = Math.round(w * 0.76), wh = Math.round(Math.min(h * 0.55, ww * 1.1))
  return placeWin({ own: true, w, h, under: true }, [Math.round((w - ww) / 2), Math.round(h * 0.12), ww, wh], true)
}

// Strip from a design of any size: its top and bottom become the header and footer, three photos between.
// A short banner (under 600 px tall at 1080 wide) is used whole as the header. fill: colour for the middle.
export function fitStrip(bw, bh, fill) {
  const w = 1080, d = Math.round((w * bh) / bw)
  const s = d <= 600 ? d : Math.min(Math.round(d / 2), 480), foot = d <= 600 ? 0 : s
  const wh = 933, gap = 40, top = s + gap
  const capY = top + 3 * wh + 2 * gap, h = capY + 300 + foot
  return {
    own: true, w, h, under: true, fill, cap: [capY, 300],
    wins: [0, 1, 2].map((i) => [60, top + i * (wh + gap), 960, wh]),
    parts: foot ? [[0, s, 0], [d - s, s, h - s]] : [[0, s, 0]],
  }
}

// A frame PNG that isn't see-through in the middle of a window would cover the guests' photos. alphaAt(x, y) → 0..255
export function frameProblem(L, alphaAt) {
  const bad = L.wins.findIndex(([x, y, w, h]) => [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8]].some(([fx, fy]) => alphaAt(Math.round(x + w * fx), Math.round(y + h * fy)) > 0))
  return bad < 0 ? '' : `Photo window ${bad + 1} isn't transparent, so it would cover the guests' photos. Start from the template and leave the windows empty.`
}

// Soft warnings for kad artwork (upload still goes ahead). rgba: the image's pixels, 4 bytes each.
export function artWarnings(type, width, rgba) {
  const out = []
  if (width < 1080) out.push(`It's only ${width} px wide, so it may look blurry on phones (1080 px or more is best).`)
  let seeThrough = false
  for (let i = 3; i < rgba.length && !seeThrough; i += 4) seeThrough = rgba[i] < 255
  if (type === 'image/png' && !seeThrough) out.push("This PNG has no transparent areas. If it shows a grey-and-white checkerboard, that's part of the picture (common with images from Google), not real transparency.")
  return out
}

// Blank template for the couple's designer: frame area filled, windows cut out and outlined
export function template(name) {
  const L = LAYOUTS[name]
  const c = Object.assign(document.createElement('canvas'), { width: L.w, height: L.h })
  const g = c.getContext('2d')
  g.fillStyle = '#E8E2D6'
  g.fillRect(0, 0, L.w, L.h)
  g.setLineDash([16, 12])
  g.lineWidth = 4
  g.strokeStyle = '#C4472D'
  g.fillStyle = '#5C635D'
  g.textAlign = 'center'
  g.font = '600 40px Figtree, sans-serif'
  // guides stay outside the windows, so a forgotten guide never prints on a guest's photo
  for (const [x, y, w, h] of L.wins) {
    g.clearRect(x, y, w, h)
    g.strokeRect(x - 6, y - 6, w + 12, h + 12)
  }
  g.fillText(`${L.w} x ${L.h} PNG · design the frame and caption`, L.w / 2, L.cap[0] + L.cap[1] * 0.42)
  g.fillText(`keep the ${L.wins.length > 1 ? 'photo windows' : 'photo window'} transparent`, L.w / 2, L.cap[0] + L.cap[1] * 0.68)
  return c.toDataURL('image/png')
}

// Reserves the couple's artwork box before it loads (no layout shift). size = [w, h] saved at upload; older events have none.
export const kadBox = (size, dvh) => size && { aspectRatio: `${size[0]} / ${size[1]}`, width: `min(100%, ${(dvh * size[0]) / size[1]}dvh)` }

// ---- video wish frame ----
// The recorder's look, baked into the video: names on top, then the camera in the arch (keyline + two bouquets),
// or in the couple's artwork: shown whole with the camera in its empty box, else 9-sliced at 18% like the CSS border-image.
export const REC = { width: 720, height: 1280 }

// The empty box in a couple's artwork (a kad with a blank middle) as fractions [x, y, w, h] of the image, or null.
// img must be CORS-readable. Found on a small copy, like the photo frames.
export function artBox(img) {
  const w = Math.min(360, img.width), h = Math.round((img.height * w) / img.width)
  const g = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, w, h)
  const b = findHoles(photoMask(g.getImageData(0, 0, w, h).data, w, h).mask, w, h, 0.1)[0]
  return b && b[2] >= w * 0.4 ? [b[0] / w, b[1] / h, b[2] / w, b[3] / h] : null
}

// ar: the artwork's width / height, or null for the arch. box: artBox's fractions, or null. Window is 3:4 like .cam, or the box.
export function recLayout(ar, head, box) {
  if (box) {
    const headH = head ? 150 : 0, fw = Math.round(Math.min(680, (REC.height - headH - 60) * ar)), fh = Math.round(fw / ar)
    const fx = (REC.width - fw) / 2, fy = Math.round((REC.height - fh - headH) / 2) + headH, [bx, by, bw, bh] = box
    return { frame: [fx, fy, fw, fh], win: [fx + bx * fw, fy + by * fh, bw * fw, bh * fh].map(Math.round), pad: null, headY: fy - headH }
  }
  const w = 564, h = 752
  const [px, py] = ar ? [44, Math.round(44 / Math.max(ar, 0.35))] : [9, 9]
  const fw = w + 2 * px, fh = h + 2 * py, headH = head ? 150 : 0
  const fx = (REC.width - fw) / 2, fy = Math.round((REC.height - fh - headH) / 2) + headH
  return { frame: [fx, fy, fw, fh], win: [fx + px, fy + py, w, h], pad: [px, py], headY: fy - headH }
}

// border-image: <img> 18% round, onto the frame rect with border widths bx, by
function nineSlice(g, img, [x, y, w, h], [bx, by]) {
  const iw = img.width, ih = img.height, sx = iw * 0.18, sy = ih * 0.18, mw = iw - 2 * sx, mh = ih - 2 * sy
  const dw = w - 2 * bx, dh = h - 2 * by
  for (const [cx, cy, dx, dy] of [[0, 0, x, y], [iw - sx, 0, x + w - bx, y], [0, ih - sy, x, y + h - by], [iw - sx, ih - sy, x + w - bx, y + h - by]])
    g.drawImage(img, cx, cy, sx, sy, dx, dy, bx, by)
  // 'round': tiles keep their scale, then stretch so a whole number fits (+.5 px hides seams)
  const nx = Math.max(1, Math.round(dw / ((mw * by) / sy))), tw = dw / nx
  for (let i = 0; i < nx; i++) {
    g.drawImage(img, sx, 0, mw, sy, x + bx + i * tw, y, tw + 0.5, by)
    g.drawImage(img, sx, ih - sy, mw, sy, x + bx + i * tw, y + h - by, tw + 0.5, by)
  }
  const ny = Math.max(1, Math.round(dh / ((mh * bx) / sx))), th = dh / ny
  for (let i = 0; i < ny; i++) {
    g.drawImage(img, 0, sy, sx, mh, x, y + by + i * th, bx, th + 0.5)
    g.drawImage(img, iw - sx, sy, sx, mh, x + w - bx, y + by + i * th, bx, th + 0.5)
  }
}

// r: resolve(theme). art / sprig: loaded Images (either may be null). Returns the still layers and the camera window;
// per frame: bg, then the camera clipped by clip(g), then top.
export function recLayers(r, { couple, label, art, sprig, box }) {
  const L = recLayout(art && art.width / art.height, !!couple, art && box)
  const [fx, fy, fw, fh] = L.frame, [wx, wy, ww, wh] = L.win
  const layer = () => Object.assign(document.createElement('canvas'), REC)
  const bg = layer(), g = bg.getContext('2d')
  g.fillStyle = r.paper
  g.fillRect(0, 0, REC.width, REC.height)
  if (couple) {
    g.textAlign = 'center'
    g.fillStyle = r.mut
    g.font = '400 21px Figtree, sans-serif'
    g.letterSpacing = '3px'
    g.fillText(label.toUpperCase(), REC.width / 2, L.headY + 40)
    g.letterSpacing = '0px'
    g.fillStyle = r.deep
    let size = 56
    do g.font = `${size}px "${r.font}", Georgia, serif`
    while (g.measureText(couple).width > REC.width - 80 && (size -= 4) > 28)
    g.fillText(couple, REC.width / 2, L.headY + 110)
  }
  const clip = (c) => {
    c.beginPath()
    c.roundRect(wx, wy, ww, wh, art ? (box ? 4 : 12) : [ww / 2, ww / 2, 36, 36])
  }
  let top = null
  if (art && box) g.drawImage(art, fx, fy, fw, fh)
  else if (art) {
    g.fillStyle = r.custom.paper ? hexMix(r.paper, '#FFFFFF', 0.6) : r.card
    g.fillRect(fx, fy, fw, fh)
    nineSlice(g, art, L.frame, L.pad)
  } else {
    g.strokeStyle = hexMix(r.deep, r.paper, 0.7)
    g.lineWidth = 2.5
    g.beginPath()
    g.roundRect(fx, fy, fw, fh, [fw / 2, fw / 2, 45, 45])
    g.stroke()
    if (sprig) {
      // same spots as .cam-frame::before / ::after
      top = layer()
      const t = top.getContext('2d'), s = fw * 0.38
      t.drawImage(sprig, fx - fw * 0.12, fy + fh * 0.06, s, s)
      t.translate(fx + fw * 1.12 - s / 2, fy + fh * 1.09 - s / 2)
      t.rotate(Math.PI)
      t.drawImage(sprig, -s / 2, -s / 2, s, s)
    }
  }
  g.fillStyle = r.deep // shows until the first camera frame
  clip(g)
  g.fill()
  return { bg, top, win: L.win, clip }
}
