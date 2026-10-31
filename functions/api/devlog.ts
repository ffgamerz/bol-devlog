// /api/devlog — "Dev log" page data. The box collector (/workspace/tools/devlog/collector.py, no AI) pushes one
// JSON snapshot; it is stored as state.json in the private Supabase Storage bucket 'devlog' (no DB schema change).
//   Collector (X-Worker-Key = Pages secret SRT_WORKER_KEY): POST <DevlogSnapshot> · GET (read-back health check)
//   Admin (Supabase login with profiles.is_admin): GET -> { data: DevlogSnapshot | null }
import { authenticate, corsHeaders, json, rateLimited, callerKey, safeEqual, type AuthEnv } from '../_lib/security'

type Env = AuthEnv & { SRT_WORKER_KEY?: string }
const BUCKET = 'devlog'
const OBJ = 'state.json'
const MAX_BYTES = 400_000

/** Last-line defence: the collector already redacts, but never store anything that looks like a secret. */
const SECRET_RES: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{16,}/g,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g, /\bAIza[0-9A-Za-z_-]{30,}/g, /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /([?&](?:key|token|access_token|apikey|api_key|secret|sig|signature|password)=)[^&\s"']+/gi,
  /((?:password|passwd|secret|token|api[_-]?key|service[_-]?key)\s*[:=]\s*)["']?[^\s"',}]+/gi,
  /\b[A-Fa-f0-9]{40,}\b/g, /\b[A-Za-z0-9+_-]{48,}={0,2}/g,
]
export function redact(s: string): string {
  let out = s
  for (const re of SECRET_RES) out = out.replace(re, (m, p1) => (typeof p1 === 'string' && m.startsWith(p1) ? p1 : '') + '[redacted]')
  return out
}
export function redactDeep(v: unknown, depth = 0): unknown {
  if (depth > 6) return null
  if (typeof v === 'string') return redact(v).slice(0, 2000)
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => redactDeep(x, depth + 1))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 200).map(([k, x]) => [k.slice(0, 80), redactDeep(x, depth + 1)]))
  return typeof v === 'number' || typeof v === 'boolean' || v === null ? v : null
}

const auth = (env: Env) => ({ apikey: env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` })
async function put(env: Env, body: string): Promise<void> {
  const go = () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}`, { method: 'POST', headers: { ...auth(env), 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' }, body })
  let r = await go()
  if (!r.ok && /bucket not found|not_found/i.test(await r.clone().text())) {
    await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, { method: 'POST', headers: { ...auth(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: MAX_BYTES + 10_000, allowed_mime_types: ['application/json'] }) })
    r = await go()
  }
  if (!r.ok) throw new Error(`Storage error (${r.status})`)
}

async function read(env: Env): Promise<unknown> {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}`, { headers: { ...auth(env), 'Cache-Control': 'no-cache' } })
  return r.ok ? r.json() : null
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const headers = corsHeaders(request, 'GET, POST, OPTIONS')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return json({ error: 'Server not configured' }, 500, headers)
  const wk = request.headers.get('X-Worker-Key') ?? ''
  const isWorker = !!wk && !!env.SRT_WORKER_KEY && env.SRT_WORKER_KEY.length >= 32 && safeEqual(wk, env.SRT_WORKER_KEY)
  try {
    if (isWorker) {
      if (request.method === 'GET') return json({ data: await read(env) }, 200, headers)
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)
      const raw = await request.text()
      if (raw.length > MAX_BYTES) return json({ error: 'Too large' }, 413, headers)
      const snap = redactDeep(JSON.parse(raw)) as Record<string, unknown>
      snap.received = new Date().toISOString()
      await put(env, JSON.stringify(snap))
      return json({ data: { ok: true } }, 200, headers)
    }
    const caller = await authenticate(request, env)
    if (!caller || caller.kind !== 'admin') return json({ error: 'Unauthorized' }, 401, headers)
    if (rateLimited('devlog:' + callerKey(caller, request), 90, 60_000)) return json({ error: 'Too many requests' }, 429, headers)
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, headers)
    return json({ data: await read(env) }, 200, headers)
  } catch (e) { return json({ error: (e as Error).message }, 502, headers) }
}
