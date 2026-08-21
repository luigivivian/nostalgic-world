import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { playerController } from 'three-player-controller'
import { AmmoPile } from './assets/AmmoPile'

export interface AmmoPickupDef {
  id: number
  pos: [number, number, number]
  amount: number
  /** performance.now() at spawn — an ignored pile eventually despawns so a round can end */
  born: number
}

export const AMMO_TTL_MS = 20000

type ControllerRef = React.MutableRefObject<playerController | null>

export const AMMO_PER_PICKUP = 4
const COLLECT_DISTANCE = 1.9

function AmmoPickup({
  def,
  slug,
  onCollect,
  controllerRef,
}: {
  def: AmmoPickupDef
  slug: string
  onCollect: (def: AmmoPickupDef) => void
  controllerRef?: ControllerRef
}) {
  const group = useRef<THREE.Group>(null)
  const taken = useRef(false)
  const camera = useThree((s) => s.camera)

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.rotation.y = clock.elapsedTime * 0.7 + def.id
    const body = controllerRef?.current?.getPosition()
    const px = body ? body.x : camera.position.x
    const py = body ? body.y + 0.9 : camera.position.y
    const pz = body ? body.z : camera.position.z
    if (!taken.current && Math.hypot(px - def.pos[0], py - def.pos[1], pz - def.pos[2]) < COLLECT_DISTANCE) {
      taken.current = true
      onCollect(def)
    }
  })

  return (
    <group ref={group} position={def.pos}>
      <AmmoPile slug={slug} />
    </group>
  )
}

export function AmmoPickups({
  slug,
  pickups,
  onCollect,
  controllerRef,
}: {
  slug: string
  pickups: AmmoPickupDef[]
  onCollect: (def: AmmoPickupDef) => void
  controllerRef?: ControllerRef
}) {
  return (
    <>
      {pickups.map((p) => (
        <AmmoPickup key={p.id} slug={slug} def={p} onCollect={onCollect} controllerRef={controllerRef} />
      ))}
    </>
  )
}
