<script setup lang="ts">
/**
 * Neida's hand-drawn vine as the site's navigation.
 *
 * The artwork is a traced scan — filled paths with `stroke="none"` and no groups
 * (see scripts/clean-vine.mjs) — which rules out the usual stroke-dash "draw the
 * line" trick: there are no strokes to walk along. Both animations here are
 * therefore done by animating masks, which don't care what they cover.
 *
 * OPENING REVEAL. A mask holding an Archimedean spiral, stroked wide enough that
 * consecutive turns overlap, with its dash offset animated. The reveal starts at
 * the centre of the wreath and unwinds clockwise and outward along the vine,
 * rather than a pie-wedge uncovering the whole radius at one bearing at once.
 *
 * LEAF FILL. A copy of the drawing, clipped to the leaf's blade and tinted,
 * revealed by a soft band travelling from the stem junction to the tip — colour
 * washing along the leaf rather than arriving all at once.
 *
 * The copy is drawn at exactly the original's size and position, which is what
 * keeps this clean: it registers over the leaf underneath, so there is no
 * ghosting and nothing needs erasing. (An earlier version erased the leaf and
 * grew a larger copy in its place. It read badly, and rightly so — a growing
 * leaf keeps the tissue it has and expands, it does not vanish and get redrawn.)
 *
 * Hit areas are real HTML buttons layered over the SVG, so the navigation keeps
 * genuine focus, keyboard and screen-reader behaviour. The idle rotation is on
 * the wrapper so buttons and art stay aligned.
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
const maskId = `vine-mask-${uid}`
const fillId = `vine-fill-${uid}`
const softId = `vine-soft-${uid}`
const clipId = (slug: string) => `vine-clip-${uid}-${slug}`

/**
 * Take the inner <g> (which carries potrace's translate/scale transform) and
 * hand the fill over to CSS so the ink can be themed.
 */
const artInner = vineRaw
  .slice(vineRaw.indexOf('<g'), vineRaw.lastIndexOf('</g>') + 4)
  .replace(/fill="#000000"/g, 'fill="currentColor"')

/**
 * Which leaf the opening reveal starts on. The spiral begins at the wreath
 * centre on this leaf's bearing and unwinds clockwise, so leaves arrive in the
 * order they sit around the ring.
 */
const REVEAL_START_SLUG = 'florals'

/**
 * Opening-reveal spiral. It has to reach past the furthest leaf tip, and the
 * stroke must be wider than the gap between turns or the reveal leaves
 * unpainted rings behind it.
 */
const SPIRAL_MAX_R = 350
const SPIRAL_TURNS = 2.1
const SPIRAL_W = (SPIRAL_MAX_R / SPIRAL_TURNS) * 1.3

/** How far behind the stem the colour wash begins, so the join is covered. */
const FRONT_BACKSET = 14

/** Bearing of the starting leaf from the wreath centre, in degrees. */
const revealStartAngle = (() => {
  const leaf = LEAVES.find((l) => l.slug === REVEAL_START_SLUG)
  if (!leaf) return -90
  return (Math.atan2(leaf.cy - WREATH.cy, leaf.cx - WREATH.cx) * 180) / Math.PI
})()

/**
 * The reveal spiral, and its length.
 *
 * The length is summed from the polyline as it is built rather than read back
 * with getTotalLength(), so the dash values are identical on the server and the
 * client and the pre-animation hidden state can be set from CSS without a flash
 * of the finished drawing.
 */
