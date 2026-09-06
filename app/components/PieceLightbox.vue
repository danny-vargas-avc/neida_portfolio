<script setup lang="ts">
/**
 * Fullscreen viewer for a single piece.
 *
 * Handles the things a modal has to get right or it becomes a trap: focus moves
 * in on open and returns to the tile on close, Escape and the backdrop both
 * dismiss, arrows step through the set, and the page behind is locked from
 * scrolling.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Piece } from '~/types/content'

const props = defineProps<{
  pieces: Piece[]
  index: number | null
}>()

const emit = defineEmits<{
  close: []
  'update:index': [value: number]
}>()

const dialog = ref<HTMLElement | null>(null)
const closeBtn = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

const open = computed(() => props.index !== null)
const piece = computed(() =>
  props.index === null ? null : props.pieces[props.index] ?? null,
)

function isVector(src: string) {
  return src.toLowerCase().endsWith('.svg')
}

function step(delta: number) {
  if (props.index === null) return
  const n = props.pieces.length
  // Wrap around: at the last piece, "next" returns to the first.
  emit('update:index', (props.index + delta + n) % n)
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      emit('close')
      break
    case 'ArrowLeft':
      e.preventDefault()
      step(-1)
      break
    case 'ArrowRight':
      e.preventDefault()
      step(1)
      break
    case 'Tab': {
      // Only two controls are reachable, so cycle focus between them rather
      // than letting Tab escape to the page underneath.
      const focusables = dialog.value?.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      )
      if (!focusables?.length) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      break
    }
  }
}

watch(open, async (isOpen) => {
  if (import.meta.server) return

  if (isOpen) {
    lastFocused = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
    await nextTick()
    closeBtn.value?.focus()
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
    lastFocused?.focus()
    lastFocused = null
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && piece"
        ref="dialog"
        class="backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="piece.title"
        @click.self="emit('close')"
      >
        <button
          ref="closeBtn"
          type="button"
          class="close"
          aria-label="Close"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M6 6 L18 18 M18 6 L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <figure class="frame">
          <img
            :src="piece.image"
            :alt="piece.alt || piece.title"
            :class="{ 'is-vector': isVector(piece.image) }"
          >
          <figcaption>
            <span class="title">{{ piece.title }}</span>
            <span v-if="piece.year" class="meta">{{ piece.year }}</span>
            <span v-if="piece.note" class="note">{{ piece.note }}</span>
          </figcaption>
        </figure>

        <div v-if="pieces.length > 1" class="nav">
          <button type="button" aria-label="Previous piece" @click="step(-1)">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M15 4 L7 12 L15 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="counter">{{ (index ?? 0) + 1 }} / {{ pieces.length }}</span>
          <button type="button" aria-label="Next piece" @click="step(1)">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M9 4 L17 12 L9 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  grid-template-rows: 1fr auto;
  place-items: center;
  gap: var(--space-m);
  padding: clamp(1rem, 4vw, 3rem);
  background: color-mix(in oklab, var(--paper) 92%, var(--ink));
  backdrop-filter: blur(6px);
}

.frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-m);
  max-width: min(100%, 1100px);
  min-height: 0;
  margin: 0;
}

.frame img {
  max-width: 100%;
  /* Leave room for the caption and the nav row beneath. */
  max-height: min(72vh, 900px);
  width: auto;
  object-fit: contain;
  border-radius: var(--radius-s);
  box-shadow: var(--shadow-deep);
  background: var(--paper-raised);
}

/* Vector placeholders have no intrinsic detail to lose, so let them fill. */
.frame img.is-vector {
  width: min(100%, 620px);
}

figcaption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-s);
  text-align: center;
}

.title {
  font-family: var(--font-display);
  font-size: var(--step-1);
}

.meta {
  color: var(--ink-soft);
  font-size: var(--step--1);
}

.note {
  flex-basis: 100%;
  max-width: 52ch;
  color: var(--ink-soft);
  font-size: var(--step--1);
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-m);
}

.nav button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--paper-edge);
  border-radius: 50%;
  background: var(--paper-raised);
  color: var(--ink-soft);
  cursor: pointer;
  transition: color var(--dur-fast) ease, border-color var(--dur-fast) ease;
}

.nav button:hover {
  color: var(--ink);
  border-color: var(--ink-faint);
}

.counter {
  color: var(--ink-soft);
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
}

.close {
  position: absolute;
  top: clamp(0.75rem, 2vw, 1.5rem);
  right: clamp(0.75rem, 2vw, 1.5rem);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--paper-edge);
  border-radius: 50%;
  background: var(--paper-raised);
  color: var(--ink-soft);
  cursor: pointer;
}

.close:hover {
  color: var(--ink);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--dur-med) var(--ease-enter);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
