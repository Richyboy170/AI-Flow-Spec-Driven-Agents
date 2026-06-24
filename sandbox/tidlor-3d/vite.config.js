import { defineConfig } from 'vite';

// Deployed to GitHub Pages at https://<user>.github.io/tidlor-3d/
// base must match the repo name so built asset URLs resolve.
export default defineConfig({
  base: '/tidlor-3d/',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // keep brand assets as real files (no base64 inlining of logos)
  },
});
