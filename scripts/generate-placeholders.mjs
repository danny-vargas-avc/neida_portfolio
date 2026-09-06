/**
 * Generates placeholder artwork for the galleries.
 *
 * These stand in until Neida's real photographs and scans arrive. They are
 * abstract risograph-style prints in each section's accent colour, so the grid
 * reads as a real gallery instead of a wall of grey boxes.
 *
 * Run:  node scripts/generate-placeholders.mjs
 * Output: public/media/<section>/placeholder-N.svg
 *
 * DELETE THIS SCRIPT (and public/media/*) once real assets land — nothing in
 * the app imports it.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// One per leaf on the vine that shows a picture gallery. `research` is a
// publication list, so it needs no imagery.
const SECTIONS = [
  { slug: 'clay', accent: '#b5674a' },
  { slug: 'florals', accent: '#b8607f' },
  { slug: 'film', accent: '#4a6b8c' },
  { slug: 'education', accent: '#4a7a5c' },
  { slug: 'cake', accent: '#98763f' },
  { slug: 'drawings', accent: '#6a5d8f' },
  { slug: 'textiles', accent: '#6f7a4b' },
]

const SHAPES = ['orb', 'arcs', 'blob', 'stripes', 'horizon', 'petals']

const RATIOS = {
  portrait: [900, 1200],
  landscape: [1200, 900],
  square: [1000, 1000],
}

/** Deterministic PRNG so re-running produces identical files. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Mix a hex colour toward white/black by amount t (-1 dark .. 1 light). */
function shade(hex, t) {
  const n = parseInt(hex.slice(1), 16)
  const target = t > 0 ? 255 : 0
  const a = Math.abs(t)
  const ch = (shift) => {
    const c = (n >> shift) & 0xff
    return Math.round(c + (target - c) * a)
  }
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`
}

function shape(kind, w, h, accent, rand) {
  const cx = w / 2
  const cy = h / 2
  const light = shade(accent, 0.55)
  const deep = shade(accent, -0.25)

  switch (kind) {
    case 'orb': {
      const r = Math.min(w, h) * (0.26 + rand() * 0.1)
      const ox = (rand() - 0.5) * w * 0.18
      return `
    <circle cx="${cx + ox}" cy="${cy}" r="${r * 1.35}" fill="${light}" opacity="0.5"/>
    <circle cx="${cx + ox * 0.4}" cy="${cy - r * 0.2}" r="${r}" fill="${accent}" opacity="0.85"/>
    <circle cx="${cx + ox * 0.4 - r * 0.3}" cy="${cy - r * 0.5}" r="${r * 0.28}" fill="${shade(accent, 0.7)}" opacity="0.7"/>`
    }
    case 'arcs': {
      let out = ''
      const rings = 4 + Math.floor(rand() * 3)
      for (let i = rings; i > 0; i--) {
        const r = (Math.min(w, h) * 0.42 * i) / rings
        out += `
    <circle cx="${cx}" cy="${h * 0.62}" r="${r}" fill="none" stroke="${i % 2 ? accent : deep}" stroke-width="${Math.min(w, h) * 0.035}" opacity="${0.25 + (i / rings) * 0.5}"/>`
      }
      return out
    }
    case 'blob': {
      const r = Math.min(w, h) * 0.3
      const pts = 7
      // Sample the ring, then join the points through their midpoints with
      // quadratic curves. Straight segments produced a hard polygon that read
      // as a rendering fault rather than a shape.
      const ring = Array.from({ length: pts }, (_, i) => {
        const a = (i / pts) * Math.PI * 2
        const rr = r * (0.72 + rand() * 0.5)
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.05]
      })
      const mid = (p, q) => [(p[0] + q[0]) / 2, (q[1] + p[1]) / 2]
      const start = mid(ring[pts - 1], ring[0])
      let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`
      for (let i = 0; i < pts; i++) {
        const cur = ring[i]
        const end = mid(cur, ring[(i + 1) % pts])
        d += `Q${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`
      }
      return `
    <path d="${d}Z" fill="${light}" opacity="0.55" transform="rotate(${(rand() * 30 - 15).toFixed(1)} ${cx} ${cy}) translate(${(w * 0.04).toFixed(0)} ${(h * 0.03).toFixed(0)})"/>
    <path d="${d}Z" fill="${accent}" opacity="0.8"/>`
    }
    case 'stripes': {
      let out = ''
      const n = 5 + Math.floor(rand() * 4)
      const gap = (h * 0.6) / n
      for (let i = 0; i < n; i++) {
        const y = h * 0.22 + i * gap
        const inset = w * (0.12 + rand() * 0.16)
        out += `
    <rect x="${inset.toFixed(0)}" y="${y.toFixed(0)}" width="${(w - inset * 2).toFixed(0)}" height="${(gap * 0.42).toFixed(0)}" rx="${(gap * 0.21).toFixed(0)}" fill="${i % 2 ? accent : light}" opacity="${(0.45 + (i / n) * 0.45).toFixed(2)}"/>`
      }
      return out
    }
    case 'horizon': {
      const y = h * (0.5 + rand() * 0.14)
      return `
    <circle cx="${cx}" cy="${y - h * 0.1}" r="${Math.min(w, h) * 0.22}" fill="${accent}" opacity="0.9"/>
    <path d="M0 ${y} Q ${w * 0.3} ${y - h * 0.08} ${w * 0.55} ${y} T ${w} ${y - h * 0.03} L${w} ${h} L0 ${h}Z" fill="${light}" opacity="0.75"/>
    <path d="M0 ${y + h * 0.12} Q ${w * 0.4} ${y + h * 0.04} ${w} ${y + h * 0.14} L${w} ${h} L0 ${h}Z" fill="${deep}" opacity="0.55"/>`
    }
    case 'petals':
    default: {
      let out = ''
      const n = 5 + Math.floor(rand() * 3)
      const r = Math.min(w, h) * 0.3
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.2
        out += `
    <ellipse cx="${(cx + Math.cos(a) * r * 0.5).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.5).toFixed(1)}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.34).toFixed(1)}" fill="${i % 2 ? accent : light}" opacity="0.62" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${(cx + Math.cos(a) * r * 0.5).toFixed(1)} ${(cy + Math.sin(a) * r * 0.5).toFixed(1)})"/>`
      }
      out += `
    <circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="${deep}" opacity="0.85"/>`
      return out
    }
  }
}

