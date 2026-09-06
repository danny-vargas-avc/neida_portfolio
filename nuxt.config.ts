// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  devtools: { enabled: true },

  modules: ['@nuxt/content', '@nuxt/image', '@nuxt/fonts'],

  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  fonts: {
    // Self-hosted + preloaded, so the display face never causes a layout shift
    // in the lobby (which is the LCP element).
    families: [
      { name: 'Fraunces', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic'] },
      { name: 'Karla', provider: 'google', weights: [400, 500, 700], styles: ['normal'] },
    ],
    defaults: { fallbacks: { serif: ['Iowan Old Style', 'Georgia'] } },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      script: [
        {
          // Marks that JS is available before first paint, so the vine can be
          // hidden ready for its reveal without flashing the finished drawing —
          // and stays visible for anyone without JS. See base.css .vine-sweep.
          innerHTML: "document.documentElement.classList.add('js')",
          tagPosition: 'head',
        },
      ],
    },
  },

  content: {
    build: {
      markdown: {
        // Her writing room is long-form; anchor links let her share a section.
        toc: { depth: 3 },
      },
    },
  },

  image: {
    // Gallery rooms are photo-heavy. These widths back the `sizes` attrs in
    // GalleryGrid/Lightbox — keep the two in sync if the layout changes.
    screens: { xs: 320, sm: 640, md: 900, lg: 1280, xl: 1800 },
    format: ['avif', 'webp', 'jpeg'],
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },

  typescript: {
    typeCheck: false, // run explicitly via `npm run typecheck`
  },
})
