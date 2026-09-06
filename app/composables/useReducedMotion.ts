import { onScopeDispose, ref } from 'vue'

/**
 * Tracks `prefers-reduced-motion`, reactively.
 *
 * CSS handles its own transitions via the duration tokens, but GSAP tweens and
 * rAF loops are invisible to CSS — every JS-driven animation in the app gates
 * on this. It stays reactive because the OS setting can change while the page
 * is open, and a running infinite tween would otherwise never notice.
 */
export function useReducedMotion() {
  const reduced = ref(false)

  // matchMedia doesn't exist during SSR/prerender; default to "allow motion"
  // and let the client correct it before first paint of any animation.
  if (import.meta.client) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = mq.matches

    const onChange = (e: MediaQueryListEvent) => {
      reduced.value = e.matches
    }
    mq.addEventListener('change', onChange)
    onScopeDispose(() => mq.removeEventListener('change', onChange))
  }

  return reduced
}