const spiral = (() => {
  const startRad = (revealStartAngle * Math.PI) / 180
  const total = SPIRAL_TURNS * Math.PI * 2
  const a = SPIRAL_MAX_R / total
  const steps = Math.ceil(SPIRAL_TURNS * 72)

  let d = ''
  let length = 0
  let px = 0
  let py = 0

  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * total
    const r = a * th
    const x = WREATH.cx + Math.cos(th + startRad) * r
    const y = WREATH.cy + Math.sin(th + startRad) * r
    if (i === 0) {
      d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    } else {
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`
      length += Math.hypot(x - px, y - py)
    }
    px = x
    py = y
  }
  return { d, length: Math.ceil(length) }
})()

const accentBySlug = computed(
  () => new Map(props.sections.map((s) => [s.slug, s.accent])),
)
const leaves = computed(() => LEAVES.filter((l) => accentBySlug.value.has(l.slug)))

const wrapper = ref<HTMLElement | null>(null)
const sweep = ref<SVGPathElement | null>(null)
const fillFront = ref<SVGRectElement | null>(null)
const revealed = ref(false)
const hovered = ref<string | null>(null)

/**
 * Which leaf is lit: whatever is hovered, else the open section.
 *
 * Falling back to the selection is what makes this work on touch, where there
 * is no hover at all — tapping a leaf fills it and it stays filled while that
 * section is open.
 */
const target = computed(() => hovered.value ?? props.activeSlug)

/**
 * The leaf currently in the fill layer. Lags behind `target` on the way out so
 * the wash can drain before the element is removed.
 */
const filling = ref<Leaf | null>(null)

/** That leaf's own colour, so hovering previews where you're about to go. */
const tintColor = computed(() =>
  filling.value
    ? accentBySlug.value.get(filling.value.slug) ?? 'currentColor'
    : 'currentColor',
)

/**
 * The leaf's own axis: the direction the wash travels, how far it must run to
 * cover the whole blade, and how wide the advancing band has to be.
 */
function leafAxis(leaf: Leaf) {
  const dx = leaf.cx - leaf.ax
  const dy = leaf.cy - leaf.ay
  return {
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    length: Math.hypot(dx, dy) + Math.max(leaf.rx, leaf.ry) + 30,
    halfWidth: Math.max(leaf.rx, leaf.ry) + 24,
  }
}

/** Axis of whichever leaf is filling, for the template. */
const axis = computed(() => (filling.value ? leafAxis(filling.value) : null))

let idle: gsap.core.Timeline | null = null
let revealTl: gsap.core.Timeline | null = null
let fillTween: gsap.core.Tween | null = null

/** Runs the colour up the leaf, from the stem to the tip. */
async function fillLeaf(leaf: Leaf) {
  filling.value = leaf
  await nextTick()

  const front = fillFront.value
  if (!front) return

  fillTween?.kill()
  const span = leafAxis(leaf).length + FRONT_BACKSET

  if (reduced.value) {
    gsap.set(front, { attr: { width: span } })
    return
  }

  fillTween = gsap.fromTo(
    front,
    { attr: { width: 0 } },
    { attr: { width: span }, duration: 0.5, ease: 'power2.out' },
  )
}

/** Drains the colour back toward the stem, then drops the layer. */
function drainLeaf() {
  const front = fillFront.value
  fillTween?.kill()

  if (!front || !filling.value || reduced.value) {
    filling.value = null
    return
  }

  fillTween = gsap.to(front, {
    attr: { width: 0 },
    duration: 0.32,
    ease: 'power2.in',
    onComplete: () => {
      // Only clear if nothing new claimed the layer while we were draining.
      if (target.value === null) filling.value = null
    },
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

/**
 * Slow breathing rotation — enough to feel alive, small enough to keep the
 * leaves easy to hit.
 *
 * It eases from wherever the drawing already sits rather than jumping to one end
 * of the swing first: setting the start angle outright made the whole vine snap
 * counter-clockwise the instant the reveal finished.
 */
function startIdle() {
  if (reduced.value || !wrapper.value) return
  idle?.kill()
  const w = wrapper.value

  idle = gsap.timeline()
  idle
    .to(w, { rotation: 1.6, duration: 4.5, ease: 'sine.inOut', transformOrigin: '50% 55%' })
    .to(w, {
      rotation: -1.6,
      duration: 9,
      ease: 'sine.inOut',
      transformOrigin: '50% 55%',
      yoyo: true,
      repeat: -1,
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

  gsap.set(el, { strokeDashoffset: spiral.length })
  revealTl
    .fromTo(wrapper.value, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0)
    .to(el, { strokeDashoffset: 0, duration: 2.8, ease: 'power1.inOut' }, 0)
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
    wrapper.value?.querySelector<HTMLElement>(`#leaf-${leaf.slug}`)?.focus()
  })
}

