/**
 * sections/thailand.ts
 * ---------------------
 * Thailand virtual banking landscape: BOT regulator header, three consortium
 * cards with REAL logo images sourced from app/assets/ via Vite asset URLs.
 *
 * Logo approach: new URL('../../assets/<file>', import.meta.url).href
 *   - Vite processes each static string at build time, copies the asset to
 *     dist/ with a hashed filename, and rewrites the URL — resolving correctly
 *     under the /tidlor-reborn/ GitHub Pages subpath.
 *
 * Gulf Energy: no clean logo in manifest — rendered as a text badge instead.
 * WeTechnology: no public logo — WeBank logo used as an approved proxy
 *   (inspectionStatus: "accepted-proxy").
 */

// ── Asset URLs ─────────────────────────────────────────────────────────────
// BOT
const botLogoUrl = new URL('../../assets/brand-bot-logo-page-image-ff828d1ca9.png', import.meta.url).href

// Consortium 01 — SCBX / KakaoBank / WeBank
const scbxLogoUrl     = new URL('../../assets/brand-scbx-logo-black-c87bc77059.webp', import.meta.url).href
const kakaoBankLogoUrl = new URL('../../assets/brand-kakaobank-logo-open-graph-image-871faae049.png', import.meta.url).href
const weBankLogoUrl   = new URL('../../assets/brand-wetechnology-webank-logo-open-graph-image-d1f9111349.png', import.meta.url).href

// Consortium 02 — Krungthai Bank / Gulf / AIS / PTT OR
const ktbLogoUrl   = new URL('../../assets/brand-ktb-logo-full-14e0f3147d.png', import.meta.url).href
const aisLogoUrl   = new URL('../../assets/brand-ais-logo-open-graph-image-624f1bd7e4.png', import.meta.url).href
const pttOrLogoUrl = new URL('../../assets/brand-ptt-or-logo-8801736cb5.png', import.meta.url).href

// Consortium 03 — Ascend Money / TrueMoney / Ant Group
const ascendMoneyLogoUrl = new URL('../../assets/brand-ascend-money-logo-e418f9492b.png', import.meta.url).href
const trueMoneyLogoUrl   = new URL('../../assets/brand-truemoney-logo-966e30e2c1.png', import.meta.url).href
const antGroupLogoUrl    = new URL('../../assets/brand-ant-group-logo-7a25eea940.png', import.meta.url).href

// ── Types ──────────────────────────────────────────────────────────────────
interface LogoBadge {
  name: string
  role: string
  logoUrl?: string      // undefined = text badge (no clean logo available)
  altText?: string
  proxyNote?: string    // displayed when the logo is an approved proxy
}

interface Consortium {
  num: string
  name: string
  description: string
  members: LogoBadge[]
}

