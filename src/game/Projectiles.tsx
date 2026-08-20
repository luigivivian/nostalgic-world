import { RigidBody, interactionGroups } from '@react-three/rapier'

export interface ProjectileDef {
  id: number
  pos: [number, number, number]
  vel: [number, number, number]
}

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
          userData={{ projectile: true }}
          collisionGroups={interactionGroups(2, [0])}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#ffd23f" emissive="#c98800" emissiveIntensity={0.6} />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}
