/**
 * Browser checks for the portal at /manage.
 *
 * Needs an account to sign in with, passed in rather than written down:
 *
 *   MANAGE_USER=neida MANAGE_PASS='…' node scripts/verify-manage.mjs
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
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))

const step = (n, ok, extra = '') => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`)

await page.goto(`${BASE}/manage`, { waitUntil: 'networkidle' })
// The app renders nothing until it knows whether there is a session, so wait
// for the form rather than guessing how long that takes.
await page.waitForSelector('#u', { timeout: 15000 })
step('sign-in screen appears', (await page.locator('#u').count()) === 1)

// wrong password
await page.fill('#u', USER); await page.fill('#p', 'wrong')
await page.click('button.mg-btn-primary')
await page.waitForTimeout(900)
const err = await page.locator('.mg-error').textContent().catch(() => '')
step('wrong password is reported', !!err && /do not match/.test(err), err?.trim())

// right password
await page.fill('#p', PW)
await page.click('button.mg-btn-primary')
await page.waitForTimeout(1600)
const rows = await page.locator('a.mg-row').count()
step('signs in and lists sections', rows >= 9, `${rows} rows`)
await page.screenshot({ path: `${OUT}/mg-home.png` })

// no horizontal scroll
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
step('no sideways scrolling on home', over <= 0, `${over}px`)

// into a section
await page.click('a[href="/manage/florals"]')
await page.waitForTimeout(1200)
step('opens a section', (await page.locator('#f-title').count()) === 1)

// edit the tagline (save on blur)
const stamp = `probe ${Date.now()}`
await page.fill('#f-tag', stamp)
await page.locator('#f-intro').click()
await page.waitForTimeout(1200)
const saved = await page.evaluate(async (slug) => {
  const r = await fetch('/api/manage/content/')
  const d = await r.json()
  return d.sections.find((s) => s.slug === slug).tagline
}, 'florals')
step('tagline saves on blur', saved === stamp, saved)

// upload
const photos = () => page.locator('.mg-photo:not(:has(.mg-photo-pending))').count()
const before = await photos()
await page.setInputFiles('input[type=file]', '/tmp/probe-upload.jpg')
await page.waitForTimeout(4000)
const after = await photos()
step('uploads a photo', after === before + 1, `${before} -> ${after}`)
await page.screenshot({ path: `${OUT}/mg-section.png` })

// open the sheet
await page.locator('.mg-photo').last().click()
await page.waitForTimeout(700)
const sheet = await page.locator('[role="dialog"]').count()
step('photo sheet opens', sheet === 1)
await page.screenshot({ path: `${OUT}/mg-sheet.png` })

// rename in the sheet
await page.fill('#p-title', '__renamed probe__')
await page.click('.mg-sheet button.mg-btn-primary')
await page.waitForTimeout(1400)
const renamed = await page.evaluate(async () => {
  const d = await (await fetch('/api/manage/content/')).json()
  return d.sections.find((s) => s.slug === 'florals').pieces.some((p) => p.title === '__renamed probe__')
})
step('renames a photo', renamed)

// delete it
await page.locator('.mg-photo').last().click()
await page.waitForTimeout(600)
await page.click('button.mg-btn-danger')
await page.waitForTimeout(300)
await page.click('.mg-sheet button[style*="mg-danger"]')
await page.waitForTimeout(1500)
const final = await photos()
step('removes a photo', final === before, `${after} -> ${final}`)

// details screen
await page.goto(`${BASE}/manage/details`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
step('details screen loads', (await page.locator('#d-name').count()) === 1)
await page.screenshot({ path: `${OUT}/mg-details.png` })

const over2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
step('no sideways scrolling on details', over2 <= 0, `${over2}px`)

console.log(`\n  console errors: ${errs.length ? errs.slice(0, 4).join(' | ') : 'none'}`)
await browser.close()