// ── Consortium data ────────────────────────────────────────────────────────
const consortiums: Consortium[] = [
  {
    num: '01',
    name: 'SCBX Consortium',
    description:
      "Led by SCB X, the digital holding company of Siam Commercial Bank (one of Thailand's Big-4 banks), in partnership with South Korea's KakaoBank — one of Asia's most successful internet banks — and WeBank / WeTechnology, Tencent's China-based digital bank powerhouse.",
    members: [
      {
        name: 'SCB X',
        role: 'Lead — Thai digital financial holding',
        logoUrl: scbxLogoUrl,
        altText: 'SCB X wordmark',
      },
      {
        name: 'KakaoBank',
        role: 'Technology partner — South Korea',
        logoUrl: kakaoBankLogoUrl,
        altText: 'KakaoBank logo',
      },
      {
        name: 'WeBank',
        role: 'Technology partner — China',
        logoUrl: weBankLogoUrl,
        altText: 'WeBank logo',
        proxyNote: 'WeBank proxy for WeTechnology',
      },
    ],
  },
  {
    num: '02',
    name: 'Krungthai Bank Consortium',
    description:
      "Led by state-backed Krungthai Bank (KTB) — one of Thailand's largest government-linked banks — with Gulf Energy (power/infrastructure), AIS (Thailand's largest mobile operator), and PTT OR (retail fuel &amp; services giant) as strategic co-investors.",
    members: [
      {
        name: 'Krungthai Bank',
        role: 'Lead — state-owned commercial bank',
        logoUrl: ktbLogoUrl,
        altText: 'Krungthai Bank emblem',
      },
      {
        name: 'Gulf',
        role: 'Energy sector partner',
        // No clean logo captured — rendered as text badge
      },
      {
        name: 'AIS',
        role: "Thailand's largest telecom",
        logoUrl: aisLogoUrl,
        altText: 'AIS logo',
      },
      {
        name: 'PTT OR',
        role: 'Retail &amp; energy partner',
        logoUrl: pttOrLogoUrl,
        altText: 'PTT OR logo',
      },
    ],
  },
  {
    num: '03',
    name: 'Ascend Money Consortium',
    description:
      "Led by Ascend Money, the fintech arm of CP Group (Thailand's largest conglomerate) and operator of the TrueMoney digital wallet. Ant Group — the global payments and financial services giant behind Alipay — joins as a strategic technology and capital partner.",
    members: [
      {
        name: 'Ascend Money',
        role: 'Lead — CP Group fintech arm',
        logoUrl: ascendMoneyLogoUrl,
        altText: 'Ascend Money logo',
      },
      {
        name: 'TrueMoney',
        role: 'Consumer brand — digital wallet',
        logoUrl: trueMoneyLogoUrl,
        altText: 'TrueMoney logo',
      },
      {
        name: 'Ant Group',
        role: 'Technology &amp; strategy — China',
        logoUrl: antGroupLogoUrl,
        altText: 'Ant Group logo',
      },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function buildLogoBadge(member: LogoBadge): string {
  const imageBlock = member.logoUrl
    ? `<div class="logo-img-wrap">
         <img src="${member.logoUrl}" alt="${member.altText ?? member.name}" loading="lazy" />
       </div>`
    : `<div class="logo-text-wrap" aria-label="${member.name} (text label — no official logo available)">${member.name}</div>`

  const proxyNote = member.proxyNote
    ? `<span class="logo-badge-note">${member.proxyNote}</span>`
    : ''

  return `
    <div class="logo-badge">
      ${imageBlock}
      <span class="logo-name">${member.name}</span>
      <span class="logo-name" style="color:var(--color-text-faint);font-size:0.65rem">${member.role}</span>
      ${proxyNote}
    </div>
  `
}

function buildConsortiumCard(c: Consortium): string {
  return `
    <article class="consortium-card" aria-labelledby="consortium-${c.num}-heading">
      <div class="consortium-badge">
        <span class="consortium-num">${c.num}</span>
        <span class="consortium-label">Consortium</span>
      </div>
      <h3 id="consortium-${c.num}-heading">${c.name}</h3>
      <p>${c.description}</p>
      <div class="logo-grid" role="list" aria-label="${c.name} member organisations">
        ${c.members.map(m => `<div role="listitem">${buildLogoBadge(m)}</div>`).join('')}
      </div>
    </article>
  `
}

// ── Section builder ────────────────────────────────────────────────────────
export function initThailand(): void {
  const app = document.getElementById('app')
  if (!app) return

  const section = document.createElement('section')
  section.id = 'thailand'
  section.className = 'section reveal'
  section.setAttribute('aria-labelledby', 'thailand-heading')

  section.innerHTML = `
    <div class="container">
      <div class="section-header">
        <span class="section-eyebrow">Thailand 2025</span>
        <h2 id="thailand-heading">Three Approved Virtual Banks</h2>
        <p class="section-lead">
          In June 2025, the Bank of Thailand granted three virtual banking licences,
          marking Thailand&#8217;s entry into licensed branchless banking.
          Commercial launch is expected in 2026.
        </p>
      </div>

      <!-- BOT regulator header -->
      <div class="bot-header" aria-label="Regulator: Bank of Thailand">
        <div class="bot-logo-badge">
          <img
            src="${botLogoUrl}"
            alt="Bank of Thailand official logo"
            height="48"
            loading="eager"
          />
        </div>
        <p class="bot-tagline">
          The <strong>Bank of Thailand (BOT)</strong> is the sole licensing authority
          for virtual banks. All three consortiums must pass a preparation period
          and receive BOT approval before commencing commercial operations.
        </p>
      </div>

      <!-- Three consortium cards -->
      <div class="consortiums-grid" role="list" aria-label="Approved virtual bank consortiums">
        ${consortiums.map(c => `<div role="listitem">${buildConsortiumCard(c)}</div>`).join('')}
      </div>
    </div>
  `

  app.appendChild(section)
}
