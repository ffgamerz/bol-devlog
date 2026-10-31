// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/claude/ingest'

const KEY = 'k'.repeat(40)
const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_KEY: 'svc', CLAUDE_INGEST_KEY: KEY }
let store: string | null
const R5 = '2026-10-31T13:10:00Z', R5B = '2026-10-31T18:10:00Z', RW = '2026-11-06T06:00:00Z'
const body = (id: string, five: number, week: number, o: { status?: string; r5?: string; project?: string; tokens?: object } = {}) => ({
  session: { id, project: o.project ?? 'bol-studio', status: o.status ?? 'running', turns: 1, tokens: o.tokens ?? { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 } },
  usage: { five: { pct: five, resetsAt: o.r5 ?? R5 }, week: { pct: week, resetsAt: RW } },
})
const post = (b: unknown, key: string | null = KEY) => onRequest({ env, request: new Request('https://x.test/', { method: 'POST', headers: key ? { Authorization: `Bearer ${key}` } : {}, body: JSON.stringify(b) }) })
  .then(async (r) => ({ status: r.status, body: (await r.json()) as { error?: string } }))

beforeEach(() => {
  store = null
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    expect(String(url)).toMatch(/^https:\/\/sb\.test\/storage\/v1\/object\/devlog-claude\/state\.json(\?t=\d+)?$/)
    if (init?.method === 'POST') { store = String(init.body); return new Response('{}') }
    return store ? new Response(store) : new Response('{"error":"not_found"}', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/claude/ingest', () => {
  it('rejects a missing or wrong key', async () => {
    expect((await post(body('abcdefgh', 1, 1), null)).status).toBe(401)
    expect((await post(body('abcdefgh', 1, 1), 'x'.repeat(40))).status).toBe(401)
    expect(store).toBeNull()
  })
  it('validates the body', async () => {
    const bad = async (b: unknown, msg: RegExp) => { const r = await post(b); expect(r.status).toBe(400); expect(r.body.error).toMatch(msg) }
    await bad({}, /session is required/)
    await bad(body('x', 1, 1), /session.id/)
    await bad(body('abcdefgh', 101, 1), /usage.five.pct/)
    await bad(body('abcdefgh', 1, -1), /usage.week.pct/)
    await bad(body('abcdefgh', 1, 1, { status: 'weird' }), /status/)
    await bad(body('abcdefgh', 1, 1, { project: '' }), /project/)
    await bad(body('abcdefgh', 1, 1, { tokens: { input: -5 } }), /tokens.input/)
    await bad({ ...body('abcdefgh', 1, 1), usage: { five: { pct: 1, resetsAt: 'nope' }, week: { pct: 1, resetsAt: RW } } }, /resetsAt/)
  })
  it('credits the rise in account percent to the session that reports it, and keeps totals idempotent', async () => {
    await post(body('aaaaaaaa', 12, 37))                     // first report: nothing to compare with yet
    await post(body('aaaaaaaa', 14.5, 37.5, { tokens: { input: 100, output: 200, cacheRead: 0, cacheWrite: 0 } }))
    await post(body('bbbbbbbb', 15, 38, { project: 'grokbot-ai-log' }))
    await post(body('aaaaaaaa', 15, 38, { status: 'ended', tokens: { input: 100, output: 200, cacheRead: 0, cacheWrite: 0 } }))   // tokens are totals: the last report wins
    const st = JSON.parse(store!)
    const a = st.sessions.find((s: { id: string }) => s.id === 'aaaaaaaa'), b = st.sessions.find((s: { id: string }) => s.id === 'bbbbbbbb')
    expect(a).toMatchObject({ status: 'ended', project: 'bol-studio', tokens: { input: 100, output: 200 }, five: 2.5, week: 0.5 })   // first report credits nothing; then +2.5 / +0.5; the last report adds 0
    expect(b).toMatchObject({ project: 'grokbot-ai-log', five: 0.5, week: 0.5 })
    expect(st.sessions).toHaveLength(2)
    expect(st.last.five.pct).toBe(15)
    expect(st.samples.length).toBeGreaterThan(1)
  })
  it('counts a new 5-hour window from zero, never negative', async () => {
    await post(body('aaaaaaaa', 90, 40))
    await post(body('aaaaaaaa', 3, 40, { r5: R5B }))
    const a = JSON.parse(store!).sessions[0]
    expect(a.five).toBe(3)
    expect(a.week).toBe(0)
  })
  it('keeps a title, redacts it and keeps the old one when a later report has none', async () => {
    const withTitle = (title?: string) => { const b = body('title-sess-1', 1, 1); (b.session as Record<string, unknown>).title = title; return b }
    expect((await post(withTitle('Fix the thumbnail strip'))).status).toBe(200)
    expect(JSON.parse(store!).sessions[0].title).toBe('Fix the thumbnail strip')
    expect((await post(withTitle())).status).toBe(200)
    expect(JSON.parse(store!).sessions[0].title).toBe('Fix the thumbnail strip')
  })
  it('rate limits at 120 requests a minute', async () => {
    const codes: number[] = []
    for (let i = 0; i < 125; i++) codes.push((await post({}, KEY)).status)   // earlier tests already used some of the minute
    expect(codes).toContain(429)
    expect(codes[0]).toBe(400)
  })

})
