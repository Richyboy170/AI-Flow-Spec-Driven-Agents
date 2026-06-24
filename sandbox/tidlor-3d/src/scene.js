// Low-poly explorable world for เงินติดล้อ / Tidlor.
// One polished scene: a circular brand plaza with the swirl monument at center
// and 4 hotspot pylons (the 4 learning cards) arranged around it. Orbit + zoom.
// Clicking a hotspot raycasts and opens the matching DOM learning card.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import swirlUrl from './assets/brand-symbol-swirl-element-6170845ab8.webp';
import wordmarkWhiteUrl from './assets/wordmark-white.png';
import skylineUrl from './assets/brand-world-lowpoly-skyline-0bc2d744f2.webp';

const PALETTE = {
  red: 0xe32d26,
  blue: 0x0b4da2,
  blueMid: 0x2e7be0,
  blueDeep: 0x0a2e5c,
  hgGreen: 0x10b070,
  arGreen: 0x90d010,
  ground: 0x123a6e,
  groundEdge: 0x0d2c55,
};

// Hotspot definitions: angle around the plaza, color, card key, label.
const HOTSPOTS = [
  { key: 'brand', color: PALETTE.red, label: 'Brand & Logos', angle: Math.PI * 0.5 },
  { key: 'products', color: PALETTE.blue, label: 'Products & Services', angle: Math.PI * 1.0 },
  { key: 'story', color: PALETTE.blueMid, label: 'Company Story', angle: Math.PI * 1.5 },
  { key: 'apply', color: PALETTE.hgGreen, label: 'How to Apply', angle: Math.PI * 2.0 },
];

