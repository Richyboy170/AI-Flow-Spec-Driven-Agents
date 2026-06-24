// Entry point. FALLBACK-FIRST: the static HTML in index.html is visible by default.
// We only mount the 3D scene if WebGL is genuinely available (and not force-disabled
// via ?nowebgl=1). On any failure the user keeps the full readable static baseline.
import './style.css';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { createCardUI } from './cardUI.js';
import wordmarkWhiteUrl from './assets/wordmark-white.png';

const forceNoWebGL = new URLSearchParams(location.search).has('nowebgl');
const fbStatus = document.getElementById('fb-status');

function webglAvailable() {
  if (forceNoWebGL) return false;
  try {
    return WebGL.isWebGLAvailable();
  } catch (_) {
    return false;
  }
}

if (!webglAvailable()) {
  // Stay on the static baseline. Update the status note for clarity.
  if (fbStatus) {
    fbStatus.textContent = forceNoWebGL
      ? '3D mode disabled (?nowebgl=1). Showing the full readable version below.'
      : 'WebGL is unavailable on this device, so the full readable version is shown below.';
  }
} else {
  mount3D().catch((err) => {
    // If anything in 3D setup throws, fall back gracefully to the static baseline.
    console.error('[tidlor-3d] 3D mount failed, using static fallback:', err);
    document.body.classList.remove('webgl-active');
    if (fbStatus) fbStatus.textContent = 'Could not start 3D mode; showing the full readable version below.';
  });
}

async function mount3D() {
  const { createScene } = await import('./scene.js');
  const app = document.getElementById('app');

  // Loading overlay
  const loading = document.createElement('div');
  loading.className = 'ui-loading';
  loading.innerHTML = `
    <img src="${wordmarkWhiteUrl}" alt="เงินติดล้อ / Tidlor" />
    <div class="bar"><i></i></div>
    <div class="lbl">Loading the world…</div>
  `;
  app.appendChild(loading);
  const bar = loading.querySelector('.bar > i');

  const THREE = await import('three');
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    bar.style.width = `${Math.round((loaded / Math.max(total, 1)) * 100)}%`;
  };
  manager.onLoad = () => {
    bar.style.width = '100%';
    setTimeout(() => {
      loading.classList.add('hidden');
      setTimeout(() => loading.remove(), 600);
    }, 250);
  };

  const cardUI = createCardUI();

  // Top bar with the real official wordmark
  const topbar = document.createElement('div');
  topbar.className = 'ui-topbar';
  topbar.innerHTML = `
    <img src="${wordmarkWhiteUrl}" alt="เงินติดล้อ / Tidlor official wordmark" />
    <span class="ui-topbar-title">เงินติดล้อ · Explore the brand world</span>
  `;
  app.appendChild(topbar);

  // Hint pill — created BEFORE the scene so the hover callback can mutate it safely
  const hint = document.createElement('div');
  hint.className = 'ui-hint';
  const DEFAULT_HINT = 'Drag to orbit · scroll to zoom · ';
  hint.appendChild(document.createTextNode(DEFAULT_HINT));
  const b = document.createElement('b');
  b.textContent = 'click a glowing crystal';
  hint.appendChild(b);
  app.appendChild(hint);

  createScene({
    container: app,
    loadingManager: manager,
    onHotspotClick: (key) => cardUI.open(key),
    onHotspotHover: (label) => { hint.firstChild.nodeValue = label ? `${label} — ` : DEFAULT_HINT; },
  });

  // Activate 3D mode (hides the static baseline)
  document.body.classList.add('webgl-active');

  // Edge case: if the manager never fires onLoad (e.g. cached), hide after a timeout.
  setTimeout(() => { if (!loading.classList.contains('hidden')) loading.classList.add('hidden'); }, 6000);
}
