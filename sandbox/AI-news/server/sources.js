// Source registry + fetchers.
//
// REQUIRED live sources (must actually hit the network):
//   - Hacker News (Algolia search_by_date JSON API, keyless)
//   - ArXiv (Atom API, cats cs.AI/cs.LG/stat.ML, newest first)
//
// BEST-EFFORT RSS/Atom blogs (each isolated in its own try/catch + timeout):
//   - Hugging Face blog, OpenAI, Google DeepMind, The Batch (deeplearning.ai)
//
// OPTIONAL key-gated: NewsAPI.org (only when NEWSAPI_KEY is set).
//
// Every source is wrapped so one failure NEVER fails the whole response:
// a failing/timing-out source records { id, name, ok:false, error } and is
// skipped. Every item is normalized to the contract's article shape, given a
// stable id (sha-256 of its url), and the full set is deduped by url.

import crypto from 'node:crypto';
import Parser from 'rss-parser';

const DEFAULT_TIMEOUT_MS = 8000;
const ARXIV_TIMEOUT_MS = 10000;

const rssParser = new Parser({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'User-Agent': 'AI-News-Aggregator/1.0 (+https://localhost)' },
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function stableId(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

// Collapse all whitespace (Atom titles/summaries carry embedded newlines).
function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(text, max = 280) {
  const clean = normalizeWhitespace(stripHtml(text));
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
}

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Only accept http(s) URLs. Feeds are untrusted input; a malicious/compromised
// feed could emit a `javascript:` (or other scheme) url that becomes an anchor
// href in the frontend. React does not sanitize non-http hrefs, so we reject
// any non-http(s) scheme here at the ingest boundary.
function safeHttpUrl(url) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

// fetch with an AbortController timeout.
async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...opts } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Build a normalized article. Guarantees a non-empty `excerpt` via a fallback
// chain (description/text -> title) so a later summary is never empty.
function normalizeArticle({
  rawId,
  title,
  url,
  source,
  sourceId,
  description,
  publishedAt,
  author = null,
  points = 0,
  commentsUrl = null,
}) {
  const cleanTitle = normalizeWhitespace(title) || 'Untitled';
  const finalUrl = safeHttpUrl(url);

  // Excerpt fallback chain: description -> title (never empty).
  let excerpt = makeExcerpt(description);
  if (!excerpt) excerpt = cleanTitle;

  // Stable id: hash of url when present, else the provided rawId (e.g. HN
  // permalink for null-url posts) so text/Ask-HN posts don't all collide.
  const idSeed = finalUrl || rawId || cleanTitle;

  return {
    id: stableId(idSeed),
    title: cleanTitle,
    url: finalUrl,
    source,
    sourceId,
    category: 'other', // assigned later by categorize()
    excerpt, // internal: used for summary fallback; stripped before response
    summary: excerpt, // default; summarize() may overwrite
    summarized: false,
    publishedAt: toIso(publishedAt),
    author: author || null,
    points: Number.isFinite(points) ? points : 0,
    commentsUrl: safeHttpUrl(commentsUrl),
  };
}

// ---------------------------------------------------------------------------
// Hacker News (Algolia) — keyless JSON
// ---------------------------------------------------------------------------

const HN_QUERIES = ['AI', 'LLM', 'machine learning'];

async function fetchHackerNews() {
  const id = 'hackernews';
  const name = 'Hacker News';
  try {
    // Per-query allSettled so one slow/failing query doesn't drop all HN results.
    const perQuery = await Promise.allSettled(
      HN_QUERIES.map(async (q) => {
        const url =
          'https://hn.algolia.com/api/v1/search_by_date?tags=story' +
          `&query=${encodeURIComponent(q)}&hitsPerPage=20`;
        const res = await fetchWithTimeout(url, { timeoutMs: DEFAULT_TIMEOUT_MS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.hits) ? data.hits : [];
      })
    );

    const hits = perQuery
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    // If every query failed, surface it as a source failure.
    if (hits.length === 0 && perQuery.every((r) => r.status === 'rejected')) {
      const reason = perQuery[0] && perQuery[0].reason;
      throw reason instanceof Error ? reason : new Error('all HN queries failed');
    }

    const articles = hits
      .filter((h) => h && (h.title || h.story_title))
      .map((h) => {
        const objectId = h.objectID;
        const permalink = `https://news.ycombinator.com/item?id=${objectId}`;
        // Link posts have h.url; Ask/text posts have url:null -> use permalink.
        const url = h.url || permalink;
        const description = h.story_text || h.comment_text || '';
        return normalizeArticle({
          rawId: permalink,
          title: h.title || h.story_title,
          url,
          source: name,
          sourceId: id,
          description,
          publishedAt: h.created_at,
          author: h.author || null,
          points: typeof h.points === 'number' ? h.points : 0,
          commentsUrl: permalink,
        });
      });

    return { source: { id, name, ok: true, error: null }, articles };
  } catch (err) {
    return { source: { id, name, ok: false, error: errMessage(err) }, articles: [] };
  }
}

// ---------------------------------------------------------------------------
// ArXiv — Atom API via rss-parser (https to avoid the http->https 301)
// ---------------------------------------------------------------------------

async function fetchArxiv() {
  const id = 'arxiv-ai';
  const name = 'ArXiv cs.AI/cs.LG/stat.ML';
  try {
    const url =
      'https://export.arxiv.org/api/query?search_query=' +
      'cat:cs.AI+OR+cat:cs.LG+OR+cat:stat.ML' +
      '&sortBy=submittedDate&sortOrder=descending&max_results=20';

    const res = await fetchWithTimeout(url, { timeoutMs: ARXIV_TIMEOUT_MS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const feed = await rssParser.parseString(xml);

    const articles = (feed.items || []).map((item) => {
      // rss-parser maps Atom <author><name> to item.creator/author; arxiv
      // nests author objects, so fall back across a few shapes.
      let author = item.creator || item.author || null;
      if (author && typeof author === 'object') author = author.name || null;

      return normalizeArticle({
        rawId: item.id || item.guid || item.link,
        title: item.title,
        url: item.link || item.id,
        source: 'ArXiv',
        sourceId: id,
        description: item.summary || item.contentSnippet || item.content || '',
        publishedAt: item.isoDate || item.pubDate,
        author,
      });
    });

    return { source: { id, name, ok: true, error: null }, articles };
  } catch (err) {
    return { source: { id, name, ok: false, error: errMessage(err) }, articles: [] };
  }
}

// ---------------------------------------------------------------------------
// Best-effort RSS/Atom blogs
// ---------------------------------------------------------------------------

const BLOG_FEEDS = [
  { id: 'huggingface', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { id: 'openai', name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { id: 'deepmind', name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
  { id: 'thebatch', name: 'The Batch (deeplearning.ai)', url: 'https://www.deeplearning.ai/the-batch/feed/' },
];

async function fetchBlogFeed({ id, name, url }) {
  try {
    // rss-parser has its own timeout, but wrap in a hard cap too.
    const feed = await withHardTimeout(rssParser.parseURL(url), DEFAULT_TIMEOUT_MS);
    const articles = (feed.items || []).slice(0, 15).map((item) =>
      normalizeArticle({
        rawId: item.guid || item.id || item.link,
        title: item.title,
        url: item.link,
        source: name,
        sourceId: id,
        description:
          item.contentSnippet || item.summary || item.content || item['content:encoded'] || '',
        publishedAt: item.isoDate || item.pubDate,
        author: item.creator || item.author || null,
      })
    );
    return { source: { id, name, ok: true, error: null }, articles };
  } catch (err) {
    return { source: { id, name, ok: false, error: errMessage(err) }, articles: [] };
  }
}

// ---------------------------------------------------------------------------
// Optional: NewsAPI.org (only when NEWSAPI_KEY is set)
// ---------------------------------------------------------------------------

async function fetchNewsApi() {
  const key = (process.env.NEWSAPI_KEY || '').trim();
  if (!key) return null; // not configured -> not a source, not a failure

  const id = 'newsapi';
  const name = 'NewsAPI';
  try {
    const url =
      'https://newsapi.org/v2/everything?q=' +
      encodeURIComponent('artificial intelligence OR LLM OR machine learning') +
      '&language=en&sortBy=publishedAt&pageSize=20';
    const res = await fetchWithTimeout(url, {
      timeoutMs: DEFAULT_TIMEOUT_MS,
      headers: { 'X-Api-Key': key },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const articles = (data.articles || []).map((a) =>
      normalizeArticle({
        rawId: a.url,
        title: a.title,
        url: a.url,
        source: a.source?.name ? `NewsAPI: ${a.source.name}` : name,
        sourceId: id,
        description: a.description || a.content || '',
        publishedAt: a.publishedAt,
        author: a.author || null,
      })
    );
    return { source: { id, name, ok: true, error: null }, articles };
  } catch (err) {
    return { source: { id, name, ok: false, error: errMessage(err) }, articles: [] };
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

function errMessage(err) {
  if (!err) return 'unknown error';
  if (err.name === 'AbortError') return 'timeout';
  return err.message || String(err);
}

function withHardTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Dedup by url, first-seen wins (preserves source attribution + order).
function dedupeByUrl(articles) {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const key = a.url || a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

// Fetch every source concurrently. Returns { sources, articles } where
// `sources` is the per-source health array and `articles` are normalized,
// deduped, and sorted newest-first (nulls last).
export async function fetchAllSources() {
  const tasks = [
    fetchHackerNews(),
    fetchArxiv(),
    ...BLOG_FEEDS.map((f) => fetchBlogFeed(f)),
    fetchNewsApi(),
  ];

  const settled = await Promise.allSettled(tasks);

  const sources = [];
  let merged = [];

  for (const result of settled) {
    if (result.status === 'rejected') {
      // Should not happen (each fetcher catches internally) but stay safe.
      sources.push({ id: 'unknown', name: 'Unknown source', ok: false, error: errMessage(result.reason) });
      continue;
    }
    const value = result.value;
    if (value === null) continue; // e.g. NewsAPI not configured
    sources.push(value.source);
    merged = merged.concat(value.articles);
  }

  const deduped = dedupeByUrl(merged);

  deduped.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : -Infinity;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : -Infinity;
    return tb - ta;
  });

  return { sources, articles: deduped };
}
