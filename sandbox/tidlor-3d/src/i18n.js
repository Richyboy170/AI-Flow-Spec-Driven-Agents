// ---------------------------------------------------------------------------
// i18n FOUNDATION (Wave 1)
// ---------------------------------------------------------------------------
// The single source of truth for every user-facing string in the app.
// Thai ('th') is the DEFAULT locale; English ('en') is the toggle + fallback.
//
// This module is the STABLE CONTRACT that Wave 2 UI code depends on. The
// exported names (getLocale / setLocale / t / onLocaleChange / initLocale) are
// frozen — do not rename them.
//
// DESIGN NOTE — why no image URLs live here:
//   Brand image assets are Vite-hashed ES module imports (e.g. `swirlUrl`),
//   resolved at build time. They cannot be plain strings in this dictionary.
//   So every value here is image-free text/HTML; `cards.js` owns image
//   placement and reads only TEXT + ALT keys from here. See cards.js.
//
// SAFETY — the HTML inside card/value strings is trusted, static, author-
// written content (no user input is interpolated), so inline <strong>/<ul>/<ol>
// is acceptable for innerHTML rendering by Wave 2. Do NOT feed user input
// through t() into innerHTML.
//
// EXTENSION (Tidlorland villages) — village + station copy is NOT hand-inlined
// here. It is registered ADDITIVELY at import time by src/villages.js, which
// derives the village.* / station.* string trees straight from the locked
// docs/villages.schema.json via the new registerMessages() export below. This
// keeps the schema the single source of truth (zero transcription drift) while
// every village/station string still flows through t() + the 'localechange'
// re-render path. The hint.* / world.* keys NEW for the walkable world (map,
// legend, compass, village-entered toast) are authored literally below because
// they are UI chrome, not in the schema.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tidlor-locale';
const SUPPORTED = ['th', 'en'];
const DEFAULT_LOCALE = 'th';
const FALLBACK_LOCALE = 'en';
const EVENT_NAME = 'localechange';

// Module-level current locale. Defaulted at definition so getLocale() is always
// safe even before initLocale() runs.
let current = DEFAULT_LOCALE;

