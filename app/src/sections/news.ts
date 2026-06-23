/**
 * sections/news.ts
 * -----------------
 * Renders a card grid of real, factual news items about virtual banking in
 * Thailand and globally, imported directly from src/data/news.json.
 */

import newsData from '../data/news.json'

interface NewsItem {
  id: string
  title: string
  date: string
  source: string
  sourceUrl: string
  summary: string
  tags: string[]
}

const articles = newsData as NewsItem[]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildNewsCard(item: NewsItem): string {
  const tags = item.tags
    .slice(0, 2)
    .map(t => `<span class="news-tag">${t}</span>`)
    .join('')

  return `
    <article class="news-card" aria-labelledby="news-${item.id}">
      <div class="news-card-meta">
        <time class="news-date" datetime="${item.date}">${formatDate(item.date)}</time>
        <div class="news-tags" aria-label="Tags">${tags}</div>
      </div>
      <h3 id="news-${item.id}">${item.title}</h3>
      <p>${item.summary}</p>
      <a
        class="news-source-link"
        href="${item.sourceUrl}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="${item.title} — source: ${item.source} (opens in new tab)"
      >
        ${item.source}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 9.5L9.5 2.5M9.5 2.5H5M9.5 2.5V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </article>
  `
}

export function initNews(): void {
  const app = document.getElementById('app')
  if (!app) return

  const section = document.createElement('section')
  section.id = 'news'
  section.className = 'section reveal'
  section.setAttribute('aria-labelledby', 'news-heading')

  section.innerHTML = `
    <div class="container">
      <div class="section-header">
        <span class="section-eyebrow">Industry News</span>
        <h2 id="news-heading">Virtual Banking Around the World</h2>
        <p class="section-lead">
          Key milestones and regulatory developments shaping the global virtual
          banking landscape &#8212; from Thailand to South Korea, China, and beyond.
        </p>
      </div>
      <div class="news-grid" role="list" aria-label="Virtual banking news articles">
        ${articles.map(a => `<div role="listitem">${buildNewsCard(a)}</div>`).join('')}
      </div>
      <p style="margin-top:2rem;font-size:0.8rem;color:var(--color-text-faint);text-align:center">
        News items are factual summaries for educational context. Links point to
        official or primary sources. This page is not a news publication.
      </p>
    </div>
  `

  app.appendChild(section)
}
