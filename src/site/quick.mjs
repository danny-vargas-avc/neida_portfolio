import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await p.goto('http://localhost:3000/manage', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
console.log('  .mg present:', await p.locator('.mg').count())
console.log('  body html head:', (await p.evaluate(() => document.body.innerHTML.slice(0, 200))))
console.log('  errors:', errs.slice(0, 5).join('\n    ') || 'none')
await b.close()
