// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { redact, redactDeep } from '../functions/api/devlog'
import { collectorAlive, groupByRepo, relTime, type DevlogSnapshot } from '../src/data/devlog'
import { activeArea, visibleNav } from '../src/app/nav'

describe('dev log', () => {
  it('redacts secret-looking strings', () => {
    expect(redact('key eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abcdefghijklmnop')).toBe('key [redacted]')
    expect(redact('https://x.dev/a?key=abc123&b=1')).toBe('https://x.dev/a?key=[redacted]&b=1')
    expect(redact('token: ghp_abcdefghijklmnopqrstuvwxyz0123')).not.toMatch(/ghp_/)
    expect(redact('src/features/videos/VideosPage.tsx')).toBe('src/features/videos/VideosPage.tsx')
    expect(redactDeep({ a: ['sk-proj-abcdefghijklmnopqrstuv'] })).toEqual({ a: ['[redacted]'] })
  })
  it('groups by repo, newest first, and ages relative times', () => {
    const now = Date.parse('2026-10-28T01:00:00Z')
    const s: DevlogSnapshot = { updated: '2026-10-28T00:59:50Z', repos: { 'bol-api': { dirtyCount: 0 } }, events: [
      { id: '1', at: '2026-10-28T00:10:00Z', repo: 'bol-studio', kind: 'commit', title: 'a' },
      { id: '2', at: '2026-10-28T00:50:00Z', repo: 'bol-studio', kind: 'deploy', title: 'b' },
      { id: '3', at: '2026-10-28T00:20:00Z', repo: 'myaccount', kind: 'commit', title: 'c' },
    ] }
    const g = groupByRepo(s)
    expect(g.map((x) => x.repo)).toEqual(['bol-studio', 'myaccount'])
    expect(g[0].events.map((e) => e.id)).toEqual(['2', '1'])
    expect(relTime('2026-10-28T00:59:50Z', now)).toBe('10s ago')
    expect(relTime('2026-10-28T00:10:00Z', now)).toBe('50m ago')
    expect(collectorAlive(s, now)).toBe(true)
    expect(collectorAlive(s, now + 120_000)).toBe(false)
  })
  it('Dev log is admin-only under More', () => {
    expect(activeArea('/', visibleNav(true))?.id).toBe('devlog')
    expect(visibleNav(false).some((a) => a.id === 'devlog')).toBe(false)
  })
})

describe('dev log tasks', () => {
  const now = Date.parse('2026-10-28T00:40:00Z')
  const ev = (id: string, at: string, task?: string) => ({ id, at, repo: 'bol-studio', kind: 'step' as const, title: id, task })
  const snap: DevlogSnapshot = { updated: '2026-10-28T00:39:59Z', repos: {}, tasks: [
    { id: 'a', name: 'Exclude', status: 'done', start: '2026-10-28T00:26:54Z', end: '2026-10-28T00:31:23Z', startUsage: 83.1, endUsage: 83.5 },
    { id: 'c', name: 'Dev log tasks', status: 'running', start: '2026-10-28T00:35:00Z', startUsage: 83.7 },
    { id: 'b', name: 'Verify', status: 'done', start: '2026-10-28T00:32:11Z', end: '2026-10-28T00:33:38Z', startUsage: 83.5, endUsage: 83.7 },
  ], events: [
    ev('x1', '2026-10-28T00:20:00Z'), ev('a1', '2026-10-28T00:27:00Z'), ev('a2', '2026-10-28T00:31:23Z'),
    ev('b1', '2026-10-28T00:33:00Z'), ev('c1', '2026-10-28T00:39:00Z'), ev('tag', '2026-10-28T00:20:00Z', 'b'),
  ] }
  it('assigns events by window (or explicit task), running first, newest start next, Other last', async () => {
    const { groupByTask, usageUsed, duration } = await import('../src/data/devlog')
    const g = groupByTask(snap, now)
    expect(g.map((x) => x.task?.id ?? 'other')).toEqual(['c', 'b', 'a', 'other'])
    expect(g[0].events.map((e) => e.id)).toEqual(['c1'])
    expect(g[1].events.map((e) => e.id)).toEqual(['b1', 'tag'])
    expect(g[2].events.map((e) => e.id)).toEqual(['a2', 'a1'])
    expect(g[3].events.map((e) => e.id)).toEqual(['x1'])
    expect(usageUsed(snap.tasks![0])).toBe(0.4)
    expect(usageUsed(snap.tasks![1])).toBeNull()
    expect(duration(269_000)).toBe('4m 29s')
  })
})

