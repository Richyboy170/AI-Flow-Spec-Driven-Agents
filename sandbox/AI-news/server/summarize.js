// Article summarization via Claude, with MANDATORY graceful degradation.
//
// CRITICAL model rules (verified; do not change):
//   - Official @anthropic-ai/sdk (NOT raw fetch).
//   - Model: claude-haiku-4-5-20251001
//   - client.messages.create with max_tokens ~160.
//   - DO NOT pass `thinking`. DO NOT pass `effort` / output_config.effort —
//     Haiku rejects effort/max.
//
// Graceful degradation: if ANTHROPIC_API_KEY is unset, skip the LLM entirely,
// report summariesEnabled:false, and keep the excerpt as `summary`. The site
// MUST fully work with no key.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 160;
const CONCURRENCY = 5;

const SYSTEM_PROMPT =
  'You summarize AI/ML news for working AI engineers in 2-3 sentences: ' +
  'what it is and why it matters technically. No preamble.';

function getSummarizeLimit() {
  const n = Number.parseInt(process.env.SUMMARIZE_LIMIT, 10);
  if (Number.isNaN(n) || n < 0) return 30;
  return n;
}

export function summariesEnabled() {
  return Boolean((process.env.ANTHROPIC_API_KEY || '').trim());
}

// Summary cache keyed by article id, so a refresh of the list doesn't re-pay
// for unchanged items.
const summaryCache = new Map(); // id -> summary string

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Summarize a single article via Claude. Throws on failure (caller falls back).
async function summarizeOne(article) {
  const content =
    `Title: ${article.title}\n` +
    (article.source ? `Source: ${article.source}\n` : '') +
    (article.url ? `URL: ${article.url}\n` : '') +
    `\n${article.excerpt || article.summary || ''}`;

  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  const text = (resp.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .trim();

  if (!text) throw new Error('empty summary from model');
  return text;
}

// Run an async worker over items with a fixed concurrency cap.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  const pool = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(pool);
  return results;
}

// Summarize a list of normalized articles in place (returns the same array).
//
// - No key: every article keeps its excerpt as `summary`, summarized:false.
// - With key: up to SUMMARIZE_LIMIT articles get an LLM summary; the rest keep
//   their excerpt. Each LLM call is isolated; a failure falls back to excerpt
//   for that item only. Results are cached by article id.
export async function summarizeArticles(articles) {
  if (!summariesEnabled()) {
    // Already defaulted to excerpt in normalizeArticle; just ensure non-empty.
    for (const a of articles) {
      if (!a.summary) a.summary = a.excerpt || a.title;
      a.summarized = false;
    }
    return articles;
  }

  const limit = getSummarizeLimit();
  const targets = articles.slice(0, limit);

  await mapWithConcurrency(targets, CONCURRENCY, async (article) => {
    // Serve from cache when we already summarized this exact article.
    if (summaryCache.has(article.id)) {
      article.summary = summaryCache.get(article.id);
      article.summarized = true;
      return;
    }
    try {
      const summary = await summarizeOne(article);
      summaryCache.set(article.id, summary);
      article.summary = summary;
      article.summarized = true;
    } catch {
      // Per-item fallback: keep excerpt, mark not-summarized.
      article.summary = article.excerpt || article.title;
      article.summarized = false;
    }
  });

  // Articles beyond the limit keep their excerpt (non-empty) summary.
  for (const a of articles) {
    if (!a.summary) a.summary = a.excerpt || a.title;
  }

  return articles;
}
