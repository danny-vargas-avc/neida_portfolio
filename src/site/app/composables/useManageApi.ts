/**
 * The portal's connection to Django.
 *
 * Same origin — nginx routes /api to Django and everything else to this app —
 * so the session cookie travels on its own and there is no token to store.
 *
 * The one sharp edge is CSRF. Django rotates the token when a session starts,
 * so the value read before signing in is dead immediately after, and reusing it
 * fails with a 403 that looks nothing like a login problem. Every request reads
 * the cookie fresh rather than caching it, which makes that impossible.
 */

export interface ApiError extends Error {
  status: number
  /** Field name -> messages, when Django rejected specific inputs. */
  fields?: Record<string, string[]>
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function fail(status: number, message: string, fields?: Record<string, string[]>): ApiError {
  const error = new Error(message) as ApiError
  error.status = status
  error.fields = fields
  return error
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData

  const res = await fetch(`/api/manage${path}`, {
    ...options,
    // Same-origin already sends cookies, but being explicit means this keeps
    // working if the API ever moves to its own hostname.
    credentials: 'same-origin',
    headers: {
      'X-CSRFToken': csrfToken(),
      // Let the browser set the multipart boundary; naming a type here breaks
      // the upload in a way that is very hard to see.
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (body.errors) {
      // Django hands back {field: [messages]}. Surface the first one as the
      // message so a caller that ignores `fields` still says something useful.
      const first = Object.values(body.errors)[0] as string[]
      throw fail(res.status, first?.[0] ?? 'That could not be saved.', body.errors)
    }
    // A 403 here is Django's CSRF page, which is HTML — so `body` is empty and
    // the message would otherwise be a shrug. Naming it saves the next person
    // from debugging a login that looks like a wrong password.
    if (res.status === 403) {
      throw fail(403, 'Your session expired. Reload the page and sign in again.')
    }
    if (res.status === 401) {
      throw fail(401, 'You are not signed in any more.')
    }
    throw fail(res.status, body.detail ?? `Something went wrong (${res.status}). Try again.`)
  }

  return body as T
}

export const manageApi = {
  session: () => request<{ signedIn: boolean, name?: string }>('/session/'),

  signIn: (username: string, password: string) =>
    request<{ signedIn: boolean, name?: string }>('/sign-in/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  signOut: () => request<unknown>('/sign-out/', { method: 'POST' }),

  content: () => request<ManageContent>('/content/'),

  saveSite: (data: Partial<ManageSite>) =>
    request<unknown>('/site/', { method: 'PATCH', body: JSON.stringify(data) }),

  saveLinks: (links: { label: string, url: string }[]) =>
    request<unknown>('/site/links/', { method: 'PUT', body: JSON.stringify({ links }) }),

  saveSection: (slug: string, data: Partial<ManageSection>) =>
    request<unknown>(`/sections/${slug}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  addPiece: (slug: string, form: FormData) =>
    request<{ piece: ManagePiece }>(`/sections/${slug}/pieces/`, { method: 'POST', body: form }),

  savePiece: (id: number, data: Partial<ManagePiece>) =>
    request<{ piece: ManagePiece }>(`/pieces/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePiece: (id: number) => request<unknown>(`/pieces/${id}/`, { method: 'DELETE' }),

  reorder: (slug: string, ids: number[]) =>
    request<unknown>(`/sections/${slug}/pieces/order/`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
}

export interface ManagePiece {
  id: number
  image: string
  thumbnail?: string
  title: string
  year?: number | null
  note?: string | null
  alt?: string
  orientation?: 'portrait' | 'landscape' | 'square'
}

export interface ManageSection {
  slug: string
  title: string
  tagline: string
  intro: string
  kind: string
  accent: string
  isPublished: boolean
  pieces: ManagePiece[]
  publicationCount: number
  offeringCount: number
}

export interface ManageSite {
  name: string
  role: string
  intro: string
  about: string
  email: string
  location: string
  links: { id?: number, label: string, url: string }[]
}

export interface ManageContent {
  site: ManageSite
  sections: ManageSection[]
}
