// ---------------------------------------------------------------------------
// villages.js — Tidlorland villages DATA / CONTENT / i18n / ASSET layer.
// ---------------------------------------------------------------------------
// This is the DATA layer the 3D engine (scene.js / main.js / cardUI.js) consumes
// to lay out and label the six "Tidlorland" villages and their fifteen learning
// stations. It is the partner module to cards.js for the new walkable world.
//
// SINGLE SOURCE OF TRUTH
//   All copy + geometry data is derived from the LOCKED build contract
//   docs/villages.schema.json (6 villages, 15 stations). This module:
//     1. imports that JSON,
//     2. registers every TH/EN string into i18n ADDITIVELY (so t() + the
//        'localechange' re-render path drives all village/station copy — no copy
//        is hand-transcribed here, eliminating drift from the schema),
//     3. resolves each station's `assetRef` filename to a Vite-hashed build URL,
//     4. exposes a small, STABLE, locale-aware API + a fallback-translate hook.
//
// WHY ASSETS LIVE HERE, NOT IN i18n (same rule as cards.js)
//   Asset URLs are Vite-hashed ES-module imports resolved at build time; they
//   cannot be plain strings in the i18n dictionary. i18n holds image-free text;
//   villages.js owns asset placement via import.meta.glob over src/assets.
//
// ---------------------------------------------------------------------------
// STABLE EXPORT CONTRACT (the engine owner imports these — do not rename):
//
//   VILLAGES                : Array<VillageDescriptor>   locale-independent geometry
//   STATION_DISPLAYS        : Array<StationDisplay>      flat list for info displays
//   getVillageName(vId)     : string   localized village name (current locale)
//   getStationTitle(vId,sId): string   localized station title (current locale)
//   getStationBody(vId,sId) : string   localized station body  (current locale)
//   getAssetUrl(assetRef)   : string|null   resolved build URL for a filename
//   translateFallback(root?): void     translate [data-i18n-key] nodes in the
//                                       static #fallback DOM (the no-JS baseline
//                                       hook for main.js — see bottom of file)
//
// TYPES (informal):
//   VillageDescriptor = {
//     id: string, category: string, themeColorHex: string,
//     stations: Array<{ id: string, assetRef: string|null, assetUrl: string|null }>
//   }   // NO name/title/body here — copy is locale-dependent, fetched via t().
//
//   StationDisplay = {
//     villageId: string, stationId: string,
//     assetRef: string|null, assetUrl: string|null
//   }
// ---------------------------------------------------------------------------

import schema from '../docs/villages.schema.json';
import { t, registerMessages } from './i18n.js';

// ---------------------------------------------------------------------------
// 1. ASSET RESOLUTION
// ---------------------------------------------------------------------------
// Eagerly glob every file under src/assets as a URL string. assetsInlineLimit:0
// in vite.config.js keeps these as real hashed files (no base64). The map is
// keyed by bare filename (e.g. 'subbrand-areegator-wordmark-4936d17d16.png').
//
// NOTE: src/assets is produced by scripts/prepare-assets.cjs from the read-only
// ../assets provenance store. Three schema assetRefs are wordmark SVGs that the
// prep step ALSO mirrors verbatim (alongside rasterized PNGs) precisely so the
// filenames below resolve. If an assetRef ever fails to resolve, fix the prep
// script's copy list — do NOT edit the locked schema.
const ASSET_MODULES = import.meta.glob('./assets/*', { eager: true, query: '?url', import: 'default' });

const ASSET_BY_FILENAME = {};
for (const [absPath, url] of Object.entries(ASSET_MODULES)) {
  const filename = absPath.split('/').pop();
  ASSET_BY_FILENAME[filename] = url;
}

/**
 * Resolve a schema `assetRef` filename to its built URL.
 * Returns null for a null/absent assetRef (e.g. the digital-card station).
 * Throws for a NON-null assetRef that does not resolve — a build/data contract
 * violation we surface loudly rather than render a broken image.
 */
export function getAssetUrl(assetRef) {
  if (assetRef == null) return null;
  const url = ASSET_BY_FILENAME[assetRef];
  if (url == null) {
    throw new Error(
      `[villages] assetRef "${assetRef}" did not resolve under src/assets. ` +
        `Add it to scripts/prepare-assets.cjs (copyRaster) and re-run prepare-assets.`,
    );
  }
  return url;
}

