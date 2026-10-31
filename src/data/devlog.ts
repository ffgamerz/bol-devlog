import { apiJson } from './api'

export type DevlogKind = 'commit' | 'deploy' | 'step' | 'change' | 'srt' | 'error'
export type DevlogEvent = { id: string; at: string; repo: string; kind: DevlogKind; title: string; detail?: string | null; files?: number | null; hash?: string | null; url?: string | null; task?: string | null; bot?: string | null }
export type DevlogRepo = { branch?: string | null; head?: string | null; headAt?: string | null; dirty?: string[]; dirtyCount?: number; ahead?: number | null }
export type DevlogTask = { id: string; name: string; repo?: string | null; bot?: string | null; status: 'running' | 'done' | 'failed'; start: string; end?: string | null; startUsage?: number | null; endUsage?: number | null }
export type DevlogSnapshot = { updated: string; received?: string; events: DevlogEvent[]; repos: Record<string, DevlogRepo>; srt?: { running: boolean; last?: string | null; at?: string | null }; tasks?: DevlogTask[]; config?: { resetAt?: string } }

export const getDevlog = () => apiJson<{ data: DevlogSnapshot | null }>('/api/devlog').then((r) => r.data)

/** "just now" / "12s ago" / "5m ago" / "3h ago" / "2d ago". */
export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso); if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** The collector pushes a heartbeat every 30 s; older than 90 s means it stopped. */
export const collectorAlive = (snap: DevlogSnapshot | null, now = Date.now()) => !!snap && now - Date.parse(snap.updated) < 90_000

export type RepoGroup = { repo: string; events: DevlogEvent[]; info?: DevlogRepo; last: number }
/** Repos ordered by latest activity (events or uncommitted work); events newest first inside each. */
export function groupByRepo(snap: DevlogSnapshot | null): RepoGroup[] {
  if (!snap) return []
  const m = new Map<string, RepoGroup>()
  const g = (repo: string) => m.get(repo) ?? (m.set(repo, { repo, events: [], info: snap.repos?.[repo], last: 0 }), m.get(repo)!)
  for (const e of snap.events ?? []) { const x = g(e.repo || 'general'); x.events.push(e); x.last = Math.max(x.last, Date.parse(e.at) || 0) }
  for (const [repo, info] of Object.entries(snap.repos ?? {})) if (info.dirtyCount) { const x = g(repo); x.last = Math.max(x.last, Date.parse(snap.updated) || 0) }
  for (const x of m.values()) x.events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return [...m.values()].sort((a, b) => b.last - a.last || a.repo.localeCompare(b.repo))
}

/** "42s" / "4m 05s" / "1h 12m". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}

/** end − start usage (one decimal), or null when either is missing. */
export const usageUsed = (t: DevlogTask) => t.startUsage != null && t.endUsage != null ? Math.round((t.endUsage - t.startUsage) * 10) / 10 : null

export type TaskGroup = { task: DevlogTask | null; events: DevlogEvent[] }
export const DEFAULT_BOT = 'Technical'
export const botOf = (t: { bot?: string | null }) => t.bot || DEFAULT_BOT
const endMs = (t: DevlogTask, now: number) => (t.end ? Date.parse(t.end) : now)

/**
 * Events belong to the task named on them; otherwise to a task whose [start, end] (end = now while running)
 * contains them: same bot if the event has one, else Technical's task first (commits/deploys come from its repos).
 * The rest go to "Other activity" (task: null). Order: running first, then newest start; Other last. Events newest first.
 */
