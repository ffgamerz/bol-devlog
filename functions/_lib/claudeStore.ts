// The Claude log lives in its own private Storage bucket ('devlog-claude', state.json), apart from the Dev log.
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Pct = { pct: number; resetsAt: string }
export type ClaudeSession = {
  id: string; project: string; title?: string | null; model?: string | null; status: 'running' | 'ended'
  start: string; last: string; end?: string | null; turns: number; tokens: Tokens
  /** Percent of the 5-hour and weekly limits credited to this session (account-wide percent that rose while it reported). */
  five: number; week: number
}
export type ClaudeSample = { at: string; five: number; week: number }
export type ClaudeState = {
  updated?: string; sessions: ClaudeSession[]; samples: ClaudeSample[]
  last?: { five: Pct; week: Pct } | null
}
type Env = { SUPABASE_URL?: string; SUPABASE_SERVICE_KEY?: string }
const BUCKET = 'devlog-claude', OBJ = 'state.json'
const hdr = (env: Env) => ({ apikey: env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` })

/** ?t= skips the CDN copy, which can lag a write by a minute. */
export async function readClaude(env: Env): Promise<ClaudeState | null> {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}?t=${Date.now()}`, { headers: { ...hdr(env), 'Cache-Control': 'no-cache' } })
  return r.ok ? ((await r.json()) as ClaudeState) : null
}
export async function writeClaude(env: Env, state: ClaudeState): Promise<void> {
  const go = () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}`, { method: 'POST', headers: { ...hdr(env), 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' }, body: JSON.stringify(state) })
  let r = await go()
  if (!r.ok && /bucket not found|not_found/i.test(await r.clone().text())) {
    await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, { method: 'POST', headers: { ...hdr(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, allowed_mime_types: ['application/json'] }) })
    r = await go()
  }
  if (!r.ok) throw new Error(`Storage error (${r.status})`)
}
