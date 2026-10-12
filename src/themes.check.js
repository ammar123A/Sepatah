// Runnable check for src/themes.js: npm run check
import assert from 'node:assert/strict'
import { PRESETS, FONTS, LAYOUTS, resolve, themeVars, contrast, textPairs, cover, bouquet, hexMix, frameProblem, artWarnings, findHole, fitSingle, fitStrip, placeWin } from './themes.js'

assert.equal(PRESETS.length, 10)
assert.equal(new Set(PRESETS.map((p) => p.id)).size, 10, 'preset ids are unique')
for (const p of PRESETS) {
  assert.ok(FONTS.includes(p.font), `${p.id} font is in FONTS`)
  for (const [what, a, b] of textPairs(resolve({ preset: p.id }))) assert.ok(contrast(a, b) >= 4.5, `${p.id}: ${what} ${contrast(a, b).toFixed(2)}`)
}

assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0')
assert.equal(contrast('#777777', '#777777'), 1)

// unknown or missing preset falls back to the original Sepatah look, which matches style.css :root
assert.equal(resolve(null).id, 'zamrud')
assert.equal(resolve({ preset: 'nope' }).deep, '#1F3A2D')
const custom = resolve({ preset: 'sage', deep: '#112233', font: 'Great Vibes' })
assert.equal(custom.deep, '#112233')
assert.equal(custom.accent, PRESETS[1].accent)
assert.match(themeVars({ deep: '#112233' })['--deep-3'], /color-mix\(in srgb, #112233 70%, black\)/)
assert.equal(themeVars(null)['--deep-3'], '#142A1F', 'presets keep their exact shades')
// every design gets the envelope bouquet; Zamrud keeps the original leaf and petal colours
for (const p of PRESETS) assert.ok(bouquet(resolve({ preset: p.id })).includes(p.petal), `${p.id} bouquet uses its petal colour`)
const z = bouquet(resolve(null))
assert.ok(z.includes('#2A4C3B') && z.includes('#E8A48F'))
assert.ok(bouquet(resolve({ accent: '#000000' })).includes('#8c8c8c'), 'custom accent → petals mixed toward white')
assert.match(themeVars(null)['--sprig'], /^url\("data:image\/svg\+xml,%3Csvg/)
assert.equal(hexMix('#000000', '#FFFFFF', 0.5), '#808080')

for (const [name, L] of Object.entries(LAYOUTS)) {
  const boxes = [...L.wins, [0, L.cap[0], L.w, L.cap[1]]]
  for (const [x, y, w, h] of boxes) assert.ok(x >= 0 && y >= 0 && x + w <= L.w && y + h <= L.h, `${name} box inside canvas`)
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][1] >= boxes[i - 1][1] + boxes[i - 1][3], `${name} boxes don't overlap`)
}

for (const L of Object.values(LAYOUTS)) { const [a, b] = L.ratio.split(':'); assert.equal(L.w / L.h, a / b, 'ratio label matches the size') }

// photo frame upload: windows must be see-through
const clear = () => 0
assert.equal(frameProblem(LAYOUTS.strip, clear), '')
const [, [x2, y2, w2, h2]] = LAYOUTS.strip.wins
assert.match(frameProblem(LAYOUTS.strip, (x, y) => (x > x2 && x < x2 + w2 && y > y2 && y < y2 + h2 ? 255 : 0)), /window 2 /)
assert.match(frameProblem(LAYOUTS.single, () => 255), /window 1 /)

// any-size frames: find the see-through hole
const img = (w, h, f) => Uint8Array.from({ length: w * h }, (_, i) => f(i % w, Math.floor(i / w)))
assert.deepEqual(findHole(img(100, 80, (x, y) => (x >= 20 && x < 80 && y >= 10 && y < 50 ? 0 : 255)), 100, 80), [20, 10, 60, 40])
// transparent margin around the whole design is "outside", not a hole
assert.deepEqual(findHole(img(100, 100, (x, y) => (x < 5 || x > 94 || (x >= 30 && x < 70 && y >= 30 && y < 70) ? 0 : 255)), 100, 100), [30, 30, 40, 40])
assert.equal(findHole(img(100, 100, () => 255), 100, 100), null, 'solid design')
assert.equal(findHole(img(100, 100, (x, y) => (x === 50 && y === 50 ? 0 : 255)), 100, 100), null, 'a speck is not a hole')
assert.equal(findHole(img(100, 100, (x) => (x > 50 ? 0 : 255)), 100, 100), null, 'open to the edge')

const hole = fitSingle(2000, 2000, [500, 400, 1000, 1000])
assert.deepEqual([hole.w, hole.h, hole.under, hole.cap], [1080, 1080, false, null])
assert.deepEqual(hole.wins, [[266, 212, 548, 548]], 'hole scaled to 1080 wide, 4 px bleed')
const bg = fitSingle(800, 1200, null)
assert.ok(bg.under && bg.h === 1620 && bg.cap[0] === bg.wins[0][1] + bg.wins[0][3] && bg.cap[0] + bg.cap[1] === bg.h, 'no hole: photo on top, caption below')
assert.equal(placeWin(bg, [0, 0, 500, 1550]).cap, null, 'no room left for a caption')
assert.equal(placeWin(bg, [0, 0, 500, 500], false).cap, null, 'caption switched off')

for (const [bw, bh, parts] of [[1080, 1440, 2], [1080, 300, 1]]) {
  const S = fitStrip(bw, bh, '#ffffff')
  assert.equal(S.parts.length, parts)
  const boxes = [...S.parts.map(([, sh, dy]) => [0, dy, S.w, sh]), ...S.wins, [0, S.cap[0], S.w, S.cap[1]]].sort((a, b) => a[1] - b[1])
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][1] >= boxes[i - 1][1] + boxes[i - 1][3], `strip ${bw}x${bh}: nothing overlaps`)
  const last = boxes.at(-1)
  assert.equal(last[1] + last[3], S.h, 'footer (or caption) ends the strip')
}

// kad artwork warnings
const px = (n, a) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? a : 200))
assert.deepEqual(artWarnings('image/png', 1500, px(4, 0)), [], 'big, really transparent PNG')
assert.equal(artWarnings('image/png', 600, px(4, 255)).length, 2, 'small + fake transparency')
assert.equal(artWarnings('image/jpeg', 2000, px(4, 255)).length, 0, 'JPGs are never transparent, no warning')

assert.deepEqual(cover(1280, 720, 960, 960), [280, 0, 720, 720], 'landscape → square crops the sides')
assert.deepEqual(cover(720, 1280, 960, 480), [0, 460, 720, 360], 'portrait → wide crops top and bottom')

console.log('themes ok')
