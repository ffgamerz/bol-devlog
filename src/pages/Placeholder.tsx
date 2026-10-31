import { PageHeader } from '@/app/PageHeader'
import { EmptyState } from '@/ui/States'

/** Stand-in for each area until the UI concept is approved and the page is built. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-lg border border-dashed border-border-strong bg-surface">
        <EmptyState title={`${title} is next`} message="This page will be built after the UI concept is approved. The full feature list is in FEATURES.md." />
      </div>
    </>
  )
}
