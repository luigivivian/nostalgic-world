import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonRamp } from '../toon'

// Shared loader/instancer for the low-poly packs in public/game/models.
// Two jobs:
//   1. toonify once per FILE (not per placement) — clones then share materials;
//   2. turn N placements of the same file into one InstancedMesh per sub-mesh, which
//      is what keeps ~600 plants inside the draw-call budget (was ~1 call per plant).

export interface Placement {
  pos: [number, number, number]
  /** rotation about Y, radians */
  rot: number
  scale: number
}

export interface ToonPart {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** the sub-mesh transform inside the model file */
  local: THREE.Matrix4
}

// Per-file colour corrections. The kits mix palettes: Kenney's grass tufts are teal and
// read as blue spikes against this island's meadow green, and the "rock" variants are
// dirt-salmon. One tint per file keeps the world cohesive without editing the assets.
const TINTS: [RegExp, THREE.Color][] = [
  [/grass(_large|_leafs|_leafsLarge)?\.glb$/, new THREE.Color('#8dbf59')],
  // the kit's bridge deck is near-white stone-grey; the pier has to read as timber
  [/bridge_(wood|side_wood)/, new THREE.Color('#c08b57')],
]

// One toon conversion per GLTF scene object, cached for the lifetime of the page. The
// original (unmerged) geometries stay alive in drei's useGLTF cache alongside the merged
// copies — accepted: the packs are small, and disposing them would break any other
// consumer of the same useGLTF entry (DevShowcase, future props).
const partsCache = new WeakMap<THREE.Object3D, ToonPart[]>()
const IDENTITY = new THREE.Matrix4()

// Textured buckets keep position/normal/uv, vertex-coloured ones position/normal/color —
// uniform attribute sets per bucket, or mergeGeometries() refuses the merge.
function stripToCore(g: THREE.BufferGeometry, textured: boolean) {
  for (const name of Object.keys(g.attributes)) {
    if (name === 'position' || name === 'normal') continue
    if (textured ? name === 'uv' : name === 'color') continue
    g.deleteAttribute(name)
  }
  g.morphAttributes = {}
  g.morphTargetsRelative = false
  if (!g.attributes.normal) g.computeVertexNormals()
}

function paintVertexColor(g: THREE.BufferGeometry, color: THREE.Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  const existing = g.attributes.color as THREE.BufferAttribute | undefined
  for (let i = 0; i < n; i++) {
    // obj2gltf scenes sometimes ship vertex colours already — modulate, don't replace
    const r = existing ? existing.getX(i) : 1
    const gg = existing ? existing.getY(i) : 1
    const b = existing ? existing.getZ(i) : 1
    arr[i * 3] = color.r * r
    arr[i * 3 + 1] = color.g * gg
    arr[i * 3 + 2] = color.b * b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

/**
 * Toonify a model file and collapse it to as few draw calls as possible:
 * - untextured sub-meshes are baked into ONE vertex-coloured geometry per
 *   (side, transparent, alphaTest) bucket — the Poly "Alien Plants" drops from 90 meshes
 *   × 11 materials to a single InstancedMesh, Kenney multi-material props to one each;
 * - textured sub-meshes merge per material (the map has to stay a uniform).
 * Sub-mesh transforms are baked into the vertices, so every part's `local` is identity.
 * Geometries with morph targets are flattened (InstancedMesh has no influences and the
 * renderer would read `undefined.length` in the shadow pass).
 */
function toonParts(scene: THREE.Object3D, url: string): ToonPart[] {
  const hit = partsCache.get(scene)
  if (hit) return hit
  const tint = TINTS.find(([re]) => re.test(url))?.[1]
  scene.updateWorldMatrix(false, true)

  type Bucket = { geos: THREE.BufferGeometry[]; material: THREE.Material }
  const buckets = new Map<string, Bucket>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    // GLTFLoader emits one single-material Mesh per primitive, so a material array
    // never shows up for glTF input; if another loader ever hands one in, take the first
    // material rather than slicing groups blind (wrong triangles would be worse).
    if (Array.isArray(mesh.material)) console.warn('props: multi-material mesh, using material[0]', url, mesh.name)
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
    const textured = !!src.map
    const g = mesh.geometry.clone()
    g.applyMatrix4(mesh.matrixWorld)
    const flags = `${src.side}:${src.transparent ? 1 : 0}:${src.alphaTest ?? 0}`
    const key = textured ? `tex:${src.uuid}:${flags}` : `vc:${flags}`
    let b = buckets.get(key)
    if (!b) {
      const material = new THREE.MeshToonMaterial({
        // tint modulates the map when there is one, replaces the colour when there is not
        color: textured ? (tint ?? src.color ?? new THREE.Color('#ffffff')) : new THREE.Color('#ffffff'),
        map: textured ? src.map : null,
        vertexColors: !textured,
        gradientMap: toonRamp(),
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        side: src.side,
      })
      b = { geos: [], material }
      buckets.set(key, b)
    }
    stripToCore(g, textured)
    if (!textured) paintVertexColor(g, tint ?? src.color ?? new THREE.Color('#ffffff'))
    b.geos.push(g)
  })

  const parts: ToonPart[] = []
  for (const { geos, material } of buckets.values()) {
    let list = geos
    if (list.some((g) => !g.index)) list = list.map((g) => (g.index ? g.toNonIndexed() : g))
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)
    if (merged) parts.push({ geometry: merged, material, local: IDENTITY })
    else {
      console.warn('props: merge failed, falling back to per-mesh instancing', url)
      for (const g of list) parts.push({ geometry: g, material, local: IDENTITY })
    }
  }
  partsCache.set(scene, parts)
  return parts
}

/** Toonified sub-meshes of a model file. Safe to call from many components. */
export function useToonParts(url: string): ToonPart[] {
  const { scene } = useGLTF(url)
  return useMemo(() => toonParts(scene, url), [scene, url])
}

const scratch = {
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  p: new THREE.Vector3(),
  s: new THREE.Vector3(),
  e: new THREE.Euler(),
}

/** world matrix for one placement of one sub-mesh */
export function placementMatrix(p: Placement, local: THREE.Matrix4, out: THREE.Matrix4) {
  scratch.e.set(0, p.rot, 0)
  scratch.q.setFromEuler(scratch.e)
  scratch.p.set(p.pos[0], p.pos[1], p.pos[2])
  scratch.s.setScalar(p.scale)
  out.compose(scratch.p, scratch.q, scratch.s)
  return out.multiply(local)
}

/**
 * Build the InstancedMeshes for `url` at `spots`. Returned as plain three objects so
 * callers can drop them in with <primitive>; geometries/materials are shared and must
 * NOT be disposed by the caller.
 */
export function buildInstances(parts: ToonPart[], spots: Placement[], castShadow = true) {
  return parts.map((part) => {
    const inst = new THREE.InstancedMesh(part.geometry, part.material, spots.length)
    inst.castShadow = castShadow
    inst.receiveShadow = false
    for (let i = 0; i < spots.length; i++)
      inst.setMatrixAt(i, placementMatrix(spots[i], part.local, scratch.m))
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    return inst
  })
}

export function preloadProps(urls: readonly string[]) {
  for (const u of urls) useGLTF.preload(u)
}
