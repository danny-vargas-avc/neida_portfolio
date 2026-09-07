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
          // Two flags, both before first paint:
          //   js         — JS is available, so the vine may be hidden ready for
          //                its entrance. Without it the drawing is simply shown.
          //   vine-ready — the page has loaded and painted, which is when the
          //                entrance may start. A CSS animation otherwise begins
          //                the moment the element is styled and runs on
          //                wall-clock time, so most of it elapsed during load:
          //                the vine was already 40% faded in by DOMContentLoaded
          //                and visually complete before anyone saw it.
          // Deliberately not tied to hydration, which can be seconds away in
          // dev while the server-rendered drawing is already on screen.
          innerHTML:
            "document.documentElement.classList.add('js');" +
            "addEventListener('load',function(){requestAnimationFrame(function(){" +
            "document.documentElement.classList.add('vine-ready')})})",
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
