import { useEffect, useMemo, useRef, useState } from 'react'
import { botOf, mytWeekdayTime, usageTimeline, usageWindow, type DevlogTask } from '@/data/devlog'
import { formatDateTime, mytHHMM } from '@/lib/date'
import { cn } from '@/lib/cn'
import { LiveUsageChart } from './LiveUsageChart'

const pct = (v: number | null | undefined) => (v == null ? '–' : `${v.toFixed(1)}%`)
const WEEK = 7 * 86400000
/** Rows shown in the task list before 'Show all'. */
export const TIMELINE_LIMIT = 5
const H = 280, PL = 36, PR = 8, PT = 10, PB = 22

/** Straight-line forecast from this week's average burn rate (usage starts near 0 at the reset). */
export function usageForecast(latest: number | null, latestAt: number | null, win: { start: number; end: number }) {
  if (latest == null || latestAt == null || latestAt <= win.start) return null
  const rate = latest / (latestAt - win.start) // % per ms
  if (rate <= 0) return null
  const atReset = latest + rate * (win.end - latestAt)
  const hitAt = latest >= 100 ? latestAt : latestAt + (100 - latest) / rate
  return { perDay: rate * 86400000, atReset, hitAt: hitAt < win.end ? hitAt : null }
}

/** Daily budget: spread what is left of the week evenly over the days left. A "day" is a session that runs reset-time to reset-time
 *  (e.g. 4:32 PM yesterday to 4:32 PM today). allowance = this session's fair share, used = rise since the session began, balance = allowance - used (negative = over). */
export function dailyBudget(points: { at: number; usage: number }[], win: { start: number; end: number }, now: number) {
  if (!points.length || now >= win.end) return null
  const DAY = 86400000
  const mid = Math.max(win.start, win.end - Math.ceil((win.end - now) / DAY) * DAY)
  const before = points.filter((p) => p.at <= mid)
  const atMid = before.length ? before[before.length - 1].usage : 0
  const latest = points[points.length - 1].usage
  const daysLeft = Math.max(1 / 24, (win.end - mid) / DAY)
  const allowance = Math.max(0, 100 - atMid) / Math.max(1, daysLeft)
  const used = Math.max(0, latest - atMid)
  return { allowance, used, balance: allowance - used, perDayRest: Math.max(0, 100 - latest) / Math.max(1 / 24, (win.end - now) / DAY) }
}

/** Container width, so the SVG draws at 1:1 and its 10px labels stay readable on a 390px phone. */
function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || fallback))
    ro.observe(el); return () => ro.disconnect()
  }, [fallback])
  return [ref, Math.max(280, Math.min(960, w))] as const
}