export function groupByTask(snap: DevlogSnapshot | null, now = Date.now()): TaskGroup[] {
  if (!snap) return []
  const tasks = [...(snap.tasks ?? [])].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  const byId = new Map(tasks.map((t) => [t.id, { task: t, events: [] as DevlogEvent[] }]))
  const other: DevlogEvent[] = []
  for (const e of snap.events ?? []) {
    const at = Date.parse(e.at)
    let g = e.task ? byId.get(e.task) : undefined
    if (!g) {
      const inWin = tasks.filter((t) => at >= Date.parse(t.start) && at <= endMs(t, now))
      const pick = e.bot ? inWin.find((t) => botOf(t).toLowerCase() === e.bot!.toLowerCase()) : (inWin.find((t) => botOf(t) === DEFAULT_BOT) ?? inWin[0])
      g = pick && byId.get(pick.id)
    }
    if (g) g.events.push(e); else other.push(e)
  }
  const desc = (a: DevlogEvent, b: DevlogEvent) => Date.parse(b.at) - Date.parse(a.at)
  const groups: TaskGroup[] = [...byId.values()].sort((a, b) => Number(b.task.status === 'running') - Number(a.task.status === 'running'))
  for (const g of groups) g.events.sort(desc)
  if (other.length) groups.push({ task: null, events: other.sort(desc) })
  return groups
}

/** task id -> the other tasks whose time ranges intersect it (usage % is account-wide, so these share usage). */
export function overlaps(tasks: DevlogTask[], now = Date.now()): Map<string, DevlogTask[]> {
  const m = new Map<string, DevlogTask[]>()
  for (const a of tasks) for (const b of tasks) {
    if (a.id === b.id) continue
    if (Date.parse(a.start) < endMs(b, now) && Date.parse(b.start) < endMs(a, now)) m.set(a.id, [...(m.get(a.id) ?? []), b])
  }
  return m
}

const mytDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
/** Today as YYYY-MM-DD in Malaysia time. */
export const mytToday = (now = Date.now()) => mytDate(new Date(now))

/** Weekly usage reset (Fri 08:32 UTC = Fri 4:32 PM MYT); override with `log set-reset <ISO>`. */
export const DEFAULT_RESET = '2026-10-30T08:32:00Z'
const WEEK = 7 * 86400000
/** The 7-day usage window containing `now`, rolled forward/back from any known reset time. */
export function usageWindow(resetAt: string | null | undefined, now = Date.now()): { start: number; end: number } {
  let a = Date.parse(resetAt || DEFAULT_RESET)
  if (Number.isNaN(a)) a = Date.parse(DEFAULT_RESET)
  const end = a + Math.ceil((now - a) / WEEK) * WEEK
  const e = end <= now ? end + WEEK : end
  return { start: e - WEEK, end: e }
}

/** "Fri 23 Oct, 4:32 PM" in Malaysia time. */
export function mytWeekdayTime(ms: number): string {
  const o: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date(ms))) o[x.type] = x.value
  return `${o.weekday} ${o.day} ${o.month}, ${o.hour}:${o.minute} ${(o.dayPeriod ?? '').toUpperCase()}`
}

/** "2d 7h" / "5h 12m" / "8m". */
export function untilText(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000))
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

/** A run of time-overlapping finished tasks. Usage % is account-wide, so the run costs max(end %) − min(start %), once. */
export type UsageInterval = { start: number; end: number; lo: number; hi: number; tasks: DevlogTask[] }
const closedWithUsage = (t: DevlogTask) => !!t.end && t.startUsage != null && t.endUsage != null && !Number.isNaN(Date.parse(t.start)) && !Number.isNaN(Date.parse(t.end))
/** Merge finished tasks (both % recorded) whose time ranges overlap. Open tasks / missing % are left out of the math. */
export function mergeIntervals(tasks: DevlogTask[]): UsageInterval[] {
  const ts = tasks.filter(closedWithUsage).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const out: UsageInterval[] = []
  for (const t of ts) {
    const s = Date.parse(t.start), e = Date.parse(t.end!), last = out[out.length - 1]
    if (last && s < last.end) { last.end = Math.max(last.end, e); last.lo = Math.min(last.lo, t.startUsage!); last.hi = Math.max(last.hi, t.endUsage!); last.tasks.push(t) }
    else out.push({ start: s, end: e, lo: t.startUsage!, hi: t.endUsage!, tasks: [t] })
  }
  return out
}
const r1 = (n: number) => Math.round(n * 10) / 10
/** Usage used by a set of tasks: sum over merged runs of max(end) − min(start). `merged` = some tasks overlapped. */
export function mergedUsed(tasks: DevlogTask[]): { used: number; merged: boolean } {
  const iv = mergeIntervals(tasks)
  return { used: r1(iv.reduce((s, i) => s + Math.max(0, i.hi - i.lo), 0)), merged: iv.some((i) => i.tasks.length > 1) }
}

