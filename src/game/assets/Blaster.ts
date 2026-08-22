import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { rimLight, toonRamp } from '../toon'

// The snack blaster, built to the Gemini concept (assets-src/concepts/blaster-side.png):
// chunky yellow body, orange grip / barrel / rail, red trigger, and a clear canister of
// chips on top as the ammo tank. Two sources:
// - loadBlaster(): the Tripo Studio mesh generated from that concept (public/game/models/
//   gen/blaster.glb — 10.4k tris, region vertex colours painted in Blender, hopper split off
//   as its own mesh; .tmp/blaster-colour.py). Preferred.
// - createBlaster(): the procedural stand-in, used if the GLB fails to load.
// Both: metres, barrel along +Z, grip down -Y, origin at the GRIP CENTRE (what the fist
// closes on), and a
// child named 'muzzle' at the barrel tip for the shot origin / muzzle VFX.

const YELLOW = '#f5b911'
const ORANGE = '#ef7f2b'
const RED = '#e5382f'
const DARK = '#6b4a12'
const CHIP = '#f0c94a'

// Every opaque part is baked into ONE vertex-coloured toon mesh (1 draw call + 1 shadow
// draw); only the glass tank is its own mesh. 20 loose meshes cost 39 calls in the budget.
const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() })
const glass = new THREE.MeshPhysicalMaterial({
  color: '#bfe8ff',
  transparent: true,
  opacity: 0.28,
  roughness: 0.15,
  clearcoat: 1,
  depthWrite: false,
})

const pieces: THREE.BufferGeometry[] = []
const tmp = new THREE.Object3D()
const col = new THREE.Color()

function part(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) {
  const g = geo.toNonIndexed()
  geo.dispose()
  tmp.position.set(x, y, z)
  tmp.rotation.set(...rot)
  tmp.updateMatrix()
  g.applyMatrix4(tmp.matrix)
  g.deleteAttribute('uv')
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  col.set(color)
  for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  pieces.push(g)
}

let merged: THREE.BufferGeometry | null = null
function bodyGeometry() {
  if (merged) return merged
  // body: two stacked rounded slabs (receiver + upper), a pinch of step between them
  part(new RoundedBoxGeometry(0.075, 0.085, 0.26, 3, 0.022), YELLOW, 0, 0.06, 0.05)
  part(new RoundedBoxGeometry(0.064, 0.05, 0.2, 3, 0.018), YELLOW, 0, 0.115, 0.02)
  // rail under the barrel, barrel, dark muzzle ring
  part(new RoundedBoxGeometry(0.05, 0.035, 0.11, 2, 0.012), ORANGE, 0, 0.035, 0.13)
  part(new THREE.CylinderGeometry(0.024, 0.026, 0.12, 14), ORANGE, 0, 0.07, 0.24, [Math.PI / 2, 0, 0])
  part(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 14), DARK, 0, 0.07, 0.298, [Math.PI / 2, 0, 0])
  // three vent slots on the receiver's flank, hammer nub at the back
  for (let i = 0; i < 3; i++) part(new RoundedBoxGeometry(0.006, 0.03, 0.012, 1, 0.002), DARK, -0.038, 0.07, -0.04 + i * 0.02)
  part(new THREE.SphereGeometry(0.016, 10, 8), ORANGE, 0, 0.09, -0.085)
  // grip (raked back), trigger guard, red trigger
  part(new RoundedBoxGeometry(0.06, 0.16, 0.07, 3, 0.02), ORANGE, 0, -0.065, -0.045, [0.28, 0, 0])
  part(new THREE.TorusGeometry(0.028, 0.007, 8, 16, Math.PI), YELLOW, 0, 0.0, 0.02, [0, Math.PI / 2, 0])
  part(new RoundedBoxGeometry(0.012, 0.028, 0.01, 1, 0.004), RED, 0, 0.008, 0.018, [0.35, 0, 0])
  // ammo tank collar and the chips tumbled inside the glass
  part(new THREE.CylinderGeometry(0.02, 0.024, 0.02, 12), DARK, 0, 0.145, 0.01)
  const chipSpots: [number, number, number, number][] = [
    [0.008, 0.175, -0.02, 0.4], [-0.01, 0.182, 0.0, 1.1], [0.006, 0.19, 0.022, 2.0],
    [-0.006, 0.172, 0.03, 0.8], [0.0, 0.196, -0.012, 1.6],
  ]
  for (const [x, y, z, r] of chipSpots) {
    const chip = new THREE.SphereGeometry(0.018, 8, 6)
    chip.scale(1, 0.35, 1)
    part(chip, CHIP, x, y, z, [r, r * 0.7, 0.3])
  }
  merged = mergeGeometries(pieces, false)!
  pieces.forEach((g) => g.dispose())
  return merged
}