// ---------------------------------------------------------------------------
// STRINGS — keyed by locale, then by dotted namespace.
//
// Key namespaces (so Wave 2 knows exactly what to wire):
//   app.*       — top bar / chrome (title, tagline) — main.js, index.html
//   loading.*   — loading overlay label — main.js
//   status.*    — the 3 WebGL fallback status messages — main.js
//   hint.*      — control hints: orbit, walk, interact, map, legend, compass — main.js
//   world.*     — walkable-world chrome: village-entered toast, legend/compass labels
//   lang.*      — language-toggle labels — Wave 2 toggle (new)
//   zone.*      — hotspot/zone labels (brand/products/story/apply + loans/insurance) — scene.js
//   hero.*      — fallback hero title/sub/tagline — index.html
//   footer.*    — fallback footer note — index.html
//   common.*    — shared inline labels (e.g. section sublabels)
//   card.*      — per-card heading/body/alt text (consumed via cards.js)
//   village.*   — village display names (REGISTERED by villages.js from schema)
//   station.*   — station titles/bodies (REGISTERED by villages.js from schema)
//
// NOTE: card.* values are image-free. Image placement + alt mapping lives in
// cards.js, which references the card.*.alt.* keys below. The same image-free
// rule holds for village.*/station.*: villages.js owns asset placement.
// ---------------------------------------------------------------------------
const STRINGS = {
  th: {
    app: {
      title: 'เงินติดล้อ · สำรวจโลกของแบรนด์',
      tagline: 'ผู้นำบริการการเงินที่เข้าถึงได้เพื่อทุกคน',
    },
    loading: {
      label: 'กำลังโหลดโลก 3 มิติ…',
    },
    status: {
      // Shown on the static fallback when WebGL is unavailable / disabled / failed.
      default: 'โหมด 3 มิติจะโหลดอัตโนมัติเมื่ออุปกรณ์รองรับ WebGL ด้านล่างคือเวอร์ชันแบบอ่านได้เต็มรูปแบบ',
      noWebgl: 'อุปกรณ์นี้ไม่รองรับ WebGL จึงแสดงเวอร์ชันแบบอ่านได้เต็มรูปแบบด้านล่างแทน',
      disabled: 'ปิดโหมด 3 มิติแล้ว (?nowebgl=1) แสดงเวอร์ชันแบบอ่านได้เต็มรูปแบบด้านล่าง',
      failed: 'ไม่สามารถเริ่มโหมด 3 มิติได้ จึงแสดงเวอร์ชันแบบอ่านได้เต็มรูปแบบด้านล่าง',
    },
    hint: {
      // Two-part control hint. Wave 2 may compose `orbit` + emphasised `crystal`.
      orbit: 'ลากเพื่อหมุนมุมมอง · เลื่อนเพื่อซูม · ',
      crystal: 'คลิกคริสตัลที่เรืองแสง',
      walk: 'ใช้ปุ่ม WASD หรือลูกศรเพื่อเดินสำรวจ',
      interact: 'กด E หรือแตะเพื่อเปิด',
      // NEW (walkable world): hints for the mini-map, legend and compass.
      map: 'แผนที่ย่อ — แตะหมู่บ้านเพื่อข้ามไป',
      legend: 'คำอธิบายสีหมู่บ้าน',
      compass: 'เข็มทิศ — หันหน้าไปทางทิศที่กำลังเดิน',
    },
    world: {
      // NEW (walkable world) chrome.
      // `entered` is a toast template; Wave 2 substitutes {village} with the
      // localized village name from getVillageName().
      entered: 'เข้าสู่ {village}',
      legendTitle: 'หมู่บ้านทั้งหมด',
      compassN: 'เหนือ',
      compassE: 'ออก',
      compassS: 'ใต้',
      compassW: 'ตก',
      stationsLabel: 'จุดเรียนรู้',
    },
    lang: {
      // Language-toggle labels. `label` = current locale name shown on the button;
      // `switchTo` = the locale the button will switch to; `aria` = a11y label.
      label: 'ไทย',
      switchTo: 'EN',
      aria: 'เปลี่ยนภาษา',
    },
    zone: {
      brand: 'แบรนด์และโลโก้',
      products: 'ผลิตภัณฑ์และบริการ',
      story: 'เรื่องราวบริษัท',
      apply: 'วิธีสมัคร',
      // New product sub-zones (Wave 2 scene may map new hotspots to these).
      loans: 'สินเชื่อทะเบียนรถ',
      insurance: 'นายหน้าประกันภัย',
    },
    hero: {
      title: 'เงินติดล้อ',
      sub: '· Ngern Tid Lor / Tidlor',
      tagline: 'ผู้นำบริการการเงินที่เข้าถึงได้เพื่อทุกคน',
    },
    footer: {
      note:
        'โลโก้และสัญลักษณ์ที่แสดงเป็นเครื่องหมายทางการของ เงินติดล้อ (Ngern Tid Lor / Tidlor) ใช้เพื่อการศึกษา/อ้างอิงส่วนบุคคลเท่านั้น ไม่ได้รับอนุญาตให้ใช้เชิงพาณิชย์',
    },
    common: {
      subbrandsLabel: 'แบรนด์ย่อยในปัจจุบัน',
      twoEngines: 'สองเสาหลักของธุรกิจ',
      missionLabel: 'พันธกิจ',
      historyLabel: 'ประวัติ',
      walkthroughLabel: 'สินเชื่อทะเบียนรถ — ขั้นตอนโดยรวม',
    },
    card: {
      brand: {
        num: '01',
        title: 'แบรนด์และโลโก้ · Brand & Logos',
        intro:
          '<p>สัญลักษณ์องค์กรของ <strong>เงินติดล้อ</strong> คือลาย <strong>swirl เกลียวสีแดงและสีน้ำเงินที่เกี่ยวกัน</strong> โดยสีแดงและสีน้ำเงินเป็นสีหลักของแบรนด์</p>',
        subbrandsLabel: 'แบรนด์ย่อยในปัจจุบัน',
        list:
          '<ul>' +
          '<li><strong>Shield</strong> — ประกันแบบพบหน้าผ่านตัวแทน</li>' +
          '<li><strong>Areegator</strong> — แพลตฟอร์มนายหน้าช่วง (sub-broker)</li>' +
          '<li><strong>heygoody</strong> — ประกันแบบดิจิทัล</li>' +
          '</ul>',
        fine: '<p class="fine">ประกันติดล้อ เป็นเครื่องหมายในอดีต ไม่ใช่แบรนด์ทางการในปัจจุบัน</p>',
        alt: {
          swirl: 'สัญลักษณ์องค์กรเงินติดล้อ: ลาย swirl เกลียวสีแดงและน้ำเงินที่เกี่ยวกัน',
          heygoody: 'โลโก้ heygoody by Ngern Tid Lor',
          areegator: 'โลโก้ Areegator',
        },
      },
      products: {
        num: '02',
        title: 'ผลิตภัณฑ์และบริการ · Products & Services',
        twoEnginesLabel: 'สองเสาหลักของธุรกิจ',
        // EXPANDED product detail (illustrative, no specific rates/amounts/terms).
        loansHeading: '<p><strong>1 · สินเชื่อทะเบียนรถ</strong></p>',
        loansBody:
          '<p>กู้โดยใช้ทะเบียนรถเป็นหลักประกัน ครอบคลุม ' +
          '<strong>รถจักรยานยนต์</strong>, <strong>รถยนต์</strong>, ' +
          '<strong>รถกระบะ/รถบรรทุก</strong> และยังมี ' +
          '<strong>สินเชื่อโฉนดที่ดิน</strong> ด้วย ' +
          'จุดเด่นคือยังใช้รถได้ตามปกติระหว่างผ่อนชำระ และสมัครได้ทั้งที่สาขาหรือผ่านแอป</p>',
        insuranceHeading: '<p><strong>2 · นายหน้าประกันภัย</strong></p>',
        insuranceBody:
          '<p>ให้บริการนายหน้าประกันทั้งแบบวินาศภัย (non-life) และประกันชีวิต ' +
          'เป็นนายหน้าประกันวินาศภัยแบบมีสาขามากที่สุดในประเทศไทย ส่งมอบผ่าน 3 ช่องทาง:</p>' +
          '<ul>' +
          '<li><strong>Shield</strong> — ทีมขายแบบพบหน้า ให้คำปรึกษาผ่านตัวแทนโดยตรง</li>' +
          '<li><strong>Areegator</strong> — แพลตฟอร์มนายหน้าช่วง (sub-broker) สำหรับพันธมิตรขายต่อ</li>' +
          '<li><strong>heygoody</strong> — ประกันดิจิทัลแบบซื้อเองออนไลน์</li>' +
          '</ul>',
        alt: {
          vehicles: 'ระบบนิเวศผลิตภัณฑ์เงินติดล้อ: สาขา กลุ่มยานพาหนะ และแอปพลิเคชัน',
        },
      },
      story: {
        num: '03',
        title: 'เรื่องราวบริษัท · Company Story',
        intro:
          '<p><strong>บริษัท ติดล้อ โฮลดิ้งส์ จำกัด (มหาชน)</strong> — จดทะเบียนในตลาดหลักทรัพย์แห่งประเทศไทย (SET) ภายใต้ชื่อย่อ <strong>TIDLOR</strong> (กลุ่มเงินทุนและหลักทรัพย์)</p>',
        missionLabel: 'พันธกิจ',
        mission:
          '<p>"ผู้นำบริการการเงินที่เข้าถึงได้" — การเงินที่เป็นธรรม โปร่งใส และเข้าถึงได้สำหรับผู้ที่เข้าไม่ถึงบริการธนาคาร</p>',
        historyLabel: 'ประวัติ',
        history:
          '<ul>' +
          '<li><strong>2549 (2006)</strong> — ก่อตั้งในชื่อ CFG Services</li>' +
          '<li><strong>2558 (2015)</strong> — เปลี่ยนชื่อเป็น เงินติดล้อ / Ngern Tid Lor</li>' +
          '<li><strong>2564 (2021)</strong> — เข้าจดทะเบียนใน SET ครั้งแรก</li>' +
          '<li><strong>15 พ.ค. 2568 (2025)</strong> — ติดล้อ โฮลดิ้งส์ เข้าจดทะเบียนใหม่</li>' +
          '</ul>',
        fine: '<p class="fine">มีสาขาประมาณ 1,800 แห่งทั่วประเทศ (ประมาณการ)</p>',
      },
      apply: {
        num: '04',
        title: 'วิธีสมัคร · How to Apply',
        walkthroughLabel: 'สินเชื่อทะเบียนรถ — ขั้นตอนโดยรวม',
        steps:
          '<ol>' +
          '<li>นำรถ + เล่มทะเบียน + บัตรประชาชน ไปที่สาขา (หรือเริ่มผ่านแอป)</li>' +
          '<li>เจ้าหน้าที่ประเมินมูลค่ารถ</li>' +
          '<li>รับข้อเสนอ / ใบเสนอราคา</li>' +
          '<li>ยังใช้รถได้ตามปกติระหว่างผ่อนชำระ</li>' +
          '</ol>',
        fine:
          '<p class="fine">เป็นแนวทางโดยทั่วไปเพื่อการศึกษาเท่านั้น — ไม่ใช่อัตรา จำนวนเงิน หรือเงื่อนไขสัญญาที่เฉพาะเจาะจง</p>',
      },
    },
  },

  en: {
    app: {
      title: 'Ngern Tid Lor · Explore the brand world',
      tagline: 'The Leading Financial Inclusion Service Provider',
    },
    loading: {
      label: 'Loading the world…',
    },
    status: {
      default:
        'Interactive 3D mode loads automatically when your device supports WebGL. Below is the full readable version.',
      noWebgl: 'WebGL is unavailable on this device, so the full readable version is shown below.',
      disabled: '3D mode disabled (?nowebgl=1). Showing the full readable version below.',
      failed: 'Could not start 3D mode; showing the full readable version below.',
    },
    hint: {
      orbit: 'Drag to orbit · scroll to zoom · ',
      crystal: 'click a glowing crystal',
      walk: 'Use WASD / arrow keys to walk',
      interact: 'Press E / tap to open',
      // NEW (walkable world): hints for the mini-map, legend and compass.
      map: 'Mini-map — tap a village to jump',
      legend: 'Village colour legend',
      compass: 'Compass — points the way you are walking',
    },
    world: {
      // NEW (walkable world) chrome.
      // `entered` is a toast template; Wave 2 substitutes {village} with the
      // localized village name from getVillageName().
      entered: 'Entered {village}',
      legendTitle: 'All villages',
      compassN: 'N',
      compassE: 'E',
      compassS: 'S',
      compassW: 'W',
      stationsLabel: 'Stations',
    },
    lang: {
      label: 'EN',
      switchTo: 'ไทย',
      aria: 'Change language',
    },
    zone: {
      brand: 'Brand & Logos',
      products: 'Products & Services',
      story: 'Company Story',
      apply: 'How to Apply',
      loans: 'Vehicle title loans',
      insurance: 'Insurance broking',
    },
    hero: {
      title: 'เงินติดล้อ',
      sub: '· Ngern Tid Lor / Tidlor',
      tagline: 'The Leading Financial Inclusion Service Provider',
    },
    footer: {
      note:
        'Brand assets shown are real official เงินติดล้อ (Ngern Tid Lor / Tidlor) marks, used for educational / personal reference only — not licensed for production use.',
    },
    common: {
      subbrandsLabel: 'Current sub-brands',
      twoEngines: 'Two engines',
      missionLabel: 'Mission',
      historyLabel: 'History',
      walkthroughLabel: 'Vehicle title loan — general walkthrough',
    },
    card: {
      brand: {
        num: '01',
        title: 'Brand & Logos · แบรนด์',
        intro:
          '<p>The corporate symbol of <strong>เงินติดล้อ</strong> is the <strong>red + blue interlocking swirl</strong>. Red and blue are the core brand colors.</p>',
        subbrandsLabel: 'Current sub-brands',
        list:
          '<ul>' +
          '<li><strong>Shield</strong> — face-to-face insurance</li>' +
          '<li><strong>Areegator</strong> — sub-broker platform</li>' +
          '<li><strong>heygoody</strong> — digital insurance</li>' +
          '</ul>',
        fine: '<p class="fine">ประกันติดล้อ is a historical mark, not a current official brand.</p>',
        alt: {
          swirl: 'Tidlor corporate symbol: red and blue interlocking swirl',
          heygoody: 'heygoody by Ngern Tid Lor logo',
          areegator: 'Areegator logo',
        },
      },
      products: {
        num: '02',
        title: 'Products & Services · ผลิตภัณฑ์',
        twoEnginesLabel: 'Two engines',
        // EXPANDED product detail (illustrative, no specific rates/amounts/terms).
        loansHeading: '<p><strong>1 · Vehicle title loans</strong></p>',
        loansBody:
          '<p>Borrow against your vehicle registration as collateral — covering ' +
          '<strong>motorcycles</strong>, <strong>cars</strong>, ' +
          '<strong>pickups / trucks</strong>, plus <strong>land title loans</strong>. ' +
          'The key benefit: keep using your vehicle while you repay, and apply at a branch or in-app.</p>',
        insuranceHeading: '<p><strong>2 · Insurance broking</strong></p>',
        insuranceBody:
          '<p>Non-life and life insurance brokerage — the largest branch-based ' +
          'non-life insurance broker in Thailand, delivered through three channels:</p>' +
          '<ul>' +
          '<li><strong>Shield</strong> — a face-to-face sales force advising customers directly</li>' +
          '<li><strong>Areegator</strong> — a sub-broker platform for reseller partners</li>' +
          '<li><strong>heygoody</strong> — digital insurance bought online, self-service</li>' +
          '</ul>',
        alt: {
          vehicles: 'Tidlor product ecosystem: branch, vehicle fleet and app',
        },
      },
      story: {
        num: '03',
        title: 'Company Story · เรื่องราวบริษัท',
        intro:
          '<p><strong>Tidlor Holdings PCL</strong> — listed on the Stock Exchange of Thailand (SET) under ticker <strong>TIDLOR</strong> (Finance &amp; Securities sector).</p>',
        missionLabel: 'Mission',
        mission:
          '<p>"The Leading Financial Inclusion Service Provider" — accessible, fair and transparent finance for the under-banked.</p>',
        historyLabel: 'History',
        history:
          '<ul>' +
          '<li><strong>2006</strong> — founded as CFG Services</li>' +
          '<li><strong>2015</strong> — renamed Ngern Tid Lor / เงินติดล้อ</li>' +
          '<li><strong>2021</strong> — first SET listing</li>' +
          '<li><strong>15 May 2025</strong> — Tidlor Holdings relisted</li>' +
          '</ul>',
        fine: '<p class="fine">Operates around 1,800 branches nationwide (estimate).</p>',
      },
      apply: {
        num: '04',
        title: 'How to Apply · วิธีสมัคร',
        walkthroughLabel: 'Vehicle title loan — general walkthrough',
        steps:
          '<ol>' +
          '<li>Bring your vehicle + registration book + ID to a branch (or start in-app).</li>' +
          '<li>Staff appraise the vehicle.</li>' +
          '<li>Get an offer / quote.</li>' +
          '<li>Keep using your vehicle while you repay.</li>' +
          '</ol>',
        fine:
          '<p class="fine">Illustrative / general guidance only — not specific rates, amounts or contractual terms.</p>',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Walk a dotted path (e.g. 'card.brand.intro') against one locale's tree.
// Returns the resolved value, or undefined if any segment is missing OR if the
// path lands on a non-leaf object (objects are treated as a miss).
function lookup(locale, key) {
  const tree = STRINGS[locale];
  if (!tree) return undefined;
  let node = tree;
  for (const segment of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[segment];
  }
  // A leaf must be a primitive (string). Objects/arrays/undefined count as miss.
  return typeof node === 'string' ? node : undefined;
}

function isSupported(locale) {
  return SUPPORTED.includes(locale);
}

function safeReadStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    // localStorage can throw in private mode / sandboxed contexts.
    return null;
  }
}

function safeWriteStorage(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch (_) {
    // Non-fatal: locale still applies for the session.
  }
}

function applyDocumentLang(locale) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = locale;
  }
}

