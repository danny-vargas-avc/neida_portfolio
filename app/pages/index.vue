<script setup lang="ts">
/**
 * The whole site: one page.
 *
 * The carousel selects which panel is shown. Every panel is rendered into the
 * HTML and merely hidden, rather than mounted on demand — so the prerendered
 * page contains all of Neida's work for search engines, and switching sections
 * costs nothing.
 */
import gsap from 'gsap'
import { computed, nextTick, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { Section, SiteInfo } from '~/types/content'
import { useReducedMotion } from '~/composables/useReducedMotion'

/**
 * Everything on the page, in one request from the Django admin.
 *
 * One endpoint rather than a call per model: this is a single page that needs
 * all of it at once, so one round trip is both simpler and easier to cache.
 * Unpublished sections are already filtered out server-side.
 */
const { apiBase } = useRuntimeConfig().public
const { data, error } = await useAsyncData('content', () =>
  $fetch<{ site: SiteInfo; sections: Section[] }>(`${apiBase}/api/content/`),
)

if (error.value) {
  // Better a clear failure than a page that renders as an empty drawing and
  // looks like the content was deleted.
  throw createError({
    statusCode: 503,
    statusMessage: 'The content service is unavailable. Is the Django server running?',
    fatal: true,
  })
}

const sections = computed(() => data.value?.sections ?? [])
const info = computed(() => data.value?.site ?? ({} as SiteInfo))

// Selection is keyed by slug rather than index: the vine's leaves are laid out
// by hand in vine-leaves.ts, so slug is the only stable link between the
// artwork and the content.
const activeSlug = ref<string | null>(null)
// Nothing is selected on load: the page opens as just the drawing, and a
// section only appears once a leaf is chosen.
const current = computed(
  () => sections.value.find((s) => s.slug === activeSlug.value) ?? null,
)
// The vine only needs each leaf's identity and colour.
const leafSections = computed(() =>
  sections.value.map((s) => ({ slug: s.slug, accent: s.accent })),
)

const reduced = useReducedMotion()
const panelEls = ref<HTMLElement[]>([])

function setPanelRef(el: Element | ComponentPublicInstance | null, i: number) {
  if (el instanceof HTMLElement) panelEls.value[i] = el
}

/**
 * Entrance for the panel that just became visible.
 *
 * v-show doesn't remount, so a Vue <Transition> never fires here — the tween is
 * driven explicitly. The scroll matters as much as the fade: the vine fills the
 * viewport, so without bringing the panel into view a click on a leaf can look
 * like it did nothing at all.
 */
watch(activeSlug, async (slug) => {
  if (!slug) return
  await nextTick()

  const i = sections.value.findIndex((s) => s.slug === slug)
  const el = panelEls.value[i]
  if (!el) return

  if (!reduced.value) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' },
    )
  }

  el.scrollIntoView({
    behavior: reduced.value ? 'auto' : 'smooth',
    block: 'start',
  })
})

// Teleported UI (the lightbox) sits outside this component's subtree, so the
// accent is mirrored onto <html> as well as scoped to the page wrapper.
watch(
  current,
  (section) => {
    if (import.meta.client && section) {
      document.documentElement.style.setProperty('--accent', section.accent)
    }
  },
  { immediate: true },
)

useHead(() => ({
  title: `${info.value.name || 'Portfolio'} — ${info.value.role || ''}`.trim(),
  meta: [{ name: 'description', content: info.value.intro || '' }],
}))
</script>

