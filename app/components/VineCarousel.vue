<script setup lang="ts">
/**
 * Neida's hand-drawn vine as the site's navigation.
 *
 * The artwork is a traced scan — filled paths with `stroke="none"` and no
 * groups (see scripts/clean-vine.mjs) — which rules out the usual stroke-dash
 * "draw the line" trick: there are no strokes to walk along. Instead the reveal is done with a mask containing a
 * single thick-stroked circle whose dash offset animates. That sweeps a wedge
 * around the wreath, so the vine appears to grow around the ring and each leaf
 * arrives as the sweep reaches it. A mask is indifferent to what it covers, so
 * this works on fills, and it is one animated element rather than 176.
 *
 * Tinting one leaf uses the same idea in reverse: a second copy of the art,
 * clipped to that leaf's ellipse and coloured with the accent, drawn on top.
 *
 * The hit areas are real HTML buttons layered over the SVG (percentage
 * positioned against a fixed aspect ratio) so the navigation keeps genuine
 * focus, keyboard and screen-reader behaviour instead of an SVG approximation.
 * The idle rotation is applied to the wrapper so buttons and art stay aligned.
 */
import gsap from 'gsap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import vineRaw from '~/assets/art/vine.svg?raw'
import { ART_VIEW, LEAVES, WREATH } from './vine-leaves'
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
const maskId = `vine-mask-${uid}`
const clipId = (slug: string) => `vine-clip-${uid}-${slug}`

/**
 * Take the inner <g> (which carries potrace's translate/scale transform) and
 * hand the fill over to CSS so the ink can be themed.
 */
const artInner = vineRaw
  .slice(vineRaw.indexOf('<g'), vineRaw.lastIndexOf('</g>') + 4)
  .replace(/fill="#000000"/g, 'fill="currentColor"')

// Sweep geometry. The stroke is wide enough to cover the wreath centre out
// past the furthest leaf tip, so the wedge reveals the full radius.
const MASK_R = WREATH.r
const MASK_W = 720
const MASK_C = 2 * Math.PI * MASK_R

const accentBySlug = computed(
  () => new Map(props.sections.map((s) => [s.slug, s.accent])),
)
const leaves = computed(() => LEAVES.filter((l) => accentBySlug.value.has(l.slug)))

const wrapper = ref<HTMLElement | null>(null)
const sweep = ref<SVGCircleElement | null>(null)
const revealed = ref(false)
const hovered = ref<string | null>(null)

/** Which leaf wears the accent: whatever is hovered, else the active section. */
const tinted = computed(() => hovered.value ?? props.activeSlug)
/** That leaf's own colour, so hovering previews where you're about to go. */
const tintColor = computed(() =>
  tinted.value ? accentBySlug.value.get(tinted.value) ?? 'currentColor' : 'currentColor',
)

let idle: gsap.core.Tween | null = null
let revealTl: gsap.core.Timeline | null = null

/**
 * Positions a hit area over its leaf.
 *
 * Leaf coordinates are in the original scan's space, so the cropped viewBox
 * origin has to be subtracted before converting to percentages of the box.
 */
function hitStyle(leaf: (typeof LEAVES)[number]) {
  const { x, y, width: W, height: H } = ART_VIEW
  return {
    left: `${((leaf.cx - leaf.rx - x) / W) * 100}%`,
    top: `${((leaf.cy - leaf.ry - y) / H) * 100}%`,
    width: `${((leaf.rx * 2) / W) * 100}%`,
    height: `${((leaf.ry * 2) / H) * 100}%`,
    transform: `rotate(${leaf.rot}deg)`,
  }
}

/** Slow breathing rotation — enough to feel alive, small enough to keep the
 *  leaves easy to hit. */
function startIdle() {
  if (reduced.value || !wrapper.value) return
  idle?.kill()
  gsap.set(wrapper.value, { rotation: -1.6 })
  idle = gsap.to(wrapper.value, {
    rotation: 1.6,
    duration: 9,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    transformOrigin: '50% 55%',
  })
}