// Deep-merge a plain-object `fragment` into `target` in place. Used by
// registerMessages() to graft additive string sub-trees (e.g. village.* /
// station.*) onto a locale without disturbing existing keys. String leaves in
// `fragment` win on collision; nested objects merge recursively.
function deepMerge(target, fragment) {
  for (const key of Object.keys(fragment)) {
    const value = fragment[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

// ---------------------------------------------------------------------------
// PUBLIC API — STABLE CONTRACT for Wave 2. Do not rename these exports.
// ---------------------------------------------------------------------------

/** Current active locale. Always one of 'th' | 'en'. */
export function getLocale() {
  return current;
}

/**
 * Switch the active locale.
 * - Validates the input (ignores + warns on anything other than 'th' | 'en').
 * - Persists to localStorage (best-effort).
 * - Updates document.documentElement.lang.
 * - Dispatches a 'localechange' CustomEvent on window: detail = { locale }.
 * No-op (still re-applies + notifies) if the locale is already current? No — we
 * short-circuit when unchanged to avoid redundant re-render churn for listeners.
 */
export function setLocale(locale) {
  if (!isSupported(locale)) {
    console.warn(`[i18n] setLocale: unsupported locale "${locale}" — ignored.`);
    return;
  }
  if (locale === current) return; // unchanged — avoid redundant events
  current = locale;
  safeWriteStorage(locale);
  applyDocumentLang(locale);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { locale } }));
  }
}

