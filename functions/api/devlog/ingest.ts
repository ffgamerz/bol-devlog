// POST /api/devlog/ingest — bots write Dev log entries straight into the 'devlog' bucket (state.json, same shape the collector pushed
// and /api/devlog serves), so the page shows them with no UI change.
//   Authorization: Bearer <key>  where <key> is one of the Pages secret DEVLOG_INGEST_KEYS = "bot1:key1,bot2:key2". The bot name comes
//   from the key, never from the body.
//   {type:'task-start', name, usage?, repo?} -> {data:{id}} · {type:'step', id, msg, repo?} · {type:'task-end', id, usage?}
// state.json is read, changed and written back (Storage has no atomic update): two writes in the same instant can drop one entry.
import { corsHeaders, json, rateLimited, safeEqual } from '../../_lib/security'
import { redact } from '../devlog'

type Env = { SUPABASE_URL?: string; SUPABASE_SERVICE_KEY?: string; DEVLOG_INGEST_KEYS?: string }
type Snap = { updated?: string; received?: string; events?: Record<string, unknown>[]; repos?: Record<string, unknown>; tasks?: Record<string, unknown>[]; [k: string]: unknown }

const BUCKET = 'devlog', OBJ = 'state.json'
const MAX_BODY = 8_000, MAX_TEXT = 500, MAX_EVENTS = 400, MAX_TASKS = 200, PER_MIN = 60
const REPO_RE = /^[A-Za-z0-9._\/-]{1,80}$/
const ID_RE = /^t[0-9a-f]{6}$/

class Bad extends Error { constructor(msg: string, readonly status = 400) { super(msg) } }

/** "bot:key,bot:key" -> the bot whose key matches (every pair is compared, so timing does not reveal which one is close). */
function botForKey(secret: string | undefined, key: string): string | null {
  let found: string | null = null
  for (const pair of (secret ?? '').split(',')) {
    const i = pair.indexOf(':'), bot = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim()
    if (i < 1 || k.length < 32 || !/^[A-Za-z0-9_-]{1,40}$/.test(bot)) continue
    if (safeEqual(key, k) && found === null) found = bot
  }
  return found
}

const text = (v: unknown, field: string, required: boolean): string | null => {
  if (v == null || v === '') { if (required) throw new Bad(`${field} is required`); return null }
  if (typeof v !== 'string') throw new Bad(`${field} must be a string`)
  const s = v.trim()
  if (!s && required) throw new Bad(`${field} is required`)
  if (s.length > MAX_TEXT) throw new Bad(`${field} is too long (max ${MAX_TEXT} characters)`)
  return redact(s)
}
const usageOf = (v: unknown): number | null => {
  if (v == null) return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw new Bad('usage must be a number from 0 to 100')
  return Math.round(v * 10) / 10
}
const repoOf = (v: unknown): string | null => {
  if (v == null || v === '') return null
  if (typeof v !== 'string' || !REPO_RE.test(v)) throw new Bad('repo must be 1-80 characters: letters, digits, . _ / -')
  return v
}
const newId = (prefix: string) => prefix + [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('')

const hdr = (env: Env) => ({ apikey: env.SUPABASE_SERVICE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` })
async function read(env: Env): Promise<Snap | null> {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}?t=${Date.now()}`, { headers: { ...hdr(env), 'Cache-Control': 'no-cache' } })   // ?t= skips the CDN copy, which can lag a write by a minute
  return r.ok ? ((await r.json()) as Snap) : null
}
async function write(env: Env, snap: Snap): Promise<void> {
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${OBJ}`, { method: 'POST', headers: { ...hdr(env), 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' }, body: JSON.stringify(snap) })
  if (!r.ok) throw new Error(`Storage error (${r.status})`)
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const headers = corsHeaders(request, 'POST, OPTIONS')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.DEVLOG_INGEST_KEYS) return json({ error: 'Server not configured' }, 500, headers)

  const m = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)$/i)
  const bot = m ? botForKey(env.DEVLOG_INGEST_KEYS, m[1]) : null
  if (!bot) return json({ error: 'Unauthorized' }, 401, headers)
  if (rateLimited('ingest:' + bot, PER_MIN, 60_000)) return json({ error: 'Too many requests (max 60 per minute)' }, 429, headers)

  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY) throw new Bad('Body too large', 413)
    let b: Record<string, unknown>
    try { b = JSON.parse(raw) } catch { throw new Bad('Body must be JSON') }
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Bad('Body must be a JSON object')

    const now = new Date().toISOString()
    const snap: Snap = (await read(env)) ?? { events: [], repos: {}, tasks: [] }
    const tasks = Array.isArray(snap.tasks) ? snap.tasks : (snap.tasks = [])
    const events = Array.isArray(snap.events) ? snap.events : (snap.events = [])
    snap.repos ??= {}
    const own = (id: unknown) => {
      if (typeof id !== 'string' || !ID_RE.test(id)) throw new Bad('id must be a task id returned by task-start')
      const t = tasks.find((x) => x.id === id)
      if (!t) throw new Bad('Unknown task id')
      if (t.bot !== bot) throw new Bad('That task belongs to another bot', 403)
      return t
    }

    let out: Record<string, unknown> = { ok: true }
    if (b.type === 'task-start') {
      const id = newId('t')
      tasks.push({ id, name: text(b.name, 'name', true), repo: repoOf(b.repo), bot, status: 'running', start: now, end: null, startUsage: usageOf(b.usage), endUsage: null })
      out = { id }
    } else if (b.type === 'step') {
      const t = own(b.id)
      if (t.status !== 'running') throw new Bad('Task already ended')
      events.push({ id: newId('e'), at: now, repo: repoOf(b.repo) ?? t.repo ?? 'general', kind: 'step', title: text(b.msg, 'msg', true), detail: null, files: null, hash: null, url: null, task: t.id, bot })
    } else if (b.type === 'task-end') {
      const t = own(b.id)
      if (t.status !== 'running') throw new Bad('Task already ended')
      Object.assign(t, { status: 'done', end: now, endUsage: usageOf(b.usage) })
    } else throw new Bad("type must be 'task-start', 'step' or 'task-end'")

    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
    if (tasks.length > MAX_TASKS) tasks.splice(0, tasks.length - MAX_TASKS)
    snap.updated = snap.received = now   // the page treats a snapshot touched in the last 90 s as "live"
    await write(env, snap)
    return json({ data: out }, 200, headers)
  } catch (e) {
    if (e instanceof Bad) return json({ error: e.message }, e.status, headers)
    return json({ error: 'Could not save the entry' }, 502, headers)
  }
}
