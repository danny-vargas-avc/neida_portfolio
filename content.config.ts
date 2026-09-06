import { defineCollection, defineContentConfig, z } from '@nuxt/content'

/**
 * Content model.
 *
 * The whole site is one page. Each of Neida's disciplines is a "section": one
 * Markdown file, one carousel slide, one drawing, one gallery. Adding an eighth
 * discipline means adding a file — never a schema or a component change.
 *
 * The kind-specific lists (`pieces`, `publications`, `offerings`) are optional
 * rather than a Zod discriminated union: Nuxt Content v3 flattens the schema
 * into SQL columns, and a union produces an unstable column set.
 */

/** One photographed or scanned work: a bouquet, a bake, a drawing, a photo. */
const piece = z.object({
  /** Path under /public, e.g. "/media/florals/bouquet-14.jpg" */
  image: z.string(),
  title: z.string(),
  year: z.number().optional(),
  /** Short caption shown in the lightbox. */
  note: z.string().optional(),
  /** Describe the image for screen readers. Falls back to `title`. */
  alt: z.string().optional(),
  /** Portrait pieces get a taller grid cell. */
  orientation: z.enum(['portrait', 'landscape', 'square']).optional(),
})

/** A paper, talk, or poster for the research section. */
const publication = z.object({
  title: z.string(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  year: z.number().optional(),
  url: z.string().optional(),
  type: z.enum(['article', 'chapter', 'talk', 'poster', 'thesis', 'preprint']).optional(),
})

/** A class, workshop, or mentoring offer for the teaching section. */
const offering = z.object({
  title: z.string(),
  blurb: z.string().optional(),
  audience: z.string().optional(),
})

export default defineContentConfig({
  collections: {
    sections: defineCollection({
      type: 'page',
      source: 'sections/*.md',
      schema: z.object({
        /** Lowercase display name, e.g. "florals". Used on the slide + heading. */
        title: z.string(),
        /** Anchor id, e.g. "florals". Must be URL-safe and unique. */
        slug: z.string(),
        /** One line under the section heading. */
        tagline: z.string(),
        /** Which gallery template renders the body of this section. */
        kind: z.enum(['gallery', 'research', 'writing', 'teaching']),
        /** Hex accent. Themes the page while this section is selected. */
        accent: z.string(),
        /**
         * Order around the vine, clockwise from the top. Must line up with the
         * matching entry in app/components/vine-leaves.ts, which is what
         * actually positions the leaf.
         */
        order: z.number(),
        /** Hidden from the vine while true. */
        draft: z.boolean().optional(),

        // --- kind-specific ---
        pieces: z.array(piece).optional(),
        publications: z.array(publication).optional(),
        offerings: z.array(offering).optional(),
        /** Research section: path or URL to a CV. */
        cv: z.string().optional(),
      }),
    }),

    /** Site-wide identity: name, intro, contact. Edited in content/site.yml. */
    site: defineCollection({
      type: 'data',
      source: 'site.yml',
      schema: z.object({
        name: z.string(),
        role: z.string(),
        intro: z.string(),
        about: z.string().optional(),
        email: z.string().optional(),
        location: z.string().optional(),
        links: z
          .array(z.object({ label: z.string(), url: z.string() }))
          .optional(),
      }),
    }),
  },
})
