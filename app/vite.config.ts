import { defineConfig } from 'vite'

// ---------------------------------------------------------------------------
// GitHub Pages deployment base path
// This is the LOCAL default used by `npm run build` and `npm run preview`.
// It assumes a project Pages site at: https://<user>.github.io/tidlor-reborn/
//
// In CI, .github/workflows/deploy.yml OVERRIDES this with
// `vite build --base=/<repo-name>/`, derived from the actual repository name —
// so the deployed build is always correct even if the repo is named differently
// and you never have to edit this file. Update BASE_PATH below only if you want
// `npm run preview` to match a different repo name locally.
// ---------------------------------------------------------------------------
const BASE_PATH = '/tidlor-reborn/'

export default defineConfig({
  base: BASE_PATH,

  build: {
    // Emit source maps for easier debugging in production
    sourcemap: true,
    // Target modern browsers that support WebGL
    target: 'es2020',
  },

  server: {
    // Convenience: open the browser automatically on `npm run dev`
    open: false,
  },
})
