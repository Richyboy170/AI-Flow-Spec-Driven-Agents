/**
 * helpers.ts
 * ----------
 * General-purpose utilities shared across scenes and sections.
 *
 * TODO (next wave): add lerp, clamp, debounce, and any other
 * numeric/animation helpers needed by content sections.
 */

/**
 * Returns the BASE_URL Vite injects at build time.
 * Use this as a prefix for ALL runtime asset fetches so URLs
 * resolve correctly under the /tidlor-reborn/ GitHub Pages subpath.
 *
 * Example:
 *   const url = assetUrl('data/news.json')
 *   // → '/tidlor-reborn/data/news.json' in production
 *   // → '/data/news.json'              in local dev
 */
export function assetUrl(path: string): string {
  // import.meta.env.BASE_URL is injected by Vite from vite.config.ts `base`
  const base = import.meta.env.BASE_URL ?? '/'
  // Ensure no double-slash between base and path
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/**
 * Lightweight linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
