import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const PW = readFileSync(process.env.PWFILE, 'utf8').trim()
const OUT = process.argv[2] || '.'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--disable-background-timer-throttling'],
})
const step = (n, ok, extra = '') => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`)

async function session(scheme) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    colorScheme: scheme,
  })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3000/manage', { waitUntil: 'networkidle' })
  await page.waitForSelector('#u', { timeout: 15000 })
  await page.fill('#u', '__apitest__'); await page.fill('#p', PW)
  await page.click('button.mg-btn-primary')
  await page.waitForSelector('a[href="/manage/florals"]', { timeout: 15000 })
  await page.waitForTimeout(600)
  return { ctx, page }
}

const ground = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.mg')).backgroundColor)

// follows a dark OS by default
let { ctx, page } = await session('dark')
const darkAuto = await ground(page)
step('follows a dark phone', darkAuto === 'rgb(22, 21, 26)', darkAuto)
await page.screenshot({ path: `${OUT}/mg-dark.png` })

// the header button beats a dark OS
await page.click('.mg-round-btn')
await page.waitForTimeout(400)
const forcedLight = await ground(page)
step('Light overrides a dark phone', forcedLight === 'rgb(244, 243, 241)', forcedLight)

// choice survives a reload
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.mg-round-btn', { timeout: 15000 })
await page.waitForTimeout(500)
const afterReload = await ground(page)
step('choice survives a reload', afterReload === 'rgb(244, 243, 241)', afterReload)
const label = await page.locator('.mg-round-btn').first().getAttribute('aria-label')
step('the button offers the other mode', label === 'Switch to dark mode', label)
await ctx.close()

// explicit Dark on a light OS, and it reaches a section screen too
;({ ctx, page } = await session('light'))
const lightAuto = await ground(page)
step('follows a light phone', lightAuto === 'rgb(244, 243, 241)', lightAuto)
await page.click('.mg-round-btn')
await page.waitForTimeout(400)
step('Dark overrides a light phone', (await ground(page)) === 'rgb(22, 21, 26)')
await page.screenshot({ path: `${OUT}/mg-home-dark.png` })

await page.goto('http://localhost:3000/manage/florals', { waitUntil: 'networkidle' })
await page.waitForSelector('#f-title', { timeout: 15000 })
await page.waitForTimeout(600)
step('applies on a section opened directly', (await ground(page)) === 'rgb(22, 21, 26)')
const cs = await page.evaluate(() => document.documentElement.style.colorScheme)
step('native controls follow', cs === 'dark', cs)
await page.screenshot({ path: `${OUT}/mg-section-dark.png` })
await ctx.close()

await browser.close()