<template>
  <div class="page" :style="current ? { '--accent': current.accent } : undefined">
    <a class="skip-link" href="#work">Skip to work</a>

    <header class="masthead shell">
      <h1 class="name">{{ info.name }}</h1>
      <p class="role">{{ info.role }}</p>
      <p v-if="info.intro" class="intro">{{ info.intro }}</p>
    </header>

    <main id="work">
      <VineCarousel
        :sections="leafSections"
        :active-slug="current?.slug ?? null"
        @update:active-slug="activeSlug = $event"
      />

      <Transition name="hint">
        <p v-if="!current" class="hint">Choose a leaf</p>
      </Transition>

      <div class="panels shell">
        <section
          v-for="(section, i) in sections"
          v-show="section.slug === current?.slug"
          :id="`panel-${section.slug}`"
          :key="section.slug"
          :ref="(el) => setPanelRef(el, i)"
          role="tabpanel"
          :aria-labelledby="`leaf-${section.slug}`"
          tabindex="0"
          class="panel"
        >
          <header class="panel-head">
            <h2>{{ section.title }}</h2>
            <p class="tagline">{{ section.tagline }}</p>
          </header>

          <!-- Omitted entirely when blank, so an unwritten section still looks
               deliberate rather than leaving a gap under the heading. -->
          <p v-if="section.intro" class="panel-note prose">{{ section.intro }}</p>

          <PublicationList
            v-if="section.kind === 'research' && section.publications?.length"
            :publications="section.publications"
            :cv="section.cv || undefined"
          />

          <OfferingList
            v-if="section.offerings?.length"
            :offerings="section.offerings"
            class="offerings"
          />

          <GalleryGrid
            v-if="section.pieces?.length"
            :pieces="section.pieces"
            class="gallery"
          />
        </section>
      </div>
    </main>

    <section v-if="info.about" class="about shell">
      <h2>about</h2>
      <p class="about-text">{{ info.about }}</p>
    </section>

    <footer class="footer shell">
      <p class="footer-name">{{ info.name }}</p>
      <ul v-if="info.links?.length || info.email" class="footer-links">
        <li v-if="info.email">
          <a :href="`mailto:${info.email}`">{{ info.email }}</a>
        </li>
        <li v-for="link in info.links" :key="link.url">
          <a :href="link.url" rel="noopener">{{ link.label }}</a>
        </li>
      </ul>
      <p v-if="info.location" class="footer-loc">{{ info.location }}</p>
    </footer>
  </div>
</template>

<style scoped>
.masthead {
  padding-block: clamp(2rem, 6vh, 4rem) var(--space-m);
  text-align: center;
}

.name {
  font-size: var(--step-5);
  font-weight: 400;
  letter-spacing: -0.03em;
}

.role {
  margin-top: var(--space-s);
  color: var(--ink-soft);
  font-size: var(--step--1);
  letter-spacing: 0.14em;
  text-transform: lowercase;
}

.intro {
  max-width: 46ch;
  margin: var(--space-m) auto 0;
  color: var(--ink-soft);
  font-size: var(--step-1);
  line-height: 1.5;
}

.panels {
  padding-block: var(--space-m) var(--space-3xl);
}

.panel {
  /* Leaves room above the heading when a selected panel is scrolled into view.
     Generous on purpose: at 2rem the heading sat flush against the top edge. */
  scroll-margin-top: clamp(2.5rem, 8vh, 5rem);
}

.panel:focus-visible {
  outline-offset: 8px;
}

.hint {
  margin-top: var(--space-xs);
  color: var(--ink-faint);
  font-size: var(--step--1);
  letter-spacing: 0.12em;
  text-align: center;
  text-transform: lowercase;
}

.hint-enter-active,
.hint-leave-active {
  transition: opacity var(--dur-med) var(--ease-enter);
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
}

.panel-head {
  margin-bottom: var(--space-l);
  text-align: center;
}

.panel-head h2 {
  font-size: var(--step-4);
  /* The accent is the only colour the page carries; the heading wears it. */
  color: var(--accent);
}

.tagline {
  margin-top: var(--space-xs);
  color: var(--ink-soft);
  font-size: var(--step-0);
}

.panel-note {
  max-width: var(--measure);
  margin: 0 auto var(--space-xl);
  color: var(--ink-soft);
  text-align: center;
}

.offerings,
.gallery {
  margin-top: var(--space-xl);
}

.about {
  padding-block: var(--space-2xl);
  border-top: 1px solid var(--paper-edge);
  text-align: center;
}

.about h2 {
  font-size: var(--step-2);
}

.about-text {
  max-width: var(--measure);
  margin: var(--space-m) auto 0;
  color: var(--ink-soft);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-m);
  padding-block: var(--space-xl);
  border-top: 1px solid var(--paper-edge);
  color: var(--ink-soft);
  font-size: var(--step--1);
}

.footer-name {
  font-family: var(--font-display);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-m);
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
