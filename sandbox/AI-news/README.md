# AI Engineering News

An interactive, dynamically-updated news aggregator for AI engineers. It pulls **real, live** AI/ML news from multiple sources, optionally summarizes each item with Claude, links every card to the original source, and renders it in a clean, dark, card-based UI with category filters and a "last updated" timestamp.

It works **with or without** an API key — without one, summaries fall back to source excerpts and the site still functions fully.

## What it does

- **Aggregates real news** from:
  - **Hacker News** (Algolia API — keyless) — AI / LLM / machine-learning stories
  - **ArXiv** (Atom API) — newest `cs.AI`, `cs.LG`, `stat.ML` papers
  - **Hugging Face Blog**, **OpenAI**, **Google DeepMind**, **The Batch (deeplearning.ai)** — best-effort RSS/Atom feeds
  - **NewsAPI.org** — optional extra source, enabled only when a key is set
- **Summarizes each article** with Claude (`claude-haiku-4-5-20251001`) into a 2-3 sentence "what it is + why it matters" blurb. No key → excerpt fallback.
- **Links to the original source** on every card (opens in a new tab).
- **Categorizes & filters**: Research Papers, Tools & Libraries, Industry News, Model Releases, Tutorials, Other.
- **Live & cached**: fetches fresh data, caches results 30-60 min (default 45) to avoid hammering APIs; a Refresh button forces a re-fetch.
- **Resilient**: any single source can fail (timeout, 404) without breaking the page — per-source health is shown and a friendly banner appears on partial/total failure.

## Architecture

```
Browser (React + Vite + Tailwind, dark mode)
        │  calls ONLY same-origin /api/*
        ▼
Express backend (Node)
        ├─ fetches all external sources server-side (avoids browser CORS)
        ├─ summarizes via the Anthropic SDK (key stays server-side)
        ├─ in-memory TTL cache (30-60 min)
        └─ in production, also serves the built frontend (web/dist)
```

All external fetching and summarization happen on the **server**: browser-direct RSS fetches are CORS-blocked, and the Claude API key must never reach the client. The frontend talks only to the local `/api`. The full API/data contract lives in [`CONTRACT.md`](./CONTRACT.md).

## Prerequisites

- **Node.js >= 20** (developed/verified on Node 24)
- npm

## Setup

```powershell
# from the project root: sandbox/AI-news
npm install          # installs backend deps
copy .env.example .env   # (PowerShell)  — or:  cp .env.example .env
```

Edit `.env` if you want AI summaries (optional — see below).

### Environment variables (`.env.example`)

| Variable             | Required | Default | Purpose |
|----------------------|----------|---------|---------|
| `ANTHROPIC_API_KEY`  | No       | (empty) | Enables Claude summaries. **If empty, summaries are disabled and source excerpts are shown — the site still works.** |
| `NEWSAPI_KEY`        | No       | (empty) | Adds NewsAPI.org as an extra source. Skipped if empty. |
| `PORT`               | No       | `8787`  | Backend HTTP port. |
| `CACHE_TTL_MINUTES`  | No       | `45`    | Cache lifetime, clamped to the 30-60 range. |
| `SUMMARIZE_LIMIT`    | No       | `30`    | Max articles summarized per fetch cycle (cost control; only relevant with an API key). |

## Running

### Development (hot reload, two processes)

```powershell
npm run dev
```

- Backend (with `--watch`) on `http://localhost:8787`
- Vite dev server on `http://localhost:5173` (this is the URL you open) — it proxies `/api` to the backend.

Open **http://localhost:5173**.

### Production (single server)

```powershell
npm run build    # installs web deps and builds web/dist
npm start        # serves the API AND the built frontend from one port
```

Then open **http://localhost:8787** (or whatever `PORT` you set). The Express server serves the built SPA at `/` and the API at `/api/*`.

## API

The frontend uses a single endpoint; see [`CONTRACT.md`](./CONTRACT.md) for the full response schema.

- `GET /api/news` — `?category=<id>|all` and `?refresh=true` (bypass cache). Returns `{ lastUpdated, cached, articleCount, sources[], summariesEnabled, articles[] }`. On source failures it still returns 200 with an `error`/per-source health so the UI degrades gracefully.
- `GET /api/health` — `{ status, uptimeSeconds, cacheAgeSeconds, summariesEnabled }`.

## Verified behavior

This build was run end-to-end and confirmed working:

- `npm start` with **no API key** returned **124 real articles** live from Hacker News, ArXiv, Hugging Face, OpenAI, and DeepMind, every article carrying a non-empty summary (excerpt fallback), a valid category, and a stable id (deduped).
- `summariesEnabled: false` with no key; the UI shows a note that excerpts are displayed.
- A failing feed (The Batch returned HTTP 404 at the time of verification) was recorded in `sources[]` as `ok:false` and did **not** break the response — exactly the intended graceful degradation.
- In production mode, Express served the built SPA at `/`, the hashed JS/CSS assets, an SPA fallback for unknown routes, and the API same-origin.

> Note on summary quality without a key: Hacker News link posts often have no body text, so their excerpt fallback can be just the title. Set `ANTHROPIC_API_KEY` to get real 2-3 sentence Claude summaries for those.

## Project structure

```
AI-news/
  CONTRACT.md            API/data contract (source of truth for both layers)
  README.md              this file
  .env.example           all environment variables
  package.json           root scripts (dev / build / start)
  server/                Express backend
    index.js             app, routes (/api/news, /api/health), static serving
    sources.js           HN + ArXiv + blog RSS + optional NewsAPI fetchers
    summarize.js         Claude summaries + no-key excerpt fallback
    categorize.js        per-article category classification
    cache.js             in-memory TTL cache
  web/                   React + Vite + Tailwind frontend
    src/
      App.jsx, main.jsx, api.js, categories.js, time.js
      components/        Header, FilterBar, ArticleCard, ArticleGrid,
                         SkeletonGrid, EmptyState, ErrorBanner, StatusNotes
    dist/                production build (generated by `npm run build`)
```

## Notes & known limitations

- **Source feed URLs drift.** The Batch's RSS endpoint 404'd during verification; blog feed URLs occasionally change. Failures are isolated per-source and surfaced in the UI rather than crashing the app — update the URL in `server/sources.js` if a feed goes stale.
- **Summaries cost money** when a key is set; `SUMMARIZE_LIMIT` caps how many articles are summarized per cycle, and summaries are cached by article id so a refresh doesn't re-pay for unchanged items.
- This is a sandbox/demo app: the cache is in-memory (resets on restart), and there is no persistence layer or auth.