describe('dev log bots', () => {
  it('bot-aware assignment, overlap and per-bot summary (MYT day/week)', async () => {
    const { groupByTask, overlaps, botSummary, mytToday, usageWindow, mytWeekdayTime, untilText } = await import('../src/data/devlog')
    const now = Date.parse('2026-10-28T01:00:00Z') // Wed 09:00 MYT
    const tasks = [
      { id: 't', name: 'Code', status: 'done' as const, start: '2026-10-28T00:10:00Z', end: '2026-10-28T00:30:00Z', startUsage: 83, endUsage: 83.4 },
      { id: 'p', name: 'Plan', bot: 'PA', status: 'done' as const, start: '2026-10-28T00:20:00Z', end: '2026-10-28T00:25:00Z', startUsage: 83.2, endUsage: 83.3 },
      { id: 'u', name: 'Upload', bot: 'Uploader', status: 'done' as const, start: '2026-10-26T02:00:00Z', end: '2026-10-26T02:10:00Z', startUsage: 70, endUsage: 70.5 },
      { id: 'old', name: 'Old', bot: 'PA', status: 'done' as const, start: '2026-10-25T02:00:00Z', end: '2026-10-25T02:10:00Z', startUsage: 60, endUsage: 61 },
    ]
    const ev = (id: string, at: string, bot?: string) => ({ id, at, repo: 'bol-studio', kind: 'commit' as const, title: id, bot })
    const g = groupByTask({ updated: '', repos: {}, tasks, events: [ev('c', '2026-10-28T00:22:00Z'), ev('s', '2026-10-28T00:22:00Z', 'PA')] }, now)
    expect(g.find((x) => x.task?.id === 't')!.events.map((e) => e.id)).toEqual(['c'])
    expect(g.find((x) => x.task?.id === 'p')!.events.map((e) => e.id)).toEqual(['s'])
    const ov = overlaps(tasks, now)
    expect(ov.get('t')!.map((x) => x.id)).toEqual(['p'])
    expect(ov.has('u')).toBe(false)
    expect(mytToday(now)).toBe('2026-10-28')
    const w = usageWindow('2026-10-30T08:32:00Z', now)
    expect(new Date(w.start).toISOString()).toBe('2026-10-23T08:32:00.000Z')
    expect(new Date(w.end).toISOString()).toBe('2026-10-30T08:32:00.000Z')
    expect(usageWindow('2026-10-16T08:32:00Z', now)).toEqual(w) // old anchor rolls forward
    expect(new Date(usageWindow('2026-10-30T08:32:00Z', Date.parse('2026-10-30T08:32:00Z')).start).toISOString()).toBe('2026-10-30T08:32:00.000Z')
    expect(mytWeekdayTime(w.start)).toBe('Fri 23 Oct, 4:32 PM')
    expect(untilText(w.end - now)).toBe('2d 7h')
    const s = Object.fromEntries(botSummary(tasks, now, '2026-10-30T08:32:00Z').map((x) => [x.bot, x]))
    expect(s.Technical.today).toEqual({ tasks: 1, used: 0.4, merged: false })
    expect(s.PA.today).toEqual({ tasks: 1, used: 0.1, merged: false })
    expect(s.PA.week).toEqual({ tasks: 2, used: 1.1, merged: false })
    expect(s.Uploader.week).toEqual({ tasks: 1, used: 0.5, merged: false })
    expect(s.Uploader.today.tasks).toBe(0)
    expect(botSummary([{ ...tasks[3], start: '2026-10-23T08:00:00Z' }], now, '2026-10-30T08:32:00Z')[0].week.tasks).toBe(0) // before the reset
  })
})

