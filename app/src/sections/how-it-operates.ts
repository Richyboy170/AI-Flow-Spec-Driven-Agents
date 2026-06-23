/**
 * sections/how-it-operates.ts
 * ----------------------------
 * Four-step process showing how virtual banks operate from eKYC onboarding
 * through regulated digital banking services.
 */

export function initHowItOperates(): void {
  const app = document.getElementById('app')
  if (!app) return

  const steps = [
    {
      num: '01',
      title: 'Digital Identity Verification (eKYC)',
      body: 'Customers open accounts using electronic Know-Your-Customer (eKYC) — identity is verified via national ID, biometrics, or face recognition. No branch visit required. The whole process typically takes under 10 minutes.',
    },
    {
      num: '02',
      title: 'Account Opening &amp; Deposits',
      body: 'Once verified, customers hold a fully-fledged deposit account with the same legal protection as a traditional bank. In Thailand, deposits are covered up to THB 1 million under the Deposit Protection Agency.',
    },
    {
      num: '03',
      title: 'Credit Scoring &amp; Lending',
      body: 'Virtual banks use alternative data — bill-payment history, digital transaction patterns, platform usage — to build credit profiles for customers who lack formal credit histories. This unlocks loans for the previously unbanked.',
    },
    {
      num: '04',
      title: 'Ongoing Digital Services',
      body: 'All banking services — transfers, bill payments, loan management, investment products — are delivered through the app. Customer support is AI-assisted with human escalation. The bank operates under continuous regulator supervision.',
    },
  ]

  const section = document.createElement('section')
  section.id = 'how-it-operates'
  section.className = 'section section-alt reveal'
  section.setAttribute('aria-labelledby', 'how-heading')

  section.innerHTML = `
    <div class="container">
      <div class="section-header">
        <span class="section-eyebrow">The Process</span>
        <h2 id="how-heading">How Virtual Banks Operate</h2>
        <p class="section-lead">
          A fully digital experience from account opening to loan disbursement &#8212;
          with regulatory supervision at every step.
        </p>
      </div>
      <ol class="steps-list" aria-label="Virtual banking process steps">
        ${steps.map(s => `
          <li class="step-card">
            <div class="step-number" aria-hidden="true">${s.num}</div>
            <h3>${s.title}</h3>
            <p>${s.body}</p>
          </li>
        `).join('')}
      </ol>
    </div>
  `

  app.appendChild(section)
}
