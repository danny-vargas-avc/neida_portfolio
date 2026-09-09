/**
 * Press and hold a photograph, then drag it somewhere else in the grid.
 *
 * Written by hand rather than pulled from a library because the requirement is
 * small and specific — one grid, touch first — and the interaction has a few
 * details that are easy to get wrong and worth stating:
 *
 *   Scrolling has to be suppressed, and touch-action alone will not do it. The
 *   browser decides whether a gesture is a scroll when the finger first moves,
 *   which is before the long press has fired, so the property cannot be changed
 *   in time. A non-passive touchmove listener calling preventDefault is what
 *   actually stops the page moving under the drag.
 *
 *   The tile has to follow the finger. Dimming it in place leaves nothing to
 *   aim with, and on a phone the finger is already covering the tile it started
 *   on, so without movement there is no feedback at all.
 *
 *   A drag must not also count as a tap. pointerup runs before click, so
 *   clearing the drag state there means the click handler sees no drag and
 *   opens the photo — every drop opening an editor. The suppression has to
 *   outlive the click, not the pointer.
 *
 *   Moving before the hold has elapsed is a scroll, not a drag. Without that,
 *   any flick that begins on a photograph is a failed reorder instead.
 */

import { onScopeDispose, reactive, ref } from 'vue'

const HOLD_MS = 300
/** Movement beyond this before the hold fires means she meant to scroll. */
const SLOP = 9
/** How close to the edge of the screen before the page follows the drag. */
const EDGE = 72
const EDGE_SPEED = 12

export function useSortablePhotos(commit: (from: number, to: number) => void) {
  const from = ref<number | null>(null)
  const over = ref<number | null>(null)
  /** Live offset of the dragged tile, in pixels from where it was picked up. */
  const shift = reactive({ x: 0, y: 0 })

  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let startX = 0
  let startY = 0
  let pendingIndex: number | null = null
  let armed = false
  let edgeFrame: number | undefined
  let edgeVelocity = 0
  // Read by the click handler; a drag that just ended must not open the editor.
  let blockClickUntil = 0

  function stopEdgeScroll() {
    if (edgeFrame !== undefined) cancelAnimationFrame(edgeFrame)
    edgeFrame = undefined
    edgeVelocity = 0
  }

  function edgeStep() {
    if (edgeVelocity !== 0) {
      window.scrollBy(0, edgeVelocity)
      edgeFrame = requestAnimationFrame(edgeStep)
    } else {
      edgeFrame = undefined
    }
  }

  /** Blocks the page scrolling while a drag is live. Must not be passive. */
  function blockScroll(event: TouchEvent) {
    if (from.value !== null) event.preventDefault()
  }

  if (import.meta.client) {
    document.addEventListener('touchmove', blockScroll, { passive: false })
    onScopeDispose(() => {
      document.removeEventListener('touchmove', blockScroll)
      clearTimeout(holdTimer)
      stopEdgeScroll()
    })
  }

  function reset() {
    clearTimeout(holdTimer)
    stopEdgeScroll()
    from.value = null
    over.value = null
    shift.x = 0
    shift.y = 0
    pendingIndex = null
    armed = false
  }

  function onPointerDown(event: PointerEvent, index: number) {
    // Only the primary button; a right-click should not begin a drag.
    if (event.button !== 0) return
    startX = event.clientX
    startY = event.clientY
    pendingIndex = index
    armed = true

    // Keeps every later pointer event coming to this element even once the
    // finger has moved off it, which is most of a drag.
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)

    holdTimer = setTimeout(() => {
      if (!armed) return
      from.value = index
      over.value = index
      navigator.vibrate?.(12)
    }, HOLD_MS)
  }

  function onPointerMove(event: PointerEvent) {
    if (from.value === null) {
      // Still deciding. A real movement this early is a scroll, so stand down
      // and let the page have the gesture.
      if (armed && Math.hypot(event.clientX - startX, event.clientY - startY) > SLOP) {
        clearTimeout(holdTimer)
        armed = false
        pendingIndex = null
      }
      return
    }

    shift.x = event.clientX - startX
    shift.y = event.clientY - startY

    // Whatever is under the finger, ignoring the tile being carried.
    //
    // elementsFromPoint, not elementFromPoint: the dragged tile is translated
    // to sit under the pointer and painted above everything, so the singular
    // version only ever reports the tile already being held and no target is
    // ever found. The plural one returns the whole stack, and the first entry
    // that is not the one in hand is what it would land on.
    for (const el of document.elementsFromPoint(event.clientX, event.clientY)) {
      const tile = (el as HTMLElement).closest?.('[data-index]') as HTMLElement | null
      if (!tile) continue
      const index = Number(tile.dataset.index)
      if (index === from.value) continue
      over.value = index
      break
    }

    // Near the top or bottom of the screen, bring the rest of the grid along.
    const y = event.clientY
    const height = window.innerHeight
    if (y < EDGE) edgeVelocity = -EDGE_SPEED
    else if (y > height - EDGE) edgeVelocity = EDGE_SPEED
    else edgeVelocity = 0
    if (edgeVelocity !== 0 && edgeFrame === undefined) edgeFrame = requestAnimationFrame(edgeStep)
    if (edgeVelocity === 0) stopEdgeScroll()
  }

  function onPointerUp() {
    const start = from.value
    const end = over.value
    if (start !== null) {
      // Long enough to outlive the click this pointer sequence will fire.
      blockClickUntil = performance.now() + 400
      if (end !== null && end !== start) commit(start, end)
    }
    reset()
  }

  /**
   * Eats the click that ends a drag, before it reaches the tile.
   *
   * Bound in the capture phase deliberately. Checking a flag inside the tile's
   * own click handler depends on that handler running after pointerup, and a
   * reorder replaces the tiles — so the click can land on an element Vue only
   * just created, in an order that is not guaranteed. Stopping it on the way
   * down does not care about either.
   */
  function onClickCapture(event: MouseEvent) {
    if (performance.now() < blockClickUntil) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  return { from, over, shift, onPointerDown, onPointerMove, onPointerUp, onClickCapture }
}
