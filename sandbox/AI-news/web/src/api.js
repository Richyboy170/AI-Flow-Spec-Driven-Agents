// Fetch wrapper for GET /api/news (see CONTRACT.md).
//
// Robustness contract: this function NEVER throws and NEVER rejects. It always
// resolves to a payload-shaped object with safe defaults so components can render
// a friendly state and the Refresh button keeps working. The three failure modes
// are normalized into that shape:
//   (a) fetch rejects (backend unreachable)         -> synthesized error payload
//   (b) HTTP 5xx / non-OK                            -> synthesized error payload
//   (c) HTTP 200 with `error` + empty articles       -> returned AS-IS (a success,
//                                                       not an exception)

const GENERIC_ERROR = 'Could not load the news feed. Please try again.'
const OFFLINE_ERROR =
  'Could not reach the news service. Check that the backend is running, then retry.'

// Coerce any backend response (or synthesized fallback) into the full contract
// shape with defensive defaults, so the UI can rely on every field existing.
function normalizePayload(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  return {
    lastUpdated: data.lastUpdated ?? null,
    cached: Boolean(data.cached),
    articleCount:
      typeof data.articleCount === 'number'
        ? data.articleCount
        : Array.isArray(data.articles)
        ? data.articles.length
        : 0,
    sources: Array.isArray(data.sources) ? data.sources : [],
    summariesEnabled: data.summariesEnabled !== false ? Boolean(data.summariesEnabled) : false,
    articles: Array.isArray(data.articles) ? data.articles : [],
    error: typeof data.error === 'string' && data.error ? data.error : null,
  }
}

function errorPayload(message) {
  return normalizePayload({
    lastUpdated: null,
    cached: false,
    articleCount: 0,
    sources: [],
    summariesEnabled: false,
    articles: [],
    error: message,
  })
}

/**
 * Fetch the news feed.
 * @param {Object} [opts]
 * @param {string} [opts.category]  one of the category ids or 'all'
 * @param {boolean} [opts.refresh]  bypass the backend cache
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<NormalizedPayload>} always resolves to a safe payload shape
 */
export async function fetchNews({ category = 'all', refresh = false, signal } = {}) {
  const params = new URLSearchParams()
  if (category && category !== 'all') params.set('category', category)
  if (refresh) params.set('refresh', 'true')
  const query = params.toString()
  const url = `/api/news${query ? `?${query}` : ''}`

  let res
  try {
    res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    // Re-surface genuine aborts so callers can ignore them; everything else is
    // treated as "backend unreachable".
    if (err && err.name === 'AbortError') throw err
    return errorPayload(OFFLINE_ERROR)
  }

  // Try to parse JSON regardless of status — the contract prefers HTTP 200 with an
  // `error` field, but a 5xx may still carry a useful body.
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const message =
      (body && typeof body.error === 'string' && body.error) ||
      `${GENERIC_ERROR} (HTTP ${res.status})`
    return normalizePayload({ ...(body || {}), error: message })
  }

  // 200 OK: return the (normalized) payload as-is. An `error` field here is a
  // valid friendly-state success, not an exception.
  return normalizePayload(body)
}

/**
 * @typedef {Object} NormalizedPayload
 * @property {string|null} lastUpdated
 * @property {boolean} cached
 * @property {number} articleCount
 * @property {Array<{id:string,name:string,ok:boolean,error:string|null}>} sources
 * @property {boolean} summariesEnabled
 * @property {Array<Object>} articles
 * @property {string|null} error
 */
