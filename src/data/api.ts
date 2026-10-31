import { supabase } from './supabase'

/** Calls the existing Cloudflare Pages functions (/api/*) with the user's bearer token. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(path, { ...init, headers })
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const parsed = await res.json().then((b) => ({ ok: true as const, b }), () => ({ ok: false as const, b: {} }))
  const body = parsed.b
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error || `Request failed (${res.status})`), { status: res.status, body })
  // A 200 that isn't JSON is the SPA's index.html: /api isn't served here (local dev without VITE_API_PROXY).
  // Throw so pages show their error state instead of crashing on missing fields.
  if (!parsed.ok && res.status !== 204) throw Object.assign(new Error('The server did not return data. Local dev needs VITE_API_PROXY in .env.local.'), { status: res.status, body })
  return body as T
}
