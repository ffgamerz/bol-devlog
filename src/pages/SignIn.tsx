import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/data/auth'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Field'
import { useFeedback } from '@/ui/Feedback'
import { ThemeToggle } from '@/ui/ThemeToggle'

/** Minimal sign-in / register gate so the shell can be used. The designed auth pages come with the page build. */
export default function SignIn() {
  const register = useLocation().pathname === '/register'
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const { toast } = useFeedback()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (register && password !== confirm) return setError('Passwords do not match')
    setBusy(true)
    try {
      if (register) { await signUp(email, password); toast('Account created. Check your email to confirm.') }
      else await signIn(email, password)
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const reset = async () => {
    if (!email) return setEmailError('Enter your email first, then tap Forgot password.')
    setEmailError(null)
    try { await sendPasswordReset(email); toast('Password reset link sent') } catch (err) { toast((err as Error).message, 'error') }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-16">
      <form onSubmit={submit} noValidate={false} className="card w-full max-w-sm space-y-4 p-6 shadow-2">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.025em]">BOL <span className="text-accent-text">Dev log</span></h1>
          <p className="mt-1 text-sm text-muted">{register ? 'Create your account' : 'Sign in to manage your videos'}</p>
        </div>
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <Input label="Email" name="email" type="email" autoComplete="email" required value={email} error={emailError}
          onChange={(e) => { setEmail(e.target.value); setEmailError(null) }} />
        <Input label="Password" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {register && <Input label="Confirm password" name="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        <Button type="submit" intent="save" block loading={busy} loadingText={register ? 'Creating…' : 'Signing in…'}>{register ? 'Create account' : 'Sign in'}</Button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {register
            ? <span className="text-muted">Have an account? <Link className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline" to="/">Sign in</Link></span>
            : <>
                <span className="text-muted">New here? <Link className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline" to="/register">Register</Link></span>
                <Button intent="ghost" size="sm" onClick={reset}>Forgot password?</Button>
              </>}
        </div>
        <div className="flex justify-center pt-1"><ThemeToggle compact /></div>
      </form>
    </div>
  )
}