// ---------------------------------------------------------------------------
// 2. REGISTER i18n STRINGS FROM THE SCHEMA (additive, at import time)
// ---------------------------------------------------------------------------
// Namespaces (kept identical to the task spec):
//   village.<villageId>.name
//   station.<villageId>.<stationId>.title
//   station.<villageId>.<stationId>.body
// Building these fragments straight from the JSON keeps the schema the single
// source of truth: there is zero hand-copied Thai/English text in this file.
function buildLocaleFragment(localeSuffix) {
  // localeSuffix is 'TH' | 'EN' — matches the schema's field naming.
  const villageNs = {};
  const stationNs = {};

  for (const village of schema.villages) {
    villageNs[village.id] = { name: village[`name${localeSuffix}`] };

    const perVillage = {};
    for (const station of village.stations) {
      perVillage[station.id] = {
        title: station[`title${localeSuffix}`],
        body: station[`body${localeSuffix}`],
      };
    }
    stationNs[village.id] = perVillage;
  }

  return { village: villageNs, station: stationNs };
}

registerMessages('th', buildLocaleFragment('TH'));
registerMessages('en', buildLocaleFragment('EN'));

// ---------------------------------------------------------------------------
// 3. LOCALE-INDEPENDENT GEOMETRY DATA + FLAT DISPLAY LIST
// ---------------------------------------------------------------------------
// VILLAGES carries only what the engine needs to lay out the world: ids,
// category, theme color, and per-station ids + resolved asset URLs. It contains
// NO localized copy — names/titles/bodies are fetched at render time via the
// getters below so the 'localechange' path re-renders them.
//
// Building VILLAGES also eagerly resolves every non-null assetRef, so any
// missing asset throws HERE at module import — failing fast and loud rather
// than silently rendering a broken <img> later (build can be green yet an
// image still broken; this assertion closes that gap).
export const VILLAGES = schema.villages.map((village) => ({
  id: village.id,
  category: village.category,
  themeColorHex: village.themeColorHex,
  stations: village.stations.map((station) => ({
    id: station.id,
    assetRef: station.assetRef,
    assetUrl: getAssetUrl(station.assetRef), // null-safe; throws on bad non-null ref
  })),
}));

/**
 * Flat list of every station for the engine to place info displays, in schema
 * order. Each entry carries its village + station id and the resolved asset.
 */
export const STATION_DISPLAYS = VILLAGES.flatMap((village) =>
  village.stations.map((station) => ({
    villageId: village.id,
    stationId: station.id,
    assetRef: station.assetRef,
    assetUrl: station.assetUrl,
  })),
);

// ---------------------------------------------------------------------------
// 4. LOCALE-AWARE GETTERS (resolve TH/EN via the CURRENT i18n locale)
// ---------------------------------------------------------------------------

/** Localized display name for a village. */
export function getVillageName(villageId) {
  return t(`village.${villageId}.name`);
}

/** Localized title for a station within a village. */
export function getStationTitle(villageId, stationId) {
  return t(`station.${villageId}.${stationId}.title`);
}

/** Localized body copy for a station within a village. */
export function getStationBody(villageId, stationId) {
  return t(`station.${villageId}.${stationId}.body`);
}

// ---------------------------------------------------------------------------
// 5. STATIC-FALLBACK TRANSLATION HOOK (the contract for main.js)
// ---------------------------------------------------------------------------
// index.html ships the #fallback baseline as REAL static HTML in Thai (the
// default locale) so no-JS / no-WebGL users get the full readable content with
// zero JavaScript. Every translatable node carries a `data-i18n-key="<key>"`
// attribute whose key resolves through t(). Nodes that hold trusted static HTML
// (lists, <strong>, etc.) additionally carry `data-i18n-html` so we set
// innerHTML instead of textContent.
//
// HOW THE ENGINE OWNER (main.js) WIRES THIS — two lines, no edits to villages.js:
//
//   import { translateFallback } from './villages.js';
//   import { onLocaleChange, initLocale } from './i18n.js';
//
//   initLocale();
//   translateFallback();                    // apply the persisted locale once
//   onLocaleChange(() => translateFallback()); // re-translate on every toggle
//
// translateFallback() is a pure DOM pass over [data-i18n-key]; it is safe to
// call repeatedly and is a no-op if #fallback is absent (e.g. 3D mounted).

/**
 * Translate every `[data-i18n-key]` node under `root` (default: document) into
 * the CURRENT locale. Sets innerHTML when the node also has `data-i18n-html`,
 * otherwise textContent. Returns the number of nodes translated.
 */
export function translateFallback(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const nodes = root.querySelectorAll('[data-i18n-key]');
  let count = 0;
  nodes.forEach((el) => {
    const key = el.getAttribute('data-i18n-key');
    if (!key) return;
    const value = t(key);
    if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
    count += 1;
  });
  return count;
}
