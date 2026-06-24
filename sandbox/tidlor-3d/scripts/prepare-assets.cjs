/*
 * One-time asset prep. The original official assets live in ../assets (read-only
 * provenance store). This derives runtime-friendly copies into src/assets:
 *   - raster assets (webp/png/jpg) are copied verbatim (browser decodes them fine)
 *   - SVG wordmarks are rasterized to transparent PNG at 4x for crisp GPU textures
 *     (the two primary wordmark SVGs embed base64 PNGs that TextureLoader can't
 *      reliably decode, so we flatten them to plain PNG here)
 * Run via: npm run prepare-assets  (also wire-able into build if desired)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', 'assets');
const OUT = path.resolve(__dirname, '..', 'src', 'assets');
fs.mkdirSync(OUT, { recursive: true });

// raster assets: copy verbatim.
//
// NOTE — the last three entries are the original wordmark SVGs. They are ALSO
// rasterized to PNG below (for crisp GPU textures in the 3D scene), but the
// villages.js data layer + 2D static fallback reference them by their hashed
// SVG filename exactly as locked in docs/villages.schema.json (the `assetRef`
// build contract). Browsers / <img> decode these embedded-PNG SVGs fine for 2D
// display, so we mirror the originals here too. Removing them would break the
// villages assetRef resolver for the three brand/sub-brand wordmark stations.
const copyRaster = [
  'brand-symbol-swirl-element-6170845ab8.webp',
  'brand-world-tidlor-banner-f674902bc4.webp',
  'brand-world-lowpoly-skyline-0bc2d744f2.webp',
  'brand-world-earnings-4subbrands-948b2823a2.jpg',
  'product-ecosystem-vehicles-883663c419.jpg',
  'product-service-center-digital-307396cba6.png',
  'subbrand-areegator-wordmark-4936d17d16.png',
  'subbrand-areegator-symbol-stacked-6749735b82.png',
  'subbrand-heygoody-lockup-by-ntl-ec96680ffb.png',
  // SVG originals mirrored verbatim for the villages.js assetRef contract:
  'brand-primary-wordmark-color-81c4d43fb1.svg',
  'brand-primary-wordmark-white-6bcb919231.svg',
  'subbrand-heygoody-wordmark-white-0da14c81f9.svg',
];

// SVG wordmarks -> rasterize to PNG. width in px of the output raster.
const rasterizeSvg = [
  { in: 'brand-primary-wordmark-color-81c4d43fb1.svg', out: 'wordmark-color.png', width: 1232 },
  { in: 'brand-primary-wordmark-white-6bcb919231.svg', out: 'wordmark-white.png', width: 1400 },
  { in: 'subbrand-heygoody-wordmark-white-0da14c81f9.svg', out: 'heygoody-wordmark.png', width: 1064 },
];

(async () => {
  for (const f of copyRaster) {
    fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
    console.log('copied', f);
  }
  for (const r of rasterizeSvg) {
    const buf = fs.readFileSync(path.join(SRC, r.in));
    await sharp(buf, { density: 600 })
      .resize({ width: r.width })
      .png()
      .toFile(path.join(OUT, r.out));
    console.log('rasterized', r.in, '->', r.out);
  }
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
