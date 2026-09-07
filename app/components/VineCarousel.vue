<script setup lang="ts">
/**
 * Neida's hand-drawn vine as the site's navigation.
 *
 * ANIMATION POLICY: opacity and transform only.
 *
 * An earlier version revealed the drawing by animating an SVG <mask> — a wide
 * stroke walking a route through the leaves, plus per-leaf hold-backs. It
 * stuttered badly, and unavoidably: changing anything inside a mask forces the
 * browser to re-rasterise the mask AND the artwork beneath it every frame, and
 * this artwork is fifty filled paths. Opacity and transform are handled by the
 * compositor instead, so they stay smooth however intricate the drawing is.
 *
 * So: the vine fades and settles in as one element, and lighting a leaf fades in
 * a tinted copy clipped to that blade. The clip is static — only opacity moves —
 * which is what keeps it cheap.
 *
 * The idle drift rotates an inner wrapper rather than the faded element, so the
 * entrance and the drift never fight over the same transform.
 *
 * Hit areas are real HTML buttons layered over the SVG, so the navigation keeps
 * genuine focus, keyboard and screen-reader behaviour.
 */
import gsap from 'gsap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import vineRaw from '~/assets/art/vine.svg?raw'
import { ART_VIEW, LEAVES, leafOutline } from './vine-leaves'
import type { Leaf } from './vine-leaves'
import { useReducedMotion } from '~/composables/useReducedMotion'

const props = defineProps<{
  /**
   * The sections that exist, in case the artwork runs ahead of the content.
   * Carries each accent so a hovered leaf can preview its OWN colour rather
   * than borrowing the currently selected section's.
   */
  sections: { slug: string; accent: string }[]
  activeSlug: string | null
}>()

const emit = defineEmits<{ 'update:activeSlug': [slug: string] }>()

const reduced = useReducedMotion()

// Unique per instance so two vines on a page can't collide over element ids.
const uid = useId()
const artId = `vine-art-${uid}`
const clipId = (slug: string) => `vine-clip-${uid}-${slug}`

/**
 * Take the inner <g> (which carries potrace's translate/scale transform) and
 * hand the fill over to CSS so the ink can be themed.
 */
const artInner = vineRaw
  .slice(vineRaw.indexOf('<g'), vineRaw.lastIndexOf('</g>') + 4)
  .replace(/fill="#000000"/g, 'fill="currentColor"')

const accentBySlug = computed(
  () => new Map(props.sections.map((s) => [s.slug, s.accent])),
)
const leaves = computed(() => LEAVES.filter((l) => accentBySlug.value.has(l.slug)))

const drift = ref<HTMLElement | null>(null)
const hovered = ref<string | null>(null)

/**
 * Which leaf is lit: whatever is hovered, else the open section.
 *
 * Falling back to the selection is what makes this work on touch, where there is
 * no hover at all — tapping a leaf lights it and it stays lit while that section
 * is open.
 */
const target = computed(() => hovered.value ?? props.activeSlug)
const litLeaf = computed(() => leaves.value.find((l) => l.slug === target.value) ?? null)

/** That leaf's own colour, so hovering previews where you're about to go. */
const tintColor = computed(() =>
  litLeaf.value ? accentBySlug.value.get(litLeaf.value.slug) ?? 'currentColor' : 'currentColor',
)

let idle: gsap.core.Timeline | null = null

/**
 * Slow breathing rotation — enough to feel alive, small enough to keep the
 * leaves easy to hit.
 *
 * It eases from wherever the drawing already sits rather than jumping to one end
 * of the swing first: setting the start angle outright made the whole vine snap
 * counter-clockwise the moment it began.
 */
function startIdle() {
  if (reduced.value || !drift.value) return
  idle?.kill()
  const el = drift.value

  idle = gsap.timeline()
  idle
    .to(el, { rotation: 1.4, duration: 5, ease: 'sine.inOut', transformOrigin: '50% 55%' })
    .to(el, {
      rotation: -1.4,
      duration: 10,
      ease: 'sine.inOut',
      transformOrigin: '50% 55%',
      yoyo: true,
      repeat: -1,
    })
}

function select(slug: string) {
  emit('update:activeSlug', slug)
}

/** Arrow keys walk around the wreath, in the order the leaves sit on it. */
function onKeydown(e: KeyboardEvent) {
  const list = leaves.value
  const i = list.findIndex((l) => l.slug === props.activeSlug)
  let next: number | null = null

  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': next = i + 1; break
    case 'ArrowLeft': case 'ArrowUp': next = i - 1; break
    case 'Home': next = 0; break
    case 'End': next = list.length - 1; break
    default: return
  }

  e.preventDefault()
  const wrapped = (next + list.length) % list.length
  const leaf = list[wrapped]
  if (!leaf) return
  select(leaf.slug)
  nextTick(() => {
    drift.value?.querySelector<HTMLElement>(`#leaf-${leaf.slug}`)?.focus()
  })
}

