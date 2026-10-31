import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null })),
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
}))
vi.mock('@/data/supabase', () => ({
  supabase: { auth, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) },
}))

describe('password recovery', () => {
  it('a #type=recovery link opens the set-password form and saves via updateUser', async () => {
    window.history.replaceState(null, '', '/login#access_token=a&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')
    const { AuthProvider } = await import('@/data/auth')
    const { ThemeProvider } = await import('@/lib/theme')
    const { FeedbackProvider } = await import('@/ui/Feedback')
    const ResetPassword = (await import('@/pages/ResetPassword')).default

    render(
      <ThemeProvider><FeedbackProvider><AuthProvider><MemoryRouter><ResetPassword /></MemoryRouter></AuthProvider></FeedbackProvider></ThemeProvider>,
    )
    await waitFor(() => expect(screen.getByLabelText('New password')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'rahasia-baru' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'rahasia-baru' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: 'rahasia-baru' }))
  })

  it('mismatched passwords stay local (no updateUser call)', async () => {
    window.history.replaceState(null, '', '/login#access_token=a&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')
    const { AuthProvider } = await import('@/data/auth')
    const { ThemeProvider } = await import('@/lib/theme')
    const { FeedbackProvider } = await import('@/ui/Feedback')
    const ResetPassword = (await import('@/pages/ResetPassword')).default
    render(
      <ThemeProvider><FeedbackProvider><AuthProvider><MemoryRouter><ResetPassword /></MemoryRouter></AuthProvider></FeedbackProvider></ThemeProvider>,
    )
    await waitFor(() => expect(screen.getByLabelText('New password')).toBeTruthy())
    auth.updateUser.mockClear()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'satu' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'dua' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Passwords do not match'))
    expect(auth.updateUser).not.toHaveBeenCalled()
  })
})