/** Step chart: usage holds between recorded points. Plain accent stroke, no fill. Task bars underneath; overlaps in warning. */
function StepChart({ data, win, zoom, now, fc }: { data: ReturnType<typeof usageTimeline>; win: { start: number; end: number }; zoom: boolean; now: number; fc?: ReturnType<typeof usageForecast> }) {
  const [box, W] = useWidth<HTMLDivElement>()
  const pts = data.points
  const x0 = zoom && pts.length ? Math.min(...data.rows.map((r) => r.start), pts[0].at) - 20 * 60000 : win.start
  const x1 = zoom && pts.length ? Math.min(win.end, Math.max(now, ...pts.map((p) => p.at)) + 20 * 60000) : win.end
  const fEnd = fc ? Math.min(100, fc.atReset) : null
  const vals = [...pts.map((p) => p.usage), ...(fEnd != null ? [fEnd] : [])]
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5)
  const X = (t: number) => PL + ((t - x0) / Math.max(1, x1 - x0)) * (W - PL - PR)
  const Y = (v: number) => PT + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - PT - PB)
  let d = ''
  pts.forEach((p, i) => { d += i === 0 ? `M${X(p.at)},${Y(p.usage)}` : `H${X(p.at)}V${Y(p.usage)}` })
  if (pts.length && now > pts[pts.length - 1].at && now < win.end) d += `H${X(Math.min(now, x1))}`
  const ys = hi - lo <= 4 ? 0.5 : Math.ceil((hi - lo) / 5)
  const yTicks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += ys) yTicks.push(Math.round(v * 10) / 10)
  const span = x1 - x0
  const narrow = W < 480
  const step = span > 2 * 86400000 ? 86400000 : span > 6 * 3600000 ? (narrow ? 6 : 3) * 3600000 : span > 2 * 3600000 ? 3600000 : (narrow ? 30 : 15) * 60000
  const xTicks: number[] = []
  for (let t = Math.ceil((x0 - win.start) / step) * step + win.start; t <= x1; t += step) xTicks.push(t)
  const lane = data.rows
  return (
    <div ref={box} className="w-full">
    <svg viewBox={`0 0 ${W} ${H + 14}`} width={W} height={H + 14} className="block max-w-full" role="img" aria-label={`Weekly usage from ${pct(data.first)} to ${pct(data.latest)}`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} className="stroke-border" strokeWidth={1} />
          <text x={PL - 4} y={Y(v) + 3} textAnchor="end" className="num fill-muted text-[10px]">{Number.isInteger(v) ? v : v.toFixed(1)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={X(t)} y={H - 6} textAnchor="middle" className="num fill-muted text-[10px]">
          {step >= 86400000 ? mytWeekdayTime(t).split(',')[0] : mytHHMM(new Date(t).toISOString())}
        </text>
      ))}
      <path d={d} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
      {fc && fEnd != null && pts.length > 0 && (() => {
        const last = pts[pts.length - 1], tEnd = fc.hitAt ?? win.end
        return <line x1={X(last.at)} y1={Y(last.usage)} x2={X(Math.min(tEnd, x1))} y2={Y(fEnd)} className="stroke-warning" strokeWidth={1.5} strokeDasharray="5 4"><title>{`Forecast: ${pct(fEnd)} ${fc.hitAt ? 'reached' : 'at reset'}`}</title></line>
      })()}
      {pts.map((p, i) => (
        <circle key={i} cx={X(p.at)} cy={Y(p.usage)} r={3} className={p.kind === 'start' ? 'fill-surface stroke-accent' : 'fill-accent stroke-accent'} strokeWidth={1.5}>
          <title>{`${formatDateTime(new Date(p.at))} MYT · ${botOf(p.task)} · ${p.task.name} (${p.kind}) · ${pct(p.usage)}`}</title>
        </circle>
      ))}
      {lane.map((r) => {
        const a = X(Math.max(r.start, x0)), b = X(Math.min(r.end ?? now, x1))
        return (
          <rect key={r.task.id} x={a} y={H + 2} width={Math.max(2, b - a)} height={6} rx={1}
            className={r.overlap ? 'fill-warning' : 'fill-accent/60'}>
            <title>{`${botOf(r.task)} · ${r.task.name}${r.overlap ? ' · overlap' : ''}`}</title>
          </rect>
        )
      })}
    </svg>
    </div>
  )
}

function Seg<T extends string>({ value, onChange, opts, label }: { value: T; onChange: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {opts.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn('inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors duration-150 [@media(pointer:coarse)]:h-10', value === v ? 'bg-surface text-fg shadow-1' : 'text-muted hover:text-fg')}>{l}</button>
      ))}
    </div>
  )
}