describe('usage timeline', () => {
  it('points in order, per-task used, gaps outside tasks, overlap, window filter', async () => {
    const { usageTimeline, usageWindow } = await import('../src/data/devlog')
    const now = Date.parse('2026-10-28T02:00:00Z')
    const win = usageWindow('2026-10-30T08:32:00Z', now)
    const T = (id: string, bot: string, start: string, end: string | null, a: number | null, b: number | null) =>
      ({ id, name: id, bot, status: end ? 'done' as const : 'running' as const, start, end, startUsage: a, endUsage: b })
    const tasks = [
      T('a', 'Technical', '2026-10-28T00:26:54Z', '2026-10-28T00:31:23Z', 83.1, 83.5),
      T('b', 'Technical', '2026-10-28T00:32:11Z', '2026-10-28T00:33:38Z', 83.5, 83.7),
      T('c', 'PA', '2026-10-28T01:21:15Z', '2026-10-28T01:23:18Z', null, 85.3),
      T('d', 'Uploader', '2026-10-28T01:22:43Z', '2026-10-28T01:24:37Z', 85.3, 85.3),
      T('e', 'Technical', '2026-10-28T01:30:00Z', '2026-10-28T01:43:16Z', 85.6, 86.5),
      T('f', 'Technical', '2026-10-28T01:49:10Z', null, 86.6, null),
      T('old', 'PA', '2026-10-22T01:00:00Z', '2026-10-22T02:00:00Z', 70, 71),
    ]
    const tl = usageTimeline(tasks, win, now)
    expect(tl.points.map((p) => p.usage)).toEqual([83.1, 83.5, 83.5, 83.7, 85.3, 85.3, 85.3, 85.6, 86.5, 86.6])
    expect(tl.rows.map((r) => r.task.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    const g = Object.fromEntries(tl.rows.map((r) => [r.task.id, r.gapBefore]))
    expect(g).toEqual({ a: null, b: 0, c: null, d: 1.6, e: 0.3, f: 0.1 })
    expect(tl.rows.find((r) => r.task.id === 'c')!.overlap).toBe(true)
    expect(tl.rows.find((r) => r.task.id === 'a')!.overlap).toBe(false)
    expect(tl.first).toBe(83.1); expect(tl.latest).toBe(86.6)
    expect(tl.inTasks).toBe(1.5) // 0.4 + 0.2 + 0 + 0.9
    expect(tl.outside).toBe(2)
    const prev = usageTimeline(tasks, { start: win.start - 7 * 86400000, end: win.start }, now)
    expect(prev.rows.map((r) => r.task.id)).toEqual(['old'])
  })
})

describe('usage with overlapping tasks merged', () => {
  const T = (id: string, bot: string, start: string, end: string | null, a: number | null, b: number | null) =>
    ({ id, name: id, bot, status: end ? 'done' as const : 'running' as const, start: `2026-10-28T${start}+08:00`, end: end ? `2026-10-28T${end}+08:00` : null, startUsage: a, endUsage: b })
  const now = Date.parse('2026-10-28T10:30:00+08:00')
  it("Azman's example: 85→85.4 and 85→85.5 at the same time cost 0.5, not 0.9", async () => {
    const { mergedUsed, usageSummary } = await import('../src/data/devlog')
    const ts = [T('t1', 'Uploader', '09:00:00', '09:20:00', 85, 85.4), T('t2', 'Uploader', '09:05:00', '09:25:00', 85, 85.5)]
    expect(mergedUsed(ts)).toEqual({ used: 0.5, merged: true })
    const s = usageSummary(ts, now, '2026-10-30T08:32:00Z')
    expect(s.bots[0].today).toEqual({ tasks: 2, used: 0.5, merged: true })
    expect(s.bots[0].week).toEqual({ tasks: 2, used: 0.5, merged: true })
  })
  it('sequential tasks still add up; touching (end == next start) is not an overlap', async () => {
    const { mergedUsed } = await import('../src/data/devlog')
    expect(mergedUsed([T('a', 'X', '09:00:00', '09:10:00', 80, 80.3), T('b', 'X', '09:10:00', '09:20:00', 80.3, 80.5)])).toEqual({ used: 0.5, merged: false })
    expect(mergedUsed([T('a', 'X', '09:00:00', '09:10:00', 80, 80.3), T('b', 'X', '09:30:00', '09:40:00', 80.6, 80.9)])).toEqual({ used: 0.6, merged: false })
  })
  it("today's real Uploader log: 4 overlapping 85→87.3 tasks + go-live = 2.5 (was 9.4)", async () => {
    const { usageSummary } = await import('../src/data/devlog')
    const up = [
      T('u0', 'Uploader', '09:03:42', '09:15:05', null, null),
      T('u1', 'Uploader', '09:13:00', '09:42:00', 85, 87.3), T('u2', 'Uploader', '09:18:47', '10:02:37', 85, 87.3),
      T('u3', 'Uploader', '09:23:00', '09:45:00', 85, 87.3), T('u4', 'Uploader', '09:32:00', '09:50:00', 85, 87.3),
      T('u5', 'Uploader', '10:07:04', '10:07:44', 87.3, 87.5),
    ]
    const tech = [T('k1', 'Technical', '09:30:00', '09:43:16', 85.6, 86.5), T('k2', 'Technical', '09:55:59', '10:04:28', 86.9, 87.3), T('k3', 'Technical', '10:22:00', null, 87.7, null)]
    const s = usageSummary([...up, ...tech], now, '2026-10-30T08:32:00Z')
    const by = Object.fromEntries(s.bots.map((b) => [b.bot, b]))
    expect(by.Uploader.today).toEqual({ tasks: 6, used: 2.5, merged: true })
    expect(by.Technical.today).toEqual({ tasks: 3, used: 1.3, merged: false }) // open task counted, no usage
    // Account: Technical's tasks sit inside Uploader's 09:13–10:04 run, so they merge across bots: 85→87.3 once, plus 87.3→87.5.
    expect(s.account.today).toEqual({ tasks: 9, used: 2.5, merged: true })
    expect(s.account.today.used).toBeLessThanOrEqual(87.7 - 85)
  })
  it('timeline: In logged tasks (merged across bots) + gaps = the real rise', async () => {
    const { usageTimeline, usageWindow } = await import('../src/data/devlog')
    const ts = [
      T('a', 'Technical', '08:26:54', '08:31:23', 83.1, 83.5), T('b', 'Uploader', '09:13:00', '09:42:00', 85, 87.3),
      T('c', 'Uploader', '09:18:47', '10:02:37', 85, 87.3), T('d', 'Technical', '09:30:00', '09:43:16', 85.6, 86.5),
      T('e', 'Uploader', '10:07:04', '10:07:44', 87.3, 87.5), T('f', 'Technical', '10:22:00', null, 87.7, null),
    ]
    const tl = usageTimeline(ts, usageWindow('2026-10-30T08:32:00Z', now), now)
    expect(tl.inTasks).toBe(2.9) // 0.4 + 2.3 + 0.2
    expect(tl.merged).toBe(true)
    const g = Object.fromEntries(tl.rows.map((r) => [r.task.id, r.gapBefore]))
    expect(g).toEqual({ a: null, b: 1.5, c: null, d: null, e: 0, f: 0.2 })
    expect(Math.round((tl.inTasks + tl.outside) * 10) / 10).toBe(Math.round((tl.latest! - tl.first!) * 10) / 10)
  })
})

describe('live 24h chart data', () => {
  it('keeps points from the last 24 h, carries the level in from before, ticks every 30 min in MYT with dates at midnight', async () => {
    const { liveSeries, mytTicks } = await import('../src/data/devlog')
    const now = Date.parse('2026-10-28T04:00:00Z') // 12:00 MYT
    const T = (id: string, start: string, end: string | null, a: number | null, b: number | null) => ({ id, name: id, status: end ? 'done' as const : 'running' as const, start, end, startUsage: a, endUsage: b })
    const s = liveSeries([
      T('old', '2026-10-27T01:00:00Z', '2026-10-27T02:00:00Z', 70, 71),
      T('a', '2026-10-27T05:00:00Z', '2026-10-27T05:30:00Z', 80, 80.5),
      T('b', '2026-10-28T03:00:00Z', null, 85, null),
    ], now)
    expect(s.from).toBe(now - 86400000)
    expect(s.points.map((p) => p.usage)).toEqual([80, 80.5, 85])
    expect(s.carry?.usage).toBe(71)
    expect(s.lanes.map((l) => l.task.id)).toEqual(['a', 'b'])
    expect(s.lanes[1].end).toBe(now)
    const t = mytTicks(Date.parse('2026-10-28T15:10:00Z'), Date.parse('2026-10-28T17:05:00Z'), 30 * 60000) // 23:10–01:05 MYT
    expect(t.map((x) => x.label)).toEqual(['23:30', 'Thu 29 Oct', '00:30', '01:00'])
    expect(t[1].day).toBe(true)
  })
})
