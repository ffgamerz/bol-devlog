import { searchWords } from '@/lib/searchWords'

/** Highlight every typed word in text (case-insensitive, any order) with the tight teal mark. */
export function Hl({ text, q }: { text: string; q: string }) {
  const ws = searchWords(q).sort((a, b) => b.length - a.length); if (!ws.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig'))
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="m-hl rounded-[3px] bg-[color-mix(in_oklab,var(--c-accent)_20%,transparent)] px-0 text-accent-text">{p}</mark> : p))}</>
}
