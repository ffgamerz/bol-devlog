// POST /api/claude/ingest — the Claude Code hook on Azman's Mac reports one session's totals plus the account's 5-hour / weekly percent.
//   Authorization: Bearer <CLAUDE_INGEST_KEY> (Pages secret, 32+ chars)
//   {session:{id, project, status:'running'|'ended', turns, tokens:{input,output,cacheRead,cacheWrite}, model?, title?}, usage:{five:{pct,resetsAt}, week:{pct,resetsAt}}}
// Idempotent: a session is upserted by id (tokens are totals, not increments). The account-wide percent that rose since the previous report is
// credited to the session that reports it, and the first report credits nothing, and a new window (changed resetsAt) counts from 0. Concurrent sessions are therefore approximate.
import { corsHeaders, json, rateLimited, safeEqual } from '../../_lib/security'
import { redact } from '../devlog'
import { readClaude, writeClaude, type ClaudeSession, type ClaudeState, type Pct, type Tokens } from '../../_lib/claudeStore'

type Env = { SUPABASE_URL?: string; SUPABASE_SERVICE_KEY?: string; CLAUDE_INGEST_KEY?: string }
const MAX_BODY = 4_000, MAX_SESSIONS = 300, MAX_SAMPLES = 2000, SAMPLE_EVERY_MS = 60_000
class Bad extends Error { constructor(msg: string, readonly status = 400) { super(msg) } }

const num = (v: unknown, field: string, max: number) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new Bad(`${field} must be a number from 0 to ${max}`)
  return v
}
const pctOf = (v: unknown, field: string): Pct => {
  const o = v as { pct?: unknown; resetsAt?: unknown } | null
  if (!o || typeof o !== 'object') throw new Bad(`${field} is required`)
  const resetsAt = typeof o.resetsAt === 'string' && !Number.isNaN(Date.parse(o.resetsAt)) ? new Date(o.resetsAt).toISOString() : null
  if (!resetsAt) throw new Bad(`${field}.resetsAt must be an ISO time`)
  return { pct: Math.round(num(o.pct, `${field}.pct`, 100) * 10) / 10, resetsAt }
}
/** Percent gained since the last report: 0 on the very first one (nothing to compare with), the whole value in a new window, else the rise. */
const gain = (now: Pct, prev: Pct | undefined) => !prev ? 0 : Math.abs(Date.parse(now.resetsAt) - Date.parse(prev.resetsAt)) > 60_000 ? now.pct : Math.max(0, now.pct - prev.pct)

export const onRequest = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const headers = corsHeaders(request, 'POST, OPTIONS')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.CLAUDE_INGEST_KEY || env.CLAUDE_INGEST_KEY.length < 32) return json({ error: 'Server not configured' }, 500, headers)
  const m = (request.headers.get('Authorization') ?? '').match(/^Bearer\s+(\S+)$/i)
  if (!m || !safeEqual(m[1], env.CLAUDE_INGEST_KEY)) return json({ error: 'Unauthorized' }, 401, headers)
  if (rateLimited('claude-ingest', 120, 60_000)) return json({ error: 'Too many requests' }, 429, headers)

  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY) throw new Bad('Body too large', 413)
    let b: { session?: Record<string, unknown>; usage?: Record<string, unknown> }
    try { b = JSON.parse(raw) } catch { throw new Bad('Body must be JSON') }
    const s = b?.session
    if (!s || typeof s !== 'object') throw new Bad('session is required')
    if (typeof s.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(s.id)) throw new Bad('session.id looks wrong')
    if (typeof s.project !== 'string' || !s.project.trim() || s.project.length > 120) throw new Bad('session.project is required (max 120 characters)')
    if (s.status !== 'running' && s.status !== 'ended') throw new Bad("session.status must be 'running' or 'ended'")
    const t = (s.tokens ?? {}) as Record<string, unknown>
    const tokens: Tokens = { input: num(t.input ?? 0, 'tokens.input', 1e12), output: num(t.output ?? 0, 'tokens.output', 1e12), cacheRead: num(t.cacheRead ?? 0, 'tokens.cacheRead', 1e12), cacheWrite: num(t.cacheWrite ?? 0, 'tokens.cacheWrite', 1e12) }
    const turns = Math.round(num(s.turns ?? 0, 'session.turns', 1e7))
    const model = typeof s.model === 'string' ? s.model.slice(0, 60) : null
    const title = typeof s.title === 'string' && s.title.trim() ? redact(s.title.trim().slice(0, 80)) : null
    const five = pctOf(b.usage?.five, 'usage.five'), week = pctOf(b.usage?.week, 'usage.week')

    const now = new Date().toISOString()
    const st: ClaudeState = (await readClaude(env)) ?? { sessions: [], samples: [], last: null }
    st.sessions ??= []; st.samples ??= []
    let row = st.sessions.find((x) => x.id === s.id)
    if (!row) { row = { id: s.id, project: s.project.trim(), model, status: 'running', start: now, last: now, turns: 0, tokens, five: 0, week: 0 } as ClaudeSession; st.sessions.push(row) }
    row.five = Math.round((row.five + gain(five, st.last?.five)) * 10) / 10
    row.week = Math.round((row.week + gain(week, st.last?.week)) * 10) / 10
    Object.assign(row, { project: s.project.trim(), title: title ?? row.title ?? null, model: model ?? row.model ?? null, tokens, turns, last: now, status: s.status, end: s.status === 'ended' ? now : null })
    st.last = { five, week }
    const prev = st.samples[st.samples.length - 1]
    if (!prev || Date.now() - Date.parse(prev.at) >= SAMPLE_EVERY_MS || prev.five !== five.pct || prev.week !== week.pct) st.samples.push({ at: now, five: five.pct, week: week.pct })
    if (st.samples.length > MAX_SAMPLES) st.samples.splice(0, st.samples.length - MAX_SAMPLES)
    if (st.sessions.length > MAX_SESSIONS) st.sessions.splice(0, st.sessions.length - MAX_SESSIONS)
    st.updated = now
    await writeClaude(env, st)
    return json({ data: { ok: true, five: row.five, week: row.week } }, 200, headers)
  } catch (e) {
    if (e instanceof Bad) return json({ error: e.message }, e.status, headers)
    return json({ error: 'Could not save the entry' }, 502, headers)
  }
}
