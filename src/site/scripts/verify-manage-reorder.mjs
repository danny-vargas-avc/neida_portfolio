/**
 * Browser checks for the portal at /manage.
 *
 * Needs an account to sign in with, passed in rather than written down:
 *
 *   MANAGE_USER=neida MANAGE_PASS='…' node scripts/verify-manage-reorder.mjs
 *
 * Run against the dev server by default; set VERIFY_URL for anywhere else.
 * Every check cleans up after itself, but it does write to whatever database it
 * is pointed at — so point it at a development one.
 */
import { chromium } from 'playwright-core'

const USER = process.env.MANAGE_USER
const PW = process.env.MANAGE_PASS
if (!USER || !PW) {
  console.error('Set MANAGE_USER and MANAGE_PASS to an account that can sign in.')
  process.exit(1)
}
const BASE = process.env.VERIFY_URL?.replace(/\/$/, '') || 'http://localhost:3000'
const OUT = process.argv[2] || '.'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--disable-background-timer-throttling'],
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
})
const page = await ctx.newPage()
const step = (n, ok, extra = '') => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`)

await page.goto(`${BASE}/manage`, { waitUntil: 'networkidle' })
await page.waitForSelector('#u', { timeout: 15000 })
await page.fill('#u', USER); await page.fill('#p', PW)
await page.click('button.mg-btn-primary')
await page.waitForSelector('a[href="/manage/florals"]', { timeout: 15000 })
await page.click('a[href="/manage/florals"]')
await page.waitForSelector('.mg-photo', { timeout: 15000 })
await page.waitForTimeout(900)

const order = () => page.evaluate(async () => {
  const d = await (await fetch('/api/manage/content/')).json()
  return d.sections.find((s) => s.slug === 'florals').pieces.map((p) => p.title)
})
const before = await order()
step('two photos to work with', before.length >= 2, before.join(' | '))

const box = async (i) => (await page.locator(`.mg-photo[data-index="${i}"]`).boundingBox())

// --- a real long-press drag, as a finger would do it ---------------------
const a = await box(0), b = await box(1)
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
await page.mouse.down()
await page.waitForTimeout(420)                       // outlast the hold
const dragging = await page.locator('.mg-photo.is-dragging').count()
step('long press picks the tile up', dragging === 1)

// move in a few steps, as a finger does
for (let s = 1; s <= 6; s++) {
  await page.mouse.move(a.x + a.width / 2 + ((b.x - a.x) * s) / 6, a.y + a.height / 2)
  await page.waitForTimeout(30)
}
const carried = await page.evaluate(() => {
  const el = document.querySelector('.mg-photo.is-dragging')
  return el ? getComputedStyle(el).transform : 'none'
})
step('the tile follows the finger', carried !== 'none' && carried !== 'matrix(1, 0, 0, 1, 0, 0)', carried)
const marked = await page.locator('.mg-photo.is-over').count()
step('the target is marked', marked >= 1)
await page.screenshot({ path: `${OUT}/mg-drag.png` })

await page.mouse.up()
await page.waitForTimeout(1500)
const after = await order()
step('the order actually changed', after[0] === before[1] && after[1] === before[0], after.join(' | '))

// --- the drop must not also open the editor -------------------------------
// Reports which dialog, not just that there is one — the difference between
// "the drag opened the editor" and "something else is on screen".
const dialogs = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"]')].map((d) => d.getAttribute('aria-label') || d.className))
step('dropping does not open the photo', dialogs.length === 0, dialogs.join(' | '))

// --- a plain tap still opens it -------------------------------------------
await page.waitForTimeout(500)
await page.locator('.mg-photo[data-index="0"]').click()
await page.waitForTimeout(700)
step('a plain tap still opens the photo', (await page.locator('[role="dialog"]').count()) === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(600)
step('Escape closes the sheet', (await page.locator('[role="dialog"]').count()) === 0)

// --- a flick that starts on a photo should scroll, not drag ---------------
await page.evaluate(() => window.scrollTo(0, 0))
const c = await box(0)
await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2)
await page.mouse.down()
await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2 - 120, { steps: 8 })  // moves before the hold
const draggingNow = await page.locator('.mg-photo.is-dragging').count()
step('a quick flick does not become a drag', draggingNow === 0)
await page.mouse.up()

console.log('')
await browser.close()
