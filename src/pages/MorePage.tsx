import { PageHeader } from '@/app/PageHeader'
import { MoreList } from '@/app/MoreList'
import { useAuth } from '@/data/auth'
import { ThemeToggle } from '@/ui/ThemeToggle'

/** /more (deep link or refresh on a phone): the same list as the More sheet. */
export default function MorePage() {
  const { isAdmin } = useAuth()
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="More" />
      <MoreList isAdmin={isAdmin} />
      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium">Theme</p>
        <ThemeToggle />
      </div>
    </div>
  )
}
