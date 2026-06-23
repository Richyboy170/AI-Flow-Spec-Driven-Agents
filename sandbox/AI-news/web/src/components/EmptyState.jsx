import { InboxIcon } from './icons.jsx'

// Shown when the feed loaded successfully but there are no articles to display —
// either the whole feed is empty, or the active category filter matches nothing.
export default function EmptyState({ category }) {
  const filtered = category && category !== 'all'
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-900/50 px-6 py-16 text-center">
      <InboxIcon className="h-10 w-10 text-slate-600" />
      <div>
        <p className="text-sm font-medium text-slate-300">
          {filtered ? 'No articles in this category' : 'No articles to show yet'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {filtered
            ? 'Try a different category or refresh the feed.'
            : 'Try refreshing — new stories arrive throughout the day.'}
        </p>
      </div>
    </div>
  )
}
