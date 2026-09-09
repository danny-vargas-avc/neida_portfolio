import { chromium } from 'playwright-core'
const b = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-background-timer-throttling','--force-device-scale-factor=1'],
})
const p = await b.newPage({ viewport: { width: 1100, height: 900 } })
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
await p.evaluate(() => {
  window.__f = []
  let last = performance.now()
  const tick = () => { const n = performance.now(); window.__f.push(n-last); last = n; requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
await p.waitForTimeout(8000)
const f = await p.evaluate(()=>window.__f)
const mid = f.slice(30).sort((a,b)=>a-b)
const pct = (q)=>mid[Math.floor(mid.length*q)].toFixed(1)
console.log(`frames ${mid.length}  median ${pct(0.5)}ms  p90 ${pct(0.9)}ms  p99 ${pct(0.99)}ms  worst ${mid[mid.length-1].toFixed(1)}ms`)
console.log(`slow frames (>32ms): ${mid.filter(d=>d>32).length}`)
await b.close()
