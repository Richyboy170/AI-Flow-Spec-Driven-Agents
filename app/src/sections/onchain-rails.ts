/**
 * sections/onchain-rails.ts
 * --------------------------
 * An illustrative, read-only analogy section explaining on-chain payment rails
 * and stablecoins as a ADJACENT CONCEPT that is DISTINCT from licensed virtual banks.
 *
 * IMPORTANT CONSTRAINT:
 *   This section MUST prominently label itself as an educational analogy
 *   that is separate from the regulated virtual banking sector. It must never
 *   conflate crypto/on-chain technology with licensed virtual banks.
 *   There are NO wallet-connect, send, or pay interactions.
 */

import snapshot from '../data/onchain-snapshot.json'

export function initOnchainRails(): void {
  const app = document.getElementById('app')
  if (!app) return

  const section = document.createElement('section')
  section.id = 'onchain-rails'
  section.className = 'section section-alt reveal'
  section.setAttribute('aria-labelledby', 'onchain-heading')

  const exampleCards = snapshot.illustrativeExamples.map(ex => `
    <article class="onchain-card">
      <h3>${ex.name}</h3>
      <p class="onchain-card-desc">${ex.description}</p>
      <div class="onchain-card-meta">
        <div>
          <strong>Illustrative Scale</strong>
          ${ex.illustrativeScale}
        </div>
        <div style="margin-top:0.75rem">
          <strong>Regulatory Status</strong>
          ${ex.regulatoryStatus}
        </div>
      </div>
    </article>
  `).join('')

  section.innerHTML = `
    <div class="container">
      <div class="section-header">
        <span class="section-eyebrow">Adjacent Concept &#8212; Not a Virtual Bank</span>
        <h2 id="onchain-heading">${snapshot.conceptTitle}</h2>
        <p class="section-lead">
          Blockchain-based payment rails are a related but separate development
          in financial technology. Understanding them helps contextualise
          where virtual banks fit.
        </p>
      </div>

      <!-- Prominent disclaimer — required by product constraint -->
      <div
        class="onchain-disclaimer"
        role="note"
        aria-label="Important distinction: this section describes an analogy, not virtual banking technology"
      >
        <strong>&#9432; Educational Analogy Only &#8212; Distinct from Virtual Banks</strong>
        <p>${snapshot.analogyDisclaimer}</p>
      </div>

      <!-- Illustrative example cards -->
      <div class="onchain-cards" role="list" aria-label="Illustrative on-chain rail concepts">
        ${exampleCards}
      </div>

      <!-- Key distinction call-out -->
      <div class="onchain-key-distinction" role="complementary" aria-label="Key distinction summary">
        <p>
          <strong>The bottom line: </strong>${snapshot.keyDistinction}
        </p>
      </div>

      <p style="margin-top:1.5rem;font-size:0.75rem;color:var(--color-text-faint);text-align:center">
        Figures are illustrative estimates for educational context.
        Last reviewed: ${snapshot.lastReviewed}
      </p>
    </div>
  `

  app.appendChild(section)
}
