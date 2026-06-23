/**
 * heroScene.ts
 * ------------
 * Minimal Three.js hero scene — a rotating icosahedron rendered into
 * the full-viewport #hero-canvas element.
 *
 * This is the Phase 4 proof-of-concept. The next wave will replace or
 * augment this geometry with the actual brand 3D composition.
 *
 * TODO (next wave):
 *   - Replace placeholder geometry with brand/product 3D asset.
 *   - Add environment map / lighting scheme from the design system.
 *   - Wire scroll-based camera animation to section transitions.
 *   - Add post-processing (bloom, depth-of-field) if performance allows.
 */

import * as THREE from 'three'

export interface HeroScene {
  /** Call once per animation frame. */
  tick: (deltaSeconds: number) => void
  /** Resize the renderer and update the camera when the viewport changes. */
  onResize: (width: number, height: number) => void
  /** Clean up GPU resources when the scene is torn down. */
  dispose: () => void
}

/**
 * Initialises and starts the hero Three.js scene.
 *
 * @param canvas - The HTMLCanvasElement to render into.
 * @returns A HeroScene control object.
 */
export function createHeroScene(canvas: HTMLCanvasElement): HeroScene {
  // ── Renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  // ── Scene ───────────────────────────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0d0d14')

  // Subtle fog to add depth without a full environment map
  scene.fog = new THREE.Fog('#0d0d14', 8, 20)

  // ── Camera ──────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  )
  camera.position.set(0, 0, 4)

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight('#ffffff', 0.4)
  scene.add(ambient)

  const point1 = new THREE.PointLight('#f8b400', 80, 12)
  point1.position.set(3, 3, 3)
  scene.add(point1)

  const point2 = new THREE.PointLight('#4f46e5', 60, 12)
  point2.position.set(-3, -2, 2)
  scene.add(point2)

  // ── Geometry — placeholder rotating icosahedron ─────────────────────────
  // Wireframe overlay on a solid mesh gives a layered look without
  // additional draw calls per face.
  const geo = new THREE.IcosahedronGeometry(1.2, 1)

  const solidMat = new THREE.MeshStandardMaterial({
    color: '#1e1b4b',
    roughness: 0.4,
    metalness: 0.7,
  })
  const solidMesh = new THREE.Mesh(geo, solidMat)
  scene.add(solidMesh)

  const wireMat = new THREE.MeshBasicMaterial({
    color: '#f8b400',
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  })
  const wireMesh = new THREE.Mesh(geo, wireMat)
  scene.add(wireMesh)

  // ── Animation state ─────────────────────────────────────────────────────
  let elapsed = 0

  // ── Public API ───────────────────────────────────────────────────────────
  function tick(deltaSeconds: number): void {
    elapsed += deltaSeconds

    // Gentle autorotation on two axes
    solidMesh.rotation.y = elapsed * 0.4
    solidMesh.rotation.x = elapsed * 0.18
    wireMesh.rotation.y = solidMesh.rotation.y
    wireMesh.rotation.x = solidMesh.rotation.x

    renderer.render(scene, camera)
  }

  function onResize(width: number, height: number): void {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  function dispose(): void {
    geo.dispose()
    solidMat.dispose()
    wireMat.dispose()
    renderer.dispose()
  }

  return { tick, onResize, dispose }
}
