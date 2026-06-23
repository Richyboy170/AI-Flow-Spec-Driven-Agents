import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The built app is served as static files by the Express backend out of web/dist.
// `base: './'` makes asset URLs relative so it works whether Express mounts dist
// at the site root or under a subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the app calls only same-origin /api. Vite proxies those calls to the
    // backend (default PORT 8787) so the browser never talks to external sources
    // directly (which CORS would block anyway).
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
