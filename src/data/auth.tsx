import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = {
  user: User | null
  session: Session | null
  isAdmin: boolean
  /** True until the stored session has been restored; never query before this is false. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  /** True while the user arrived from a password-recovery email link and has not saved a new password yet. */
  recovery: boolean
  updatePassword: (password: string) => Promise<void>
  cancelRecovery: () => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)
const RECOVERY_KEY = 'bol-devlog:pw-recovery'
/** Recovery links land on `#access_token=…&type=recovery`; capture it before supabase-js clears the hash. */
const hashIsRecovery = typeof window !== 'undefined' && /[#&]type=recovery(?:&|$)/.test(window.location.hash) && /access_token=/.test(window.location.hash)
const clearRecovery = () => { try { sessionStorage.removeItem(RECOVERY_KEY) } catch { /* private mode */ } }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(() => {
    if (hashIsRecovery) { try { sessionStorage.setItem(RECOVERY_KEY, '1') } catch { /* private mode */ } }
    if (hashIsRecovery) return true
    try { return sessionStorage.getItem(RECOVERY_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    let alive = true
    let adminFor: string | undefined  // user whose is_admin we have loaded
    const loadAdmin = async (uid: string | undefined) => {
      if (!uid) { adminFor = undefined; return setIsAdmin(false) }
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', uid).maybeSingle()
      if (alive) { adminFor = uid; setIsAdmin(Boolean(data?.is_admin)) }
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadAdmin(data.session?.user.id)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      // A fresh sign-in: hold on Loading until is_admin is known, or admin-only routes bounce to Calendar.
      const uid = s?.user.id
      if (e === 'SIGNED_IN' && uid && uid !== adminFor) { setLoading(true); setSession(s); void loadAdmin(uid).finally(() => { if (alive) setLoading(false) }) }
      else { setSession(s); void loadAdmin(uid) }
      if (e === 'PASSWORD_RECOVERY') {
        try { sessionStorage.setItem(RECOVERY_KEY, '1') } catch { /* private mode */ }
        setRecovery(true)
      }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    isAdmin,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
      if (error) throw error
    },
    recovery,
    async updatePassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      clearRecovery(); setRecovery(false)
    },
    cancelRecovery() { clearRecovery(); setRecovery(false) },
    async signOut() { await supabase.auth.signOut() },
  }), [session, isAdmin, loading, recovery])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
