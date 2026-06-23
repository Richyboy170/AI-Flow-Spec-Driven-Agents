/**
 * webgl-detect.ts
 * ---------------
 * Detects WebGL availability before any Three.js scene is initialised.
 *
 * Usage:
 *   import { isWebGLAvailable, showWebGLFallback } from './lib/webgl-detect'
 *
 *   if (!isWebGLAvailable()) {
 *     showWebGLFallback()
 *   } else {
 *     // proceed with Three.js
 *   }
 */

/**
 * Returns true if WebGL (1 or 2) is available in this environment.
 * Tests by creating a temporary canvas and requesting a WebGL context.
 * The canvas is immediately discarded so nothing is rendered.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    return ctx !== null
  } catch {
    return false
  }
}

/**
 * Returns true if WebGL 2 specifically is available.
 * Three.js r155+ prefers WebGL 2 and falls back to WebGL 1 automatically,
 * but callers that need compute shaders can check this directly.
 */
export function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') !== null
  } catch {
    return false
  }
}

/**
 * Shows the pre-rendered HTML fallback and hides the main canvas.
 * The fallback element is #webgl-fallback in index.html and is styled
 * via critical inline CSS so it displays before the JS bundle loads.
 *
 * Also hides #hero-canvas to avoid an empty black rectangle on screen.
 */
export function showWebGLFallback(): void {
  const fallback = document.getElementById('webgl-fallback')
  const canvas = document.getElementById('hero-canvas')

  if (fallback) {
    fallback.classList.add('visible')
  }

  if (canvas) {
    ;(canvas as HTMLCanvasElement).style.display = 'none'
  }
}
