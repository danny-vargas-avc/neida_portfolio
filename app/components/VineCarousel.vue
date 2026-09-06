<script setup lang="ts">
/**
 * Neida's hand-drawn vine as the site's navigation.
 *
 * The artwork is a traced scan — filled paths with `stroke="none"` and no groups
 * (see scripts/clean-vine.mjs) — which rules out the usual stroke-dash "draw the
 * line" trick: there are no strokes to walk along. Both animations here are
 * therefore done by animating masks, which don't care what they cover.
 *
 * OPENING REVEAL. A mask holding one wide-stroked path that runs from the centre
 * of the wreath out through every leaf in turn, with its dash offset animated,
 * so the drawing uncovers along that route.
 *
 * The route is listed explicitly in REVEAL_ORDER rather than derived. The leaves
 * do not come in compass order — by bearing from the centre, film (-18 degrees)
 * and education (50) fall between florals (-44) and cake (75) — so neither an
 * angular wedge nor a mathematical spiral can produce the order the vine itself
 * follows. Walking the listed leaves still reads as a spiral, because that route
 * genuinely winds outward from the middle.
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
 * The order the reveal travels through the leaves — the vine's own path, which
 * is not the same as their order by bearing from the centre. Change this and the
 * opening animation follows the new route; nothing else needs touching.
 */
const REVEAL_ORDER = [
  'florals',
  'cake',
  'drawings',
  'textiles',
  'clay',
  'film',
  'education',
  'research',
] as const

/**
 * Width of the revealing stroke. Wide enough that the vine running between two
 * leaves is uncovered as the path passes, without being so wide that it gives
 * away the next leaf early.
 *
 * The stroke uses a butt linecap, not round: a round cap paints a full disc even
 * at zero dash length, which left a circle of vine already showing at the centre
 * before the reveal had started.
 *
 * Kept fairly tight, because a wider stroke reaches sideways onto vine belonging
 * to leaves the route has not arrived at yet — research's stem in particular was
 * appearing while the reveal was still elsewhere.
 */
const REVEAL_W = 158

/** How far behind the stem the colour wash begins, so the join is covered. */
const FRONT_BACKSET = 14

/**
 * The reveal route, and its length.
 *
 * Leaf centres are joined with a Catmull-Rom spline so the path curves through
 * them instead of zig-zagging, then sampled to a polyline. Sampling gives the
 * length for free: summing it here rather than reading getTotalLength() back
 * from the DOM keeps the dash values identical on the server and the client, so
 * the pre-animation hidden state can be set from CSS without flashing the
 * finished drawing.
 */
const reveal = (() => {
  // Start at the middle of the wreath, then out through each leaf in turn.
  const pts: [number, number][] = [[WREATH.cx, WREATH.cy]]
  for (const slug of REVEAL_ORDER) {
    const leaf = LEAVES.find((l) => l.slug === slug)
    if (leaf) pts.push([leaf.cx, leaf.cy])
  }

  // Run on past the final leaf. The route otherwise stops at its centre, and a
  // butt-capped stroke ends there too, leaving the outer half of that blade
  // never uncovered. The blade centre is halfway along, so 2.6x the stem-to-
  // centre vector clears the tip with margin.
  const last = LEAVES.find((l) => l.slug === REVEAL_ORDER[REVEAL_ORDER.length - 1])
  if (last) {
    pts.push([
      last.ax + (last.cx - last.ax) * 2.6,
      last.ay + (last.cy - last.ay) * 2.6,
    ])
  }

  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!
  const SEGMENTS = 24

  let d = ''
  let length = 0
  let px = 0
  let py = 0

  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = at(i - 1)
    const [x1, y1] = at(i)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)

    for (let step = 0; step <= SEGMENTS; step++) {
      if (i > 0 && step === 0) continue // the previous segment ended here
      const t = step / SEGMENTS
      const t2 = t * t
      const t3 = t2 * t

      // Catmull-Rom basis, tension 0.5.
      const x =
        0.5 *
        (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3)
      const y =
        0.5 *
        (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3)

      if (d === '') {
        d = `M${x.toFixed(1)} ${y.toFixed(1)}`
      } else {
        d += `L${x.toFixed(1)} ${y.toFixed(1)}`
        length += Math.hypot(x - px, y - py)
      }
      px = x
      py = y
    }
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

  gsap.set(el, { strokeDashoffset: reveal.length })
  revealTl
    .fromTo(wrapper.value, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0)
    .to(el, { strokeDashoffset: 0, duration: 4.4, ease: 'power1.inOut' }, 0)
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
    <div ref="wrapper" class="vine" :style="{ '--sweep-c': String(reveal.length) }">
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
              :d="reveal.d"
              stroke-linecap="butt"
              fill="none"
              stroke="#fff"
              :stroke-width="REVEAL_W"
              stroke-linejoin="round"
              :stroke-dasharray="reveal.length"
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
