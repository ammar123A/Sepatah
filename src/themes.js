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
// `parts` copies slices of the design ([sy, sh, dy] in layout px, design scaled to width L.w), `fill` colours the gaps.
export function compose(L, shots, style, { couple, date, font }) {
  const c = Object.assign(document.createElement('canvas'), { width: L.w, height: L.h })
  const g = c.getContext('2d')
  const art = style.overlay
  g.fillStyle = L.fill || style.bg || '#fff'
  g.fillRect(0, 0, L.w, L.h)
  const drawArt = () => {
    const k = art.width / L.w
    for (const [sy, sh, dy] of L.parts || [[0, L.h, 0]]) g.drawImage(art, 0, sy * k, art.width, sh * k, 0, dy, L.w, sh)
  }
  if (art && L.under) drawArt()
  L.wins.forEach(([x, y, w, h], i) => g.drawImage(shots[i], ...cover(shots[i].width, shots[i].height, w, h), x, y, w, h))
  if (art && !L.under) drawArt()
  // a template-made design carries its own caption; a fitted one gets ours only if Mato left it on
  if (art ? !L.own || !L.cap : !L.cap) return c
  if (!art && style.bd) {
    g.strokeStyle = style.bd
    g.lineWidth = 4
    g.strokeRect(2, 2, L.w - 4, L.h - 4)
  }
  const [cy, ch] = L.cap
  g.textAlign = 'center'
  g.fillStyle = style.fg
  // long couple names shrink to fit the caption; a short caption band starts smaller
  let size = Math.min(86, Math.round(ch * 0.32))
  do g.font = `${size}px "${font}", Georgia, serif`
  while (g.measureText(couple).width > L.w - 100 && (size -= 4) > 30)
  g.fillText(couple, L.w / 2, cy + ch * 0.48)
  g.fillStyle = style.sub
  g.font = `600 ${Math.min(43, Math.round(ch * 0.16))}px Figtree, sans-serif`
  g.fillText(date, L.w / 2, cy + ch * 0.8)
  return c
}

// ---- a couple's own frame in any size or shape ----
// Biggest see-through area that doesn't touch the image edge (a hole in the frame), as [x, y, w, h], or null.
// alpha: one 0..255 value per pixel, w x h. Holes smaller than 5% of the image don't count.
export function findHole(alpha, w, h) {
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
  let best = null, id = 0
  for (let i = 0; i < w * h; i++) {
    if (mark[i] || alpha[i] >= 128) continue
    const r = fill(i, ++id)
    if (!best || r.n > best.n) best = r
  }
  return best && best.n >= w * h * 0.05 ? best.box : null
}

// Window moved or resized in admin; the caption (if on) fills the space below it
export const placeWin = (L, win, capOn = !!L.cap) => ({ ...L, wins: [win], cap: capOn && L.h - win[1] - win[3] >= 120 ? [win[1] + win[3], L.h - win[1] - win[3]] : null })

// Single photo from a design of any size (bw x bh). hole: findHole's box in the same pixels, or null.
export function fitSingle(bw, bh, hole) {
  const w = 1080, k = w / bw, h = Math.round(bh * k)
  if (hole) {
    // photo fills the hole with a little bleed under the design's edge; the design goes on top
    const [x, y, hw, hh] = hole.map((v) => Math.round(v * k)), b = 4
    const x0 = Math.max(0, x - b), y0 = Math.max(0, y - b)
    return { own: true, w, h, under: false, cap: null, wins: [[x0, y0, Math.min(w, x + hw + b) - x0, Math.min(h, y + hh + b) - y0]] }
  }
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
