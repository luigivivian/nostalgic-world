import { useCallback, useEffect, useRef, useState } from 'react'
import { RigidBody } from '@react-three/rapier'
import type { CollisionPayload } from '@react-three/rapier'
import { Outlines } from '@react-three/drei'
import { terrainHeight } from './terrain'
import { toonRamp } from './toon'

const BLOCK = 1.15
const COLS = 4
const ROWS = 3
// straight ahead of the spawn (camera starts looking down -Z)
const WALL_X = 0
const WALL_Z = -11

interface BlockDef {
  id: number
  pos: [number, number, number]
}

interface Fragment {
  id: number
  pos: [number, number, number]
  vel: [number, number, number]
  born: number
}

function buildWall(): BlockDef[] {
  const defs: BlockDef[] = []
  let id = 0
  for (let col = 0; col < COLS; col++) {
    const x = WALL_X + (col - (COLS - 1) / 2) * (BLOCK + 0.04)
    const ground = terrainHeight(x, WALL_Z)
    for (let row = 0; row < ROWS; row++) {
      defs.push({ id: id++, pos: [x, ground + BLOCK / 2 + 0.3 + row * (BLOCK + 0.03), WALL_Z] })
    }
  }
  return defs
}

interface Props {
  onBreak: (pos: [number, number, number]) => void
}

// Breakable wall in the spirit of the three.js ammo-break demo, adapted to rapier:
// a projectile hit swaps the block for 8 half-size fragments with a radial impulse.
export function Blocks({ onBreak }: Props) {
  const [blocks, setBlocks] = useState<BlockDef[]>(buildWall)
  const [fragments, setFragments] = useState<Fragment[]>([])
  const fragId = useRef(1000)

  const breakBlock = useCallback(
    (def: BlockDef, e: CollisionPayload) => {
      const hit = e.target.rigidBody?.translation() ?? { x: def.pos[0], y: def.pos[1], z: def.pos[2] }
      const shooterVel = e.other.rigidBody?.linvel() ?? { x: 0, y: 0, z: 0 }
      setBlocks((bs) => bs.filter((b) => b.id !== def.id))
      const frags: Fragment[] = []
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          for (const sz of [-1, 1]) {
            frags.push({
              id: fragId.current++,
              pos: [hit.x + (sx * BLOCK) / 4, hit.y + (sy * BLOCK) / 4, hit.z + (sz * BLOCK) / 4],
              vel: [
                sx * 3 + shooterVel.x * 0.12,
                sy * 2 + 2.5 + shooterVel.y * 0.12,
                sz * 3 + shooterVel.z * 0.12,
              ],
              born: performance.now(),
            })
          }
      setFragments((fs) => [...fs, ...frags])
      onBreak([hit.x, hit.y + BLOCK, hit.z])
    },
    [onBreak],
  )

  // fragments decay after a few seconds
  useEffect(() => {
    if (fragments.length === 0) return
    const t = setInterval(() => {
      const now = performance.now()
      setFragments((fs) => fs.filter((f) => now - f.born < 4000))
    }, 500)
    return () => clearInterval(t)
  }, [fragments.length > 0])

  return (
    <>
      {blocks.map((b) => (
        <RigidBody
          key={b.id}
          position={b.pos}
          colliders="cuboid"
          onCollisionEnter={(e) => {
            if ((e.other.rigidBody?.userData as { projectile?: boolean })?.projectile)
              breakBlock(b, e)
          }}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[BLOCK, BLOCK, BLOCK]} />
            <meshToonMaterial color="#d98a45" gradientMap={toonRamp()} />
            <Outlines thickness={0.035} color="#3a2313" />
          </mesh>
        </RigidBody>
      ))}
      {fragments.map((f) => (
        <RigidBody key={f.id} position={f.pos} linearVelocity={f.vel} colliders="cuboid">
          <mesh castShadow>
            <boxGeometry args={[BLOCK / 2, BLOCK / 2, BLOCK / 2]} />
            <meshToonMaterial color="#b76b32" gradientMap={toonRamp()} />
            <Outlines thickness={0.025} color="#3a2313" />
          </mesh>
        </RigidBody>
      ))}
    </>
  )
}
