import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/data/auth'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Field'
import { useFeedback } from '@/ui/Feedback'
import { ThemeToggle } from '@/ui/ThemeToggle'

/** Set a new password after the recovery email link: View → Edit → Save/Cancel (never autosaved). */
export default function ResetPassword() {
  const { recovery, updatePassword, cancelRecovery } = useAuth()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (password !== confirm) return setError('Passwords do not match')
    setBusy(true)
    try { await updatePassword(password); toast('Password updated'); navigate('/', { replace: true }) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const cancel = () => { cancelRecovery(); navigate('/', { replace: true }) }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="card w-full max-w-sm space-y-4 p-6 shadow-2">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.025em]">Grokbot <span className="text-accent-text">AI log</span></h1>
          <p className="mt-1 text-sm text-muted">{recovery ? 'Choose a new password for your account' : 'This reset link is invalid or has expired'}</p>
        </div>
        {recovery ? (
          <form onSubmit={save} className="space-y-4">
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Input label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" intent="ghost" onClick={cancel}>Cancel</Button>
              <Button type="submit" intent="save" loading={busy} loadingText="Saving…">Save password</Button>
            </div>
          </form>
        ) : (
          <Button intent="save" block onClick={() => navigate('/', { replace: true })}>Request a new link</Button>
        )}
        <div className="flex justify-center pt-1"><ThemeToggle compact /></div>
      </div>
    </div>
  )
}
