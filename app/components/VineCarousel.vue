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
 * colour UNDERNEATH the drawing, so the pen lines stay black on top of it and it
 * reads as the leaf having been coloured in rather than as a UI state. Only
 * opacity animates, which is what keeps it cheap.
 *
 * The idle spin rotates an inner wrapper rather than the faded element, so the
 * entrance and the spin never fight over the same transform. Hovering a leaf
 * eases the spin to a stop and releasing resumes it — done by tweening the
 * tween's timeScale, not by pausing it, which would stop dead mid-motion.
 *
 * Hit areas are real HTML buttons layered over the SVG, so the navigation keeps
 * genuine focus, keyboard and screen-reader behaviour.
 */
import gsap from 'gsap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import vineRaw from '~/assets/art/vine.svg?raw'
import { ART_VIEW, LEAVES, WREATH, leafOutline } from './vine-leaves'
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

/**
 * The leaf the highlight is drawn around, held through the fade-out.
 *
 * Without this the clip is dropped the instant nothing is lit, while the
 * highlight is still fading — so for the length of the transition the tint
 * applied to the WHOLE drawing rather than one blade, flashing the entire vine
 * in the accent colour.
 */
const lastLit = ref<Leaf | null>(null)
watch(litLeaf, (leaf) => {
  if (leaf) lastLit.value = leaf
})
const shownLeaf = computed(() => litLeaf.value ?? lastLit.value)

/**
 * Colour is laid on in two passes, each nudged off the outline.
 *
 * A single shape filled exactly to the line reads as a digital fill. Offsetting
 * and rotating each pass a little leaves colour slightly over the line in places
 * and short of it in others, and the overlap between the two makes the density
 * uneven — which is what going over a patch twice with a pencil actually looks
 * like.
 */
const WASH_PASSES = [
  { rotate: -2.4, dx: 2, dy: -1.5, scale: 0.95, opacity: 0.3 },
  { rotate: 3.1, dx: -1.5, dy: 2, scale: 0.91, opacity: 0.26 },
]

function washTransform(leaf: Leaf, pass: (typeof WASH_PASSES)[number]) {
  return (
    `translate(${leaf.cx + pass.dx} ${leaf.cy + pass.dy}) ` +
    `rotate(${pass.rotate}) scale(${pass.scale}) ` +
    `translate(${-leaf.cx} ${-leaf.cy})`
  )
}


/** That leaf's own colour, so hovering previews where you're about to go. */
const tintColor = computed(() =>
  litLeaf.value ? accentBySlug.value.get(litLeaf.value.slug) ?? 'currentColor' : 'currentColor',
)

let spin: gsap.core.Tween | null = null
let spinRate: gsap.core.Tween | null = null

/**
 * The wreath's centre as a percentage of the cropped viewBox, so the drawing
 * turns about the ring rather than the middle of its bounding box.
 */
const spinOrigin = `${(((WREATH.cx - ART_VIEW.x) / ART_VIEW.width) * 100).toFixed(1)}% ` +
  `${(((WREATH.cy - ART_VIEW.y) / ART_VIEW.height) * 100).toFixed(1)}%`

/** One turn, slowly. Linear, because a continuous rotation must not pulse. */
const SPIN_SECONDS = 150

function startSpin() {
  if (reduced.value || !drift.value || spin) return
  spin = gsap.to(drift.value, {
    rotation: '+=360',
    duration: SPIN_SECONDS,
    ease: 'none',
    repeat: -1,
    transformOrigin: spinOrigin,
  })
}

/**
 * Eases the spin to a halt, or back up to speed.
 *
 * Tweening timeScale rather than calling pause()/resume(): pausing stops the
 * rotation dead on the frame it happens, which reads as a jolt on something
 * moving this slowly. Slowing to zero over half a second looks like it is
 * settling. Resuming is given longer so it creeps back rather than lurching.
 */
function setSpinning(on: boolean) {
  if (!spin) return
  spinRate?.kill()
  spinRate = gsap.to(spin, {
    timeScale: on ? 1 : 0,
    duration: on ? 1.1 : 0.55,
    ease: on ? 'power2.inOut' : 'power2.out',
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

// Hovering a leaf stops the vine so it can be read and aimed at; leaving starts
// it again. Keyed on hover alone, not on the open section — otherwise choosing a
// section would freeze the drawing for as long as it stayed open.
watch(hovered, (slug) => setSpinning(!slug))

onMounted(() => {
  // No need to wait for the entrance: it animates .vine while the spin animates
  // .vine-inner, so the two never touch the same transform.
  startSpin()
})

// The OS setting can flip while the page is open; drop the loop if it does.
watch(reduced, (isReduced) => {
  if (isReduced) {
    spinRate?.kill()
    spin?.kill()
    spin = null
    if (drift.value) gsap.set(drift.value, { rotation: 0 })
  } else {
    startSpin()
  }
})

onBeforeUnmount(() => {
  spinRate?.kill()
  spin?.kill()
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
          </defs>

          <!--
            Colour goes UNDER the drawing so the pen lines stay black on top of
            it, the way a coloured-in drawing actually looks. Tinting the ink
            itself read as a UI state; this reads as the leaf having been
            coloured in.
          -->
          <g
            v-if="shownLeaf"
            class="wash"
            :class="{ 'is-lit': !!litLeaf }"
            :style="{ color: tintColor }"
          >
            <path
              v-for="(pass, i) in WASH_PASSES"
              :key="i"
              :d="leafOutline(shownLeaf)"
              :transform="washTransform(shownLeaf, pass)"
              :opacity="pass.opacity"
              fill="currentColor"
            />
          </g>

          <use :href="`#${artId}`" />

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
  /* Promotes the drawing to its own layer, so the spin is composited rather
     than repainting fifty paths every frame. */
  will-change: transform;
}

.art {
  width: 100%;
  height: 100%;
  color: var(--ink);
  overflow: visible;
}

.wash {
  opacity: 0;
  /* Colour is set inline from the leaf's own accent.

     If a glow is ever wanted here, drop-shadow(0 0 Npx currentColor) follows the
     linework nicely — but it has to go on an UNCLIPPED parent with the clip on
     an inner group. CSS applies filter before clip-path, so both on one element
     cuts the halo off square at the blade's outline. */
  transition: opacity var(--dur-med) var(--ease-enter);
  pointer-events: none;
}

.wash.is-lit {
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
