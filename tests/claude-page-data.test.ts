import { describe, expect, it } from 'vitest'
import { billedTokens, byProject, compact, rankSessions, type ClaudeSession, type ClaudeState } from '../src/data/claude'

const T0 = Date.parse('2026-10-31T12:00:00Z')
const sess = (id: string, project: string, last: string, five: number, week: number, output = 1000): ClaudeSession => ({ id, project, status: 'ended', start: last, last, turns: 1, tokens: { input: 0, output, cacheRead: 5e6, cacheWrite: 0 }, five, week })
const st: ClaudeState = {
  samples: [], last: { five: { pct: 12, resetsAt: '2026-10-31T13:10:00Z' }, week: { pct: 37, resetsAt: '2026-11-06T06:00:00Z' } },
  sessions: [sess('a', 'bol-studio', '2026-10-31T11:00:00Z', 4, 9), sess('b', 'grokbot-ai-log', '2026-10-31T11:30:00Z', 1, 12), sess('c', 'bol-studio', '2026-10-31T01:00:00Z', 0, 5), sess('d', 'old', '2026-10-20T01:00:00Z', 0, 30)],
}
describe('Claude page data', () => {
  it('ranks sessions by percent in the chosen window', () => {
    expect(rankSessions(st, 'week', T0).map((s) => s.id)).toEqual(['b', 'a', 'c'])      // d is before this week's window
    expect(rankSessions(st, 'five', T0).map((s) => s.id)).toEqual(['a', 'b'])           // only those that reported inside the 5 hours, by 5-hour percent
    expect(rankSessions(st, 'all', T0).map((s) => s.id)).toEqual(['d', 'b', 'a', 'c'])
    expect(rankSessions(null, 'week', T0)).toEqual([])
  })
  it('groups by project and counts cached reads apart from billed tokens', () => {
    const p = byProject(rankSessions(st, 'week', T0))
    expect(p[0]).toMatchObject({ project: 'bol-studio', week: 14, sessions: 2 })
    expect(billedTokens({ input: 1, output: 2, cacheRead: 999, cacheWrite: 3 })).toBe(6)
    expect(compact(21_087_234)).toBe('21.1M'); expect(compact(950)).toBe('950'); expect(compact(95_329)).toBe('95.3k')
  })
})
