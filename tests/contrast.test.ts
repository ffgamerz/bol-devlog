import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../src/styles/tokens.css'), 'utf8')
function block(selector: RegExp) {
  const m = css.match(selector)
  if (!m) throw new Error('missing block')
  const vars: Record<string, string> = {}
  for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[k] = v
  return vars
}
const themes = {
  light: block(/:root, \.light \{([\s\S]*?)\n\}/),
  dark: block(/\.dark \{([\s\S]*?)\n\}/),
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

for (const [name, t] of Object.entries(themes)) {
  describe(`${name} theme contrast (WCAG AA)`, () => {
    const surfaces = ['c-bg', 'c-surface', 'c-surface-2']
    it.each(['c-text', 'c-text-muted', 'c-text-faint', 'c-accent-text'].flatMap((f) => surfaces.map((s) => [f, s])))(
      'text %s on %s ≥ 4.5', (f, s) => expect(ratio(t[f], t[s])).toBeGreaterThanOrEqual(4.5))
    it.each(['accent', 'success', 'danger', 'info', 'warning', 'neutral'])(
      'button label on %s ≥ 4.5', (k) => expect(ratio(t[`c-${k}-fg`], t[`c-${k}`])).toBeGreaterThanOrEqual(4.5))
    it.each(['c-bg', 'c-surface', 'c-surface-2', 'c-surface-3'])(
      'focus ring (accent) on %s ≥ 3:1', (s) => expect(ratio(t['c-accent'], t[s])).toBeGreaterThanOrEqual(3))
    it.each(['success', 'danger', 'info', 'warning', 'ai'])(
      '%s text on its soft tint ≥ 4.5', (k) => {
        const fg = t[`c-${k}`]; const bg = t[`c-${k}-soft`]
        // in light mode the solid colour is used as text on the soft tint
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
      })
    it.each(['youtube', 'tiktok', 'facebook', 'instagram', 'threads', 'shopee'].flatMap((b) => surfaces.map((s) => [b, s])))(
      'brand %s on %s ≥ 3 (icons/UI)', (b, s) => expect(ratio(t[`brand-${b}`], t[s])).toBeGreaterThanOrEqual(3))
    it.each(surfaces)('strong border on %s ≥ 3', (s) => expect(ratio(t['c-border-strong'], t[s])).toBeGreaterThanOrEqual(3))
  })
}
