/**
 * Shared state for the portal.
 *
 * Everything she can edit arrives in one request and is held here, so moving
 * between the home screen and a section is instant and does not re-fetch. Edits
 * are written back to this store as they save, which keeps the two views in
 * agreement without either of them reloading.
 */

import { computed } from 'vue'
import { manageApi, type ManageContent, type ManageSection } from './useManageApi'

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export function useManage() {
  // useState rather than a module-level ref: Nuxt scopes it per app instance,
  // which keeps it from leaking between requests if this ever renders on a
  // server.
  const content = useState<ManageContent | null>('manage-content', () => null)
  const signedIn = useState<boolean | null>('manage-signed-in', () => null)
  const loading = useState('manage-loading', () => false)
  const toast = useState<{ text: string, bad?: boolean } | null>('manage-toast', () => null)

  let toastTimer: ReturnType<typeof setTimeout> | undefined

  function say(text: string, bad = false) {
    clearTimeout(toastTimer)
    toast.value = { text, bad }
    toastTimer = setTimeout(() => (toast.value = null), bad ? 4200 : 2200)
  }

  async function check() {
    const { signedIn: yes } = await manageApi.session()
    signedIn.value = yes
    return yes
  }

  async function load() {
    loading.value = true
    try {
      content.value = await manageApi.content()
    } finally {
      loading.value = false
    }
  }

  /** Signs in, then loads. Both, because one without the other is never useful. */
  async function signIn(username: string, password: string) {
    await manageApi.signIn(username, password)
    signedIn.value = true
    await load()
  }

  async function signOut() {
    await manageApi.signOut()
    signedIn.value = false
    content.value = null
  }

  /**
   * Makes sure there is a session and content before a page renders.
   * Returns false when the caller should show the sign-in screen instead.
   */
  async function ready() {
    if (signedIn.value === null) await check()
    if (!signedIn.value) return false
    if (!content.value) await load()
    return true
  }

  const sections = computed(() => content.value?.sections ?? [])
  const site = computed(() => content.value?.site ?? null)

  function section(slug: string): ManageSection | undefined {
    return sections.value.find((s) => s.slug === slug)
  }

  return { content, signedIn, loading, toast, say, check, load, signIn, signOut, ready, sections, site, section }
}

/**
 * Saves one field when it loses focus, and reports how that went.
 *
 * On blur rather than on every keystroke: a request per character is wasteful
 * and makes the indicator flicker, and blur is the moment she has actually
 * finished with a field. Nothing is saved when the value has not changed, so
 * tabbing through a form is silent.
 */
export function useFieldSaver(say: (text: string, bad?: boolean) => void) {
  const states = reactive<Record<string, SaveState>>({})
  const errors = reactive<Record<string, string>>({})
  const timers: Record<string, ReturnType<typeof setTimeout>> = {}

  async function save(key: string, was: unknown, now: unknown, write: () => Promise<unknown>) {
    if (was === now) return true
    clearTimeout(timers[key])
    states[key] = 'saving'
    delete errors[key]
    try {
      await write()
      states[key] = 'saved'
      // Clears itself, so the form does not accumulate a column of ticks.
      timers[key] = setTimeout(() => (states[key] = 'idle'), 1800)
      return true
    } catch (err) {
      const e = err as { message?: string, fields?: Record<string, string[]> }
      states[key] = 'failed'
      errors[key] = e.fields ? Object.values(e.fields)[0][0] : (e.message ?? 'Could not save.')
      say(errors[key], true)
      return false
    }
  }

  return { states, errors, save }
}
