import { useCallback, useEffect, useRef, useState } from 'react'
import { RigidBody } from '@react-three/rapier'
import type { CollisionPayload } from '@react-three/rapier'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { terrainHeight } from './terrain'
import { toonRamp } from './toon'

const BLOCK = 1.15
const COLS = 4
const ROWS = 3
// straight ahead of the spawn (camera starts looking down -Z)
const WALL_X = 0
const WALL_Z = -11

const FRAGMENT_TTL_MS = 2500
const MAX_FRAGMENTS = 40

// Shared GPU resources: one geometry + one material for every block and every
// fragment (8 per break) instead of a fresh pair per mesh.
const blockGeometry = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK)
const fragmentGeometry = new THREE.BoxGeometry(BLOCK / 2, BLOCK / 2, BLOCK / 2)
const blockMaterial = new THREE.MeshToonMaterial({ color: '#d98a45', gradientMap: toonRamp() })
const fragmentMaterial = new THREE.MeshToonMaterial({ color: '#b76b32', gradientMap: toonRamp() })

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
  /** Called once per broken block with the drop position and the projectile that hit it. */
  onBreak: (pos: [number, number, number], projectileId: number) => void
}

// Breakable wall in the spirit of the three.js ammo-break demo, adapted to rapier:
// a projectile hit swaps the block for 8 half-size fragments with a radial impulse.
export function Blocks({ onBreak }: Props) {
  const [blocks, setBlocks] = useState<BlockDef[]>(buildWall)
  const [fragments, setFragments] = useState<Fragment[]>([])
  const fragId = useRef(1000)
  // The rapier body outlives the React state update by a frame or two, so the same
  // block can report several collisions before it unmounts — break each one once.
  const broken = useRef(new Set<number>())
  // Likewise per projectile: the 0.18-wide ball fits the 0.04 gap between blocks and
  // can touch two of them in one physics step — only the first contact counts.
  const spent = useRef(new Set<number>())

  const breakBlock = useCallback(
    (def: BlockDef, e: CollisionPayload) => {
      const projectileId = (e.other.rigidBody?.userData as { id?: number })?.id ?? -1
      if (broken.current.has(def.id) || spent.current.has(projectileId)) return
      broken.current.add(def.id)
      spent.current.add(projectileId)
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
      // cap the live rigid-body count: the oldest debris goes first
      setFragments((fs) => [...fs, ...frags].slice(-MAX_FRAGMENTS))
      onBreak([hit.x, hit.y + BLOCK, hit.z], projectileId)
    },
    [onBreak],
  )

  // fragments decay after a few seconds
  useEffect(() => {
    if (fragments.length === 0) return
    const t = setInterval(() => {
      const now = performance.now()
      setFragments((fs) => fs.filter((f) => now - f.born < FRAGMENT_TTL_MS))
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
          <mesh geometry={blockGeometry} material={blockMaterial} castShadow receiveShadow dispose={null}>
            <Outlines thickness={0.035} color="#3a2313" />
          </mesh>
        </RigidBody>
      ))}
      {/* debris: no outline pass, no shadow caster — at half size neither reads */}
      {fragments.map((f) => (
        <RigidBody key={f.id} position={f.pos} linearVelocity={f.vel} colliders="cuboid">
          <mesh geometry={fragmentGeometry} material={fragmentMaterial} dispose={null} />
        </RigidBody>
      ))}
    </>
  )
}