/**
 * Translate a dotted/nested key (e.g. t('hint.orbit')) for the current locale.
 * Resolution order:
 *   1. current locale
 *   2. fallback locale ('en')
 *   3. the key string itself
 * A missing key (falls through to step 3) emits a console.warn but never throws.
 * Falling back from current → en does NOT warn (that is expected behaviour).
 */
export function t(key) {
  const fromCurrent = lookup(current, key);
  if (fromCurrent !== undefined) return fromCurrent;

  if (current !== FALLBACK_LOCALE) {
    const fromFallback = lookup(FALLBACK_LOCALE, key);
    if (fromFallback !== undefined) return fromFallback;
  }

  console.warn(`[i18n] Missing translation key: "${key}" (locale "${current}").`);
  return key;
}

/**
 * Subscribe to locale changes. The callback receives the new locale string.
 * Returns an unsubscribe function.
 *
 *   const off = onLocaleChange((locale) => rerender(locale));
 *   off(); // stop listening
 */
export function onLocaleChange(cb) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => cb(e && e.detail ? e.detail.locale : getLocale());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

/**
 * Initialise locale state from persisted storage. Call once, early, from
 * main.js. Reads localStorage; if absent or invalid, defaults to 'th'. Sets
 * document.documentElement.lang. Does NOT dispatch 'localechange' (listeners
 * attach afterwards, and initial render reads getLocale() directly).
 * Returns the resolved locale.
 */
