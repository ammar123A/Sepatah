// Runnable check for src/themes.js: npm run check
import assert from 'node:assert/strict'
import { PRESETS, FONTS, LAYOUTS, resolve, themeVars, contrast, textPairs, cover, bouquet, hexMix, frameProblem, artWarnings, findHole, findHoles, photoMask, fitHoles, fitBox, fitSingle, fitStrip, placeWin, recLayout, REC } from './themes.js'

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

// the couple's own strip design: blank boxes in its centre colour are the photo areas
const rgba = (w, h, f) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) a.set(f(i % w, Math.floor(i / w)), i * 4); return a }
const RED = [150, 20, 30, 255], CREAM = [245, 238, 225, 255]
const three = photoMask(rgba(100, 300, (x, y) => (x >= 10 && x < 90 && [[10, 90], [105, 185], [200, 280]].some(([a, b]) => y >= a && y < b) ? CREAM : RED)), 100, 300)
const boxes3 = findHoles(three.mask, 100, 300, 0.03)
assert.ok(three.solid && boxes3.length === 3, 'three solid boxes found')
assert.deepEqual(fitHoles(100, 300, boxes3, true).wins, [[108, 108, 864, 864], [108, 1134, 864, 864], [108, 2160, 864, 864]], 'used as is, top to bottom, no bleed')
assert.equal(findHoles(photoMask(rgba(100, 300, () => RED), 100, 300).mask, 100, 300, 0.03).length, 0, 'plain design: no boxes')

// a kad with one blank box: the box grows to hold three photos, header and footer kept
const kad = findHoles(photoMask(rgba(100, 125, (x, y) => (x >= 15 && x < 85 && y >= 30 && y < 95 ? CREAM : RED)), 100, 125).mask, 100, 125, 0.03)
assert.deepEqual(kad, [[15, 30, 70, 65]])
const B = fitBox(100, 125, kad[0]), [bx, by, bw, bh] = kad[0].map((v) => Math.round(v * 10.8))
for (const [x, y, w, h] of B.wins) assert.ok(x >= bx && x + w <= bx + bw && y >= by, 'photos inside the box')
for (let i = 1; i < 3; i++) assert.ok(B.wins[i][1] > B.wins[i - 1][1] + B.wins[i - 1][3], 'photos do not overlap')
const [head, foot] = B.parts.slice(-2), boxEnd = foot[2]
assert.deepEqual(head, [0, by, 0])
assert.ok(B.wins[2][1] + B.wins[2][3] < B.logoY && B.logoY < boxEnd && foot[2] + foot[1] === B.h, 'logo under the photos, footer ends the strip')
const tiles = B.parts.slice(0, -2)
assert.ok(tiles.every(([sy, sh, dy], i) => sy === by && sh === bh && dy === by + i * bh) && tiles.at(-1)[2] + bh >= boxEnd, 'box rows repeat to the footer')
assert.deepEqual(tiles.map((t) => t[3]), tiles.map((_, i) => i % 2 === 1), 'every other copy mirrored')

// kad artwork warnings
const px = (n, a) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? a : 200))
assert.deepEqual(artWarnings('image/png', 1500, px(4, 0)), [], 'big, really transparent PNG')
assert.equal(artWarnings('image/png', 600, px(4, 255)).length, 2, 'small + fake transparency')
assert.equal(artWarnings('image/jpeg', 2000, px(4, 255)).length, 0, 'JPGs are never transparent, no warning')

assert.deepEqual(cover(1280, 720, 960, 960), [280, 0, 720, 720], 'landscape → square crops the sides')
assert.deepEqual(cover(720, 1280, 960, 480), [0, 460, 720, 360], 'portrait → wide crops top and bottom')

console.log('themes ok')

// video wish frame: the camera window stays 3:4 and inside the 720 x 1280 video, below the names
for (const ar of [null, 0.71, 1, 1.6, 0.2]) for (const head of [true, false]) {
  const { frame: [fx, fy, fw, fh], win: [x, y, w, h], headY } = recLayout(ar, head)
  assert.equal(w * 4, h * 3)
  assert.ok(fx >= 0 && fy >= 0 && fx + fw <= REC.width && fy + fh <= REC.height, `frame fits for ar ${ar}`)
  assert.ok(x > fx && y > fy && x + w < fx + fw && y + h < fy + fh)
  assert.ok(headY >= 0)
}