export function createScene({ container, loadingManager, onHotspotClick, onHotspotHover }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.blueDeep);
  scene.fog = new THREE.Fog(PALETTE.blueDeep, 28, 70);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 9, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const texLoader = new THREE.TextureLoader(loadingManager);
  function loadTex(url, { srgb = true } = {}) {
    const t = texLoader.load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  // ---- Lighting (flat-shaded friendly) ----
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x0a2240, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(8, 16, 10);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc0ff, 0.4);
  fill.position.set(-10, 6, -8);
  scene.add(fill);

  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // ---- Ground: low-poly disc plaza ----
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(20, 7),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, flatShading: true, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  worldRoot.add(ground);

  // Raised inner ring (brand red accent)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(5.6, 6.2, 32),
    new THREE.MeshStandardMaterial({ color: PALETTE.red, flatShading: true, roughness: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  worldRoot.add(ring);

  // Scattered low-poly "hills" for depth around the rim
  const hillMat = new THREE.MeshStandardMaterial({ color: PALETTE.groundEdge, flatShading: true, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const r = 15 + Math.random() * 4;
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const h = 1.2 + Math.random() * 2.4;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4 + Math.random(), h, 5), hillMat);
    cone.position.set(Math.cos(a) * r, h / 2 - 0.2, Math.sin(a) * r);
    cone.rotation.y = Math.random() * Math.PI;
    worldRoot.add(cone);
  }

  // ---- Skyline backdrop plane (the official low-poly skyline) ----
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 38),
    new THREE.MeshBasicMaterial({ map: loadTex(skylineUrl), depthWrite: false, fog: false })
  );
  backdrop.position.set(0, 14, -52);
  scene.add(backdrop);

  // ---- HERO: swirl monument at center ----
  const heroGroup = new THREE.Group();
  worldRoot.add(heroGroup);

  // Pedestal (low-poly hex prism)
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.6, 1.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xf4f7fb, flatShading: true, roughness: 0.8 })
  );
  pedestal.position.y = 0.7;
  heroGroup.add(pedestal);
  const pedBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.25, 0.25, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.blue, flatShading: true, roughness: 0.8 })
  );
  pedBand.position.y = 1.35;
  heroGroup.add(pedBand);

  // Swirl centerpiece — TWO CROSSED transparent planes so the swirl is always
  // visible from any orbit angle (a single plane would turn edge-on and vanish
  // as the monument rotates). The whole group spins slowly as one unit.
  const swirlTex = loadTex(swirlUrl);
  const swirlMat = new THREE.MeshBasicMaterial({
    map: swirlTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.04, fog: false,
  });
  const swirlGroup = new THREE.Group();
  swirlGroup.position.y = 4.0;
  const swirlA = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), swirlMat);
  const swirlB = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), swirlMat);
  swirlB.rotation.y = Math.PI / 2;
  swirlGroup.add(swirlA, swirlB);
  heroGroup.add(swirlGroup);

  // White wordmark on front + back faces of the pedestal
  const wmMat = new THREE.MeshBasicMaterial({ map: loadTex(wordmarkWhiteUrl), transparent: true, side: THREE.DoubleSide, fog: false });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.36), wmMat);
  wm.position.set(0, 0.75, 2.62);
  heroGroup.add(wm);
  const wmBack = wm.clone();
  wmBack.position.z = -2.62;
  wmBack.rotation.y = Math.PI;
  heroGroup.add(wmBack);

  // ---- HOTSPOTS: 4 interactive pylons ----
  const hotspotMeshes = [];
  const PLAZA_R = 8.5;
  for (const hs of HOTSPOTS) {
    const g = new THREE.Group();
    g.position.set(Math.cos(hs.angle) * PLAZA_R, 0, Math.sin(hs.angle) * PLAZA_R);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xeef3f9, flatShading: true, roughness: 0.85 })
    );
    base.position.y = 0.25;
    g.add(base);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.8 })
    );
    post.position.y = 1.3;
    g.add(post);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: hs.color, flatShading: true, roughness: 0.35, metalness: 0.1,
      emissive: hs.color, emissiveIntensity: 0.18,
    });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.05, 0), crystalMat);
    crystal.position.y = 3.0;
    crystal.userData = { hotspot: hs, baseY: 3.0, mat: crystalMat };
    g.add(crystal);
    hotspotMeshes.push(crystal);

    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.7, 24),
      new THREE.MeshBasicMaterial({ color: hs.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    g.add(glow);

    worldRoot.add(g);
  }

  // ---- Controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.49; // stay above ground
  controls.minPolarAngle = Math.PI * 0.12;
  controls.target.set(0, 3.2, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.update();

  // ---- Raycasting (click vs drag guard) ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = null;

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hotspotMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return; // it was an orbit drag, not a click
    setPointer(e);
    const obj = pick();
    if (obj) onHotspotClick && onHotspotClick(obj.userData.hotspot.key);
  });

  // Hover: cursor + emissive bump
  let hovered = null;
  renderer.domElement.addEventListener('pointermove', (e) => {
    setPointer(e);
    const obj = pick();
    if (obj !== hovered) {
      if (hovered) hovered.userData.mat.emissiveIntensity = 0.18;
      hovered = obj;
      if (hovered) hovered.userData.mat.emissiveIntensity = 0.55;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
      onHotspotHover && onHotspotHover(hovered ? hovered.userData.hotspot.label : null);
    }
  });
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // ---- Resize ----
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- Animation loop ----
  const clock = new THREE.Clock();
  let raf = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick() {
    raf = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    if (!reduceMotion) {
      swirlGroup.rotation.y = t * 0.4;
      for (const m of hotspotMeshes) {
        m.rotation.y = t * 0.6;
        m.position.y = m.userData.baseY + Math.sin(t * 1.6 + m.position.x) * 0.18;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }
  tick();

  function dispose() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  // ---- Test/automation hook (DEV / ?test only): project hotspots to screen px ----
  function getHotspotScreenPositions() {
    const rect = renderer.domElement.getBoundingClientRect();
    return hotspotMeshes.map((m) => {
      const v = new THREE.Vector3();
      m.getWorldPosition(v);
      v.project(camera);
      return {
        key: m.userData.hotspot.key,
        x: Math.round(rect.left + (v.x * 0.5 + 0.5) * rect.width),
        y: Math.round(rect.top + (-v.y * 0.5 + 0.5) * rect.height),
        visible: v.z < 1,
      };
    });
  }
  function freeze() { controls.autoRotate = false; }

  const api = { dispose, getHotspotScreenPositions, freeze };
  // Expose the read-only test hook only in dev or when ?test is present — kept out
  // of normal production usage.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    window.__tidlor3d = api;
  }
  return api;
}
