# AI News Aggregator — API & Data Contract (v1)

This is the load-bearing coordination artifact. Backend and frontend are built in parallel against this contract. Do not change a field name or shape without updating this file and notifying both owners.

## Project root
`C:\Users\cf306237\Desktop\Projects\tidlor-reborn\sandbox\AI-news\`

## Architecture
- **Backend**: Node.js + Express. Owns ALL external fetching (RSS, Hacker News API, optional NewsAPI), LLM summarization, and caching. Serves a local JSON API + serves the built frontend as static files in production.
- **Frontend**: React + Vite + Tailwind CSS (dark mode). Calls ONLY the local backend API. Never fetches external sources directly (CORS would block it).
- **Why a backend at all**: Browser-direct fetches of ArXiv/blog RSS are CORS-blocked, and the Claude API key must never ship to the client. All external I/O and summarization happen server-side.

## Directory layout (agreed ownership)
```
AI-news/
  CONTRACT.md            (this file — coordinator owns)
  README.md              (coordinator/integration owns)
  .env.example           (backend owns)
  .gitignore             (backend owns)
  package.json           (ROOT — backend owns; runs both via scripts)
  server/                (BACKEND OWNS — do not edit from frontend)
    index.js             Express app, routes, static serving
    sources.js           source registry + RSS/HN fetchers
    summarize.js         Claude summarization + graceful no-key fallback
    cache.js             in-memory TTL cache
    categorize.js        category classification per article
  web/                   (FRONTEND OWNS — do not edit from backend)
    index.html
    vite.config.js       (must proxy /api -> backend in dev)
    tailwind.config.js
    postcss.config.js
    package.json         (frontend deps)
    src/
      main.jsx
      App.jsx
      index.css
      api.js             (fetch wrapper hitting /api/news)
      components/*.jsx
```

## The single API endpoint

### `GET /api/news`
Optional query params:
- `category` — one of the category ids below, or `all` (default). Filtering MAY be done server-side or client-side; frontend should support client-side filtering regardless so it works on the full payload.
- `refresh` — `true` to bypass cache and force a re-fetch. Default false.

**Success response (HTTP 200):**
```json
{
  "lastUpdated": "2026-06-19T12:00:00.000Z",
  "cached": true,
  "articleCount": 42,
  "sources": [
    { "id": "hackernews", "name": "Hacker News", "ok": true, "error": null },
    { "id": "arxiv-ai",   "name": "ArXiv cs.AI", "ok": false, "error": "timeout" }
  ],
  "summariesEnabled": true,
  "articles": [
    {
      "id": "stable-unique-string",
      "title": "Article title",
      "url": "https://original.source/article",
      "source": "Hacker News",
      "sourceId": "hackernews",
      "category": "research",
      "summary": "2-3 sentence LLM summary, or the article excerpt if summaries are disabled.",
      "summarized": true,
      "publishedAt": "2026-06-19T09:30:00.000Z",
      "author": "optional string or null",
      "points": 0,
      "commentsUrl": "optional string or null"
    }
  ]
}
```

Field notes:
- `id` MUST be stable for a given article (hash of url is fine) so React keys and dedup work.
- `summary` is ALWAYS a non-empty string. When the Claude key is absent or summarization fails for an item, fall back to the article's own excerpt/description (truncated ~280 chars). `summarized` reflects whether an LLM actually produced it.
- `summariesEnabled` is `false` when no `ANTHROPIC_API_KEY` is set — frontend shows a subtle note ("AI summaries disabled — showing source excerpts").
- `publishedAt` ISO 8601 or null. Frontend sorts newest first; handle null (treat as oldest).
- `points` / `commentsUrl` are Hacker-News-specific; null/0 for other sources. Frontend renders them only when present.
- `sources[]` lets the frontend show per-source health and a friendly partial-failure banner.

**Error response (HTTP 200 with empty articles, OR 5xx):**
Prefer returning HTTP 200 with `articles: []` and populated `sources[]` describing what failed, plus a top-level `error` string, so the UI can always render a friendly state. Only return 5xx for total server failure.
```json
{ "lastUpdated": "...", "cached": false, "articleCount": 0, "sources": [...], "summariesEnabled": false, "articles": [], "error": "All sources failed to load. Try again shortly." }
```

### `GET /api/health`
`{ "status": "ok", "uptimeSeconds": 123, "cacheAgeSeconds": 45, "summariesEnabled": true }`

## Categories (fixed enum — both sides hardcode these)
| id          | label             |
|-------------|-------------------|
| `research`  | Research Papers   |
| `tools`     | Tools & Libraries |
| `industry`  | Industry News     |
| `models`    | Model Releases    |
| `tutorials` | Tutorials         |
| `other`     | Other             |

Every article gets exactly one category. `other` is the fallback. The frontend filter bar shows: All + the six above.

## Sources (backend selects a reliable combination)
Keyless / reliable (always on):
- **Hacker News** — Algolia API `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI` (and/or `query=LLM`, `machine learning`). No key, CORS-irrelevant server-side.
- **ArXiv** — Atom API `http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:stat.ML&sortBy=submittedDate&sortOrder=descending&max_results=15`
- **RSS blogs (best-effort, per-source try/catch)**: Hugging Face blog, OpenAI blog/news, Google DeepMind blog, The Batch (deeplearning.ai). Use a server-side RSS/Atom parser. If a feed 404s or times out, record it in `sources[]` and continue.

Optional (key-gated, best-effort): NewsAPI.org if `NEWSAPI_KEY` is set.

Every source must be wrapped in try/catch with a timeout; one failing source must never fail the whole response. This double-serves the "friendly error message" requirement.

## Summarization (backend, server-side only)
- Model: `claude-haiku-4-5-20251001` (verified valid; alias `claude-haiku-4-5` also works). Pricing $1/$5 per 1M tok.
- Use the official `anthropic` Node SDK (`@anthropic-ai/sdk`), `client.messages.create`. NOT raw fetch.
- Params for short summary: `max_tokens: ~160`, NO `thinking`, NO `effort` (Haiku rejects `effort`/`max`). System prompt: "You summarize AI/ML news for working AI engineers in 2-3 sentences: what it is and why it matters technically. No preamble."
- **Graceful degradation**: if `ANTHROPIC_API_KEY` is unset, skip the LLM entirely, set `summariesEnabled: false`, and use excerpts as `summary`. The site MUST fully work with no key (a reviewer may not have one).
- Summarize concurrently with a small concurrency cap (e.g. 5) and a per-call try/catch so one failure falls back to excerpt for that item only.
- Cache summaries by article id so a refresh of the article list doesn't re-pay for unchanged items.

## Caching (backend)
- In-memory TTL cache, default 45 minutes (config via `CACHE_TTL_MINUTES`, must be in the 30-60 range per spec). `refresh=true` bypasses it. Expose cache age via `cached` flag and `/api/health`.

## Environment variables (.env.example must list all)
```
ANTHROPIC_API_KEY=        # optional — without it, summaries are disabled but the site still works
NEWSAPI_KEY=              # optional — extra source
PORT=8787                 # backend port
CACHE_TTL_MINUTES=45      # 30-60
SUMMARIZE_LIMIT=30        # cap how many articles get LLM summaries per cycle (cost control)
```

## Dev/run workflow (must be in README + package.json scripts)
- Dev: backend on PORT (default 8787); Vite dev server on 5173 proxying `/api` -> backend.
- One command to run both in dev (e.g. `npm run dev` via `concurrently`).
- Prod: `npm run build` (builds web), then `npm start` serves API + built static `web/dist` from Express.
- Node 24 / npm 11 are installed. Windows + PowerShell environment.

## Non-negotiable deliverables (spec)
- `README.md` with setup + env vars + how to run.
- `.env.example` listing all keys.
- Real dynamic data (HN + ArXiv at minimum actually fetched live).
- "Last updated" timestamp visible in UI (from `lastUpdated`).
- Error states / friendly messages when sources or summaries fail.
- Dark, card-based, responsive, professional engineering aesthetic.
- Sources shown as styled TEXT badges (NOT downloaded brand logos — visual-asset gate deliberately not triggered; sources are data, not design assets).
