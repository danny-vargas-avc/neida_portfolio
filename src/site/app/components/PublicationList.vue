<script setup lang="ts">
/**
 * The research list.
 *
 * The most conservative component in the site on purpose: whoever reads this is
 * likely evaluating her academically, and legibility buys more credibility here
 * than any amount of motion would.
 */
import type { Publication } from '~/types/content'

defineProps<{ publications: Publication[]; cv?: string }>()

const TYPE_LABEL: Record<string, string> = {
  article: 'Article',
  chapter: 'Chapter',
  talk: 'Talk',
  poster: 'Poster',
  thesis: 'Thesis',
  preprint: 'Preprint',
}
</script>

<template>
  <div class="wrap">
    <ol class="list">
      <li v-for="pub in publications" :key="pub.title" class="entry">
        <div class="head">
          <h3 class="title">
            <a v-if="pub.url" :href="pub.url" rel="noopener">{{ pub.title }}</a>
            <template v-else>{{ pub.title }}</template>
          </h3>
          <span v-if="pub.type" class="kind">{{ TYPE_LABEL[pub.type] ?? pub.type }}</span>
        </div>
        <p class="meta">
          <span v-if="pub.authors">{{ pub.authors }}</span>
          <span v-if="pub.venue" class="venue">{{ pub.venue }}</span>
          <span v-if="pub.year">{{ pub.year }}</span>
        </p>
      </li>
    </ol>

    <a v-if="cv" :href="cv" class="cv" rel="noopener">Download CV</a>
  </div>
</template>

<style scoped>
.wrap {
  max-width: var(--measure);
}

.list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.entry {
  padding-block: var(--space-m);
  border-top: 1px solid var(--paper-edge);
}

.entry:last-child {
  border-bottom: 1px solid var(--paper-edge);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-m);
}

.title {
  font-size: var(--step-1);
  font-weight: 400;
  line-height: 1.25;
}

.title a {
  text-decoration: underline;
  text-decoration-color: var(--accent);
}

.kind {
  flex: none;
  padding: 0.15em 0.6em;
  border: 1px solid var(--paper-edge);
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: var(--step--2);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35em 0.9em;
  margin-top: var(--space-2xs);
  color: var(--ink-soft);
  font-size: var(--step--1);
}

.venue {
  font-style: italic;
}

.cv {
  display: inline-block;
  margin-top: var(--space-l);
  padding: 0.6em 1.4em;
  border: 1px solid var(--ink);
  border-radius: 999px;
  font-size: var(--step--1);
  text-decoration: none;
  transition: background var(--dur-fast) ease, color var(--dur-fast) ease;
}

.cv:hover {
  background: var(--ink);
  color: var(--paper);
}
</style>
