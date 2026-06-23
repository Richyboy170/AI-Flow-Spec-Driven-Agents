// In-memory TTL cache for the assembled news payload.
// Single-entry (the whole /api/news payload). Tracks age for /api/health and
// the `cached` response flag. refresh=true bypasses reads.

const MIN_TTL_MIN = 30;
const MAX_TTL_MIN = 60;
const DEFAULT_TTL_MIN = 45;

function clampTtlMinutes(raw) {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_TTL_MIN;
  return Math.min(MAX_TTL_MIN, Math.max(MIN_TTL_MIN, n));
}

const ttlMinutes = clampTtlMinutes(process.env.CACHE_TTL_MINUTES);
const ttlMs = ttlMinutes * 60 * 1000;

let entry = null; // { value, storedAt }

export function getTtlMinutes() {
  return ttlMinutes;
}

// Returns the cached value if present and not expired, else null.
export function getCached() {
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) {
    entry = null;
    return null;
  }
  return entry.value;
}

export function setCached(value) {
  entry = { value, storedAt: Date.now() };
}

// Age of the current cache entry in whole seconds, or null if empty/expired.
export function getCacheAgeSeconds() {
  if (!entry) return null;
  const ageMs = Date.now() - entry.storedAt;
  if (ageMs > ttlMs) return null;
  return Math.floor(ageMs / 1000);
}

export function clearCache() {
  entry = null;
}
