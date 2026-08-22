import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BAG_H, bagGeometry } from './bagGeometry'
import { bagMaterial, useBagTexture } from './SnackBag'
import { preloadProps, useToonParts } from './props'

// Ammo pickup visual: a wooden pallet with three bags of the current collection
// stacked on it, over an orange glow disc. Bags are the same mesh/scan as the targets,
// so "ammo" reads as "more of those bags"; the pallet + glow separate it from a target
// at play distance (a bag on a pallet is cargo, a bag on a fence is a target).

const PALLET = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/Pallet_Wood.gltf'
preloadProps([PALLET])
const PALLET_SCALE = 0.95
const PALLET_H = 0.3 * PALLET_SCALE

const BAG = 0.7
// one bag propped upright at the front (the scan is the readable part), two lying
// behind it; the piles spin so every side gets a turn facing the player
const PILE: { pos: [number, number, number]; rot: [number, number, number]; variant: number }[] = [
  { pos: [0.0, PALLET_H + (BAG_H * BAG) / 2 - 0.03, 0.16], rot: [-0.22, 0.1, 0.0], variant: 3 },
  { pos: [-0.3, PALLET_H + 0.12, -0.26], rot: [-1.35, 0.5, 0.2], variant: 1 },
  { pos: [0.32, PALLET_H + 0.12, -0.3], rot: [-1.4, -0.55, -0.2], variant: 2 },
]

// the three bags merge into one geometry: one draw call (plus shadow) per pile
// instead of three, and no per-bag React nodes
let pileGeometry: THREE.BufferGeometry | null = null
function pile(): THREE.BufferGeometry {
  if (pileGeometry) return pileGeometry
  const m = new THREE.Matrix4()
  const parts = PILE.map((b) => {
    const g = bagGeometry(b.variant).clone()
    m.compose(
      new THREE.Vector3(...b.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.rot)),
      new THREE.Vector3(BAG, BAG, BAG),
    )
    return g.applyMatrix4(m)
  })
  pileGeometry = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return pileGeometry
}

// Ground glow in the ammo orange of the HUD pips: additive, over-white so Bloom lifts
// it on desktop, and still a warm disc on the LOW_END tier without Bloom.
const haloGeometry = new THREE.CircleGeometry(1.05, 28)
const haloMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.0, 1.15, 0.35),
  toneMapped: false,
  transparent: true,
  opacity: 0.42,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
})

/** ~0.95 units tall; `slug` picks which collection's bags are stacked. Base at y = 0. */
export function AmmoPile({ slug, scale = 1 }: { slug: string; scale?: number }) {
  const pallet = useToonParts(PALLET)
  const map = useBagTexture(slug, 1)
  const geometry = useMemo(pile, [])
  return (
    <group scale={scale}>
      {pallet.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={p.material}
          scale={PALLET_SCALE}
          castShadow
          receiveShadow
          dispose={null}
        />
      ))}
      <mesh geometry={geometry} material={bagMaterial(map)} castShadow receiveShadow dispose={null} />
      <mesh geometry={haloGeometry} material={haloMaterial} rotation-x={-Math.PI / 2} position-y={0.03} dispose={null} />
    </group>
  )
}

/** height of the pile, for callers that need to sit it on the ground */
export const AMMO_PILE_HEIGHT = PALLET_H + BAG_H * BAG
