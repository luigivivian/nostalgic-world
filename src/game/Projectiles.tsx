import { RigidBody, interactionGroups } from '@react-three/rapier'
import * as THREE from 'three'

export interface ProjectileDef {
  id: number
  pos: [number, number, number]
  vel: [number, number, number]
}

const geometry = new THREE.SphereGeometry(0.09, 12, 12)
const material = new THREE.MeshStandardMaterial({
  color: '#ffd23f',
  emissive: '#c98800',
  emissiveIntensity: 0.6,
})

interface Props {
  projectiles: ProjectileDef[]
  /** Hit anything that is not a target (terrain, water plane) — the shot is wasted. */
  onMiss: (id: number) => void
}

// Fast small spheres; ccd so they never tunnel through a bag face.
export function Projectiles({ projectiles, onMiss }: Props) {
  return (
    <>
      {projectiles.map((p) => (
        <RigidBody
          key={p.id}
          position={p.pos}
          linearVelocity={p.vel}
          colliders="ball"
          ccd
          density={4}
          // no gravity: the shot must land exactly on the reticle (at world gravity the
          // ball dropped ~0.5 u over the 10 u to a target)
          gravityScale={0}
          userData={{ projectile: true, id: p.id }}
          collisionGroups={interactionGroups(2, [0])}
          onCollisionEnter={(e) => {
            // the target side owns the hit path; anything else ends the shot as a miss
            if ((e.other.rigidBody?.userData as { target?: boolean })?.target) return
            onMiss(p.id)
          }}
        >
          <mesh geometry={geometry} material={material} dispose={null} />
        </RigidBody>
      ))}
    </>
  )
}
