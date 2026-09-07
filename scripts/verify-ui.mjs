/**
 * Browser smoke test for the things static output can't show.
 *
 * Run the dev server first, then:  node scripts/verify-ui.mjs [outputDir]
 *
 * Two hard-won details are load-bearing here:
 *
 *  1. Headless Chrome throttles requestAnimationFrame to a few frames a second,
 *     which freezes every GSAP tween and makes working animations look broken.
 *     The launch flags below keep the ticker running.
 *  2. The vine's entrance is a pure CSS animation, so it finishes whether or not
 *     Vue has hydrated. Waiting on it is NOT a readiness signal — clicks
 *     dispatched on the strength of it silently did nothing. `selectLeaf()`
 *     retries until a click actually takes effect instead.
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

/** Selects a leaf, retrying until Vue has hydrated and the click sticks. */
async function selectLeaf(slug) {
  await page.waitForFunction(
    (s) => {
      const btn = document.querySelector(`#leaf-${s}`)
      if (!btn) return false
      if (btn.getAttribute('aria-selected') === 'true') return true
      btn.click()
      return false
    },
    slug,
    { timeout: 20000, polling: 250 },
  )
}

// --- entrance --------------------------------------------------------------
await page
  .waitForFunction(
    () => {
      const v = document.querySelector('.vine')
      return v && +getComputedStyle(v).opacity > 0.99
    },
    { timeout: 12000 },
  )
  .then(
    () => check('vine entrance completes', true),
    () => check('vine entrance completes', false, 'never reached full opacity'),
  )

const entrance = await page.evaluate(() => {
  const v = document.querySelector('.vine')
  return { animations: v.getAnimations().map((a) => a.animationName) }
})
check(
  'entrance is a CSS opacity/transform animation',
  entrance.animations.includes('vine-enter'),
  JSON.stringify(entrance),
)

// --- the page opens as just the drawing ------------------------------------
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

// --- selecting a leaf swaps the panel --------------------------------------
await selectLeaf('research')
await page.waitForTimeout(700)
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

// --- the lit leaf wears its OWN accent, not the open section's --------------
const lit = await page.evaluate(() => {
  const t = document.querySelector('.tint')
  return {
    clip: t?.getAttribute('clip-path'),
    color: t?.style.color,
    opacity: +getComputedStyle(t).opacity,
  }
})
check(
  'lit leaf shows its own accent',
  !!lit.clip?.includes('research') && lit.opacity > 0.9,
  JSON.stringify(lit),
)

// --- keyboard moves selection and focus together ---------------------------
await page.locator('#leaf-research').focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(500)
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

// --- lightbox: opens, traps focus, locks scroll, restores on Escape --------
await selectLeaf('clay')
await page.waitForTimeout(500)
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
check(
  'lightbox opens, traps focus, locks scroll',
  lb.open && lb.focusInside && lb.locked,
  JSON.stringify(lb),
)
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
