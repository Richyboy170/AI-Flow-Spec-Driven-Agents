# เงินติดล้อ · Tidlor — Low-Poly 3D Explainer

A small, playable low-poly **Three.js** mini-world that teaches the real Thai listed
company **เงินติดล้อ (Ngern Tid Lor / Tidlor)**. Orbit around a brand plaza, and click
the four glowing crystal hotspots to pop bite-sized learning cards:

1. **Brand & Logos** — the red + blue interlocking swirl symbol and current sub-brands (Shield, Areegator, heygoody).
2. **Products & Services** — vehicle title loans + insurance broking.
3. **Company Story** — Tidlor Holdings PCL on the SET (ticker TIDLOR), mission and history.
4. **How to Apply** — an illustrative walkthrough of getting a vehicle title loan.

It is built with **vanilla Three.js + Vite** (no React) to keep the static bundle small
for GitHub Pages.

## Run it

```bash
npm install
npm run prepare-assets   # one-time: derives runtime textures into src/assets (rasterizes SVG wordmarks)
npm run dev              # local dev server
npm run build            # production build into dist/
npm run preview          # serve the production build
```

> `prepare-assets` is already run for the committed `src/assets/`. Re-run it only if the
> originals in `assets/` change.

## GitHub Pages base path (important)

This project deploys to `https://<user>.github.io/tidlor-3d/`, so `vite.config.js` sets:

```js
base: '/tidlor-3d/'
```

Two consequences:

- When previewing or deving, open the app under the base path, e.g.
  `http://localhost:4173/tidlor-3d/` (the bare root returns a 404).
- All textures are imported as **ES modules** (`import url from './assets/x.webp'`), so
  Vite rewrites their URLs with the base path automatically — no manual
  `import.meta.env.BASE_URL` prefixing is needed. (`public/.nojekyll` is included so
  GitHub Pages serves the hashed asset folder.)

## WebGL fallback (fallback-first)

The four content areas are real, default-visible HTML in `index.html`. On load the app
checks `WebGL.isWebGLAvailable()`; **only** if WebGL is available does it mount the 3D
canvas and hide the static baseline. If WebGL is missing or 3D setup throws, the user
keeps the full readable version. You can force the fallback to verify it:

```
http://localhost:4173/tidlor-3d/?nowebgl=1
```

## Brand assets

The logos, wordmarks and product imagery in this project are **real official
เงินติดล้อ (Ngern Tid Lor / Tidlor) marks**, used here for **educational / personal
reference only** — they are **not licensed for production use**. Originals and provenance
live in `assets/visual-manifest.json`.
