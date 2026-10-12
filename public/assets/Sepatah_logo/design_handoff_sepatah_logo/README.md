# Handoff: Sepatah logo (option 3a)

## Overview
Logo for Sepatah, a Malaysian wedding platform (Vue 3 + Vite + Supabase). Selected option: an arch-shaped green tile holding a lowercase "s", with the wordmark "sepatah." underneath. Use it on the invitation site, admin shell, live screen, QR table card, favicon and app icon.

## About the Design Files
`Sepatah Logo Final.dc.html` is a design reference built in HTML. It is not production code. Recreate the logo in the Vue app as a component (`SepatahLogo.vue`, below) and as static SVG/PNG exports for favicon, QR card and print.

## Fidelity
High fidelity. Colors, fonts, proportions and variants are final.

## Logo anatomy (primary, stacked)
Scale everything from the base unit **u = mark width**. Values below are for mark width 128 px.

- **Arch tile**: 128 w x 174 h (ratio 1 : 1.36). `border-radius: 64px 64px 0 0` (half the width on top corners, square bottom). Fill `#1F3A2D`.
- **Letter "s"**: lowercase, font **Gloock** 400, 108 px (0.84 x mark width), color `#F2EDE3`, `line-height: 1`, centered in the tile, nudged down 10 px (`margin-top`), which optically centers the x-height.
- **Gap** between tile and wordmark: 26 px (0.2 x mark width).
- **Wordmark**: "sepatah" in **Young Serif** 400, lowercase, 58 px (0.45 x mark width), `letter-spacing: -1px`, `line-height: 1`, color `#1F3A2D`, followed by a full stop "." in `#C4472D`.
- Stack is horizontally centered.

## Variants
| Variant | Background | Tile | "s" | Wordmark | Dot |
|---|---|---|---|---|---|
| Primary | `#F2EDE3` | `#1F3A2D` | `#F2EDE3` | `#1F3A2D` | `#C4472D` |
| Reversed | `#1F3A2D` | `#F2EDE3` | `#1F3A2D` | `#F2EDE3` | `#C4472D` |
| Square icon (app icon) | `#1F3A2D`, radius 22 px at 96 px | arch 52x70, `#F2EDE3`, bottom-aligned, tile clipped by square | `#1F3A2D`, Gloock 44 px | none | none |
| Round icon (avatar) | `#1F3A2D` circle, 48 px | arch 26x35, bottom-aligned | `#1F3A2D`, Gloock 22 px | none | none |

Icon sizing rule: arch width = 54% of container, arch height = 73% of container, "s" size = 0.85 x arch width, arch sits on the container's bottom edge.

## Usage rules
- Minimum size: stacked logo 64 px mark width; below that use an icon variant only.
- Clear space: at least the width of the letter "s" (about 0.4 x mark width) on all sides.
- The terracotta dot is the only use of the accent color. Do not recolor it, remove it in the wordmark, or add it to icons.
- Do not stretch, outline, add shadows or gradients, or swap fonts.

## Design tokens
- Paper `#F2EDE3`, deep green `#1F3A2D`, accent `#C4472D`, ink `#1C221E`
- Fonts (Google Fonts): Gloock (monogram), Young Serif (wordmark). Self-host both for production and for the PDF QR card (embed or convert wordmark to outlines).

## Implementation (Vue 3)
```vue
<!-- SepatahLogo.vue -->
<script setup>
const props = defineProps({ size: { type: Number, default: 128 }, reversed: Boolean })
</script>
<template>
  <div class="logo" :style="{ '--u': props.size + 'px' }" role="img" aria-label="Sepatah">
    <div class="mark" :class="{ rev: reversed }"><span>s</span></div>
    <div class="word" :class="{ rev: reversed }">sepatah<i>.</i></div>
  </div>
</template>
<style scoped>
.logo { display:flex; flex-direction:column; align-items:center; gap:calc(var(--u)*.2) }
.mark { width:var(--u); height:calc(var(--u)*1.36); border-radius:calc(var(--u)/2) calc(var(--u)/2) 0 0;
  background:#1F3A2D; display:flex; align-items:center; justify-content:center }
.mark span { font:400 calc(var(--u)*.84)/1 'Gloock',serif; color:#F2EDE3; margin-top:calc(var(--u)*.078) }
.mark.rev { background:#F2EDE3 } .mark.rev span { color:#1F3A2D }
.word { font:400 calc(var(--u)*.45)/1 'Young Serif',serif; letter-spacing:-.01em; color:#1F3A2D }
.word.rev { color:#F2EDE3 } .word i { font-style:normal; color:#C4472D }
</style>
```

## Assets to generate (task for Claude Code)
1. `logo-primary.svg`, `logo-reversed.svg` (text converted to outlines).
2. `favicon.svg`, `favicon-32.png`, `apple-touch-icon-180.png`, `icon-512.png` from the square icon variant. Apple icons should be full-bleed square without rounded corners (the OS rounds them).
3. `og-image.png` 1200x630, reversed logo centered on `#1F3A2D`.
4. Use the logo on: invitation footer ("Dibuat dengan Sepatah", small), admin header, QR table card, live screen corner.

## States
Static asset; no interaction. If used as a link to home, press state `scale(.97)` per the product's button rules. Respect `prefers-reduced-motion` (no animated logo).

## Files
- `Sepatah Logo Final.dc.html`: the selected logo and variants (design reference)
- `Sepatah Logos.dc.html`: all explored options (rounds 1 to 3), for context only
