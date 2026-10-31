import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { botOf, DAY_MS, liveSeries, mytTicks, type DevlogTask, type UsagePoint } from '@/data/devlog'
import { formatDateTime } from '@/lib/date'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'

const H = 280, PT = 12, PB = 22, AXIS = 40, LANE = 16, PADL = 18, PADR = 22 // pads keep the first/last time labels inside the scroller
const pct = (v: number) => `${v.toFixed(1)}%`

/**
 * Live 24-hour usage chart. Fixed scale (≈2 h visible on phones, ≈4 h on desktop), scrolls sideways back to now − 24 h.
 * Ends at now and moves every minute; stays pinned to now unless the user scrolled away (then a "Now →" button).
 * The y-axis sits outside the scroller so it stays put; the task strip is inside the same SVG so it scrolls in sync.
 */
export function LiveUsageChart({ tasks, now }: { tasks: DevlogTask[]; now: number }) {
  const minute = Math.floor(now / 60000) * 60000
  const phone = !useMediaQuery('(min-width: 640px)')
  const scroller = useRef<HTMLDivElement>(null)
  const [viewW, setViewW] = useState(320)
  const pinned = useRef(true)
  const [away, setAway] = useState(false)
  const [sel, setSel] = useState<UsagePoint | null>(null)

  useEffect(() => {
    const el = scroller.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setViewW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  const hoursVisible = phone ? 2 : 4
  const pxPerMs = viewW / (hoursVisible * 3600000)
  const W = Math.round(PADL + DAY_MS * pxPerMs + PADR)
  const s = useMemo(() => liveSeries(tasks, minute), [tasks, minute])
  const X = (t: number) => PADL + (t - s.from) * pxPerMs

  const vals = [...s.points.map((p) => p.usage), ...(s.carry ? [s.carry.usage] : [])]
  const lo = vals.length ? Math.floor(Math.min(...vals) - 0.5) : 0
  const hi = vals.length ? Math.ceil(Math.max(...vals) + 0.5) : 1
  const ys = hi - lo <= 4 ? 0.5 : Math.ceil((hi - lo) / 5)
  const yTicks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += ys) yTicks.push(Math.round(v * 10) / 10)
  const Y = (v: number) => PT + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - PT - PB)

  // Step line: starts at the left edge from the last level before the window, holds between points, runs on to now.
  let d = ''
  const seq = s.carry ? [{ at: s.from, usage: s.carry.usage }, ...s.points] : s.points
  seq.forEach((p, i) => { d += i === 0 ? `M${X(p.at)},${Y(p.usage)}` : `H${X(p.at)}V${Y(p.usage)}` })
  if (seq.length) d += `H${X(s.to)}`
  const ticks = mytTicks(s.from, s.to, 30 * 60000)

  // Keep the view: pinned → stick to the right edge; scrolled away → shift back by the minute the window moved.
  const prevFrom = useRef(s.from)
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return
    if (pinned.current) el.scrollLeft = el.scrollWidth
    else el.scrollLeft -= (s.from - prevFrom.current) * pxPerMs
    prevFrom.current = s.from
  }, [s.from, W, pxPerMs])
  const gliding = useRef(0) // while "Now →" smooth-scrolls, in-between positions must not unpin
  const onScroll = () => {
    const el = scroller.current; if (!el) return
    const atEnd = el.scrollWidth - el.clientWidth - el.scrollLeft < 12
    if (gliding.current && !atEnd && Date.now() < gliding.current) return
    gliding.current = 0
    pinned.current = atEnd; setAway(!atEnd)
  }
  const toNow = () => {
    const el = scroller.current; if (!el) return
    pinned.current = true; setAway(false); gliding.current = Date.now() + 1500
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }

  const lanes = s.lanes
  const totalH = H + LANE
  return (
    <div>
      <p className="num mb-1 min-h-5 text-xs text-muted" aria-live="polite">
        {sel ? <>{formatDateTime(new Date(sel.at))} · <b className="text-fg">{botOf(sel.task)}</b> · {sel.task.name} ({sel.kind}) · <b className="text-fg">{pct(sel.usage)}</b></>
          : phone ? 'Tap a dot for details · swipe left for earlier hours' : 'Hover a dot for details · scroll left for earlier hours'}
      </p>
      <div className="relative flex">
        <svg width={AXIS} height={totalH} className="shrink-0" aria-hidden>
          {yTicks.map((v) => <text key={v} x={AXIS - 6} y={Y(v) + 3} textAnchor="end" className="num fill-muted text-[10px]">{Number.isInteger(v) ? v : v.toFixed(1)}</text>)}
        </svg>
        <div ref={scroller} onScroll={onScroll} data-testid="live-scroller"
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
          <svg width={W} height={totalH} role="img" aria-label="Usage % over the last 24 hours" onClick={(e) => { if ((e.target as Element).tagName !== 'circle') setSel(null) }}>
            {yTicks.map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} className="stroke-border" strokeWidth={1} />)}
            {ticks.map((t) => (
              <g key={t.t}>
                <line x1={X(t.t)} x2={X(t.t)} y1={PT} y2={H - PB} className={t.day ? 'stroke-border-strong' : 'stroke-border'} strokeWidth={1} strokeDasharray={t.day ? undefined : '2 4'} />
                <text x={X(t.t)} y={H - 6} textAnchor="middle" className={cn('num text-[10px]', t.day ? 'fill-fg font-semibold' : 'fill-muted')}>{t.label}</text>
              </g>
            ))}
            <line x1={X(s.to)} x2={X(s.to)} y1={PT - 4} y2={H - PB} className="stroke-info" strokeWidth={1} strokeDasharray="3 3" />
            <text x={X(s.to) - 4} y={PT + 4} textAnchor="end" className="fill-info text-[10px] font-semibold">now</text>
            <text x={PADL} y={PT + 4} className="num fill-muted text-[10px]">{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short' }).format(s.from)}</text>
            {!s.carry && s.points.length > 0 && (() => {
              // Before the first recorded % there is no line; say so instead of leaving a blank grid.
              const end = s.points[0].at - 30 * 60000, out = []
              for (let t = end; t > s.from + 20 * 60000; t -= 2 * 3600000) out.push(<text key={t} x={X(t)} y={(H - PB + PT) / 2} textAnchor="end" className="fill-faint text-[11px]">No usage % recorded yet ←</text>)
              return out
            })()}
            {d && <path d={d} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />}
            {s.points.map((p, i) => (
              <g key={i} onMouseEnter={() => setSel(p)} onClick={() => setSel(p)} onFocus={() => setSel(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(p) } }}
                tabIndex={0} role="button" aria-label={`${formatDateTime(new Date(p.at))} MYT, ${botOf(p.task)}, ${p.task.name} (${p.kind}), ${pct(p.usage)}`}
                className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-accent">
                <circle cx={X(p.at)} cy={Y(p.usage)} r={12} fill="transparent" />
                <circle cx={X(p.at)} cy={Y(p.usage)} r={sel === p ? 5 : 3.5} className={p.kind === 'start' ? 'fill-surface stroke-accent' : 'fill-accent stroke-accent'} strokeWidth={1.5}>
                  <title>{`${formatDateTime(new Date(p.at))} MYT · ${botOf(p.task)} · ${p.task.name} (${p.kind}) · ${pct(p.usage)}`}</title>
                </circle>
              </g>
            ))}
            {lanes.map((l) => {
              const a = X(Math.max(l.start, s.from)), b = X(Math.min(l.end, s.to))
              return (
                <rect key={l.task.id} x={a} y={H + 3} width={Math.max(3, b - a)} height={7} rx={1.5} className={l.overlap ? 'fill-warning' : 'fill-accent/60'}>
                  <title>{`${botOf(l.task)} · ${l.task.name}${l.overlap ? ' · overlap' : ''}`}</title>
                </rect>
              )
            })}
            {!s.points.length && !s.carry && <text x={W - viewW / 2} y={H / 2} textAnchor="middle" className="fill-muted text-xs">No usage % recorded in the last 24 hours</text>}
          </svg>
        </div>
        {away && (
          <button type="button" onClick={toNow}
            className="absolute right-2 top-2 inline-flex h-8 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-accent-text shadow-1 transition-opacity duration-150 [@media(pointer:coarse)]:h-10">
            Now →
          </button>
        )}
      </div>
    </div>
  )
}
