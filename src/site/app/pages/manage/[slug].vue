<script setup lang="ts">
/**
 * One section: its words, and its photographs.
 *
 * Uploads are optimistic — the picture appears in the grid the moment it is
 * chosen, from a local object URL, and is replaced by the server's copy when it
 * lands. On a phone connection a 3MB photograph takes a few seconds to travel
 * and resize, and staring at an unchanged grid for that long reads as a failure.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { manageApi, type ManagePiece } from '~/composables/useManageApi'
import { useFieldSaver, useManage } from '~/composables/useManage'
import { useSortablePhotos } from '~/composables/useSortablePhotos'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug))

const { signedIn, section, say, ready } = useManage()
const booting = ref(true)

const current = computed(() => section(slug.value))
const saver = useFieldSaver(say)

onMounted(async () => {
  const ok = await ready()
  booting.value = false
  if (!ok) router.replace('/manage')
  else if (!current.value) router.replace('/manage')
})

// --- words -----------------------------------------------------------------

async function saveField(field: 'title' | 'tagline' | 'intro', value: string) {
  const s = current.value
  if (!s) return
  const was = s[field]
  if (was === value) return
  s[field] = value
  const ok = await saver.save(field, was, value, () =>
    manageApi.saveSection(slug.value, { [field]: value }),
  )
  if (!ok) s[field] = was
}

async function togglePublished() {
  const s = current.value
  if (!s) return
  const next = !s.isPublished
  s.isPublished = next
  try {
    await manageApi.saveSection(slug.value, { isPublished: next })
    say(next ? 'Showing on the site' : 'Hidden from the site')
  } catch (err) {
    s.isPublished = !next
    say((err as Error).message, true)
  }
}

// --- photographs -----------------------------------------------------------

interface Pending { key: string, preview: string }
const pending = ref<Pending[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

async function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  // Cleared immediately so picking the same file twice in a row still fires.
  input.value = ''
  for (const file of files) await upload(file)
}

async function upload(file: File) {
  const s = current.value
  if (!s) return

  const key = `${file.name}-${Date.now()}-${Math.random()}`
  const preview = URL.createObjectURL(file)
  pending.value.push({ key, preview })

  const form = new FormData()
  form.append('image', file)
  // Filename minus extension is a better first guess than "Untitled", and she
  // can rename it in the sheet.
  form.append('title', file.name.replace(/\.[^.]+$/, ''))

  try {
    const { piece } = await manageApi.addPiece(slug.value, form)
    s.pieces.push(piece)
  } catch (err) {
    say((err as Error).message, true)
  } finally {
    pending.value = pending.value.filter((p) => p.key !== key)
    URL.revokeObjectURL(preview)
  }
}

// --- the editing sheet -----------------------------------------------------

const editing = ref<ManagePiece | null>(null)
const draft = ref<Partial<ManagePiece>>({})
// Declared before close(), which resets it.
const confirmingDelete = ref(false)

function open(piece: ManagePiece) {
  editing.value = piece
  draft.value = { title: piece.title, alt: piece.alt ?? '', orientation: piece.orientation, year: piece.year ?? null }
}

function close() {
  editing.value = null
  confirmingDelete.value = false
}

/*
  Escape closes the sheet, and the browser's back gesture is left alone.

  Worth having even on a phone: the portal is a normal web page on a laptop too,
  and a modal with no keyboard way out is a trap for anyone not using a mouse.
*/
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && editing.value) {
    event.stopPropagation()
    close()
  }
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))

const savingPiece = ref(false)

async function savePiece() {
  const piece = editing.value
  if (!piece) return
  savingPiece.value = true
  try {
    const { piece: fresh } = await manageApi.savePiece(piece.id, draft.value)
    Object.assign(piece, fresh)
    close()
    say('Saved')
  } catch (err) {
    say((err as Error).message, true)
  } finally {
    savingPiece.value = false
  }
}

async function removePiece() {
  const piece = editing.value
  const s = current.value
  if (!piece || !s) return
  try {
    await manageApi.deletePiece(piece.id)
    s.pieces = s.pieces.filter((p) => p.id !== piece.id)
    confirmingDelete.value = false
    close()
    say('Photo removed')
  } catch (err) {
    say((err as Error).message, true)
  }
}