type Period = { tasks: number; used: number; merged: boolean }
export type BotSummary = { bot: string; today: Period; week: Period; running: number }
/**
 * Per bot: tasks started today (MYT) / in the current usage window, and the usage they used with overlapping
 * tasks merged (never the plain sum of end − start). `account` = all bots merged together, so it can't exceed the real rise.
 */
export function usageSummary(tasks: DevlogTask[], now = Date.now(), resetAt?: string | null): { bots: BotSummary[]; account: Omit<BotSummary, 'bot' | 'running'> } {
  const today = mytToday(now)
  const win = usageWindow(resetAt, now)
  const isToday = (t: DevlogTask) => mytDate(new Date(t.start)) === today
  const inWeek = (t: DevlogTask) => { const st = Date.parse(t.start); return st >= win.start && st < win.end }
  const period = (ts: DevlogTask[]): Period => ({ tasks: ts.length, ...mergedUsed(ts) })
  const byBot = new Map<string, DevlogTask[]>()
  for (const t of tasks) byBot.set(botOf(t), [...(byBot.get(botOf(t)) ?? []), t])
  const bots = [...byBot].map(([bot, ts]) => ({ bot, today: period(ts.filter(isToday)), week: period(ts.filter(inWeek)), running: ts.filter((t) => t.status === 'running').length }))
    .sort((a, b) => b.week.used - a.week.used || a.bot.localeCompare(b.bot))
  return { bots, account: { today: period(tasks.filter(isToday)), week: period(tasks.filter(inWeek)) } }
}
export const botSummary = (tasks: DevlogTask[], now = Date.now(), resetAt?: string | null) => usageSummary(tasks, now, resetAt).bots

export type UsagePoint = { at: number; usage: number; kind: 'start' | 'end'; task: DevlogTask }
export type TimelineRow = { task: DevlogTask; start: number; end: number | null; used: number | null; gapBefore: number | null; prevAt: number | null; overlap: boolean; inRun: boolean }
export type UsageTimeline = { points: UsagePoint[]; rows: TimelineRow[]; first: number | null; latest: number | null; inTasks: number; outside: number; merged: boolean }

/**
 * Every recorded usage % (task-start / task-end values from all bots) inside [win.start, win.end), oldest first,
 * plus one row per task (by start time) with the gap since the previous recorded point = usage spent outside logged tasks.
 * Usage only rises within a usage week, so the previous point's value is the latest known usage before the task.
 */
