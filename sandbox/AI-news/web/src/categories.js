// Fixed category enum from CONTRACT.md. Both backend and frontend hardcode these.
// Each category carries Tailwind utility classes used to color the category badge
// and the source TEXT badge (sources are data, never downloaded brand logos).

export const CATEGORIES = [
  { id: 'research', label: 'Research Papers' },
  { id: 'tools', label: 'Tools & Libraries' },
  { id: 'industry', label: 'Industry News' },
  { id: 'models', label: 'Model Releases' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'other', label: 'Other' },
]

// "All" + the six fixed categories, in display order, for the FilterBar.
export const FILTERS = [{ id: 'all', label: 'All' }, ...CATEGORIES]

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
)

export function categoryLabel(id) {
  return CATEGORY_LABELS[id] || 'Other'
}

// Per-category accent styling. Kept as full class strings (no string interpolation)
// so Tailwind's content scanner keeps them in the build.
const CATEGORY_STYLES = {
  research: {
    badge: 'bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-500/30',
    source: 'bg-violet-500/10 text-violet-200 ring-1 ring-inset ring-violet-500/25',
    dot: 'bg-violet-400',
  },
  tools: {
    badge: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    source: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-inset ring-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  industry: {
    badge: 'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/30',
    source: 'bg-sky-500/10 text-sky-200 ring-1 ring-inset ring-sky-500/25',
    dot: 'bg-sky-400',
  },
  models: {
    badge: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30',
    source: 'bg-amber-500/10 text-amber-200 ring-1 ring-inset ring-amber-500/25',
    dot: 'bg-amber-400',
  },
  tutorials: {
    badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30',
    source: 'bg-rose-500/10 text-rose-200 ring-1 ring-inset ring-rose-500/25',
    dot: 'bg-rose-400',
  },
  other: {
    badge: 'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30',
    source: 'bg-slate-500/10 text-slate-200 ring-1 ring-inset ring-slate-500/25',
    dot: 'bg-slate-400',
  },
}

export function categoryStyle(id) {
  return CATEGORY_STYLES[id] || CATEGORY_STYLES.other
}
