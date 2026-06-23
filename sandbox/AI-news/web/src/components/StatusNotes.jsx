import { AlertIcon, InfoIcon } from './icons.jsx'

// Subtle, non-blocking notices shown ABOVE the grid when there are still articles
// to render:
//   - PartialFailureNote: some sources failed (payload.sources[].ok === false)
//   - SummariesDisabledNote: payload.summariesEnabled === false
// These are distinct from the full ErrorBanner (which replaces the grid entirely).

export function PartialFailureNote({ sources }) {
  const failed = (sources || []).filter((s) => s && s.ok === false)
  if (failed.length === 0) return null

  const names = failed.map((s) => s.name || s.id).filter(Boolean)
  const summary =
    names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90"
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <p>
        <span className="font-medium text-amber-200">
          Some sources didn’t load
        </span>{' '}
        <span className="text-amber-200/70">
          ({summary}). Showing results from the sources that responded.
        </span>
      </p>
    </div>
  )
}

export function SummariesDisabledNote() {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-slate-400"
    >
      <InfoIcon className="h-4 w-4 shrink-0 text-slate-500" />
      <p>AI summaries are disabled — showing source excerpts instead.</p>
    </div>
  )
}
