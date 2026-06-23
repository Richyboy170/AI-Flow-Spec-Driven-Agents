import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchNews } from './api.js'
import { CATEGORIES } from './categories.js'
import { publishedTimestamp } from './time.js'
import Header from './components/Header.jsx'
import FilterBar from './components/FilterBar.jsx'
import ArticleGrid from './components/ArticleGrid.jsx'
import SkeletonGrid from './components/SkeletonGrid.jsx'
import EmptyState from './components/EmptyState.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { PartialFailureNote, SummariesDisabledNote } from './components/StatusNotes.jsx'

// App owns all state; child components are presentational. We fetch the full
// payload once (and on Refresh), then filter client-side by category.
export default function App() {
  const [payload, setPayload] = useState(null) // normalized payload or null until first load
  const [loading, setLoading] = useState(true) // first-load / hard reload (shows skeletons)
  const [refreshing, setRefreshing] = useState(false) // background refresh (keeps current view)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const abortRef = useRef(null)

  const load = useCallback(async ({ refresh = false } = {}) => {
    // Cancel any in-flight request before starting a new one.
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (refresh) setRefreshing(true)
    else setLoading(true)

    try {
      // fetchNews never throws (except on genuine abort); it always resolves to a
      // safe payload shape, so the UI can always render something.
      const data = await fetchNews({ refresh, signal: controller.signal })
      setPayload(data)
    } catch (err) {
      if (err && err.name === 'AbortError') return // superseded by a newer request
      // Defensive: should not happen given api.js, but never leave the UI blank.
      setPayload({
        lastUpdated: null,
        cached: false,
        articleCount: 0,
        sources: [],
        summariesEnabled: false,
        articles: [],
        error: 'Something went wrong. Please try again.',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load])

  const handleRefresh = useCallback(() => load({ refresh: true }), [load])

  const articles = payload?.articles ?? []

  // Sort newest-first by publishedAt; null/invalid timestamps sort as oldest.
  const sortedArticles = useMemo(() => {
    return [...articles].sort(
      (a, b) => publishedTimestamp(b?.publishedAt) - publishedTimestamp(a?.publishedAt),
    )
  }, [articles])

  // Per-category counts for the filter badges (computed on the full payload).
  const counts = useMemo(() => {
    const base = { all: sortedArticles.length }
    for (const c of CATEGORIES) base[c.id] = 0
    for (const a of sortedArticles) {
      const id = a?.category
      if (id && id in base) base[id] += 1
      else base.other += 1
    }
    return base
  }, [sortedArticles])

  // Client-side category filtering.
  const visibleArticles = useMemo(() => {
    if (selectedCategory === 'all') return sortedArticles
    return sortedArticles.filter((a) => (a?.category || 'other') === selectedCategory)
  }, [sortedArticles, selectedCategory])

  const summariesEnabled = payload?.summariesEnabled !== false
  const hasError = Boolean(payload?.error)
  const hasArticles = sortedArticles.length > 0
  // Full error banner only when we have nothing to show AND an error string.
  const showErrorBanner = !loading && hasError && !hasArticles

  return (
    <div className="min-h-full">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-950"
      >
        Skip to content
      </a>

      <Header
        lastUpdated={payload?.lastUpdated ?? null}
        cached={Boolean(payload?.cached)}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-col gap-4">
          <FilterBar
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            counts={hasArticles ? counts : null}
          />

          {/* Subtle, non-blocking notices when we still have articles to show. */}
          {hasArticles && (
            <div className="flex flex-col gap-2">
              {!summariesEnabled && <SummariesDisabledNote />}
              <PartialFailureNote sources={payload?.sources} />
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonGrid count={9} />
        ) : showErrorBanner ? (
          <ErrorBanner
            error={payload?.error}
            onRetry={handleRefresh}
            retrying={refreshing}
          />
        ) : visibleArticles.length > 0 ? (
          <ArticleGrid articles={visibleArticles} />
        ) : (
          <EmptyState category={selectedCategory} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-slate-600 sm:px-6">
        <p>
          Aggregated AI/ML engineering news. Articles link to their original
          sources. Built with React, Vite &amp; Tailwind CSS.
        </p>
      </footer>
    </div>
  )
}
