/**
 * Light or dark.
 *
 * Two states, one button. Until she picks one the phone decides, so the app
 * opens the way everything else on her phone looks; the moment she does pick,
 * that is remembered and the phone stops being consulted. That keeps the
 * default sensible without making "follow the system" a third thing she has to
 * understand and choose between.
 *
 * The decision is made here rather than in a media query because a stored
 * choice has to be able to beat the operating system. CSS then has a single
 * dark block keyed off a class on <html>, instead of the same palette written
 * out twice and drifting apart.
 */

import { watch } from 'vue'

export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'mg-theme'
const DARK_CLASS = 'mg-dark'

/** Per device, not per account: the same person wants different things on a
 *  phone in bed and a laptop at a desk. */
function stored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // Private browsing, or storage turned off. Falling back to the phone's
    // setting is a fine answer when we cannot remember anything.
  }
  return null
}

export function useManageTheme() {
  const choice = useState<ThemeChoice>('mg-theme', () => 'light')

  if (import.meta.client) {
    function apply(dark: boolean) {
      const root = document.documentElement
      root.classList.toggle(DARK_CLASS, dark)
      // Native form controls, scrollbars and the on-screen keyboard follow this
      // rather than our tokens, and look wrong against the page without it.
      root.style.colorScheme = dark ? 'dark' : 'light'
      // The standalone app's status bar reads this.
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#16151a' : '#f4f3f1')
    }

    // Read on the way in, during setup and before the portal's first paint, so
    // the app does not flash the wrong ground.
    choice.value = stored() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    apply(choice.value === 'dark')

    watch(choice, (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch { /* the choice still applies for this visit */ }
      apply(value === 'dark')
    })
  }

  function toggle() {
    choice.value = choice.value === 'dark' ? 'light' : 'dark'
  }

  return { choice, toggle }
}
