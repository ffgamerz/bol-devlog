/** Word-by-word title search: every typed word must appear somewhere in the title (any order, case-insensitive). */
export const MAX_WORDS = 8
/** 'Pes  pajeri' -> ['pes', 'pajeri'] (deduped, max 8). Double quotes (straight or curly) are dropped, so "botol" finds botol. PostgREST wildcard '*' and LIKE escapes are stripped/escaped later. */
export function searchWords(q: string): string[] {
  return [...new Set(q.toLowerCase().replace(/[*"“”„″]/g, ' ').split(/[\s,()]+/).filter(Boolean))].slice(0, MAX_WORDS)
}
/** One ILIKE pattern per word, with LIKE specials (% _ \) escaped so they match literally. */
export const likePatterns = (q: string) => searchWords(q).map((w) => `%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
/** Apply AND-of-ILIKE per word to a supabase/PostgREST query builder. */
export function titleWords<T extends { ilike(c: string, v: string): T }>(q: T, text: string, col = 'title'): T {
  let r = q
  for (const p of likePatterns(text)) r = r.ilike(col, p)
  return r
}
/** Client-side twin (tests, local filtering). */
export const matchesWords = (title: string, q: string) => { const t = title.toLowerCase(); return searchWords(q).every((w) => t.includes(w)) }
