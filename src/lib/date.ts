const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-23" (or ISO timestamp) → "23 Oct 2026". Empty/invalid → ''. No timezone shift for date-only values. */
export function formatDate(v: string | null | undefined): string {
  if (!v) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return ''
  const [, y, mo, d] = m
  const mi = Number(mo) - 1
  if (mi < 0 || mi > 11) return ''
  return `${Number(d)} ${MONTHS[mi]} ${y}`
}

/** How long a video keeps the "NEW" badge after its record date (2 weeks). */
export const NEW_VIDEO_DAYS = 14

/**
 * True when a record ("created_at" — the date the video was added/edited in BOL Studio,
 * date-only or ISO) falls in the last `days` days. Today counts; future dates are not new.
 */
export function isNewRecord(created_at: string | null | undefined, days = NEW_VIDEO_DAYS, now = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(created_at ?? '')
  if (!m) return false
  const [, y, mo, d] = m
  const mi = Number(mo) - 1
  if (mi < 0 || mi > 11) return false
  const then = new Date(Number(y), mi, Number(d)).getTime()
  if (Number.isNaN(then)) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diff = Math.round((today - then) / 86_400_000)
  return diff >= 0 && diff < days
}

/** Today in the user's local zone as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export type DatePreset = '' | 'today' | '7d' | '14d' | '30d' | 'custom'
/** Inclusive [from, to] ISO range for a preset (local dates). */
export function presetRange(p: DatePreset, now = new Date()): { from: string; to: string } | null {
  if (p === 'today') return { from: todayISO(now), to: todayISO(now) }
  if (p === '7d' || p === '14d' || p === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - (p === '7d' ? 6 : p === '14d' ? 13 : 29))
    return { from: todayISO(d), to: todayISO(now) }
  }
  return null
}

export const APP_TZ = 'Asia/Kuala_Lumpur'
function mytParts(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return null
  const o: Record<string, string> = {}
  for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d)) o[x.type] = x.value
  return { year: o.year, month: o.month.slice(0, 3), day: o.day, hour: o.hour, minute: o.minute, ampm: (o.dayPeriod ?? '').toUpperCase() }
}
/** ISO timestamp → "23 Oct, 9:14 PM" in Malaysia time (independent of the device zone). */
/** ISO timestamp → "26 Oct 2026, 5:00 PM" in Malaysia time. */
export function formatDateTimeFull(v: string | Date | null | undefined): string {
  if (!v) return ''
  const p = mytParts(v)
  return p ? `${p.day} ${p.month} ${p.year}, ${Number(p.hour)}:${p.minute} ${p.ampm}` : ''
}
/** ISO timestamp → "17:00" (24h, Malaysia time); '' if empty/invalid. */
export function mytHHMM(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v); if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}
/** "2026-10-26" + "17:00" → "2026-10-26T17:00:00+08:00"; null if either is missing. */
export function mytTimestamp(date: string | null | undefined, hhmm: string | null | undefined): string | null {
  return date && hhmm && /^\d{2}:\d{2}$/.test(hhmm) ? `${date.slice(0, 10)}T${hhmm}:00+08:00` : null
}
export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return ''
  const p = mytParts(v)
  return p ? `${p.day} ${p.month}, ${Number(p.hour)}:${p.minute} ${p.ampm}` : ''
}
