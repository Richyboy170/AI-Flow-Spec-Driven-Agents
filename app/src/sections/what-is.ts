/**
 * sections/what-is.ts
 * --------------------
 * Explains what a virtual bank is and how it differs from neobanks,
 * fintech apps, and traditional banks. Fully DOM-injected.
 */

export function initWhatIs(): void {
  const app = document.getElementById('app')
  if (!app) return

  const cards = [
    {
      icon: '&#127963;',
      title: 'Licensed &amp; Regulated',
      body: 'Virtual banks hold a full commercial banking licence from the national regulator — the same licence as any traditional bank. They must meet capital adequacy, consumer-protection, and AML/KYC requirements.',
    },
    {
      icon: '&#128241;',
      title: 'Fully Digital',
      body: 'No physical branches, ever. All customer interactions — from identity verification and account opening to lending and customer support — occur through mobile apps and web interfaces.',
    },
    {
      icon: '&#9878;&#65039;',
      title: 'Distinct from Fintech Apps',
      body: "Unlike payment wallets or neobanks that operate under a partner bank's licence, a virtual bank holds its own banking licence. This gives it direct regulator accountability and full product control.",
    },
    {
      icon: '&#127758;',
      title: 'Financial Inclusion Mission',
      body: 'Regulators typically grant virtual bank licences to improve access for underserved groups: individuals without credit histories, rural populations, migrant workers, and micro-enterprises.',
    },
  ]

  const section = document.createElement('section')
  section.id = 'what-is'
  section.className = 'section reveal'
  section.setAttribute('aria-labelledby', 'what-is-heading')

  section.innerHTML = `
    <div class="container">
      <div class="section-header">
        <span class="section-eyebrow">The Basics</span>
        <h2 id="what-is-heading">What Is a Virtual Bank?</h2>
        <p class="section-lead">
          Not just an app &#8212; a fully licensed, branchless bank with the same
          regulatory standing as any traditional institution.
        </p>
      </div>
      <div class="feature-grid" role="list">
        ${cards.map(c => `
          <article class="feature-card" role="listitem">
            <div class="feature-card-icon" aria-hidden="true">${c.icon}</div>
            <h3>${c.title}</h3>
            <p>${c.body}</p>
          </article>
        `).join('')}
      </div>
    </div>
  `

  app.appendChild(section)
}
