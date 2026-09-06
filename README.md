# Neida Rodriguez — portfolio

A single-page portfolio built around Neida's hand-drawn vine. Each leaf on the
drawing is a section of her work; choosing one opens that section below.

Nuxt 4 · Vue 3 · TypeScript · Nuxt Content · GSAP. Prerendered to static HTML.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static output in .output/public
```

> **Note:** `npm install` needs `--legacy-peer-deps` on npm 11.5.x, which has a
> bug resolving Nuxt's peer graph (`Cannot read properties of null (reading
> 'edgesOut')`).

---

## For Neida: editing the site

Everything you'd want to change lives in two places. You never need to touch
code.

### `content/site.yml`

Your name, the line under it, the about text, and your contact links.

### `content/sections/*.md`

One file per leaf on the vine. The part between the `---` lines is the
settings; anything below is a paragraph shown under the heading.

To **add a piece of work**:

1. Put the image in `public/media/<section>/` — e.g. `public/media/cake/lemon-tart.jpg`
2. Add three lines to that section's `pieces:` list:

```yaml
  - image: /media/cake/lemon-tart.jpg
    title: Lemon tart
    year: 2026
```

`orientation: portrait | landscape | square` sets the shape of its grid cell.
`note:` adds a caption in the enlarged view. `alt:` describes the image for
people using a screen reader — worth filling in.

Search for `TODO(neida)` to find every bit of placeholder text still waiting on
you.

---

## The artwork

`public/media/carousel.svg` is the traced scan of the vine — **drop replacement
artwork there**. It is a potrace trace: filled paths, no strokes, no groups, on
a full sheet of paper with a lot of blank margin and a scattering of scan dust.

```bash
node scripts/clean-vine.mjs      # drops scan noise, crops to the ink
node scripts/leaf-overlay.mjs .  # renders the leaf hit areas over the art
```

`clean-vine.mjs` writes `app/assets/art/vine.svg` (what the app imports) and
prints the cropped viewBox to paste into `app/components/vine-leaves.ts`. It
leaves path coordinates alone, so existing leaf positions stay valid.

If Neida redraws the vine with leaves in new places, re-measure them: run
`leaf-overlay.mjs`, compare, and adjust the ellipses in `vine-leaves.ts` until
they sit on the leaves.

### How the animations work

The drawing is *filled* paths with `stroke="none"`, so the usual
`stroke-dashoffset` "draw the line" trick has nothing to walk along. Two things
work instead, both in `app/components/VineCarousel.vue`:

- **The reveal** is an SVG `<mask>` holding one thick-stroked circle whose dash
  offset animates. That sweeps a wedge around the wreath, so the vine appears to
  grow around the ring and each leaf arrives as the sweep reaches it. A mask
  doesn't care what's underneath, so this works on fills — and it animates one
  element rather than sixty-four.
- **Tinting one leaf** is a second copy of the artwork, clipped to that leaf's
  ellipse and coloured with its accent, drawn on top.

The leaf hit areas are real HTML `<button>`s layered over the SVG, so the
navigation keeps genuine focus, keyboard and screen-reader behaviour. The idle
rotation is applied to the wrapper so the buttons stay aligned with the art.

---

## Placeholders

`scripts/generate-placeholders.mjs` writes the abstract prints currently filling
the galleries. **Delete the script and `public/media/<section>/placeholder-*.svg`
once real photographs land** — nothing in the app imports them.

---

## Checks

```bash
npm run dev                       # in one terminal
node scripts/verify-ui.mjs /tmp   # in another
```

`verify-ui.mjs` drives a real browser and asserts what static output can't show:
the reveal runs and finishes, nothing is selected on load, hovering a leaf
previews its own colour, selecting swaps the panel, arrow keys move selection
and focus, and the lightbox traps focus and restores it on Escape.

Two things it has to get right, learned the hard way:

- Headless Chrome throttles `requestAnimationFrame` to a few frames a second,
  which freezes every GSAP tween and makes working animations look broken. The
  launch flags in the script keep the ticker running.
- `strokeDashoffset === 0` is also the value *before* any dash is applied, so it
  cannot by itself tell "finished" from "never started".

Also worth checking by hand: turn on **System Settings → Accessibility → Reduce
Motion** and reload. The vine should appear without the sweep, hold still, and
navigate instantly.
