import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, Bot, Captions, Layers, CheckCircle2, FilePen, FileText, GitCommitHorizontal, Loader2, Rocket, Terminal, TriangleAlert, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/app/PageHeader'
import { UsageTimeline } from './UsageTimeline'
import { botOf, usageSummary, mytWeekdayTime, untilText, usageWindow, collectorAlive, duration, getDevlog, groupByTask, overlaps, relTime, usageUsed, type DevlogEvent, type DevlogKind, type DevlogSnapshot, type DevlogTask } from '@/data/devlog'
import { formatDateTime, mytHHMM } from '@/lib/date'
import { useUrlFilters } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { Badge, FilterChip } from '@/ui/Chips'
import { RowSkeleton } from '@/ui/Skeleton'
import { EmptyState, ErrorState } from '@/ui/States'

const POLL_MS = 3000
const KIND: Record<DevlogKind, { icon: LucideIcon; label: string; cls: string }> = {
  commit: { icon: GitCommitHorizontal, label: 'Commit', cls: 'text-accent-text bg-accent-soft' },
  deploy: { icon: Rocket, label: 'Deploy', cls: 'text-success bg-success-soft' },
  step: { icon: Terminal, label: 'Step', cls: 'text-info bg-info-soft' },
  change: { icon: FileText, label: 'Change', cls: 'text-muted bg-surface-3' },
  srt: { icon: Captions, label: 'SRT', cls: 'text-muted bg-surface-3' },
  error: { icon: TriangleAlert, label: 'Error', cls: 'text-danger bg-danger-soft' },
}

/** Polls /api/devlog every 3 s while the tab is visible (no page reload). */
function useDevlog() {
  const [snap, setSnap] = useState<DevlogSnapshot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const busy = useRef(false)
  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try { setSnap(await getDevlog()); setErr(null) } catch (e) { setErr((e as Error).message) } finally { busy.current = false; setLoaded(true) }
  }, [])
  useEffect(() => {
    load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    const vis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', vis)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [load])
  return { snap, loaded, err, reload: load }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id) }, [ms])
  return now
}

function EventRow({ e, now }: { e: DevlogEvent; now: number }) {
  const k = KIND[e.kind] ?? KIND.step
  const Icon = k.icon
  return (
    <li className="flex gap-3 py-2.5">
      <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full [&>svg]:size-3.5', k.cls)} aria-label={k.label}><Icon /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug break-words">
          {e.hash && <code className="num mr-1.5 rounded bg-surface-3 px-1 py-0.5 text-xs">{e.hash}</code>}
          {e.url ? <a href={e.url} target="_blank" rel="noreferrer" className="underline decoration-border-strong underline-offset-2 hover:text-accent-text">{e.title}</a> : e.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted break-words">
          {e.bot && e.bot.toLowerCase() !== e.repo.toLowerCase() && <span className="rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent-text">{e.bot}</span>}
          <span className="rounded-full bg-surface-3 px-1.5 py-px font-medium">{e.repo}</span>
          {[e.files != null ? `${e.files} file${e.files === 1 ? '' : 's'}` : '', e.detail].filter(Boolean).join(' · ')}
        </p>
      </div>
      <time dateTime={e.at} title={`${formatDateTime(e.at)} MYT`} className="num shrink-0 pt-0.5 text-xs text-muted">{relTime(e.at, now)}</time>
    </li>
  )
}

const pct = (v: number | null | undefined) => (v == null ? '–' : `${v.toFixed(1)}%`)
const STATUS = {
  running: { tone: 'info' as const, icon: Loader2, label: 'Running', spin: true },
  done: { tone: 'success' as const, icon: CheckCircle2, label: 'Done', spin: false },
  failed: { tone: 'danger' as const, icon: XCircle, label: 'Failed', spin: false },
}

function TaskHeader({ t, now, overlap }: { t: DevlogTask; now: number; overlap?: DevlogTask[] }) {
  const st = STATUS[t.status] ?? STATUS.done
  const Icon = st.icon
  const start = Date.parse(t.start)
  const end = t.end ? Date.parse(t.end) : now
  const used = usageUsed(t)
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent"><Bot className="size-3" aria-hidden />{botOf(t)}</Badge>
        <h2 className="min-w-0 flex-1 basis-40 text-[15px] font-semibold tracking-[-0.015em] break-words">{t.name}</h2>
        {!!overlap?.length && (
          <span title={`Ran at the same time as ${overlap.map((o) => `${botOf(o)}: ${o.name}`).join('; ')}. Usage % is account-wide, so these numbers include each other's work.`}>
            <Badge tone="warning"><Layers className="size-3" aria-hidden />overlap</Badge>
          </span>
        )}
        <Badge tone={st.tone}><Icon className={cn('size-3', st.spin && 'animate-spin')} aria-hidden />{st.label}</Badge>
      </div>
      <dl className="num mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div><dt className="text-muted">Time (MYT)</dt><dd title={formatDateTime(t.start)}>{mytHHMM(t.start)}{t.end ? `–${mytHHMM(t.end)}` : ' – now'}</dd></div>
        <div><dt className="text-muted">Duration</dt><dd>{duration(end - start)}</dd></div>
        <div><dt className="text-muted">Usage</dt><dd>{pct(t.startUsage)} → {t.status === 'running' && t.endUsage == null ? '…' : pct(t.endUsage)}</dd></div>
        <div><dt className="text-muted">Used</dt><dd className="font-semibold">{used == null ? '–' : `${used.toFixed(1)}%`}</dd></div>
      </dl>
    </div>
  )
}

