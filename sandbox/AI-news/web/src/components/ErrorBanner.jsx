import { AlertIcon, RefreshIcon } from './icons.jsx'

// Full error banner shown when the feed could not load (no articles to render).
// Uses payload.error for the message and keeps a working Retry button.
export default function ErrorBanner({ error, onRetry, retrying }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium text-rose-200">Couldn’t load the feed</p>
          <p className="mt-0.5 text-rose-300/80">
            {error || 'Something went wrong while loading the news feed.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        aria-busy={retrying}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 font-medium text-rose-100 transition-colors duration-200 hover:bg-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshIcon className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  )
}