/**
 * Positions a hit area over its leaf.
 *
 * Leaf coordinates are in the original scan's space, so the cropped viewBox
 * origin has to be subtracted before converting to percentages of the box.
 */
function hitStyle(leaf: Leaf) {
  const { x, y, width: W, height: H } = ART_VIEW
  return {
    left: `${((leaf.cx - leaf.rx - x) / W) * 100}%`,
    top: `${((leaf.cy - leaf.ry - y) / H) * 100}%`,
    width: `${((leaf.rx * 2) / W) * 100}%`,
    height: `${((leaf.ry * 2) / H) * 100}%`,
    transform: `rotate(${leaf.rot}deg)`,
  }
}

onMounted(() => {
  // The entrance is a CSS animation on .vine (2.6s, see base.css); hold the
  // drift until it has finished so the two never transform the same element at
  // once. Keep this in step with that duration.
  gsap.delayedCall(reduced.value ? 0 : 2.7, startIdle)
})

// The OS setting can flip while the page is open; drop the loop if it does.
watch(reduced, (isReduced) => {
  if (isReduced) {
    idle?.kill()
    if (drift.value) gsap.set(drift.value, { rotation: 0 })
  } else {
    startIdle()
  }
})

onBeforeUnmount(() => {
  idle?.kill()
  gsap.killTweensOf(startIdle)
})
</script>

<template>
  <div class="vine-stage">
    <div class="vine">
      <div ref="drift" class="vine-inner">
        <svg
          class="art"
          :viewBox="`${ART_VIEW.x} ${ART_VIEW.y} ${ART_VIEW.width} ${ART_VIEW.height}`"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <g :id="artId" v-html="artInner" />

            <!--
              Clipped to the blade itself, not the hit-area ellipse. Cake and
              florals sit inside the wreath, where an ellipse would also enclose
              lengths of vine and colour them along with the leaf.
            -->
            <clipPath v-for="leaf in leaves" :id="clipId(leaf.slug)" :key="leaf.slug">
              <path :d="leafOutline(leaf)" />
            </clipPath>
          </defs>

          <use :href="`#${artId}`" />

          <!--
            The lit leaf: a second copy of the drawing clipped to that blade and
            tinted, faded in by CSS. Painted last so it sits over the vine — cake
            and florals overlap the ring itself, and SVG has no z-index, so
            document order is the stacking order.

            The clip never animates; only opacity does. That is what keeps this
            cheap however intricate the drawing is.
          -->
          <g
            class="tint"
            :class="{ 'is-lit': !!litLeaf }"
            :clip-path="litLeaf ? `url(#${clipId(litLeaf.slug)})` : undefined"
            :style="{ color: tintColor }"
          >
            <use :href="`#${artId}`" />
          </g>
        </svg>

        <div class="hits" role="tablist" aria-label="Areas of work" @keydown="onKeydown">
          <button
            v-for="leaf in leaves"
            :id="`leaf-${leaf.slug}`"
            :key="leaf.slug"
            type="button"
            role="tab"
            class="hit"
            :class="{ 'is-active': leaf.slug === activeSlug }"
            :style="hitStyle(leaf)"
            :aria-selected="leaf.slug === activeSlug"
            :aria-controls="`panel-${leaf.slug}`"
            :tabindex="leaf.slug === activeSlug ? 0 : -1"
            @click="select(leaf.slug)"
            @mouseenter="hovered = leaf.slug"
            @mouseleave="hovered = null"
            @focus="hovered = leaf.slug"
            @blur="hovered = null"
          >
            <span class="sr-only">{{ leaf.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vine-stage {
  display: grid;
  place-items: center;
  /* The drawing carries its own margin in the cropped viewBox, so the stage
     adds very little of its own. */
  padding-block: var(--space-xs);
}

.vine {
  position: relative;
  width: min(100%, 620px);
  /* Matches the cropped viewBox in vine-leaves.ts, so the percentage-positioned
     hit areas land on the leaves. Keep the two in step. */
  aspect-ratio: 581 / 547;
}

.vine-inner {
  position: absolute;
  inset: 0;
  /* Promotes the drawing to its own layer, so the idle drift is composited
     rather than repainting fifty paths every frame. */
  will-change: transform;
}

.art {
  width: 100%;
  height: 100%;
  color: var(--ink);
  overflow: visible;
}

.tint {
  opacity: 0;
  /* Colour is set inline from the leaf's own accent. */
  transition: opacity var(--dur-med) var(--ease-enter);
}

.tint.is-lit {
  opacity: 1;
}

.hits {
  position: absolute;
  inset: 0;
}

.hit {
  position: absolute;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  /* Sits over the art; the visible feedback is the leaf lighting underneath. */
  -webkit-tap-highlight-color: transparent;
}

.hit:focus-visible {
  outline: 2.5px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .vine-inner {
    transform: none !important;
  }
}
</style>