const MergedMark = ({ on }: { on: boolean }) => on ? <span className="ml-1 inline-flex align-[-1px] text-warning" title="Overlapping tasks merged (counted once)" aria-label="overlapping tasks merged"><Layers className="size-3" aria-hidden /></span> : null

export default function DevLogPage() {
  const { snap, loaded, err, reload } = useDevlog()
  const now = useNow()
  const [more, setMore] = useState<Record<string, boolean>>({})
  const { values: view, set: setView } = useUrlFilters({ bot: '' })
  const bot = view.bot
  const setBot = (b: string) => setView({ bot: b })
  const tasks = snap?.tasks ?? []
  const resetAt = snap?.config?.resetAt
  const win = usageWindow(resetAt, now)
  const usage = usageSummary(tasks, now, resetAt)
  const summary = usage.bots
  const ov = overlaps(tasks, now)
  const all = groupByTask(snap, now)
  const groups = bot ? all.filter((g) => g.task && botOf(g.task) === bot) : all
  const alive = collectorAlive(snap, now)
  const dirtyRepos = Object.entries(snap?.repos ?? {}).filter(([, r]) => r.dirtyCount)

  const subtitle = snap ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={cn('inline-block size-2 rounded-full', alive ? 'bg-success animate-pulse' : 'bg-warning')} aria-hidden />
      {alive ? 'Live' : 'Collector offline'} · updated {relTime(snap.updated, now)} · times in Malaysia time
      {snap.srt && <Badge tone={snap.srt.running ? 'success' : 'neutral'}>SRT worker {snap.srt.running ? 'running' : 'stopped'}</Badge>}
    </span>
  ) : 'Live view of the Technical bot’s coding work, grouped by task.'

  return (
    <div>
      <PageHeader title="Dev log" subtitle={subtitle} />
      {!loaded ? <RowSkeleton rows={5} />
        : err && !snap ? <ErrorState message={err} onRetry={reload} />
        : !all.length ? <EmptyState title="No activity yet" message="Tasks, commits, deploys and steps from the box will appear here within a few seconds." />
        : (
          <>
            {summary.length > 0 && (
              <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 lg:p-5" aria-label="Usage by bot">
                <p className="mb-3 text-sm">
                  <span className="font-semibold">This usage week:</span>{' '}
                  <span className="num">{mytWeekdayTime(win.start)} to {mytWeekdayTime(win.end)} (MYT)</span>
                  <span className="num ml-2 text-xs text-muted">, resets in {untilText(win.end - now)}</span>
                </p>
                <dl className="divide-y divide-border sm:hidden">
                  {summary.map((x) => (
                    <div key={x.bot} className="py-2">
                      <dt className="text-sm font-medium">{x.bot}{x.running > 0 && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-info align-middle" title="Task running" />}</dt>
                      <dd className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted">
                        <span>Today <b className="num text-fg">{x.today.tasks}</b> · <b className="num text-fg">{x.today.used.toFixed(1)}%</b><MergedMark on={x.today.merged} /></span>
                        <span>Usage week <b className="num text-fg">{x.week.tasks}</b> · <b className="num text-fg">{x.week.used.toFixed(1)}%</b><MergedMark on={x.week.merged} /></span>
                      </dd>
                    </div>
                  ))}
                  {summary.length > 1 && (
                    <div className="py-2">
                      <dt className="text-sm font-semibold">All bots</dt>
                      <dd className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted">
                        <span>Today <b className="num text-fg">{usage.account.today.tasks}</b> · <b className="num text-fg">{usage.account.today.used.toFixed(1)}%</b><MergedMark on={usage.account.today.merged} /></span>
                        <span>Usage week <b className="num text-fg">{usage.account.week.tasks}</b> · <b className="num text-fg">{usage.account.week.used.toFixed(1)}%</b><MergedMark on={usage.account.week.merged} /></span>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="num w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted"><th className="pb-1.5 font-medium">Bot</th><th className="pb-1.5 text-right font-medium">Today</th><th className="pb-1.5 pl-3 text-right font-medium"><span className="sm:hidden">Usage week</span><span className="max-sm:hidden">This usage week</span></th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {summary.map((x) => (
                        <tr key={x.bot}>
                          <td className="py-1.5 pr-2 font-medium">{x.bot}{x.running > 0 && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-info align-middle" title="Task running" />}</td>
                          <td className="py-1.5 text-right whitespace-nowrap">{x.today.tasks}<span className="max-sm:hidden"> task{x.today.tasks === 1 ? '' : 's'}</span> · <b>{x.today.used.toFixed(1)}%</b><MergedMark on={x.today.merged} /></td>
                          <td className="py-1.5 pl-3 text-right whitespace-nowrap">{x.week.tasks} · <b>{x.week.used.toFixed(1)}%</b><MergedMark on={x.week.merged} /></td>
                        </tr>
                      ))}
                    </tbody>
                    {summary.length > 1 && (
                      <tfoot className="border-t-2 border-border-strong">
                        <tr>
                          <td className="pt-2 pr-2 font-semibold">All bots</td>
                          <td className="pt-2 text-right whitespace-nowrap">{usage.account.today.tasks} · <b>{usage.account.today.used.toFixed(1)}%</b><MergedMark on={usage.account.today.merged} /></td>
                          <td className="pt-2 pl-3 text-right whitespace-nowrap">{usage.account.week.tasks} · <b>{usage.account.week.used.toFixed(1)}%</b><MergedMark on={usage.account.week.merged} /></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">Usage % is the whole account’s weekly usage, not per bot. Tasks that ran at the same time (marked <b>overlap</b>) are merged before adding up: each run of overlapping tasks counts once, as its highest end % minus its lowest start % (<Layers className="inline size-3 align-[-1px] text-warning" aria-hidden /> = overlapping tasks merged). “All bots” merges across bots, so it never exceeds the real rise. Running tasks and tasks without both % count as tasks but add no usage. Numbers are tasks · usage %. “This usage week” runs from one weekly usage reset to the next.</p>
              </section>
            )}
            {tasks.length > 0 && <UsageTimeline tasks={tasks} resetAt={resetAt} now={now} />}
            {summary.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <FilterChip active={!bot} onClick={() => setBot('')}>All</FilterChip>
                {summary.map((x) => <FilterChip key={x.bot} active={bot === x.bot} onClick={() => setBot(bot === x.bot ? '' : x.bot)}>{x.bot}</FilterChip>)}
              </div>
            )}
            <div className="space-y-4">
              {groups.map((g) => {
                const key = g.task?.id ?? 'other'
                const list = more[key] ? g.events : g.events.slice(0, 12)
                const running = g.task?.status === 'running'
                return (
                  <section key={key} aria-current={running ? 'true' : undefined}
                    className={cn('rounded-[var(--radius-lg)] border bg-surface p-4 lg:p-5', running ? 'border-info ring-2 ring-info/25' : 'border-border')}>
                    {g.task ? <TaskHeader t={g.task} now={now} overlap={ov.get(g.task.id)} /> : (
                      <div className="mb-1 flex items-center gap-2"><Activity className="size-4 text-muted" aria-hidden /><h2 className="text-[15px] font-semibold tracking-[-0.015em]">Other activity</h2></div>
                    )}
                    {list.length > 0 ? <ul className="divide-y divide-border">{list.map((e) => <EventRow key={e.id} e={e} now={now} />)}</ul>
                      : <p className="py-2 text-sm text-muted">{running ? 'Waiting for the first step…' : 'No events logged.'}</p>}
                    {g.events.length > 12 && (
                      <button type="button" className="mt-1 min-h-11 text-sm font-medium text-accent-text" onClick={() => setMore((m) => ({ ...m, [key]: !m[key] }))}>
                        {more[key] ? 'Show less' : `Show all ${g.events.length}`}
                      </button>
                    )}
                  </section>
                )
              })}
              {dirtyRepos.length > 0 && (
                <details className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 text-sm lg:px-5">
                  <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-muted"><FilePen className="size-3.5" /> Uncommitted work in {dirtyRepos.map(([n, r]) => `${n} (${r.dirtyCount})`).join(', ')}</summary>
                  {dirtyRepos.map(([n, r]) => (
                    <div key={n} className="mt-2">
                      <p className="text-xs font-semibold">{n}{r.ahead ? <span className="ml-2 font-normal text-warning">{r.ahead} not pushed</span> : null}</p>
                      <ul className="mt-1 space-y-0.5 text-xs break-all">{(r.dirty ?? []).map((f) => <li key={f} className="font-mono">{f}</li>)}</ul>
                    </div>
                  ))}
                </details>
              )}
            </div>
            {err && <p role="status" className="mt-3 text-xs text-warning">Last refresh failed: {err}. Retrying…</p>}
          </>
        )}
    </div>
  )
}
