<script setup lang="ts">
/**
 * The portal's home screen, and the sign-in screen when there is no session.
 *
 * One route for both: signing in should not feel like arriving somewhere else,
 * and this way the app opens to whichever is true without a redirect flashing
 * past on the way.
 */
import { onMounted, ref } from 'vue'
import { useManage } from '~/composables/useManage'

definePageMeta({ layout: false })

const { signedIn, sections, site, say, ready, signIn, signOut } = useManage()

const booting = ref(true)
const username = ref('')
const password = ref('')
const busy = ref(false)
const problem = ref('')

onMounted(async () => {
  try {
    await ready()
  } catch {
    problem.value = 'Could not reach the site. Check your connection and try again.'
  } finally {
    booting.value = false
  }
})

async function submit() {
  problem.value = ''
  busy.value = true
  try {
    await signIn(username.value, password.value)
    password.value = ''
  } catch (err) {
    problem.value = (err as Error).message
  } finally {
    busy.value = false
  }
}

async function leave() {
  await signOut()
  say('Signed out')
}

/** "3 photos" reads better than a bare number, and "No photos yet" better still. */
function summarise(count: number, noun: string) {
  if (count === 0) return `No ${noun}s yet`
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

useHead({ title: 'Manage — Neida Rodriguez' })
</script>

<template>
  <!-- Nothing until the session is known: showing the sign-in form and then
       replacing it half a second later is worse than a brief blank. -->
  <div v-if="booting" class="mg" />

  <ManageChrome v-else-if="!signedIn" title="Sign in">
    <form class="mg-card" @submit.prevent="submit">
      <div class="mg-field">
        <label class="mg-label" for="u">Username</label>
        <input
          id="u"
          v-model="username"
          class="mg-input"
          autocomplete="username"
          autocapitalize="none"
          autocorrect="off"
          required
        >
      </div>
      <div class="mg-field">
        <label class="mg-label" for="p">Password</label>
        <input
          id="p"
          v-model="password"
          class="mg-input"
          type="password"
          autocomplete="current-password"
          required
        >
      </div>
      <div class="mg-field">
        <p v-if="problem" class="mg-error">{{ problem }}</p>
        <button class="mg-btn mg-btn-primary mg-btn-block" :disabled="busy">
          <span v-if="busy" class="mg-spin" />
          {{ busy ? 'Signing in' : 'Sign in' }}
        </button>
      </div>
    </form>
  </ManageChrome>

  <ManageChrome v-else :title="site?.name || 'Your site'">
    <template #action>
      <a href="/" class="mg-round-btn" aria-label="View the site" title="View the site">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 4h6v6M20 4l-8.5 8.5" />
          <path d="M18 14.5V19a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 19V8a1.5 1.5 0 011.5-1.5H10" />
        </svg>
      </a>
    </template>

    <section class="mg-group">
      <h2 class="mg-card-title">Your site</h2>
      <div class="mg-card">
        <NuxtLink to="/manage/details" class="mg-row">
          <span class="mg-thumb">
            <span class="mg-thumb-tint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--mg-accent)">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </span>
          </span>
          <span class="mg-row-main">
            <span class="mg-row-label">Your details</span>
            <span class="mg-row-sub">Name, intro, about, contact and links</span>
          </span>
          <svg class="mg-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </NuxtLink>
      </div>
    </section>

    <section class="mg-group">
      <h2 class="mg-card-title">Sections</h2>
      <div class="mg-card">
        <NuxtLink
          v-for="s in sections"
          :key="s.slug"
          :to="`/manage/${s.slug}`"
          class="mg-row"
          :style="{ '--mg-row-accent': s.accent }"
        >
          <!-- Her own photograph where there is one: it makes the list hers
               rather than a menu, and tells her at a glance what is in each. -->
          <span class="mg-thumb">
            <img v-if="s.pieces.length" :src="s.pieces[0].thumbnail || s.pieces[0].image" alt="">
            <span v-else class="mg-thumb-tint"><span class="mg-thumb-dot" /></span>
          </span>
          <span class="mg-row-main">
            <span class="mg-row-label">{{ s.title }}</span>
            <span class="mg-row-sub">
              <template v-if="s.kind === 'research'">{{ summarise(s.publicationCount, 'publication') }}</template>
              <template v-else-if="s.kind === 'teaching'">{{ summarise(s.offeringCount, 'offering') }}</template>
              <template v-else>{{ summarise(s.pieces.length, 'photo') }}</template>
            </span>
          </span>
          <span v-if="!s.isPublished" class="mg-badge">Hidden</span>
          <svg class="mg-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </NuxtLink>
      </div>
    </section>

    <button class="mg-btn mg-btn-danger mg-btn-block" @click="leave">Sign out</button>
  </ManageChrome>
</template>
