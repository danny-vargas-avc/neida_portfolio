<script setup lang="ts">
/**
 * Her details: the top of the page, the about text, and the footer links.
 *
 * The links are edited as a small list and saved whole rather than row by row —
 * there are only ever a handful, and "add a row, fill it in, it saves itself"
 * is a lot of moving parts for something she changes twice a year.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { manageApi } from '~/composables/useManageApi'
import { useFieldSaver, useManage } from '~/composables/useManage'

definePageMeta({ layout: false })

const router = useRouter()
const { site, say, ready } = useManage()
const booting = ref(true)
const saver = useFieldSaver(say)

onMounted(async () => {
  const ok = await ready()
  booting.value = false
  if (!ok) router.replace('/manage')
})

type TextField = 'name' | 'role' | 'intro' | 'about' | 'email' | 'location'

async function saveField(field: TextField, value: string) {
  const s = site.value
  if (!s) return
  const was = s[field]
  if (was === value) return
  s[field] = value
  const ok = await saver.save(field, was, value, () => manageApi.saveSite({ [field]: value }))
  if (!ok) s[field] = was
}

// --- links -----------------------------------------------------------------

const links = ref<{ label: string, url: string }[]>([])
const linksDirty = ref(false)
const savingLinks = ref(false)

onMounted(() => {
  // Copied out of the store so a half-finished row is not shown on the home
  // screen before it is saved.
  links.value = (site.value?.links ?? []).map((l) => ({ label: l.label, url: l.url }))
})

function addLink() {
  links.value.push({ label: '', url: '' })
  linksDirty.value = true
}

function removeLink(i: number) {
  links.value.splice(i, 1)
  linksDirty.value = true
}

async function saveLinks() {
  savingLinks.value = true
  try {
    const cleaned = links.value.filter((l) => l.label.trim() || l.url.trim())
    await manageApi.saveLinks(cleaned)
    if (site.value) site.value.links = cleaned.map((l) => ({ ...l }))
    links.value = cleaned
    linksDirty.value = false
    say('Links saved')
  } catch (err) {
    say((err as Error).message, true)
  } finally {
    savingLinks.value = false
  }
}

const anySaving = computed(() => Object.values(saver.states).includes('saving'))
const anySaved = computed(() => Object.values(saver.states).includes('saved'))

useHead({ title: 'Your details — Manage' })
</script>

<template>
  <div v-if="booting || !site" class="mg" />

  <ManageChrome v-else title="Your details" eyebrow="Your site" back="/manage">
    <template #action>
      <span class="mg-status" :class="{ 'is-saved': anySaved }">
        <template v-if="anySaving">Saving</template>
        <template v-else-if="anySaved">Saved</template>
      </span>
    </template>

    <section class="mg-card">
      <div class="mg-field">
        <label class="mg-label" for="d-name">Name</label>
        <input
          id="d-name"
          class="mg-input"
          :class="{ 'is-bad': saver.errors.name }"
          :value="site.name"
          @change="saveField('name', ($event.target as HTMLInputElement).value)"
        >
        <p class="mg-help">Shown in large type at the top of the page.</p>
        <p v-if="saver.errors.name" class="mg-error">{{ saver.errors.name }}</p>
      </div>

      <div class="mg-field">
        <label class="mg-label" for="d-role">Role</label>
        <input
          id="d-role"
          class="mg-input"
          :value="site.role"
          @change="saveField('role', ($event.target as HTMLInputElement).value)"
        >
        <p class="mg-help">The small line under your name.</p>
      </div>

      <div class="mg-field">
        <label class="mg-label" for="d-intro">Intro</label>
        <textarea
          id="d-intro"
          class="mg-textarea"
          :value="site.intro"
          @change="saveField('intro', ($event.target as HTMLTextAreaElement).value)"
        />
        <p class="mg-help">A sentence or two under your name. Leave blank to hide it.</p>
      </div>
    </section>

    <section class="mg-card">
      <div class="mg-card-head"><h2 class="mg-card-title">About</h2></div>
      <div class="mg-field">
        <textarea
          class="mg-textarea"
          style="min-height: 170px"
          :value="site.about"
          aria-label="About"
          @change="saveField('about', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </section>

    <section class="mg-card">
      <div class="mg-card-head"><h2 class="mg-card-title">Contact</h2></div>
      <div class="mg-field">
        <label class="mg-label" for="d-email">Email</label>
        <input
          id="d-email"
          class="mg-input"
          :class="{ 'is-bad': saver.errors.email }"
          type="email"
          inputmode="email"
          autocapitalize="none"
          :value="site.email"
          @change="saveField('email', ($event.target as HTMLInputElement).value)"
        >
        <p class="mg-help">Add an address and it becomes a contact link in the footer.</p>
        <p v-if="saver.errors.email" class="mg-error">{{ saver.errors.email }}</p>
      </div>
      <div class="mg-field">
        <label class="mg-label" for="d-loc">Location</label>
        <input
          id="d-loc"
          class="mg-input"
          :value="site.location"
          @change="saveField('location', ($event.target as HTMLInputElement).value)"
        >
        <p class="mg-help">For example “Brooklyn, NY”. Leave blank to hide it.</p>
      </div>
    </section>

    <section class="mg-card">
      <div class="mg-card-head"><h2 class="mg-card-title">Links</h2></div>

      <div v-for="(link, i) in links" :key="i" class="mg-field">
        <div style="display:flex;gap:8px;align-items:center">
          <input
            v-model="link.label"
            class="mg-input"
            placeholder="Instagram"
            aria-label="Link name"
            style="flex:1"
            @input="linksDirty = true"
          >
          <button class="mg-icon-btn" style="margin-left:0;flex:none;color:var(--mg-danger)" :aria-label="`Remove ${link.label || 'link'}`" @click="removeLink(i)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <input
          v-model="link.url"
          class="mg-input"
          type="url"
          inputmode="url"
          autocapitalize="none"
          placeholder="https://instagram.com/…"
          aria-label="Link address"
          @input="linksDirty = true"
        >
      </div>

      <div v-if="!links.length" class="mg-empty">
        <strong>No links yet</strong>
        <span>Instagram, a shop, anywhere else you are.</span>
      </div>

      <div class="mg-field">
        <button class="mg-btn mg-btn-quiet mg-btn-block" @click="addLink">Add a link</button>
        <button
          v-if="linksDirty"
          class="mg-btn mg-btn-primary mg-btn-block"
          :disabled="savingLinks"
          @click="saveLinks"
        >
          <span v-if="savingLinks" class="mg-spin" />
          {{ savingLinks ? 'Saving' : 'Save links' }}
        </button>
      </div>
    </section>
  </ManageChrome>
</template>
