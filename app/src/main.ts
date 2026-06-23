/**
 * main.ts — Application entry point
 * -----------------------------------
 * Phase 4: scaffolding + hero proof-of-concept.
 *
 * Boot sequence:
 *   1. Import global styles.
 *   2. Check WebGL availability; show fallback and abort if unavailable.
 *   3. Initialise the hero Three.js scene on the full-viewport canvas.
 *   4. Start the RAF (requestAnimationFrame) render loop.
 *   5. Handle window resize.
 *
 * TODO (next wave):
 *   - Initialise content sections (hero copy, what-is, how-it-operates,
 *     thailand, onchain-rails, news) imported from src/sections/.
 *   - Add scroll-based section reveal logic.
 *   - Wire navigation / header component.
 */

import './style.css'

import { isWebGLAvailable, showWebGLFallback } from './lib/webgl-detect'
import { createHeroScene } from './scenes/heroScene'

// ── WebGL capability gate ────────────────────────────────────────────────
if (!isWebGLAvailable()) {
  showWebGLFallback()
  // Nothing else to boot — exit early.
} else {
  bootApp()
}

function bootApp(): void {
  // ── Canvas ──────────────────────────────────────────────────────────────
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    console.error('[main] #hero-canvas not found in DOM.')
    return
  }

  // ── Hero scene ───────────────────────────────────────────────────────────
  const heroScene = createHeroScene(canvas)

  // ── Render loop ──────────────────────────────────────────────────────────
  let lastTime = performance.now()

  function renderLoop(now: number): void {
    const deltaMs = now - lastTime
    lastTime = now

    // Clamp delta to avoid huge jumps after tab blur / battery saver
    const deltaSeconds = Math.min(deltaMs / 1000, 0.1)

    heroScene.tick(deltaSeconds)
    requestAnimationFrame(renderLoop)
  }

  requestAnimationFrame(renderLoop)

  // ── Resize handler ───────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    heroScene.onResize(window.innerWidth, window.innerHeight)
  })

  // ── Section initialisation (stubs — activate in next wave) ───────────────
  // import { initHero }           from './sections/hero'
  // import { initWhatIs }         from './sections/what-is'
  // import { initHowItOperates }  from './sections/how-it-operates'
  // import { initThailand }       from './sections/thailand'
  // import { initOnchainRails }   from './sections/onchain-rails'
  // import { initNews }           from './sections/news'
  //
  // initHero()
  // initWhatIs()
  // initHowItOperates()
  // initThailand()
  // initOnchainRails()
  // initNews()
}
