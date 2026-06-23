import { defineConfig } from 'vite'

// ---------------------------------------------------------------------------
// GitHub Pages deployment base path
// This project deploys to: https://<user>.github.io/tidlor-reborn/
// If the repository is ever renamed, update BASE_PATH to match the new
// repo name (e.g., '/new-repo-name/').
// For local dev served from root, Vite still handles this correctly via
// the dev-server rewrite — no manual change needed for development.
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
