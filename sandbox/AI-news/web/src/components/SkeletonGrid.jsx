// Loading placeholders that mirror the ArticleCard layout to minimize layout shift.
function SkeletonCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-ink-800 bg-ink-900/80 p-4 sm:p-5">
      <div className="mb-3 flex gap-2">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-5 w-16" />
      </div>
      <div className="skeleton mb-2 h-4 w-full" />
      <div className="skeleton mb-4 h-4 w-3/4" />
      <div className="skeleton mb-1.5 h-3 w-full" />
      <div className="skeleton mb-1.5 h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
      <div className="mt-auto flex gap-3 pt-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  )
}

export default function SkeletonGrid({ count = 9 }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
