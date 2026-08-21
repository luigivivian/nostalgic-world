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

// Fast small spheres; ccd so they never tunnel through a block face.
export function Projectiles({ projectiles }: { projectiles: ProjectileDef[] }) {
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
          userData={{ projectile: true, id: p.id }}
          collisionGroups={interactionGroups(2, [0])}
        >
          <mesh geometry={geometry} material={material} dispose={null} />
        </RigidBody>
      ))}
    </>
  )
}
