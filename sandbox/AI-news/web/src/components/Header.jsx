import { absoluteTime, relativeTime } from '../time.js'
import { RefreshIcon } from './icons.jsx'

// App title, a live "Last updated" stamp from payload.lastUpdated, and a Refresh
// button that triggers a refresh=true fetch. The button is disabled while a
// refresh is in flight and announces its busy state to assistive tech.
export default function Header({ lastUpdated, cached, onRefresh, refreshing }) {
  const relative = relativeTime(lastUpdated)
  const absolute = absoluteTime(lastUpdated)

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/30"
            aria-hidden="true"
          >
            <span className="font-mono text-sm font-semibold tracking-tight">AI</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight text-slate-50 sm:text-xl">
              AI Engineering News
            </h1>
            <p className="text-xs text-slate-400">
              Live from Hacker News, ArXiv &amp; research blogs
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs text-slate-400" aria-live="polite">
            {lastUpdated ? (
              <>
                <span className="text-slate-500">Last updated </span>
                <time dateTime={lastUpdated} title={absolute} className="text-slate-300">
                  {relative || absolute}
                </time>
                {cached && (
                  <span className="ml-1.5 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    cached
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500">Not yet updated</span>
            )}
          </p>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors duration-200 hover:bg-ink-700 hover:text-white focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
