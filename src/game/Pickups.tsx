import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { playerController } from 'three-player-controller'
import { Collectible } from '../collectible/Collectible'
import type { PoolTazo } from './tazoPool'

export interface PickupDef {
  id: number
  pos: [number, number, number]
  tazo: PoolTazo
}

type ControllerRef = React.MutableRefObject<playerController | null>

const COLLECT_DISTANCE = 1.9
const TEXTURE_SIZE = 256

// Shared glow halo: an over-white additive disc that Bloom picks up. NOT a pointLight —
// adding/removing a light changes the light count and forces every material in the
// scene (terrain, ~330 plants, blocks) to recompile its shader, a hitch per pickup.
const haloGeometry = new THREE.CircleGeometry(0.55, 24)
const haloMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.2, 1.7, 0.7),
  toneMapped: false,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
})

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

  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    g.rotation.y += dt * 1.8
    g.position.y = def.pos[1] + Math.sin(clock.elapsedTime * 2 + def.id) * 0.15
    // third person: collect against the CHARACTER, not the camera trailing behind it
    const body = controllerRef?.current?.getPosition()
    const dist = body
      ? Math.hypot(body.x - g.position.x, body.y - g.position.y, body.z - g.position.z)
      : camera.position.distanceTo(g.position)
    if (!taken.current && dist < COLLECT_DISTANCE) {
      taken.current = true
      onCollect(def)
    }
  })

  return (
    <group ref={group} position={def.pos} scale={0.38}>
      <Collectible shape="disc" frontUrl={def.tazo.front} backUrl={def.tazo.back} maxSize={TEXTURE_SIZE} />
      <mesh geometry={haloGeometry} material={haloMaterial} rotation-x={-Math.PI / 2} position-y={-0.9} dispose={null} />
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
