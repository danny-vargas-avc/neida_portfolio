<script setup lang="ts">
/**
 * The work grid.
 *
 * Deliberately caption-free: following the reference site, the grid is pure
 * image and the details live in the lightbox. A masonry column layout lets
 * portrait and landscape pieces sit together without cropping either.
 */
import { ref } from 'vue'
import type { Piece } from '~/types/content'

defineProps<{ pieces: Piece[] }>()

const openIndex = ref<number | null>(null)
</script>

<template>
  <div>
    <ul class="grid">
      <li v-for="(piece, i) in pieces" :key="piece.image" class="cell">
        <button type="button" class="tile" @click="openIndex = i">
          <!--
            A plain img, deliberately. <NuxtImg> rewrites the src to /_ipx/…,
            which needs an image server running behind the site; this deploys as
            a static build served by nginx, so that URL matched nginx's SPA
            fallback and every photograph arrived as a copy of index.html. The
            resizing it would have done now happens in Django on upload, which
            is the only place in this setup that can do it.
          -->
          <img
            :src="piece.thumbnail || piece.image"
            :alt="piece.alt || piece.title"
            loading="lazy"
            decoding="async"
          >
          <span class="sr-only">View {{ piece.title }} larger</span>
        </button>
      </li>
    </ul>

    <PieceLightbox
      :pieces="pieces"
      :index="openIndex"
      @close="openIndex = null"
      @update:index="openIndex = $event"
    />
  </div>
</template>

<style scoped>
.grid {
  columns: 1;
  column-gap: var(--space-l);
  padding: 0;
  margin: 0;
  list-style: none;
}

@media (min-width: 640px) {
  .grid { columns: 2; }
}

@media (min-width: 1024px) {
  .grid { columns: 3; }
}

.cell {
  break-inside: avoid;
  margin-bottom: var(--space-l);
}

.tile {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  overflow: hidden;
  border-radius: var(--radius-s);
}

.tile img {
  width: 100%;
  height: auto;
  transition: transform var(--dur-slow) var(--ease-enter);
}

.tile:hover img {
  transform: scale(1.03);
}
</style>