/** Total length ≈ 0.42 m, the size of a chunky toy pistol in Luigi's hand. */
export function createBlaster(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'blaster'
  const body = new THREE.Mesh(bodyGeometry(), toon)
  // authored with the origin at the grip top; the attach point is the grip CENTRE
  body.position.set(0, 0.08, 0.045)
  body.castShadow = true
  body.frustumCulled = false
  g.add(body)
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.07, 4, 12), glass)
  tank.position.set(0, 0.265, 0.055)
  tank.rotation.x = Math.PI / 2
  tank.frustumCulled = false
  g.add(tank)
  const muzzle = new THREE.Object3D()
  muzzle.name = 'muzzle'
  muzzle.position.set(0, 0.15, 0.355)
  g.add(muzzle)
  return g
}

const GEN_URL = '/game/models/gen/blaster.glb'
// Tripo API image-to-3D of the concept (task 713bd562, v3.1, 9.3k tris, albedo+mr+normal
// JPEGs). Y-up, muzzle along -Z (the thinnest end of the vertex cloud), 1 unit long; the
// toy is ≈0.42 m. Grip centre / muzzle measured from the vertex cloud (back-bottom / -z tip).
const GEN_SCALE = 0.42
const GEN_GRIP = new THREE.Vector3(0, -0.22, 0.28)
const GEN_MUZZLE = new THREE.Vector3(0, 0.06, -0.5)
// spin so the muzzle runs along +Z like the procedural one
const GEN_ROT = new THREE.Euler(0, Math.PI, 0)

/** The generated blaster, toon-shaded from its albedo. Rejects on load failure — callers fall back. */
export async function loadBlaster(): Promise<THREE.Group> {
  const gltf = await new GLTFLoader().loadAsync(GEN_URL)
  const g = new THREE.Group()
  g.name = 'blaster'
  const inner = gltf.scene
  inner.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const old = mesh.material as THREE.MeshStandardMaterial
    mesh.material = rimLight(new THREE.MeshToonMaterial({ map: old.map, gradientMap: toonRamp() }), '#fff1cc', 0.3)
    old.normalMap?.dispose()
    old.metalnessMap?.dispose()
    old.roughnessMap?.dispose()
    old.dispose()
    mesh.castShadow = true
    mesh.frustumCulled = false
  })
  // rotate into convention, then slide so the grip centre sits on the group origin
  const pivot = new THREE.Group()
  pivot.rotation.copy(GEN_ROT)
  pivot.scale.setScalar(GEN_SCALE)
  pivot.add(inner)
  pivot.updateMatrix()
  const gripLocal = GEN_GRIP.clone().applyMatrix4(pivot.matrix)
  pivot.position.sub(gripLocal)
  g.add(pivot)
  const muzzle = new THREE.Object3D()
  muzzle.name = 'muzzle'
  muzzle.position.copy(GEN_MUZZLE).applyMatrix4(pivot.matrix).sub(gripLocal)
  g.add(muzzle)
  return g
}
