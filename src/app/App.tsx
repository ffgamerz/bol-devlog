import { Suspense } from 'react'
import { lazyRetry as lazy } from '@/lib/chunkReload'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/data/auth'
import { ThemeProvider } from '@/lib/theme'
import { FeedbackProvider } from '@/ui/Feedback'
import { RowSkeleton } from '@/ui/Skeleton'
import { AppShell } from './AppShell'

const SignIn = lazy(() => import('@/pages/SignIn'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Placeholder = lazy(() => import('@/pages/Placeholder'))
const DevLog = lazy(() => import('@/features/devlog/DevLogPage'))
const Claude = lazy(() => import('@/features/claude/ClaudePage'))

const Loading = () => <div className="mx-auto max-w-[var(--page-max)] p-4"><RowSkeleton rows={4} /></div>

function Gate() {
  const { user, loading, isAdmin, recovery } = useAuth()
  if (loading) return <Loading />
  // Recovery link: stay on the set-password form until the new password is saved or cancelled.
  if (recovery) return <Suspense fallback={<Loading />}><ResetPassword /></Suspense>
  if (!user) return <Suspense fallback={<Loading />}><SignIn /></Suspense>  // handles /register too
  const page = (title: string) => <Placeholder title={title} />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={isAdmin ? <DevLog /> : page('Admins only')} />
          <Route path="claude" element={isAdmin ? <Claude /> : page('Admins only')} />
          <Route path="devlog" element={<Navigate to="/" replace />} />
          <Route path="reset" element={<ResetPassword />} />
          <Route path="login" element={<Navigate to="/" replace />} />
          <Route path="register" element={<Navigate to="/" replace />} />
          <Route path="*" element={page('Not found')} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <FeedbackProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}
