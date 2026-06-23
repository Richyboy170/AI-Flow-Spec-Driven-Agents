import { FILTERS } from '../categories.js'

// All + the six fixed categories. Selecting a filter only updates local state in
// App (client-side filtering of the already-fetched payload); it never re-fetches.
// `counts` maps category id -> number of articles, with `all` = total.
export default function FilterBar({ selected, onSelect, counts }) {
  return (
    <nav aria-label="Filter by category" className="w-full">
      <ul className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = selected === filter.id
          const count = counts ? counts[filter.id] ?? 0 : null
          return (
            <li key={filter.id}>
              <button
                type="button"
                onClick={() => onSelect(filter.id)}
                aria-pressed={isActive}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'border-accent/60 bg-accent-soft text-accent'
                    : 'border-ink-700 bg-ink-900 text-slate-300 hover:border-ink-600 hover:bg-ink-800 hover:text-white',
                ].join(' ')}
              >
                <span>{filter.label}</span>
                {count !== null && (
                  <span
                    className={[
                      'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                      isActive ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-slate-400',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
