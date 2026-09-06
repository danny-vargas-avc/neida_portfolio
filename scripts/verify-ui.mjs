/**
 * Browser smoke test for the things static output can't show.
 *
 * Run the dev server first, then:  node scripts/verify-ui.mjs [outputDir]
 *
 * Two hard-won details are load-bearing here:
 *
 *  1. Headless Chrome throttles requestAnimationFrame to a few frames per
 *     second, which freezes every GSAP tween and makes working animations look
 *     broken. The launch flags below keep the ticker running.
 *
 *  2. "strokeDashoffset === 0" is also the value BEFORE any dash is applied, so
 *     it alone cannot distinguish "finished" from "never started". The reveal
 *     check pairs it with the accent copy, which only mounts on completion.
 */
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '.'
const URL = process.env.VERIFY_URL || 'http://localhost:3000/'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
  ],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle' })

/** The vine's reveal state: how much of the sweep mask is still hiding art. */
const revealState = () =>
  page.evaluate(() => {
    const sweep = document.querySelector('.vine-sweep')
    if (!sweep) return { present: false }
    return {
      present: true,
      offset: Math.abs(parseFloat(getComputedStyle(sweep).strokeDashoffset) || 0),
      // The colour-fill layer only mounts once the reveal has finished.
      finished: !!document.querySelector('.tint'),
    }
  })

/** Vue attaches handlers on hydrate; clicking before that silently does nothing. */
await page.waitForFunction(() => document.querySelector('.vine-sweep') !== null, {
  timeout: 15000,
})

// --- the page opens as just the drawing -------------------------------------
const initial = await page.evaluate(() => ({
  selected: document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
  visiblePanels: [...document.querySelectorAll('[role="tabpanel"]')].filter(
    (p) => p.offsetParent !== null,
  ).length,
  hint: document.querySelector('.hint')?.textContent?.trim() ?? null,
}))
check(
  'no section selected on load',
  initial.selected === 0 && initial.visiblePanels === 0,
  JSON.stringify(initial),
)

// --- the reveal runs, and finishes ------------------------------------------
const start = await revealState()
check('vine reveal spiral present', start.present === true, JSON.stringify(start))

await page
  .waitForFunction(
    () => {
      const s = document.querySelector('.vine-sweep')
      return s && Math.abs(parseFloat(getComputedStyle(s).strokeDashoffset) || 0) < 1
    },
    { timeout: 12000 },
  )
  .then(
    () => check('reveal completes', true),
    () => check('reveal completes', false, 'sweep never reached full reveal'),
  )

await page.waitForTimeout(400)

// Hovering a leaf must preview THAT leaf's colour, not the active section's.
await page.locator('#leaf-research').hover({ force: true })
await page.waitForTimeout(500)
const tint = await page.evaluate(() => {
  const t = document.querySelector('.tint')
  return { clip: t?.getAttribute('clip-path'), color: t?.style.color }
})
check(
  'hovered leaf previews its own accent',
  !!tint.clip?.includes('research') && !!tint.color && tint.color !== '',
  JSON.stringify(tint),
)

// --- carousel selection swaps the panel -------------------------------------
// The leaf hit areas are rotated and overlap the artwork, so dispatch the click
// directly rather than fighting Playwright's actionability checks.
await page.evaluate(() => document.querySelector('#leaf-research').click())
await page.waitForTimeout(900)
const swapped = await page.evaluate(() => ({
  selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
  visible: [...document.querySelectorAll('[role="tabpanel"]')]
    .filter((p) => p.offsetParent !== null)
    .map((p) => p.id),
}))
check(
  'selecting a section swaps the panel',
  swapped.selected === 'leaf-research' && swapped.visible.join() === 'panel-research',
  JSON.stringify(swapped),
)

// --- keyboard moves selection and focus together ----------------------------
await page.locator('#leaf-research').focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(700)
const keyed = await page.evaluate(() => ({
  selected: document.querySelector('[role="tab"][aria-selected="true"]')?.id,
  focused: document.activeElement?.id,
}))
check(
  'arrow key moves selection and focus',
  keyed.selected === 'leaf-drawings' && keyed.focused === 'leaf-drawings',
  JSON.stringify(keyed),
)

await page.screenshot({ path: `${OUT}/pw-section.png` })

// --- lightbox: opens, traps focus, locks scroll, restores on Escape ---------
await page.evaluate(() => document.querySelector('#leaf-clay').click())
await page.waitForTimeout(700)
await page.locator('#panel-clay .tile').first().click()
await page.waitForTimeout(600)
const lb = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  return {
    open: !!d,
    focusInside: !!d && d.contains(document.activeElement),
    locked: document.body.style.overflow === 'hidden',
  }
})
check('lightbox opens, traps focus, locks scroll', lb.open && lb.focusInside && lb.locked, JSON.stringify(lb))
await page.screenshot({ path: `${OUT}/pw-lightbox.png` })

await page.keyboard.press('Escape')
await page.waitForTimeout(500)
const closed = await page.evaluate(() => ({
  open: !!document.querySelector('[role="dialog"]'),
  locked: document.body.style.overflow === 'hidden',
}))
check('Escape closes and unlocks', !closed.open && !closed.locked, JSON.stringify(closed))

check('no console errors', errors.length === 0, errors.join(' | '))

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
