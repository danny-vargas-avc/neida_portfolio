// https://nuxt.com/docs/api/configuration/nuxt-config
// Baked into the served HTML for link previews. See app.head below for why
// these are constants rather than read from the admin.
const SITE_NAME = 'Neida Rodriguez'
const SITE_TAGLINE = 'Florals, cake, drawings, textiles, clay, film, teaching and research.'
const SITE_ORIGIN = 'https://neidarodriguez.com'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  devtools: { enabled: true },

  modules: ['@nuxt/image', '@nuxt/fonts'],

  css: ['~/assets/css/tokens.css', '~/assets/css/base.css'],

  fonts: {
    // Self-hosted + preloaded, so the display face never causes a layout shift
    // in the lobby (which is the LCP element).
    families: [
      { name: 'Fraunces', provider: 'google', weights: [400, 500, 600], styles: ['normal', 'italic'] },
      { name: 'Karla', provider: 'google', weights: [400, 500, 700], styles: ['normal'] },
      // Portal only. The face is referenced from manage.css, which ships in the
      // /manage route chunk, so a visitor to the public site never fetches it.
      { name: 'Bricolage Grotesque', provider: 'google', weights: [500, 600, 700], styles: ['normal'] },
    ],
    defaults: { fallbacks: { serif: ['Iowan Old Style', 'Georgia'] } },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      // Written here, not with useHead on the page.
      //
      // The site renders in the browser, so useHead runs in the browser — and
      // the things that make a shared link look like anything (iMessage, Slack,
      // WhatsApp, search engines) read the HTML without running any script.
      // They were seeing a blank shell: no title, no description, no image, so
      // a shared link was a bare URL. These are in the file the server sends.
      //
      // The cost of that is they are fixed at build time. Changing the tagline
      // in the admin updates the page but not the preview until the next
      // deploy, which is the right trade for text that changes once a year.
      title: SITE_NAME,
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: SITE_TAGLINE },

        // The name is the headline and the tagline the subtitle: a link is
        // recognised by whose it is, and explained by what she does.
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
        { property: 'og:title', content: SITE_NAME },
        { property: 'og:description', content: SITE_TAGLINE },
        { property: 'og:url', content: SITE_ORIGIN + '/' },
        { property: 'og:image', content: SITE_ORIGIN + '/og.png' },
        // Stated so the card reserves the right shape before the image loads.
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'A drawn flower: three round petals on a stem with two leaves.' },

        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: SITE_NAME },
        { name: 'twitter:description', content: SITE_TAGLINE },
        { name: 'twitter:image', content: SITE_ORIGIN + '/og.png' },
      ],
      link: [
        // SVG for browsers that take it, PNG for the ones that do not, and the
        // touch icon for a link saved to a phone's home screen.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'canonical', href: SITE_ORIGIN + '/' },
      ],
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

  // Built to static files and served by nginx, with no Node process in
  // production — the same shape as the graze deployment. The vine's fade-in
  // covers the API request, so nothing is visibly waiting.
  ssr: false,

  runtimeConfig: {
    public: {
      // Empty means same-origin. In production nginx proxies /api/ to Django,
      // and in development the devProxy below does the same, so the app can use
      // relative URLs everywhere and CORS never enters into it.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
    },
  },

  image: {
    // Gallery rooms are photo-heavy. These widths back the `sizes` attrs in
    // GalleryGrid/Lightbox — keep the two in sync if the layout changes.
    screens: { xs: 320, sm: 640, md: 900, lg: 1280, xl: 1800 },
    format: ['avif', 'webp', 'jpeg'],
  },

  nitro: {
    // Django serves the API and the uploaded images. Proxying them in dev keeps
    // the front end on one origin, matching how nginx routes in production.
    devProxy: {
      '/api': { target: 'http://127.0.0.1:8000/api', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000/media', changeOrigin: true },
    },
  },

  typescript: {
    typeCheck: false, // run explicitly via `npm run typecheck`
  },
})
