/**
 * Renders the leaf hit areas over Neida's vine drawing so they can be checked
 * by eye. Run whenever the artwork changes and the ellipses in
 * app/components/vine-leaves.ts need re-measuring.
 *
 *   node scripts/leaf-overlay.mjs [outputDir]
 */
import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'

const OUT = process.argv[2] || '.'

const svgRaw = await readFile('app/assets/art/vine.svg', 'utf8')
const leavesSrc = await readFile('app/components/vine-leaves.ts', 'utf8')

// Pull the literals straight out of the source so this can never drift from
// what the component actually uses.
const leaves = [...leavesSrc.matchAll(
  /\{\s*slug:\s*'([^']+)',[^}]*?cx:\s*(-?[\d.]+),\s*cy:\s*(-?[\d.]+),\s*rx:\s*(-?[\d.]+),\s*ry:\s*(-?[\d.]+),\s*rot:\s*(-?[\d.]+)/g,
)].map((m) => ({
  slug: m[1], cx: +m[2], cy: +m[3], rx: +m[4], ry: +m[5], rot: +m[6],
}))

const wreath = leavesSrc.match(/WREATH = \{ cx: (\d+), cy: (\d+), r: (\d+)/)
const [wcx, wcy, wr] = wreath ? [+wreath[1], +wreath[2], +wreath[3]] : [300, 500, 180]

const overlay = leaves.map((l, i) => `
  <ellipse cx="${l.cx}" cy="${l.cy}" rx="${l.rx}" ry="${l.ry}"
    transform="rotate(${l.rot} ${l.cx} ${l.cy})"
    fill="rgba(255,0,90,0.18)" stroke="#e0005a" stroke-width="2"/>
  <text x="${l.cx}" y="${l.cy + 5}" font-size="15" font-family="sans-serif"
    text-anchor="middle" fill="#c00">${i + 1}.${l.slug}</text>`).join('')
  + `<circle cx="${wcx}" cy="${wcy}" r="${wr}" fill="none" stroke="#0a0" stroke-width="2" stroke-dasharray="8 8"/>`
  + `<circle cx="${wcx}" cy="${wcy}" r="4" fill="#0a0"/>`

// The cleaned artwork carries its own cropped viewBox; give it an explicit
// pixel size so the screenshot is legible.
const view = svgRaw.match(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+)"/)
const vw = view ? +view[3] : 600
const vh = view ? +view[4] : 911
const scale = 900 / vh

const svg = svgRaw
  .replace('<svg ', `<svg width="${Math.round(vw * scale)}" height="${Math.round(vh * scale)}" `)
  .replace('</svg>', `${overlay}</svg>`)

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({
  viewport: { width: Math.round(vw * scale) + 20, height: Math.round(vh * scale) + 20 },
})
await page.setContent(`<body style="margin:0;background:#fff">${svg}</body>`)
await page.screenshot({ path: `${OUT}/leaf-overlay.png` })
await browser.close()

console.log(`Rendered ${leaves.length} leaf hit areas -> ${OUT}/leaf-overlay.png`)
