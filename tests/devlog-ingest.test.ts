// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/devlog/ingest'

const KEY_A = 'a'.repeat(40), KEY_B = 'b'.repeat(40)
const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_KEY: 'svc-key', DEVLOG_INGEST_KEYS: `alpha:${KEY_A}, beta:${KEY_B}` }
let store: string | null
const post = (body: unknown, key: string | null = KEY_A, raw = false) => onRequest({
  env,
  request: new Request('https://x.test/api/devlog/ingest', { method: 'POST', headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' }, body: raw ? (body as string) : JSON.stringify(body) }),
}).then(async (r) => ({ status: r.status, body: (await r.json()) as { data?: { id?: string }; error?: string } }))

beforeEach(() => {
  store = null
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    expect(String(url)).toMatch(/^https:\/\/sb\.test\/storage\/v1\/object\/devlog\/state\.json(\?t=\d+)?$/)
    if (init?.method === 'POST') { store = String(init.body); return new Response('{}', { status: 200 }) }
    return store ? new Response(store, { status: 200 }) : new Response('{"error":"not_found"}', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/devlog/ingest', () => {
  it('rejects a missing, wrong or short key with 401 and writes nothing', async () => {
    expect((await post({ type: 'task-start', name: 'x' }, null)).status).toBe(401)
    expect((await post({ type: 'task-start', name: 'x' }, 'c'.repeat(40))).status).toBe(401)
    expect((await post({ type: 'task-start', name: 'x' }, 'short')).status).toBe(401)
    expect(store).toBeNull()
  })

  it('validates the body', async () => {
    const bad = async (b: unknown, msg: RegExp) => { const r = await post(b); expect(r.status).toBe(400); expect(r.body.error).toMatch(msg) }
    await bad('nope', /JSON/)
    await bad({ type: 'wat' }, /type must be/)
    await bad({ type: 'task-start' }, /name is required/)
    await bad({ type: 'task-start', name: 'x'.repeat(501) }, /too long/)
    await bad({ type: 'task-start', name: 'x', usage: 101 }, /usage/)
    await bad({ type: 'task-start', name: 'x', usage: -1 }, /usage/)
    await bad({ type: 'task-start', name: 'x', usage: '5' }, /usage/)
    await bad({ type: 'task-start', name: 'x', repo: 'bad repo!' }, /repo/)
    await bad({ type: 'step', id: 'nope', msg: 'hi' }, /task id/)
    await bad({ type: 'step', id: 't000000', msg: 'hi' }, /Unknown task id/)
    expect((await post('{bad', KEY_A, true)).status).toBe(400)
  })

  it('task-start -> step -> task-end writes the snapshot the Dev log reader expects', async () => {
    const start = await post({ type: 'task-start', name: 'Fix login', usage: 13.7, repo: 'bol-studio' })
    expect(start.status).toBe(200)
    const id = start.body.data!.id!
    expect(id).toMatch(/^t[0-9a-f]{6}$/)
    expect((await post({ type: 'step', id, msg: 'Wrote the test' })).status).toBe(200)
    expect((await post({ type: 'task-end', id, usage: 13.9 })).status).toBe(200)

    const snap = JSON.parse(store!)
    expect(snap.tasks).toHaveLength(1)
    expect(snap.tasks[0]).toMatchObject({ id, name: 'Fix login', bot: 'alpha', repo: 'bol-studio', status: 'done', startUsage: 13.7, endUsage: 13.9 })
    expect(Date.parse(snap.tasks[0].start)).toBeLessThanOrEqual(Date.parse(snap.tasks[0].end))
    expect(snap.events).toHaveLength(1)
    expect(snap.events[0]).toMatchObject({ kind: 'step', title: 'Wrote the test', task: id, bot: 'alpha', repo: 'bol-studio' })
    expect(Date.parse(snap.updated)).toBeGreaterThan(Date.now() - 5000)
  })

  it('takes the bot name from the key, and one bot cannot touch another bot\'s task', async () => {
    const id = (await post({ type: 'task-start', name: 'A job' })).body.data!.id!
    const r = await post({ type: 'step', id, msg: 'sneaky' }, KEY_B)
    expect(r.status).toBe(403)
    expect((await post({ type: 'task-end', id }, KEY_B)).status).toBe(403)
    const b = await post({ type: 'task-start', name: 'B job', repo: 'x' }, KEY_B)
    expect(JSON.parse(store!).tasks.find((t: { id: string }) => t.id === b.body.data!.id).bot).toBe('beta')
  })

  it('keeps existing snapshot data, refuses steps on an ended task, and redacts secrets', async () => {
    store = JSON.stringify({ updated: '2026-01-01T00:00:00Z', events: [{ id: 'old', at: '2026-01-01T00:00:00Z', repo: 'r', kind: 'commit', title: 'old' }], repos: { r: { branch: 'main' } }, config: { resetAt: '2026-10-30T08:32:00Z' } })
    const id = (await post({ type: 'task-start', name: 'Job ghp_abcdefghijklmnopqrstuvwxyz0123456789' })).body.data!.id!
    await post({ type: 'task-end', id })
    const ended = await post({ type: 'step', id, msg: 'late' })
    expect(ended.status).toBe(400)
    const snap = JSON.parse(store!)
    expect(snap.events[0].id).toBe('old')
    expect(snap.repos.r.branch).toBe('main')
    expect(snap.config.resetAt).toBe('2026-10-30T08:32:00Z')
    expect(snap.tasks[0].name).toContain('[redacted]')
    expect(snap.tasks[0].name).not.toContain('ghp_')
  })

  it('rate limits a bot at 60 requests a minute', async () => {
    const key = 'r'.repeat(40)
    const e2 = { ...env, DEVLOG_INGEST_KEYS: `ratebot:${key}` }
    const go = () => onRequest({ env: e2, request: new Request('https://x.test/', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: '{"type":"x"}' }) }).then((r) => r.status)
    const codes: number[] = []
    for (let i = 0; i < 61; i++) codes.push(await go())
    expect(codes.slice(0, 60).every((c) => c === 400)).toBe(true)
    expect(codes[60]).toBe(429)
  })
})