function playReveal() {
  const el = sweep.value
  if (!el) return

  revealTl?.kill()

  if (reduced.value) {
    gsap.set(el, { strokeDashoffset: 0 })
    revealed.value = true
    return
  }

  revealTl = gsap.timeline({
    onComplete: () => {
      revealed.value = true
      startIdle()
    },
  })

  gsap.set(el, { strokeDashoffset: MASK_C })
  revealTl
    .fromTo(
      wrapper.value,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: 'power1.out' },
      0,
    )
    .to(el, { strokeDashoffset: 0, duration: 2.6, ease: 'power1.inOut' }, 0)
    // A last settle, so the finished drawing lands rather than simply stopping.
    .fromTo(
      wrapper.value,
      { scale: 1.015 },
      { scale: 1, duration: 0.7, ease: 'power2.out', transformOrigin: '50% 55%' },
      '-=0.7',
    )
}

function select(slug: string) {
  emit('update:activeSlug', slug)
}

/** Arrow keys walk around the wreath, matching the carousel it replaced. */
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
    wrapper.value?.querySelector<HTMLElement>(`#leaf-${leaf.slug}`)?.focus()
  })
}

onMounted(() => {
  playReveal()
})

// The OS setting can flip while the page is open; drop the loop if it does.
watch(reduced, (isReduced) => {
  if (isReduced) {
    idle?.kill()
    if (wrapper.value) gsap.set(wrapper.value, { rotation: 0, scale: 1 })
  } else if (revealed.value) {
    startIdle()
  }
})

onBeforeUnmount(() => {
  idle?.kill()
  revealTl?.kill()
})
</script>

<template>
  <div class="vine-stage">
    <!--
      `--sweep-c` drives the pre-animation hidden state from CSS (see base.css).
      It is a custom property rather than the real stroke-dashoffset so that
      GSAP's inline style still wins once the reveal starts.
    -->
    <div ref="wrapper" class="vine" :style="{ '--sweep-c': String(MASK_C) }">
      <svg
        class="art"
        :viewBox="`${ART_VIEW.x} ${ART_VIEW.y} ${ART_VIEW.width} ${ART_VIEW.height}`"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <g :id="artId" v-html="artInner" />

          <mask
            :id="maskId"
            maskUnits="userSpaceOnUse"
            :x="ART_VIEW.x"
            :y="ART_VIEW.y"
            :width="ART_VIEW.width"
            :height="ART_VIEW.height"
          >
            <!--
              The presentation attribute stays at 0 so that with JS disabled
              the drawing is simply visible. base.css raises it to `--sweep-c`
              only when the `js` class is present, which an inline head script
              sets before first paint — so there is no flash of finished art.
            -->
            <circle
              ref="sweep"
              class="vine-sweep"
              :cx="WREATH.cx"
              :cy="WREATH.cy"
              :r="MASK_R"
              fill="none"
              stroke="#fff"
              :stroke-width="MASK_W"
              :stroke-dasharray="MASK_C"
              stroke-dashoffset="0"
              :transform="`rotate(-90 ${WREATH.cx} ${WREATH.cy})`"
            />
          </mask>

          <clipPath v-for="leaf in leaves" :id="clipId(leaf.slug)" :key="leaf.slug">
            <ellipse
              :cx="leaf.cx"
              :cy="leaf.cy"
              :rx="leaf.rx"
              :ry="leaf.ry"
              :transform="`rotate(${leaf.rot} ${leaf.cx} ${leaf.cy})`"
            />
          </clipPath>
        </defs>

        <g :mask="`url(#${maskId})`" class="ink">
          <use :href="`#${artId}`" />
        </g>

        <!-- The accent copy is held back until the reveal finishes, or it would
             appear un-masked and give the ending away. -->
        <use
          v-if="revealed && tinted"
          class="tint"
          :href="`#${artId}`"
          :clip-path="`url(#${clipId(tinted)})`"
          :style="{ color: tintColor }"
        />
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
  aspect-ratio: 585 / 547;
  will-change: transform;
}

.art {
  width: 100%;
  height: 100%;
  color: var(--ink);
  overflow: visible;
}

.tint {
  /* Colour is set inline from the leaf's own accent. */
  transition: color var(--dur-med) var(--ease-enter);
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
  /* Sits over the art; the visible feedback is the tinted leaf underneath. */
  -webkit-tap-highlight-color: transparent;
}

.hit:focus-visible {
  outline: 2.5px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .vine {
    transform: none !important;
  }
}
</style>
