import { expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { DateInput } from '@/ui/DateInput'
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
it('every label[for] points at a real form control (mouse + touch DateInput)', () => {
  for (const coarse of [false, true]) {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: coarse, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    const { container, unmount } = render(<DateInput label="Upload date" value="2026-10-24" onChange={() => {}} />)
    for (const l of container.querySelectorAll('label[for]')) expect(document.getElementById(l.getAttribute('for')!)?.tagName).toMatch(/INPUT|SELECT|TEXTAREA|BUTTON/)
    if (!coarse) expect(container.querySelector('[role=button]')?.getAttribute('aria-labelledby')).toBeTruthy()
    unmount(); window.matchMedia = mm
  }
})
