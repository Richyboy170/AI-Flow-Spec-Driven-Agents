/**
 * sections/hero.ts
 * -----------------
 * Builds the hero section and injects it as the first child of #app.
 * The Three.js canvas sits behind this section via position:fixed / z-index,
 * so the section background is transparent to reveal the 3D backdrop.
 */

export function initHero(): void {
  const app = document.getElementById('app')
  if (!app) return

  const section = document.createElement('section')
  section.id = 'hero'
  section.setAttribute('aria-label', 'Introduction')

  section.innerHTML = `
    <div class="hero-content">
      <p class="hero-kicker">An Educational Guide · Thailand 2025</p>
      <h1 class="hero-title">
        Virtual Banking:<br>
        <span>Thailand's Next</span><br>
        Financial Frontier
      </h1>
      <p class="hero-subtitle">
        A new generation of fully licensed, branchless banks is reshaping how
        billions of people access financial services. Thailand joined the movement
        in June&nbsp;2025 with three approved virtual banking consortiums.
      </p>
      <div class="hero-actions">
        <a href="#what-is" class="btn btn-primary">Start Learning</a>
        <a href="#thailand" class="btn btn-ghost">Thailand 2025</a>
      </div>
    </div>
    <div class="hero-scroll-cue" aria-hidden="true">
      <span>scroll</span>
      <div class="scroll-chevron"></div>
    </div>
  `

  app.appendChild(section)
}