export function initLocale() {
  const stored = safeReadStorage();
  current = isSupported(stored) ? stored : DEFAULT_LOCALE;
  applyDocumentLang(current);
  return current;
}

/**
 * ADDITIVE EXTENSION POINT (stable contract). Register a tree of strings into
 * one locale at runtime, deep-merged onto the existing dictionary. This lets a
 * data module (src/villages.js) graft the village.* / station.* copy derived
 * from docs/villages.schema.json into i18n WITHOUT this file having to inline
 * (and risk mis-transcribing) that copy. Call once per locale, at import time,
 * before any t() for those keys runs.
 *
 *   registerMessages('th', { village: { 'brand-symbol': { name: '…' } } });
 *
 * - `locale` must be a supported locale ('th' | 'en'); otherwise it warns and
 *   no-ops (so a typo can't silently corrupt the dictionary).
 * - String leaves in `fragment` overwrite on collision; this is intended for
 *   NEW namespaces and is not used to mutate the frozen built-in keys above.
 */
export function registerMessages(locale, fragment) {
  if (!isSupported(locale)) {
    console.warn(`[i18n] registerMessages: unsupported locale "${locale}" — ignored.`);
    return;
  }
  if (!fragment || typeof fragment !== 'object') return;
  if (!STRINGS[locale]) STRINGS[locale] = {};
  deepMerge(STRINGS[locale], fragment);
}

// Convenience: the list of supported locales (handy for building a toggle).
export const LOCALES = [...SUPPORTED];