// --- reordering ------------------------------------------------------------

/** Applies a move and saves it, rolling back if the server disagrees. */
async function movePiece(fromIndex: number, toIndex: number) {
  const s = current.value
  if (!s) return
  const before = s.pieces
  const next = [...s.pieces]
  next.splice(toIndex, 0, ...next.splice(fromIndex, 1))
  s.pieces = next
  try {
    await manageApi.reorder(slug.value, next.map((p) => p.id))
    say('Order saved')
  } catch (err) {
    s.pieces = before
    say((err as Error).message, true)
  }
}

const sort = useSortablePhotos(movePiece)

// Short labels: the segmented control has a third of the width each, and
// "Taller than wide" wraps to three lines at that size.
const shapes = [
  { value: 'portrait', label: 'Tall' },
  { value: 'landscape', label: 'Wide' },
  { value: 'square', label: 'Square' },
] as const

const isGallery = computed(() => current.value && !['research', 'teaching'].includes(current.value.kind))

useHead(() => ({ title: `${current.value?.title ?? 'Section'} — Manage` }))
</script>

<template>
  <div v-if="booting || !current" class="mg" />

  <ManageChrome v-else :title="current.title" eyebrow="Section" back="/manage" :accent="current.accent">
    <template #action>
      <span class="mg-status" :class="{ 'is-saved': Object.values(saver.states).includes('saved') }">
        <template v-if="Object.values(saver.states).includes('saving')">Saving</template>
        <template v-else-if="Object.values(saver.states).includes('saved')">Saved</template>
      </span>
    </template>

    <!-- words -->
    <section class="mg-card">
      <div class="mg-field">
        <label class="mg-label" for="f-title">Heading</label>
        <input
          id="f-title"
          class="mg-input"
          :class="{ 'is-bad': saver.errors.title }"
          :value="current.title"
          @change="saveField('title', ($event.target as HTMLInputElement).value)"
        >
        <p v-if="saver.errors.title" class="mg-error">{{ saver.errors.title }}</p>
      </div>

      <div class="mg-field">
        <label class="mg-label" for="f-tag">Tagline</label>
        <input
          id="f-tag"
          class="mg-input"
          :value="current.tagline"
          @change="saveField('tagline', ($event.target as HTMLInputElement).value)"
        >
        <p class="mg-help">One line under the heading.</p>
      </div>

      <div class="mg-field">
        <label class="mg-label" for="f-intro">Intro</label>
        <textarea
          id="f-intro"
          class="mg-textarea"
          :value="current.intro"
          @change="saveField('intro', ($event.target as HTMLTextAreaElement).value)"
        />
        <p class="mg-help">Leave blank and the page skips it entirely.</p>
      </div>

      <div class="mg-field">
        <button class="mg-btn mg-btn-quiet mg-btn-block" @click="togglePublished">
          {{ current.isPublished ? 'Hide this section while you work' : 'Show this section on the site' }}
        </button>
        <p class="mg-help">
          {{ current.isPublished ? 'Everyone can see this section.' : 'Only you can see this. The leaf does nothing until you show it.' }}
        </p>
      </div>
    </section>

    <!-- photographs -->
    <section v-if="isGallery" class="mg-card">
      <div class="mg-card-head">
        <h2 class="mg-card-title">Photos</h2>
        <span v-if="current.pieces.length > 1" class="mg-help">Hold one to reorder</span>
      </div>

      <div
        v-if="current.pieces.length || pending.length"
        class="mg-photos"
        :class="{ 'is-sorting': sort.from.value !== null }"
        @pointermove="sort.onPointerMove"
        @pointerup="sort.onPointerUp"
        @pointercancel="sort.onPointerUp"
        @click.capture="sort.onClickCapture"
      >
        <button
          v-for="(piece, i) in current.pieces"
          :key="piece.id"
          :data-index="i"
          class="mg-photo"
          :class="{
            'is-dragging': sort.from.value === i,
            'is-over': sort.over.value === i && sort.from.value !== null && sort.from.value !== i,
          }"
          :style="sort.from.value === i
            ? { transform: `translate(${sort.shift.x}px, ${sort.shift.y}px) scale(1.06)` }
            : undefined"
          @pointerdown="sort.onPointerDown($event, i)"
          @click="open(piece)"
        >
          <img :src="piece.thumbnail || piece.image" :alt="piece.alt || piece.title" draggable="false">
          <span v-if="current.pieces.length > 1" class="mg-photo-index">{{ i + 1 }}</span>
        </button>

        <div v-for="p in pending" :key="p.key" class="mg-photo">
          <img :src="p.preview" alt="" draggable="false">
          <span class="mg-photo-pending"><span class="mg-spin" /></span>
        </div>
      </div>

      <div v-else class="mg-empty">
        <strong>No photos yet</strong>
        <span>Add one from your camera roll.</span>
      </div>

      <div class="mg-field">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="chooseFiles"
        >
        <button class="mg-btn mg-btn-primary mg-btn-block" @click="fileInput?.click()">
          Add photos
        </button>
      </div>
    </section>

    <!-- the two sections the portal does not manage yet -->
    <section v-else class="mg-card">
      <div class="mg-empty">
        <strong>{{ current.kind === 'research' ? 'Publications' : 'Offerings' }}</strong>
        <span>
          These are edited in the older admin for now.
          <a href="/admin/portfolio/section/" style="color: var(--mg-accent)">Open it</a>
        </span>
      </div>
    </section>
  </ManageChrome>

  <!-- photo sheet -->
  <Teleport to="body">
    <Transition name="mg-scrim">
      <div v-if="editing" class="mg-scrim" @click="close" />
    </Transition>
    <Transition name="mg-sheet">
      <div v-if="editing" class="mg-sheet mg" :style="{ '--mg-accent': current?.accent }" role="dialog" aria-modal="true" aria-label="Edit photo">
        <div class="mg-sheet-grip" />
        <div class="mg-shell mg-body" style="padding-bottom: 16px;">
          <img
            :src="editing.image"
            :alt="editing.alt || editing.title"
            style="width:100%;max-height:36dvh;object-fit:contain;border-radius:14px;background:var(--mg-sunk)"
          >

          <div class="mg-card">
            <div class="mg-field">
              <label class="mg-label" for="p-title">Title</label>
              <input id="p-title" v-model="draft.title" class="mg-input">
              <p class="mg-help">Shown when the picture is opened.</p>
            </div>
            <div class="mg-field">
              <label class="mg-label" for="p-alt">Description for screen readers</label>
              <input id="p-alt" v-model="draft.alt" class="mg-input">
              <p class="mg-help">Describe it for someone who cannot see it.</p>
            </div>
            <div class="mg-field">
              <span class="mg-label" id="p-shape-label">Shape</span>
              <div class="mg-seg" role="group" aria-labelledby="p-shape-label">
                <button
                  v-for="opt in shapes"
                  :key="opt.value"
                  type="button"
                  :aria-pressed="draft.orientation === opt.value"
                  @click="draft.orientation = opt.value"
                >{{ opt.label }}</button>
              </div>
              <p class="mg-help">Sets the shape of its cell in the grid.</p>
            </div>
            <div class="mg-field">
              <label class="mg-label" for="p-year">Year</label>
              <input id="p-year" v-model.number="draft.year" class="mg-input" type="number" inputmode="numeric">
            </div>
          </div>

          <button class="mg-btn mg-btn-primary mg-btn-block" :disabled="savingPiece" @click="savePiece">
            <span v-if="savingPiece" class="mg-spin" />
            {{ savingPiece ? 'Saving' : 'Save' }}
          </button>
          <button class="mg-btn mg-btn-quiet mg-btn-block" @click="close">Cancel</button>

          <button v-if="!confirmingDelete" class="mg-btn mg-btn-danger mg-btn-block" @click="confirmingDelete = true">
            Remove this photo
          </button>
          <template v-else>
            <p class="mg-help" style="text-align:center">Remove it from the site? This cannot be undone.</p>
            <button class="mg-btn mg-btn-block" style="background: var(--mg-danger); color: #fff" @click="removePiece">
              Yes, remove it
            </button>
            <button class="mg-btn mg-btn-quiet mg-btn-block" @click="confirmingDelete = false">Keep it</button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
