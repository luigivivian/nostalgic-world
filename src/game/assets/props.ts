import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
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

// One toon conversion per GLTF scene object, cached for the lifetime of the page.
const partsCache = new WeakMap<THREE.Object3D, ToonPart[]>()

function toonParts(scene: THREE.Object3D, url: string): ToonPart[] {
  const hit = partsCache.get(scene)
  if (hit) return hit
  const parts: ToonPart[] = []
  const converted = new Map<THREE.Material, THREE.Material>()
  const tint = TINTS.find(([re]) => re.test(url))?.[1]
  scene.updateWorldMatrix(false, true)
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const src = mesh.material as THREE.MeshStandardMaterial
    let mat = converted.get(src)
    if (!mat) {
      mat = new THREE.MeshToonMaterial({
        color: tint ?? src.color ?? new THREE.Color('#ffffff'),
        map: src.map ?? null,
        gradientMap: toonRamp(),
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        side: src.side,
      })
      converted.set(src, mat)
    }
    parts.push({ geometry: mesh.geometry, material: mat, local: mesh.matrixWorld.clone() })
  })
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
