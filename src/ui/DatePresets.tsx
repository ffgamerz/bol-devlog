import { ChipRow, FilterChip } from './Chips'
import { DateInput } from './DateInput'
import type { DatePreset } from '@/lib/date'

/**
 * Date filter: Today / Last 7 days / Last 30 days, then Custom (from–to with DateInput).
 * Controlled; pair with useUrlFilters so the choice lives in the URL.
 */
export function DatePresets({ label, preset, from, to, onChange }: {
  label?: string; preset: DatePreset; from: string; to: string
  onChange: (v: { preset: DatePreset; from: string; to: string }) => void
}) {
  const pick = (p: DatePreset) => onChange({ preset: preset === p ? '' : p, from: p === 'custom' ? from : '', to: p === 'custom' ? to : '' })
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      <ChipRow>
        <FilterChip active={preset === 'today'} onClick={() => pick('today')}>Today</FilterChip>
        <FilterChip active={preset === '7d'} onClick={() => pick('7d')}>Last 7 days</FilterChip>
        <FilterChip active={preset === '14d'} onClick={() => pick('14d')}>Last 2 weeks</FilterChip>
        <FilterChip active={preset === '30d'} onClick={() => pick('30d')}>Last 30 days</FilterChip>
        <FilterChip active={preset === 'custom'} onClick={() => pick('custom')}>Custom</FilterChip>
      </ChipRow>
      {preset === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <DateInput label="From" value={from} max={to || undefined} clearable onChange={(v) => onChange({ preset, from: v, to })} />
          <DateInput label="To" value={to} min={from || undefined} clearable showToday onChange={(v) => onChange({ preset, from, to: v })} />
        </div>
      )}
    </div>
  )
}
