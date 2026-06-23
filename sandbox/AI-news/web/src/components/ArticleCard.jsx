import { categoryLabel, categoryStyle } from '../categories.js'
import { absoluteTime, relativeTime } from '../time.js'
import {
  ChatIcon,
  DocumentIcon,
  ExternalLinkIcon,
  FlameIcon,
  SparkleIcon,
} from './icons.jsx'

// A single news item. Defensive against missing optional fields: author, points,
// commentsUrl, publishedAt and even summary may be absent/null without crashing.
export default function ArticleCard({ article }) {
  const {
    title,
    url,
    source,
    category,
    summary,
    summarized,
    publishedAt,
    author,
    points,
    commentsUrl,
  } = article

  const style = categoryStyle(category)
  const relative = relativeTime(publishedAt)
  const hasPoints = typeof points === 'number' && points > 0
  const hasComments = typeof commentsUrl === 'string' && commentsUrl.length > 0
  const safeTitle = title || 'Untitled'

  return (
    <article className="group flex h-full animate-fade-in flex-col rounded-xl border border-ink-800 bg-ink-900/80 p-4 transition-colors duration-200 hover:border-ink-600 hover:bg-ink-850 sm:p-5">
      {/* Source TEXT badge (category-colored) + category badge */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-xs font-semibold ${style.source}`}
          title={source || 'Unknown source'}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
          <span className="truncate">{source || 'Unknown source'}</span>
        </span>
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
          {categoryLabel(category)}
        </span>
      </div>

      {/* Title links to the original article in a new tab */}
      <h2 className="text-base font-semibold leading-snug text-slate-100">
        <a
          href={url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1.5 transition-colors duration-200 hover:text-accent focus-visible:text-accent"
        >
          <span className="line-clamp-3">{safeTitle}</span>
          <ExternalLinkIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors duration-200 group-hover:text-accent" />
        </a>
      </h2>

      {/* Summary / excerpt */}
      {summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{summary}</p>
      )}

      {/* Footer: AI-summary indicator, time, author, HN points + comments */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-4 text-xs text-slate-500">
        {/* Subtle indicator: real LLM summary vs source excerpt */}
        {summarized ? (
          <span
            className="inline-flex items-center gap-1 text-accent/80"
            title="Summarized by AI"
          >
            <SparkleIcon className="h-3.5 w-3.5" />
            AI summary
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-slate-500"
            title="Source excerpt (not AI-summarized)"
          >
            <DocumentIcon className="h-3.5 w-3.5" />
            Excerpt
          </span>
        )}

        {relative && (
          <span className="text-slate-500" title={absoluteTime(publishedAt)}>
            <time dateTime={publishedAt}>{relative}</time>
          </span>
        )}

        {author && <span className="truncate text-slate-500">by {author}</span>}

        {hasPoints && (
          <span className="inline-flex items-center gap-1 text-amber-400/80" title="Hacker News points">
            <FlameIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums">{points}</span>
          </span>
        )}

        {hasComments && (
          <a
            href={commentsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-400 transition-colors duration-200 hover:text-accent focus-visible:text-accent"
          >
            <ChatIcon className="h-3.5 w-3.5" />
            Comments
          </a>
        )}
      </div>
    </article>
  )
}
