import { BallCollider, RigidBody, interactionGroups } from '@react-three/rapier'
import * as THREE from 'three'

export interface ProjectileDef {
  id: number
  pos: [number, number, number]
  vel: [number, number, number]
}

// The shot reads as a tracer: a short capsule stretched along its velocity, over-white
// so it crosses the Bloom threshold. The collider stays the 0.09 ball the aim was tuned on.
const geometry = new THREE.CapsuleGeometry(0.055, 0.75, 3, 8)
const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.7), toneMapped: false })
const UP = new THREE.Vector3(0, 1, 0)
const dir = new THREE.Vector3()

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
          colliders={false}
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
          <BallCollider args={[0.09]} />
          <mesh
            geometry={geometry}
            material={material}
            quaternion={new THREE.Quaternion().setFromUnitVectors(UP, dir.set(...p.vel).normalize())}
            dispose={null}
          />
        </RigidBody>
      ))}
    </>
  )
}
