// Express app: the AI News Aggregator backend.
//
// Routes:
//   GET /api/news     — assembled, summarized, categorized news (cached).
//                       Query: ?category=<id|all>  ?refresh=true
//   GET /api/health   — liveness + cache age + summaries flag.
//
// In production (when web/dist exists) it also serves the built frontend as
// static files with SPA fallback. The whole pipeline is wrapped so a single
// failing source never produces a 500 — partial failures return HTTP 200 with
// articles:[]/partial articles + populated sources[] + a top-level error.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchAllSources } from './sources.js';
import { categorize, CATEGORY_IDS } from './categorize.js';
import { summarizeArticles, summariesEnabled } from './summarize.js';
import { getCached, setCached, getCacheAgeSeconds } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT, 10) || 8787;
const WEB_DIST = path.resolve(__dirname, '..', 'web', 'dist');
const STARTED_AT = Date.now();

const app = express();

// CORS for the Vite dev server (frontend on 5173 calling the API directly).
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })
);

// Strip the internal-only `excerpt` field before sending an article out.
function publicArticle(a) {
  const { excerpt, ...rest } = a;
  return rest;
}

// Build the full payload (fetch -> categorize -> summarize). Never throws;
// returns a contract-shaped object even when everything fails.
async function buildPayload() {
  let sources = [];
  let articles = [];
  let topLevelError = null;

  try {
    const fetched = await fetchAllSources();
    sources = fetched.sources;
    articles = fetched.articles;
  } catch (err) {
    // Total fetch failure — still return a friendly, contract-shaped payload.
    topLevelError = 'All sources failed to load. Try again shortly.';
    return {
      lastUpdated: new Date().toISOString(),
      cached: false,
      articleCount: 0,
      sources,
      summariesEnabled: summariesEnabled(),
      articles: [],
      error: topLevelError,
      _builtAt: Date.now(),
    };
  }

  // Assign categories.
  for (const a of articles) {
    a.category = categorize(a);
  }

  // Summarize (LLM or excerpt fallback). Never throws.
  try {
    await summarizeArticles(articles);
  } catch {
    for (const a of articles) {
      if (!a.summary) a.summary = a.excerpt || a.title;
    }
  }

  const anyOk = sources.some((s) => s.ok);
  if (!anyOk || articles.length === 0) {
    topLevelError = 'All sources failed to load. Try again shortly.';
  }

  return {
    lastUpdated: new Date().toISOString(),
    cached: false,
    articleCount: articles.length,
    sources,
    summariesEnabled: summariesEnabled(),
    articles,
    ...(topLevelError ? { error: topLevelError } : {}),
    _builtAt: Date.now(),
  };
}

// Get a payload, honoring the TTL cache unless refresh=true.
async function getPayload({ refresh }) {
  if (!refresh) {
    const cached = getCached();
    if (cached) {
      return { ...cached, cached: true };
    }
  }
  const fresh = await buildPayload();
  // Only cache a payload that actually has articles (don't cache a failure).
  if (fresh.articleCount > 0) {
    setCached(fresh);
  }
  return fresh;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
    cacheAgeSeconds: getCacheAgeSeconds(),
    summariesEnabled: summariesEnabled(),
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const refresh = String(req.query.refresh || '').toLowerCase() === 'true';
    const category = String(req.query.category || 'all').toLowerCase();

    const payload = await getPayload({ refresh });

    // Optional server-side category filter (frontend also filters client-side).
    let articles = payload.articles;
    if (category !== 'all' && CATEGORY_IDS.includes(category)) {
      articles = articles.filter((a) => a.category === category);
    }

    const { _builtAt, articles: _drop, ...meta } = payload;
    res.status(200).json({
      ...meta,
      articleCount: articles.length,
      articles: articles.map(publicArticle),
    });
  } catch (err) {
    // Last-resort guard: still HTTP 200 with a friendly, contract-shaped body.
    res.status(200).json({
      lastUpdated: new Date().toISOString(),
      cached: false,
      articleCount: 0,
      sources: [],
      summariesEnabled: summariesEnabled(),
      articles: [],
      error: 'All sources failed to load. Try again shortly.',
    });
  }
});

// ---------------------------------------------------------------------------
// Static frontend (production) — only mounted when web/dist exists, so the
// API still boots cleanly while the frontend is being built in parallel.
// ---------------------------------------------------------------------------

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  // SPA fallback: anything not under /api -> index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
  console.log(`[ai-news] serving built frontend from ${WEB_DIST}`);
} else {
  console.log('[ai-news] web/dist not found — running API-only (dev mode)');
}

app.listen(PORT, () => {
  console.log(`[ai-news] API listening on http://localhost:${PORT}`);
  console.log(`[ai-news] summaries ${summariesEnabled() ? 'ENABLED' : 'DISABLED (no ANTHROPIC_API_KEY)'}`);
});

export default app;
