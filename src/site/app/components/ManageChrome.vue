<script setup lang="ts">
/**
 * The portal's frame: sticky header, the toast, and the page body.
 *
 * Every screen uses this so the header sits in exactly the same place as you
 * move between them — the thing that makes a set of web pages feel like one
 * app rather than a series of documents.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useManage } from '~/composables/useManage'
import { useManageTheme } from '~/composables/useManageTheme'

defineProps<{
  title: string
  /** Where the back arrow goes. Omitted on the home screen, which has none. */
  back?: string
  /** Tints this screen with its section's colour. */
  accent?: string
  /** Small line above the title, naming where you are. */
  eyebrow?: string
}>()

const { toast } = useManage()

// Every screen renders inside this, so opening a section link directly applies
// the stored choice too — not only arriving via the home screen.
const { choice, toggle } = useManageTheme()

// The icon shows what you would get, not what you have: on a dark screen the
// useful button is the one offering light. The label says so outright, because
// a sun on its own is ambiguous about which way it goes.
const themeLabel = computed(() =>
  choice.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
)

useHead({
  // Declared here rather than globally so only the portal is installable, and
  // so a visitor to the public site never downloads any of it.
  link: [
    { rel: 'manifest', href: '/manage.webmanifest' },
    { rel: 'apple-touch-icon', href: '/manage-icon-192.png' },
  ],
  meta: [
    // Opens without browser chrome once added to the home screen.
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'Portfolio' },
    { name: 'theme-color', content: '#f6f5f3' },
    // The portal is hers alone; keep it out of search results.
    { name: 'robots', content: 'noindex, nofollow' },
  ],
  // viewport-fit=cover is what makes env(safe-area-inset-*) report real values,
  // which is what keeps the header out from under the notch.
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
})

// The header gains its rule only once the page has moved, so a short screen
// never shows a line under a header with nothing above it.
const stuck = ref(false)
function onScroll() {
  stuck.value = window.scrollY > 4
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div class="mg" :style="accent ? { '--mg-accent': accent } : undefined">
    <header class="mg-header" :class="{ 'is-stuck': stuck }">
      <div class="mg-shell mg-header-row">
        <NuxtLink v-if="back" :to="back" class="mg-icon-btn" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </NuxtLink>
        <div class="mg-header-text">
          <p v-if="eyebrow" class="mg-eyebrow">{{ eyebrow }}</p>
          <h1 class="mg-title">{{ title }}</h1>
        </div>

        <div class="mg-header-actions">
          <slot name="action" />

          <button
            type="button"
            class="mg-round-btn"
            :aria-label="themeLabel"
            :title="themeLabel"
            @click="toggle"
          >
            <svg v-if="choice === 'dark'" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.4v2M12 19.6v2M2.4 12h2M19.6 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
            </svg>
            <svg v-else width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 14.2A8.2 8.2 0 019.8 4a8.4 8.4 0 108.4 10.2z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <main class="mg-shell mg-body">
      <slot />
    </main>

    <Transition name="mg-toast">
      <div
        v-if="toast"
        class="mg-toast"
        :class="{ 'is-bad': toast.bad }"
        role="status"
        aria-live="polite"
      >
        {{ toast.text }}
      </div>
    </Transition>
  </div>
</template>

<!--
  Not scoped, and pulled in here rather than from nuxt.config: every portal
  screen renders inside this component, so the stylesheet rides along in the
  route's own chunk and a visitor to the public site never downloads it.
-->
<style src="~/assets/css/manage.css"></style>
