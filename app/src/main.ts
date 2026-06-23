/**
 * main.ts — Application entry point
 * -----------------------------------
 * Boot sequence:
 *   1. Import global styles.
 *   2. Initialise all content sections — always, regardless of WebGL.
 *   3. Attempt to start the Three.js hero scene; hide canvas if WebGL absent.
 *   4. Start the RAF render loop.
 *   5. Wire nav toggle and scroll-reveal observer.
 */

import './style.css'

import { isWebGLAvailable } from './lib/webgl-detect'
import { createHeroScene } from './scenes/heroScene'
import { initHero }          from './sections/hero'
import { initWhatIs }        from './sections/what-is'
import { initHowItOperates } from './sections/how-it-operates'
import { initThailand }      from './sections/thailand'
import { initOnchainRails }  from './sections/onchain-rails'
import { initNews }          from './sections/news'

// ── Content sections: always initialise ─────────────────────────────────────
// These build the DOM regardless of WebGL availability.
initHero()
initWhatIs()
initHowItOperates()
initThailand()
initOnchainRails()
initNews()
appendFooter()

// ── Three.js scene: gated on WebGL ──────────────────────────────────────────
if (isWebGLAvailable()) {
  bootScene()
} else {
  // Hide the blank canvas; the page is fully readable without the 3D backdrop.
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null
  if (canvas) canvas.style.display = 'none'
}

// ── Mobile nav toggle ────────────────────────────────────────────────────────
const toggle = document.querySelector('.nav-toggle') as HTMLButtonElement | null
const menu   = document.getElementById('nav-menu')

if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!expanded))
    toggle.setAttribute('aria-label', expanded ? 'Open navigation menu' : 'Close navigation menu')
    menu.classList.toggle('is-open', !expanded)
  })

  // Close on any nav-link click (restores scroll UX on mobile)
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open')
      toggle.setAttribute('aria-expanded', 'false')
      toggle.setAttribute('aria-label', 'Open navigation menu')
    })
  })
}

// ── Scroll-reveal observer ───────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      }
    })
  },
  { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
)

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el))

// ── Scroll-spy: highlight active nav link ────────────────────────────────────
const sectionIds = ['hero', 'what-is', 'how-it-operates', 'thailand', 'onchain-rails', 'news']

const spyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id
        document.querySelectorAll('.nav-link').forEach(link => {
          const href = link.getAttribute('href')
          link.classList.toggle('is-active', href === `#${id}`)
        })
      }
    })
  },
  { rootMargin: `-${64}px 0px -70% 0px`, threshold: 0 }
)

sectionIds.forEach(id => {
  const el = document.getElementById(id)
  if (el) spyObserver.observe(el)
})

// ── Three.js scene ───────────────────────────────────────────────────────────
function bootScene(): void {
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null
  if (!canvas) {
    console.error('[main] #hero-canvas not found in DOM.')
    return
  }

  const heroScene = createHeroScene(canvas)
  let lastTime = performance.now()

  function renderLoop(now: number): void {
    const deltaMs = now - lastTime
    lastTime = now
    // Clamp delta to avoid huge jumps after tab blur / battery saver
    heroScene.tick(Math.min(deltaMs / 1000, 0.1))
    requestAnimationFrame(renderLoop)
  }

  requestAnimationFrame(renderLoop)

  window.addEventListener('resize', () => {
    heroScene.onResize(window.innerWidth, window.innerHeight)
  })
}

// ── Minimal footer ───────────────────────────────────────────────────────────
function appendFooter(): void {
  const footer = document.createElement('footer')
  footer.className = 'site-footer'
  footer.innerHTML = `
    <div class="container">
      <p>An open educational resource — not financial advice. Information is accurate as of June 2025.</p>
    </div>
  `
  // Footer goes after #app in the DOM
  const app = document.getElementById('app')
  if (app?.parentNode) {
    app.parentNode.insertBefore(footer, app.nextSibling)
  }
}
