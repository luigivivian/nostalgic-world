import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { playerController } from 'three-player-controller'
import { Collectible } from '../collectible/Collectible'
import type { PoolTazo } from './tazoPool'
import type { Rarity } from './store'

export interface PickupDef {
  id: number
  pos: [number, number, number]
  tazo: PoolTazo
  rarity: Rarity
  /** performance.now() at drop time — drives the 10s despawn */
  born: number
}

type ControllerRef = React.MutableRefObject<playerController | null>

/** Game feel: the tazo starts pulling toward the player here... */
export const MAGNET_DISTANCE = 3.2
/** ...and is banked here. The pull closes the gap in well under a second. */
export const COLLECT_DISTANCE = 1.2
/** Pressure: an uncollected drop is lost. */
export const PICKUP_TTL_MS = 10000
const TEXTURE_SIZE = 256

// Shared glow halo: an over-white additive disc that Bloom picks up. NOT a pointLight —
// adding/removing a light changes the light count and forces every material in the
// scene (terrain, ~330 plants, targets) to recompile its shader, a hitch per pickup.
const haloGeometry = new THREE.CircleGeometry(0.55, 24)
const haloMaterials: Record<Rarity, THREE.MeshBasicMaterial> = {
  common: haloMaterial(2.2, 1.7, 0.7, 0.32),
  rare: haloMaterial(0.9, 1.9, 2.6, 0.45),
  legendary: haloMaterial(2.8, 1.1, 2.6, 0.6),
}

function haloMaterial(r: number, g: number, b: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(r, g, b),
    toneMapped: false,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function Pickup({
  def,
  onCollect,
  controllerRef,
}: {
  def: PickupDef
  onCollect: (def: PickupDef) => void
  controllerRef?: ControllerRef
}) {
  const group = useRef<THREE.Group>(null)
  const taken = useRef(false)
  const camera = useThree((s) => s.camera)
  // magnetised XZ drift, applied on top of the bob so the two never fight
  const drift = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    g.rotation.y += dt * 1.8
    g.position.set(def.pos[0] + drift.x, def.pos[1] + drift.y, def.pos[2] + drift.z)
    g.position.y += Math.sin(clock.elapsedTime * 2 + def.id) * 0.15

    // third person: collect against the CHARACTER, not the camera trailing behind it
    const body = controllerRef?.current?.getPosition()
    const px = body ? body.x : camera.position.x
    const py = body ? body.y + 0.9 : camera.position.y
    const pz = body ? body.z : camera.position.z
    const dist = Math.hypot(px - g.position.x, py - g.position.y, pz - g.position.z)

    if (!taken.current && dist < MAGNET_DISTANCE) {
      // exponential pull toward the player: frame-rate independent, no overshoot
      const k = 1 - Math.exp(-5 * dt)
      drift.x += (px - g.position.x) * k
      drift.y += (py - g.position.y) * k
      drift.z += (pz - g.position.z) * k
    }
    if (!taken.current && dist < COLLECT_DISTANCE) {
      taken.current = true
      onCollect(def)
    }
  })

  return (
    <group ref={group} position={def.pos} scale={def.rarity === 'common' ? 0.38 : 0.46}>
      <Collectible shape="disc" frontUrl={def.tazo.front} backUrl={def.tazo.back} maxSize={TEXTURE_SIZE} />
      <mesh
        geometry={haloGeometry}
        material={haloMaterials[def.rarity]}
        rotation-x={-Math.PI / 2}
        position-y={-0.9}
        dispose={null}
      />
    </group>
  )
}

export function Pickups({
  pickups,
  onCollect,
  controllerRef,
}: {
  pickups: PickupDef[]
  onCollect: (def: PickupDef) => void
  controllerRef?: ControllerRef
}) {
  return (
    <>
      {pickups.map((p) => (
        <Pickup key={p.id} def={p} onCollect={onCollect} controllerRef={controllerRef} />
      ))}
    </>
  )
}
