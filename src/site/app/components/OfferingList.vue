<script setup lang="ts">
import type { Offering } from '~/types/content'

defineProps<{ offerings: Offering[] }>()
</script>

<template>
  <ul class="list">
    <li v-for="offering in offerings" :key="offering.title" class="card">
      <h3 class="title">{{ offering.title }}</h3>
      <p v-if="offering.blurb" class="blurb">{{ offering.blurb }}</p>
      <span v-if="offering.audience" class="audience">{{ offering.audience }}</span>
    </li>
  </ul>
</template>

<style scoped>
.list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--space-l);
  padding: 0;
  margin: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  padding-top: var(--space-m);
  border-top: 2px solid var(--accent);
}

.title {
  font-size: var(--step-1);
  font-weight: 400;
}

.blurb {
  color: var(--ink-soft);
  font-size: var(--step--1);
}

.audience {
  margin-top: auto;
  padding-top: var(--space-xs);
  color: var(--ink-faint);
  font-size: var(--step--2);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
