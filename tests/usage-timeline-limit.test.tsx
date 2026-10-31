import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { TIMELINE_LIMIT, UsageTimeline } from '../src/features/devlog/UsageTimeline'
import type { DevlogTask } from '../src/data/devlog'

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
afterEach(cleanup)

it('Usage timeline lists only the 5 newest tasks, with a Show all (N) / Show less toggle', () => {
  const now = Date.parse('2026-10-29T09:00:00Z')
  const tasks: DevlogTask[] = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`, name: `Task ${i}`, bot: 'Technical', status: 'done' as const,
    start: new Date(now - (8 - i) * 3600000).toISOString(), end: new Date(now - (8 - i) * 3600000 + 600000).toISOString(),
    startUsage: 80 + i * 0.2, endUsage: 80 + i * 0.2 + 0.1,
  }))
  const { container } = render(<UsageTimeline tasks={tasks} resetAt="2026-10-30T08:32:00Z" now={now} />)
  const items = () => [...container.querySelectorAll('#usage-tl-rows > li')].map((li) => li.textContent ?? '')
  expect(TIMELINE_LIMIT).toBe(5)
  expect(items()).toHaveLength(5)
  expect(items()[0]).toContain('Task 7') // newest first
  expect(items().some((t) => t.includes('Task 2'))).toBe(false)
  const btn = screen.getByRole('button', { name: 'Show all (8)' })
  expect(btn.getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(btn)
  expect(items()).toHaveLength(8)
  fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
  expect(items()).toHaveLength(5)
})

it('no toggle when there are 5 or fewer tasks', () => {
  const now = Date.parse('2026-10-29T09:00:00Z')
  const tasks: DevlogTask[] = [0, 1, 2].map((i) => ({ id: `t${i}`, name: `Task ${i}`, bot: 'PA', status: 'done' as const,
    start: new Date(now - (3 - i) * 3600000).toISOString(), end: new Date(now - (3 - i) * 3600000 + 600000).toISOString(), startUsage: 80 + i, endUsage: 80.5 + i }))
  render(<UsageTimeline tasks={tasks} resetAt="2026-10-30T08:32:00Z" now={now} />)
  expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull()
})
