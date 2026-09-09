/**
 * Prepares Neida's scanned vine drawing for the site.
 *
 *   source: public/media/carousel.svg   (drop new artwork here)
 *   output: app/assets/art/vine.svg     (what the app imports)
 *
 *   node scripts/clean-vine.mjs
 *
 * The scan is traced by potrace, which produces two problems:
 *
 *   1. Scan dust. Roughly 100 of the 176 paths are specks a couple of units
 *      across, plus a hairline down the right edge of the page. They read as
 *      dirt on screen and, worse, stretch the drawing's bounds.
 *   2. Page margins. The ink occupies about 60% of the scanned page, so a large
 *      band of empty paper sits above and below the wreath.
 *
 * This drops the noise and retightens the viewBox to the surviving ink. Path
 * coordinates are left untouched — only the viewBox changes — so the leaf
 * positions in app/components/vine-leaves.ts stay valid.
 *
 * Bounding boxes come from a real browser because potrace emits relative path
 * commands that would otherwise need a full path parser to measure.
 */
import { chromium } from 'playwright-core'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const SRC = 'public/media/carousel.svg'
const OUT = 'app/assets/art/vine.svg'

/**
 * A path is dust if it is a hairline, or smaller than this in both axes.
 * Overridable so the thresholds can be swept against the path count and the
 * result eyeballed before committing to one. Past roughly 1.4 / 5 the count
 * plateaus at 49 paths — beyond that the script starts eating real linework
 * rather than dust.
 */
const MIN_THICKNESS = Number(process.env.MIN_THICKNESS ?? 1.4)
const MIN_EXTENT = Number(process.env.MIN_EXTENT ?? 5)
/** Breathing room left around the ink, in viewBox units. */
const MARGIN = 8

const raw = await readFile(SRC, 'utf8')

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage()
await page.setContent(`<body style="margin:0">${raw}</body>`)

const boxes = await page.evaluate(() => {
  const svg = document.querySelector('svg')
  const vb = svg.viewBox.baseVal
  const r = svg.getBoundingClientRect()
  const sx = vb.width / r.width
  const sy = vb.height / r.height
  return [...svg.querySelectorAll('path')].map((el, i) => {
    const b = el.getBoundingClientRect()
    return {
      i,
      x: (b.x - r.x) * sx,
      y: (b.y - r.y) * sy,
      w: b.width * sx,
      h: b.height * sy,
    }
  })
})
await browser.close()

const isNoise = (b) =>
  Math.min(b.w, b.h) < MIN_THICKNESS || Math.max(b.w, b.h) < MIN_EXTENT

const keep = boxes.filter((b) => !isNoise(b))
const drop = new Set(boxes.filter(isNoise).map((b) => b.i))

const x0 = Math.min(...keep.map((b) => b.x)) - MARGIN
const y0 = Math.min(...keep.map((b) => b.y)) - MARGIN
const x1 = Math.max(...keep.map((b) => b.x + b.w)) + MARGIN
const y1 = Math.max(...keep.map((b) => b.y + b.h)) + MARGIN
const [vx, vy, vw, vh] = [x0, y0, x1 - x0, y1 - y0].map((n) => Math.round(n))

// Rebuild the file, skipping the noise paths by their original index.
let seen = -1
const body = raw.replace(/<path\b[^>]*\/>/g, (tag) => {
  seen++
  return drop.has(seen) ? '' : tag
})

const cleaned = body
  .replace(/<\?xml[^>]*\?>\s*/, '')
  .replace(/<!DOCTYPE[\s\S]*?>\s*/, '')
  .replace(
    /<svg[^>]*>/,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">`,
  )
  .replace(/\n{2,}/g, '\n')

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, cleaned, 'utf8')

console.log(`kept ${keep.length} paths, dropped ${drop.size} noise paths`)
console.log(`viewBox: ${vx} ${vy} ${vw} ${vh}  (was 0 0 600 911)`)
console.log(`aspect ratio: ${(vw / vh).toFixed(4)}`)
console.log(`wrote ${OUT}`)
console.log(
  '\nUpdate ART_VIEW in app/components/vine-leaves.ts to:\n' +
    `  { x: ${vx}, y: ${vy}, width: ${vw}, height: ${vh} }`,
)
