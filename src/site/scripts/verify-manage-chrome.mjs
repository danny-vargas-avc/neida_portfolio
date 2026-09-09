/**
 * The portal's edges on a phone: nothing under the notch, and no bare document
 * showing past the app's own ground.
 *
 *   MANAGE_USER=… MANAGE_PASS=… node scripts/verify-manage-chrome.mjs
 */
import { chromium } from 'playwright-core'

const USER = process.env.MANAGE_USER
const PW = process.env.MANAGE_PASS
if (!USER || !PW) { console.error('Set MANAGE_USER and MANAGE_PASS.'); process.exit(1) }
const BASE = process.env.VERIFY_URL?.replace(/\/$/, '') || 'http://localhost:3000'
const OUT = process.argv[2] || '.'

const step = (n, ok, extra = '') => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`)
const b = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--disable-background-timer-throttling'],
})

for (const scheme of ['dark', 'light']) {
  const ctx = await b.newContext({
    viewport: { width: 393, height: 852 },   // iPhone 15 Pro
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: scheme,
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/manage`, { waitUntil: 'networkidle' })
  await page.waitForSelector('#u', { timeout: 15000 })
  await page.waitForTimeout(700)

  console.log(`\n  --- ${scheme} ---`)

  const r = await page.evaluate(() => {
    const root = document.documentElement
    const mg = document.querySelector('.mg')
    return {
      viewport: document.querySelector('meta[name=viewport]')?.content,
      rootClass: root.className,
      rootBg: getComputedStyle(root).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      mgBg: getComputedStyle(mg).backgroundColor,
      // Does the app's own box cover the whole scrollable page?
      mgHeight: Math.round(mg.getBoundingClientRect().height),
      docHeight: Math.round(root.scrollHeight),
      headerTop: Math.round(document.querySelector('.mg-header').getBoundingClientRect().top),
    }
  })

  step('viewport asks for the safe areas', /viewport-fit=cover/.test(r.viewport || ''), r.viewport)
  step('the document itself is painted', r.rootBg !== 'rgba(0, 0, 0, 0)', `html ${r.rootBg}`)
  step('body does not cover it back up', r.bodyBg === 'rgba(0, 0, 0, 0)', `body ${r.bodyBg}`)
  step('the root matches the app ground', r.rootBg === r.mgBg, `${r.rootBg} vs ${r.mgBg}`)
  step('the app covers the whole page', r.mgHeight >= r.docHeight - 1, `${r.mgHeight} of ${r.docHeight}`)
  step('the header starts at the top', r.headerTop === 0, `${r.headerTop}px`)

  await page.screenshot({ path: `${OUT}/mg-chrome-${scheme}.png` })
  await ctx.close()
}
console.log('')
await b.close()