// Drive the fill layer from whichever leaf is lit. Waits for the reveal so a
// hover during the opening animation can't light a leaf early.
watch([target, revealed], ([slug, isRevealed]) => {
  if (!isRevealed) return
  if (!slug) {
    drainLeaf()
    return
  }
  const leaf = leaves.value.find((l) => l.slug === slug)
  if (leaf && leaf.slug !== filling.value?.slug) fillLeaf(leaf)
})

onMounted(() => {
  playReveal()
})

// The OS setting can flip while the page is open; drop the loops if it does.
watch(reduced, (isReduced) => {
  if (isReduced) {
    idle?.kill()
    fillTween?.kill()
    if (wrapper.value) gsap.set(wrapper.value, { rotation: 0, scale: 1 })
  } else if (revealed.value) {
    startIdle()
  }
})

onBeforeUnmount(() => {
  idle?.kill()
  revealTl?.kill()
  fillTween?.kill()
})
</script>

<template>
  <div class="vine-stage">
    <!--
      `--sweep-c` drives the pre-animation hidden state from CSS (see base.css).
      It is a custom property rather than the real stroke-dashoffset so that
      GSAP's inline style still wins once the reveal starts.
    -->
    <div ref="wrapper" class="vine" :style="{ '--sweep-c': String(spiral.length) }">
      <svg
        class="art"
        :viewBox="`${ART_VIEW.x} ${ART_VIEW.y} ${ART_VIEW.width} ${ART_VIEW.height}`"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <g :id="artId" v-html="artInner" />

          <!-- Softens the leading edge of the colour wash. -->
          <filter :id="softId" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>

          <mask
            :id="maskId"
            maskUnits="userSpaceOnUse"
            :x="ART_VIEW.x"
            :y="ART_VIEW.y"
            :width="ART_VIEW.width"
            :height="ART_VIEW.height"
          >
            <!--
              The presentation attribute stays at 0 so that with JS disabled the
              drawing is simply visible. base.css raises it to `--sweep-c` only
              when the `js` class is present, which an inline head script sets
              before first paint — so there is no flash of finished art.
            -->
            <path
              ref="sweep"
              class="vine-sweep"
              :d="spiral.d"
              fill="none"
              stroke="#fff"
              :stroke-width="SPIRAL_W"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="spiral.length"
              stroke-dashoffset="0"
            />
          </mask>

          <!--
            Clipped to the blade itself, not the hit-area ellipse. Cake and
            florals sit inside the wreath, where an ellipse would also enclose
            lengths of vine and colour them along with the leaf.
          -->
          <clipPath v-for="leaf in leaves" :id="clipId(leaf.slug)" :key="leaf.slug">
            <path :d="leafOutline(leaf)" />
          </clipPath>

          <!--
            The advancing edge of the colour, square to the leaf's midrib, so the
            fill runs from the stem to the tip rather than appearing at once.
          -->
          <mask
            :id="fillId"
            maskUnits="userSpaceOnUse"
            :x="ART_VIEW.x"
            :y="ART_VIEW.y"
            :width="ART_VIEW.width"
            :height="ART_VIEW.height"
          >
            <g
              v-if="filling && axis"
              :transform="`rotate(${axis.angle} ${filling.ax} ${filling.ay})`"
            >
              <rect
                ref="fillFront"
                class="fill-front"
                :x="filling.ax - FRONT_BACKSET"
                :y="filling.ay - axis.halfWidth"
                width="0"
                :height="axis.halfWidth * 2"
                fill="#fff"
                :filter="`url(#${softId})`"
              />
            </g>
          </mask>
        </defs>

        <g :mask="`url(#${maskId})`" class="ink">
          <use :href="`#${artId}`" />
        </g>

        <!--
          The lit leaf, painted last so it sits over the vine — cake and florals
          overlap the ring itself. SVG has no z-index; document order is the
          stacking order, so this group must stay the final child of the <svg>.

          Held back until the opening reveal finishes, or it would appear
          un-masked and give the ending away.
        -->
        <g
          v-if="revealed && filling"
          class="tint"
          :clip-path="`url(#${clipId(filling.slug)})`"
          :mask="`url(#${fillId})`"
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
  /* Sits over the art; the visible feedback is the leaf filling underneath. */
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
