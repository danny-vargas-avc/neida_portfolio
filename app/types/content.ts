export type SectionKind = 'gallery' | 'research' | 'writing' | 'teaching'

export interface Piece {
  image: string
  title: string
  year?: number
  note?: string
  alt?: string
  orientation?: 'portrait' | 'landscape' | 'square'
}

export interface Publication {
  title: string
  authors?: string
  venue?: string
  year?: number
  url?: string
  type?: 'article' | 'chapter' | 'talk' | 'poster' | 'thesis' | 'preprint'
}

export interface Offering {
  title: string
  blurb?: string
  audience?: string
}

/** One discipline: a leaf on the vine plus the panel it reveals. */
export interface Section {
  path: string
  title: string
  slug: string
  tagline: string
  kind: SectionKind
  accent: string
  order: number
  draft?: boolean
  pieces?: Piece[]
  publications?: Publication[]
  offerings?: Offering[]
  cv?: string
  /** Parsed Markdown body, rendered by <ContentRenderer>. */
  body?: unknown
}

export interface SiteInfo {
  name: string
  role: string
  intro: string
  about?: string
  email?: string
  location?: string
  links?: { label: string; url: string }[]
}
