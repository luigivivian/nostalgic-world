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
    const t = clock.elapsedTime
    g.rotation.y = t * 0.5 + def.id
    g.position.y = def.pos[1] + 0.06 + Math.sin(t * 2.2 + def.id) * 0.06
    // getPosition() is ~1.5 u above the feet (capsule reference), the pile sits on the
    // ground: compare on the XZ plane with a loose height band, or the 3D distance
    // never drops below the radius and the pile can't be collected
    const body = controllerRef?.current?.getPosition()
    const px = body ? body.x : camera.position.x
    const py = body ? body.y : camera.position.y
    const pz = body ? body.z : camera.position.z
    const near =
      Math.hypot(px - def.pos[0], pz - def.pos[2]) < COLLECT_DISTANCE && Math.abs(py - def.pos[1]) < 3
    if (!taken.current && near) {
      taken.current = true
      onCollect(def)
    }
  })

  return (
    <group ref={group} name="ammoPile" position={def.pos}>
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