export function usageTimeline(tasks: DevlogTask[], win: { start: number; end: number }, now = Date.now()): UsageTimeline {
  const inWin = (ms: number) => ms >= win.start && ms < win.end
  const points: UsagePoint[] = []
  for (const t of tasks) {
    const s = Date.parse(t.start)
    if (t.startUsage != null && inWin(s)) points.push({ at: s, usage: t.startUsage, kind: 'start', task: t })
    const e = t.end ? Date.parse(t.end) : NaN
    if (t.endUsage != null && inWin(e)) points.push({ at: e, usage: t.endUsage, kind: 'end', task: t })
  }
  points.sort((a, b) => a.at - b.at || (a.kind === 'end' ? -1 : 1))
  const ov = overlaps(tasks, now)
  const sorted = tasks.filter((t) => inWin(Date.parse(t.start))).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  // Gaps follow the same merge as "In logged tasks": one per run of overlapping counted tasks (lowest start % minus the
  // highest % recorded before the run), so In logged tasks + Outside = the real rise. Usage only rises within a week.
  const runs = mergeIntervals(sorted)
  const firstOf = new Map(runs.map((r) => [r.tasks[0].id, r]))
  // Only tasks that count (finished, both %) set the level, so a rise during a task missing its start % shows up as a gap.
  const counted = new Set(runs.flatMap((r) => r.tasks.map((x) => x.id)))
  const prevMax = (at: number, self: string) => points.filter((p) => counted.has(p.task.id) && p.task.id !== self && (p.at < at || (p.at === at && p.kind === 'end')))
    .reduce<UsagePoint | null>((m, p) => (!m || p.usage > m.usage || (p.usage === m.usage && p.at > m.at) ? p : m), null)
  const rows: TimelineRow[] = sorted.map((t) => {
    const start = Date.parse(t.start)
    const run = firstOf.get(t.id)
    const inside = runs.find((r) => r.tasks.some((x) => x.id === t.id) || (start >= r.start && start < r.end))
    const inRun = !!inside && !run
    let gap: number | null = null, prev: UsagePoint | null = null
    if (run) { prev = prevMax(run.start, t.id); gap = prev ? Math.max(0, r1(run.lo - prev.usage)) : null }
    else if (!inside && t.startUsage != null) { prev = prevMax(start, t.id); gap = prev ? Math.max(0, r1(t.startUsage - prev.usage)) : null }
    return { task: t, start, end: t.end ? Date.parse(t.end) : null, used: usageUsed(t), gapBefore: gap, prevAt: prev?.at ?? null, overlap: ov.has(t.id), inRun }
  })
  const m = mergedUsed(sorted)
  return {
    points, rows,
    first: points[0]?.usage ?? null,
    latest: points.length ? Math.max(...points.map((p) => p.usage)) : null,
    inTasks: m.used, merged: m.merged,
    outside: r1(rows.reduce((s, r) => s + (r.gapBefore ?? 0), 0)),
  }
}

export const DAY_MS = 86400000
export type LiveSeries = { from: number; to: number; points: UsagePoint[]; carry: UsagePoint | null; lanes: { task: DevlogTask; start: number; end: number; overlap: boolean }[] }
/**
 * Live chart data for the last `span` ms ending at `now` (all bots, ignores the usage week): the recorded usage points
 * inside it, the last point before it (so the line starts at the left edge), and the task bars that touch it.
 */
export function liveSeries(tasks: DevlogTask[], now = Date.now(), span = DAY_MS): LiveSeries {
  const from = now - span, to = now
  const all: UsagePoint[] = []
  for (const t of tasks) {
    const s = Date.parse(t.start)
    if (t.startUsage != null && !Number.isNaN(s)) all.push({ at: s, usage: t.startUsage, kind: 'start', task: t })
    const e = t.end ? Date.parse(t.end) : NaN
    if (t.endUsage != null && !Number.isNaN(e)) all.push({ at: e, usage: t.endUsage, kind: 'end', task: t })
  }
  all.sort((a, b) => a.at - b.at || (a.kind === 'end' ? -1 : 1))
  const points = all.filter((p) => p.at >= from && p.at <= to)
  const carry = [...all].reverse().find((p) => p.at < from) ?? null
  const ov = overlaps(tasks, now)
  const lanes = tasks.map((t) => ({ task: t, start: Date.parse(t.start), end: t.end ? Date.parse(t.end) : now, overlap: ov.has(t.id) }))
    .filter((l) => !Number.isNaN(l.start) && l.end >= from && l.start <= to)
  return { from, to, points, carry, lanes }
}

export type Tick = { t: number; label: string; day: boolean }
/** Axis ticks every `step` ms aligned to Malaysia time (UTC+8); midnight ticks carry the date ("Thu 29 Oct"). */
export function mytTicks(from: number, to: number, step: number): Tick[] {
  const OFF = 8 * 3600000
  const out: Tick[] = []
  for (let t = Math.ceil((from + OFF) / step) * step - OFF; t <= to; t += step) {
    const m = new Date(t + OFF)
    const day = m.getUTCHours() === 0 && m.getUTCMinutes() === 0
    const label = day
      ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short' }).format(t)
      : `${String(m.getUTCHours()).padStart(2, '0')}:${String(m.getUTCMinutes()).padStart(2, '0')}`
    out.push({ t, label, day })
  }
  return out
}
