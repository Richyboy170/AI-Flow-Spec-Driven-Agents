// Lightweight relative-time + absolute-time helpers (no date library dependency).

const DIVISIONS = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

const rtf =
  typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// "3 hours ago", "in 2 days", or '' when the timestamp is missing/invalid.
export function relativeTime(value) {
  const date = toDate(value)
  if (!date) return ''
  let duration = (date.getTime() - Date.now()) / 1000
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      const rounded = Math.round(duration)
      if (rtf) return rtf.format(rounded, division.unit)
      const abs = Math.abs(rounded)
      const suffix = rounded <= 0 ? 'ago' : 'from now'
      return `${abs} ${division.unit}${abs === 1 ? '' : 's'} ${suffix}`
    }
    duration /= division.amount
  }
  return ''
}

// Full, locale-formatted timestamp for tooltips / title attributes.
export function absoluteTime(value) {
  const date = toDate(value)
  if (!date) return 'unknown time'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Numeric epoch for sorting; null/invalid sorts as oldest.
export function publishedTimestamp(value) {
  const date = toDate(value)
  return date ? date.getTime() : Number.NEGATIVE_INFINITY
}
