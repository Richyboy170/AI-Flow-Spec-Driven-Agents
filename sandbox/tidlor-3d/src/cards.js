// ---------------------------------------------------------------------------
// Learning-card structure for the 3D hotspots (rendered as a DOM overlay).
// ---------------------------------------------------------------------------
// REFACTORED (Wave 1): all COPY now comes from i18n via t(). This file owns
// only the asset imports + the per-card *render recipe* (which image goes
// where, which i18n keys to render, in what order). Wave 2's cardUI.js calls
// renderCardBody(key) to rebuild a card's innerHTML for the CURRENT locale, and
// re-calls it on the 'localechange' event.
//
// Why images live here, not in i18n: asset URLs below are Vite-hashed ES module
// imports resolved at build time — they cannot be plain strings in the i18n
// dictionary. So i18n holds image-free text + ALT keys; this file places the
// images and binds their alt text to those keys.
// ---------------------------------------------------------------------------
import { t } from './i18n.js';

import swirlUrl from './assets/brand-symbol-swirl-element-6170845ab8.webp';
import vehiclesUrl from './assets/product-ecosystem-vehicles-883663c419.jpg';
import heygoodyLockupUrl from './assets/subbrand-heygoody-lockup-by-ntl-ec96680ffb.png';
import areegatorUrl from './assets/subbrand-areegator-wordmark-4936d17d16.png';

// --- Block primitives ------------------------------------------------------
// A card body is an ordered array of blocks. Each block is a plain object that
// renderBlock() turns into an HTML fragment for the current locale. We keep the
// block vocabulary deliberately tiny (3 types) — no generic templating DSL.
//
//   { html: 'card.brand.intro' }                 → t(key) emitted as-is (trusted HTML)
//   { img: <url>, altKey: 'card.brand.alt.swirl', className: 'ui-card-img' }
//   { imgRow: [{ img, altKey }, ...] }            → a row of logos (sub-brands)
//   { label: 'card.products.twoEnginesLabel' }    → <p class="lbl">…</p> sublabel
//
// `key`-style fields are i18n keys resolved at render time; `img` fields are
// build-time asset URLs.
function renderBlock(block) {
  if (block.html) {
    return t(block.html);
  }
  if (block.label) {
    return `<p class="lbl">${t(block.label)}</p>`;
  }
  if (block.img) {
    const cls = block.className ? ` class="${block.className}"` : '';
    return `<img${cls} src="${block.img}" alt="${t(block.altKey)}" loading="lazy" />`;
  }
  if (block.imgRow) {
    const imgs = block.imgRow
      .map((it) => `<img src="${it.img}" alt="${t(it.altKey)}" />`)
      .join('');
    return `<div class="subbrand-row">${imgs}</div>`;
  }
  return '';
}

// --- Card definitions ------------------------------------------------------
// num/accent/titleKey are card chrome; `body` is the ordered render recipe.
// All human-readable text is referenced by i18n key — none is inlined here.
export const CARDS = {
  brand: {
    num: '01',
    accent: '#E32D26',
    titleKey: 'card.brand.title',
    body: [
      { img: swirlUrl, altKey: 'card.brand.alt.swirl', className: 'ui-card-img' },
      { html: 'card.brand.intro' },
      { label: 'card.brand.subbrandsLabel' },
      {
        imgRow: [
          { img: heygoodyLockupUrl, altKey: 'card.brand.alt.heygoody' },
          { img: areegatorUrl, altKey: 'card.brand.alt.areegator' },
        ],
      },
      { html: 'card.brand.list' },
      { html: 'card.brand.fine' },
    ],
  },
  products: {
    num: '02',
    accent: '#0B4DA2',
    titleKey: 'card.products.title',
    body: [
      { img: vehiclesUrl, altKey: 'card.products.alt.vehicles', className: 'ui-card-img' },
      { label: 'card.products.twoEnginesLabel' },
      { html: 'card.products.loansHeading' },
      { html: 'card.products.loansBody' },
      { html: 'card.products.insuranceHeading' },
      { html: 'card.products.insuranceBody' },
    ],
  },
  story: {
    num: '03',
    accent: '#2E7BE0',
    titleKey: 'card.story.title',
    body: [
      { html: 'card.story.intro' },
      { label: 'card.story.missionLabel' },
      { html: 'card.story.mission' },
      { label: 'card.story.historyLabel' },
      { html: 'card.story.history' },
      { html: 'card.story.fine' },
    ],
  },
  apply: {
    num: '04',
    accent: '#10B070',
    titleKey: 'card.apply.title',
    body: [
      { label: 'card.apply.walkthroughLabel' },
      { html: 'card.apply.steps' },
      { html: 'card.apply.fine' },
    ],
  },
};

// --- OPTIONAL product sub-zone cards (Wave 2 may map new hotspots here) -----
// Minimal, i18n-driven detail cards for the two product "engines". They reuse
// the same expanded copy keys as the products card so there is one source of
// truth. Kept separate from CARDS so existing hotspots are unaffected.
export const SUBZONE_CARDS = {
  loans: {
    num: '02a',
    accent: '#0B4DA2',
    titleKey: 'zone.loans',
    body: [
      { img: vehiclesUrl, altKey: 'card.products.alt.vehicles', className: 'ui-card-img' },
      { html: 'card.products.loansHeading' },
      { html: 'card.products.loansBody' },
    ],
  },
  insurance: {
    num: '02b',
    accent: '#10B070',
    titleKey: 'zone.insurance',
    body: [
      { html: 'card.products.insuranceHeading' },
      { html: 'card.products.insuranceBody' },
    ],
  },
};

// --- Public render helpers (the Wave 2 contract) ---------------------------

/**
 * Resolve a card definition by key from CARDS (then SUBZONE_CARDS). Returns
 * undefined for an unknown key.
 */
export function getCard(key) {
  return CARDS[key] || SUBZONE_CARDS[key];
}

/**
 * Build the localized inner HTML for a card's BODY (everything below the
 * title row) using the CURRENT locale. Pure function of (key, current locale):
 * call it again after a 'localechange' event to re-render. Returns '' for an
 * unknown key.
 */
export function renderCardBody(key) {
  const card = getCard(key);
  if (!card) return '';
  return card.body.map(renderBlock).join('\n');
}

/**
 * Convenience: the localized title for a card (via its titleKey), for the
 * card header. Returns '' for an unknown key.
 */
export function getCardTitle(key) {
  const card = getCard(key);
  return card ? t(card.titleKey) : '';
}