export function UsageTimeline({ tasks, resetAt, now }: { tasks: DevlogTask[]; resetAt?: string | null; now: number }) {
  const [week, setWeek] = useState<'cur' | 'prev'>('cur')
  const [range, setRange] = useState<'live' | 'week'>('live')
  const [all, setAll] = useState(false)
  useEffect(() => setAll(false), [week])
  const cur = usageWindow(resetAt, now)
  const win = week === 'cur' ? cur : { start: cur.start - WEEK, end: cur.start }
  const data = useMemo(() => usageTimeline(tasks, win, now), [tasks, win.start, win.end, Math.floor(now / 30000)]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = [...data.rows].reverse()
  const shown = all ? rows : rows.slice(0, TIMELINE_LIMIT)
  const lastPt = data.points.length ? data.points[data.points.length - 1] : null
  const fc = week === 'cur' ? usageForecast(data.latest, lastPt?.at ?? null, win) : null
  const bud = week === 'cur' ? dailyBudget(data.points, win, now) : null
  const change = data.first != null && data.latest != null ? Math.round((data.latest - data.first) * 10) / 10 : null

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 lg:p-5" aria-labelledby="usage-tl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="usage-tl" className="text-[15px] font-semibold tracking-[-0.015em]">Usage timeline</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <Seg label="Usage week" value={week} onChange={setWeek} opts={[['cur', 'This week'], ['prev', 'Previous week']]} />
          {week === 'cur' && <Seg label="Chart range" value={range} onChange={setRange} opts={[['live', 'Last 24h · live'], ['week', 'Week']]} />}
        </div>
      </div>
      <p className="num mb-3 text-xs text-muted">{mytWeekdayTime(win.start)} to {mytWeekdayTime(win.end)} (MYT)</p>
      {!data.points.length ? (
        <>
          {week === 'cur' && range === 'live' && <LiveUsageChart tasks={tasks} now={now} />}
          <p className="py-6 text-center text-sm text-muted">No usage % recorded in this usage week.</p>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-muted">Latest recorded</p>
              <p className="num text-3xl font-semibold tracking-[-0.02em]">{pct(data.latest)}</p>
              <p className="num text-xs text-muted">{change != null && `+${change.toFixed(1)}% since first point (${pct(data.first)})`}</p>
            </div>
            <dl className="num grid grid-cols-2 gap-x-5 text-sm">
              <div><dt className="text-xs text-muted">In logged tasks</dt><dd className="font-semibold">{pct(data.inTasks)}{data.merged && <span className="ml-1 text-xs font-normal text-warning">overlaps merged</span>}</dd></div>
              <div><dt className="text-xs text-muted">Outside tasks (gaps)</dt><dd className="font-semibold">{pct(data.outside)}</dd></div>
            </dl>
            {bud && (
              <div>
                <p className="text-xs text-muted">Today’s session</p>
                <p className={cn('num text-lg font-semibold', bud.balance < 0 ? 'text-warning' : '')}>{bud.balance >= 0 ? `${bud.balance.toFixed(1)}% left this session` : `${(-bud.balance).toFixed(1)}% over this session`}</p>
                <p className="num text-xs text-muted">used {bud.used.toFixed(1)}% of {bud.allowance.toFixed(1)}% · ~{bud.perDayRest.toFixed(1)}%/day to last till reset</p>
              </div>
            )}
            {fc && (
              <div>
                <p className="text-xs text-muted">Forecast at reset</p>
                <p className={cn('num text-lg font-semibold', fc.hitAt ? 'text-warning' : '')}>{fc.hitAt ? `Hits 100% ${mytWeekdayTime(fc.hitAt)}` : pct(fc.atReset)}</p>
                <p className="num text-xs text-muted">at ~{fc.perDay.toFixed(1)}%/day · resets {mytWeekdayTime(win.end)}</p>
              </div>
            )}
          </div>
          {week === 'cur' && range === 'live' ? <LiveUsageChart tasks={tasks} now={now} /> : <StepChart data={data} win={win} zoom={false} now={now} fc={fc} />}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full border-[1.5px] border-accent" />task start</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-accent" />task end</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-accent/60" />task</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-warning" />overlapping task</span>
          </p>

          <ol id="usage-tl-rows" className="mt-4 divide-y divide-border text-sm">
            {shown.map((r) => (
              <li key={r.task.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <time className="num w-[8.5rem] shrink-0 text-xs text-muted" dateTime={r.task.start}>{formatDateTime(r.task.start)}</time>
                  <span className="rounded px-1.5 py-px text-xs font-medium bg-surface-3">{botOf(r.task)}</span>
                  <span className="min-w-0 flex-1 basis-40 break-words">{r.task.name}</span>
                  {r.overlap && <span className="rounded bg-warning-soft px-1.5 py-px text-xs font-medium text-warning">overlap</span>}
                  <span className="num ml-auto whitespace-nowrap text-xs">
                    {pct(r.task.startUsage)} → {r.task.status === 'running' && r.task.endUsage == null ? '…' : pct(r.task.endUsage)}
                    <b className="ml-2 inline-block min-w-[3.2rem] text-right">{r.used == null ? '–' : `${r.used.toFixed(1)}%`}</b>
                  </span>
                </div>
                {r.gapBefore != null && r.gapBefore > 0 && (
                  <p className="num mt-0.5 pl-[8.5rem] text-xs text-warning max-sm:pl-0">+{r.gapBefore.toFixed(1)}% outside logged tasks since {mytHHMM(new Date(r.prevAt!).toISOString())}</p>
                )}
              </li>
            ))}
          </ol>
          {rows.length > TIMELINE_LIMIT && (
            <button type="button" aria-expanded={all} aria-controls="usage-tl-rows"
              className="mt-1 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => setAll((a) => !a)}>{all ? 'Show less' : `Show all (${rows.length})`}</button>
          )}
          <p className="mt-2 text-xs text-muted">Usage % is account-wide. “In logged tasks” merges overlapping tasks (all bots) so a shared rise counts once: each run costs its highest end % minus its lowest start %. A gap is the rise from the highest % recorded before a run of tasks to the run’s lowest start %, shown on the run’s first task: usage spent outside logged tasks (chats, unlogged work). Per-task “used” is that task alone. Times are MYT; newest first.</p>
        </>
      )}
    </section>
  )
}
