import { apiJson } from './api'

export type ClaudeTokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type ClaudeSession = {
  id: string; project: string; title?: string | null; model?: string | null; status: 'running' | 'ended'; start: string; last: string; end?: string | null
  turns: number; tokens: ClaudeTokens; five: number; week: number
}
export type ClaudeSample = { at: string; five: number; week: number }
export type ClaudeState = { updated?: string; sessions: ClaudeSession[]; samples: ClaudeSample[]; last?: { five: { pct: number; resetsAt: string }; week: { pct: number; resetsAt: string } } | null }

export const getClaude = () => apiJson<{ data: ClaudeState | null }>('/api/claude').then((r) => r.data)

/** Tokens the model actually read and wrote (cache reads are cheap and huge, so they are shown apart). */
export const billedTokens = (t: ClaudeTokens) => t.input + t.output + t.cacheWrite
export function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}

export type Range = 'five' | 'week' | 'all'
/** Sessions active inside the window (a session counts when it last reported after the window start), highest weekly percent first. */
export function rankSessions(st: ClaudeState | null, range: Range, now = Date.now()): ClaudeSession[] {
  if (!st) return []
  const from = range === 'five' && st.last ? Date.parse(st.last.five.resetsAt) - 5 * 3600_000 : range === 'week' && st.last ? Date.parse(st.last.week.resetsAt) - 7 * 86400_000 : 0
  return st.sessions.filter((s) => Date.parse(s.last) >= from && Date.parse(s.last) <= now + 60_000).sort((a, b) => (range === 'five' ? b.five - a.five : b.week - a.week) || billedTokens(b.tokens) - billedTokens(a.tokens))
}
/** Per project: sessions summed, highest first. */
export function byProject(sessions: ClaudeSession[]) {
  const m = new Map<string, { project: string; five: number; week: number; tokens: number; sessions: number }>()
  for (const s of sessions) {
    const x = m.get(s.project) ?? { project: s.project, five: 0, week: 0, tokens: 0, sessions: 0 }
    x.five += s.five; x.week += s.week; x.tokens += billedTokens(s.tokens); x.sessions++
    m.set(s.project, x)
  }
  return [...m.values()].sort((a, b) => b.week - a.week)
}
