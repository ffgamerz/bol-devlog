import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/app/PageHeader'
import { billedTokens, byProject, compact, getClaude, rankSessions, type ClaudeSample, type ClaudeState, type Range } from '@/data/claude'
import { relTime } from '@/data/devlog'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/cn'
import { Badge, FilterChip } from '@/ui/Chips'
import { RowSkeleton } from '@/ui/Skeleton'
import { EmptyState, ErrorState } from '@/ui/States'

const POLL_MS = 15_000
const pct = (v: number) => `${v.toFixed(1)}%`

function useClaude() {
  const [st, setSt] = useState<ClaudeState | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const busy = useRef(false)
  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try { setSt(await getClaude()); setErr(null) } catch (e) { setErr((e as Error).message) } finally { busy.current = false; setLoaded(true) }
  }, [])
  useEffect(() => {
    load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [load])
  return { st, loaded, err, reload: load }
}

function Limit({ label, pctNow, resetsAt, now }: { label: string; pctNow: number; resetsAt: string; now: number }) {
  const left = Math.max(0, Date.parse(resetsAt) - now)
  const h = Math.floor(left / 3600_000), m = Math.floor((left % 3600_000) / 60_000)
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('num mt-1 text-3xl font-semibold', pctNow >= 90 ? 'text-danger' : pctNow >= 75 ? 'text-warning' : '')}>{pct(pctNow)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(pctNow)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pctNow)}%` }} />
      </div>
      <p className="num mt-2 text-xs text-muted">resets in {h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${String(m).padStart(2, '0')}m`} · {formatDateTime(resetsAt)} MYT</p>
    </div>
  )
}

/** Step line of both percentages over the last 24 hours. */
function Timeline({ samples, now }: { samples: ClaudeSample[]; now: number }) {
  const W = 640, H = 140, PL = 28, PR = 8, PT = 8, PB = 18
  const from = now - 24 * 3600_000
  const pts = samples.filter((s) => Date.parse(s.at) >= from)
  if (pts.length < 2) return <p className="text-sm text-muted">The chart appears after a few reports.</p>
  const X = (t: number) => PL + ((t - from) / (now - from)) * (W - PL - PR)
  const Y = (v: number) => PT + (1 - v / 100) * (H - PT - PB)
  const path = (k: 'five' | 'week') => pts.map((p, i) => `${i ? 'L' : 'M'}${X(Date.parse(p.at)).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ')
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="5-hour and weekly percent over the last 24 hours">
        {[0, 50, 100].map((v) => <g key={v}><line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="var(--c-border, #888)" strokeOpacity=".35" strokeDasharray="3 4" /><text x={PL - 4} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity=".6">{v}</text></g>)}
        <path d={path('week')} fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
        <path d={path('five')} fill="none" className="stroke-accent" strokeWidth="2" />
        <text x={PL} y={H - 4} fontSize="9" fill="currentColor" opacity=".6">24h ago</text>
        <text x={W - PR} y={H - 4} textAnchor="end" fontSize="9" fill="currentColor" opacity=".6">now</text>
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted"><span><i className="mr-1 inline-block h-0.5 w-4 bg-accent align-middle" />5-hour</span><span><i className="mr-1 inline-block h-0.5 w-4 bg-current align-middle opacity-50" />Weekly</span></figcaption>
    </figure>
  )
}

export default function ClaudePage() {
  const { st, loaded, err, reload } = useClaude()
  const [range, setRange] = useState<Range>('week')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(id) }, [])
  const sessions = useMemo(() => rankSessions(st, range, now), [st, range, now])
  const projects = useMemo(() => byProject(sessions), [sessions])
  const key = range === 'five' ? 'five' : 'week'
  const max = Math.max(0.1, ...sessions.map((s) => s[key]))
  const subtitle = st?.updated ? <>Percent of the Claude plan limits, by session. Last report {relTime(st.updated, now)}.</> : 'Percent of the Claude plan limits, by session.'

  return (
    <div>
      <PageHeader title="Claude" subtitle={subtitle} />
      {!loaded ? <RowSkeleton rows={5} />
        : err && !st ? <ErrorState message={err} onRetry={reload} />
        : !st || !st.sessions?.length ? <EmptyState title="No sessions yet" message="Claude Code sessions on your Mac report here after each reply once the hook is installed." />
        : (
          <div className="space-y-6">
            {st.last && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Limit label="5-hour session" pctNow={st.last.five.pct} resetsAt={st.last.five.resetsAt} now={now} />
                <Limit label="Weekly limit" pctNow={st.last.week.pct} resetsAt={st.last.week.resetsAt} now={now} />
              </div>
            )}
            <section className="rounded-xl border border-border bg-surface p-4"><h2 className="mb-2 text-sm font-medium">Last 24 hours</h2><Timeline samples={st.samples ?? []} now={now} /></section>

            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-sm font-medium">Who used it</h2>
                <FilterChip active={range === 'five'} onClick={() => setRange('five')}>This 5 hours</FilterChip>
                <FilterChip active={range === 'week'} onClick={() => setRange('week')}>This week</FilterChip>
                <FilterChip active={range === 'all'} onClick={() => setRange('all')}>All time</FilterChip>
              </div>
              {!sessions.length ? <p className="text-sm text-muted">No sessions in this range.</p> : (
                <>
                  <ul className="mb-4 divide-y divide-border rounded-xl border border-border bg-surface" aria-label="Projects">
                    {projects.map((p) => (
                      <li key={p.project} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.project}</span>
                        <span className="num text-xs text-muted">{p.sessions} session{p.sessions === 1 ? '' : 's'} · {compact(p.tokens)} tokens</span>
                        <span className="num w-16 text-right text-sm font-semibold">{pct(range === 'five' ? p.five : p.week)}</span>
                      </li>))}
                  </ul>
                  <ul className="divide-y divide-border rounded-xl border border-border bg-surface" aria-label="Sessions">
                    {sessions.map((s) => (
                      <li key={s.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title || s.project}{s.title && <span className="ml-2 font-normal text-muted">{s.project}</span>}</span>
                          {/* the desktop app rarely fires SessionEnd, so 'running' only counts while it reported in the last 10 minutes */}
                          {s.status === 'running' && Date.now() - Date.parse(s.last) < 600_000 && <Badge tone="info">Active</Badge>}
                          <span className="num text-sm font-semibold">{pct(s[key])}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent" style={{ width: `${(s[key] / max) * 100}%` }} /></div>
                        <p className="num mt-1.5 text-xs text-muted">5h {pct(s.five)} · week {pct(s.week)} · {compact(billedTokens(s.tokens))} tokens (+{compact(s.tokens.cacheRead)} cached reads) · {s.turns} turns · {s.model ?? ''} · {formatDateTime(s.start)}</p>
                      </li>))}
                  </ul>
                </>)}
            </section>
          </div>)}
    </div>
  )
}