function svg({ w, h, accent, kind, seed }) {
  const rand = rng(seed)
  const paper = '#f4f3f0'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
  <defs>
    <clipPath id="c"><rect width="${w}" height="${h}" rx="0"/></clipPath>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
    </filter>
  </defs>
  <g clip-path="url(#c)">
    <rect width="${w}" height="${h}" fill="${paper}"/>${shape(kind, w, h, accent, rand)}
    <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.85"/>
  </g>
</svg>
`
}

const PER_SECTION = 6
let count = 0

for (const [s, { slug, accent }] of SECTIONS.entries()) {
  const dir = resolve(root, 'public/media', slug)
  await mkdir(dir, { recursive: true })

  for (let i = 0; i < PER_SECTION; i++) {
    const seed = [...`${slug}${i}`].reduce((a, c) => a + c.charCodeAt(0) * 31, 7)
    const rand = rng(seed)
    const ratio = i % 3 === 0 ? 'portrait' : i % 3 === 1 ? 'landscape' : 'square'
    const [w, h] = RATIOS[ratio]
    // Walk the shape list instead of picking randomly: random selection kept
    // landing on the same motif and the grid read as one image repeated. The
    // per-section offset stops every section opening with the same shape.
    const kind = SHAPES[(i + s) % SHAPES.length]
    await writeFile(
      resolve(dir, `placeholder-${i + 1}.svg`),
      svg({ w, h, accent, kind, seed }),
      'utf8',
    )
    count++
  }
}

console.log(`Generated ${count} placeholder images across ${SECTIONS.length} sections.`)
