import { chromium } from 'playwright-core'
import { readFile, writeFile } from 'node:fs/promises'
const svg = await readFile('public/media/carousel.svg', 'utf8')
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const p = await b.newPage()
await p.setContent(`<body style="margin:0">${svg}</body>`)
const data = await p.evaluate(() => {
  const svgEl = document.querySelector('svg')
  const vb = svgEl.viewBox.baseVal
  const r = svgEl.getBoundingClientRect()
  const sx = vb.width / r.width, sy = vb.height / r.height
  return [...svgEl.querySelectorAll('path')].map((el, i) => {
    const b = el.getBoundingClientRect()
    return {
      i,
      x: +(((b.x - r.x) * sx)).toFixed(1),
      y: +(((b.y - r.y) * sy)).toFixed(1),
      w: +((b.width * sx)).toFixed(1),
      h: +((b.height * sy)).toFixed(1),
      len: el.getTotalLength ? +el.getTotalLength().toFixed(0) : 0,
    }
  })
})
await b.close()
await writeFile('/tmp/bboxes.json', JSON.stringify(data))
const big = data.filter(d => d.w > 60 || d.h > 60).sort((a,b)=>(b.w*b.h)-(a.w*a.h))
console.log('total paths:', data.length)
console.log('viewBox: 600 x 911')
console.log('\nlargest 12 by area:')
for (const d of big.slice(0,12)) console.log(`  #${d.i} x=${d.x} y=${d.y} w=${d.w} h=${d.h} len=${d.len}`)
const tiny = data.filter(d => d.w <= 12 && d.h <= 12)
console.log(`\ntiny (<=12px): ${tiny.length}  |  mid: ${data.length - big.length - tiny.length}`)
