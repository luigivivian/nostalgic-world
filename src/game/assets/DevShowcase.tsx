import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { terrainHeight } from '../terrain'
import { SPAWN } from '../PlayerTPS'
import { SnackBag } from './SnackBag'
import { AmmoPile } from './AmmoPile'
import { StationDressing } from './StationDressing'
import { GameVFX, playVfxEvent } from '../vfx/GameVFX'
import type { PoolTazo } from '../tazoPool'

// Asset showroom, mounted by <Island/> only when the URL says ?showcase — three bags
// from different collections, an ammo pile, and a hit/collect VFX loop, all a few steps
// in front of the beach spawn so a headless screenshot catches them without playing.

const SLUGS = ['looney', 'tinytoon', 'maskara']
const ROW_Z = SPAWN.z - 7
const SPACING = 1.5

const fakeTazo: PoolTazo = { collection: 'showcase', label: 'demo', front: '', back: null }

function VfxLoop() {
  const t = useRef(0)
  const n = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (t.current < 1.1) return
    t.current = 0
    const i = n.current++
    const x = SPAWN.x - SPACING + (i % 3) * SPACING
    const y = terrainHeight(x, ROW_Z) + 0.9
    if (i % 2 === 0)
      playVfxEvent({ type: 'hit', at: performance.now(), pos: [x, y, ROW_Z], targetId: i, stationId: 'praia', combo: 1 })
    else
      playVfxEvent({
        type: 'collect',
        at: performance.now(),
        pos: [x, y, ROW_Z],
        tazo: fakeTazo,
        rarity: i % 4 === 1 ? 'legendary' : 'common',
        isNew: true,
      })
  })
  return null
}

export function DevShowcase() {
  useEffect(() => {
    console.log('[showcase] mounted — bags:', SLUGS.join(', '))
  }, [])
  return (
    <>
      {SLUGS.map((slug, i) => {
        const x = SPAWN.x - SPACING + i * SPACING
        return (
          <group key={slug} position={[x, terrainHeight(x, ROW_Z) + 0.62, ROW_Z]}>
            <SnackBag slug={slug} variant={i} />
            <Text position={[0, -0.78, 0.3]} fontSize={0.13} color="#2a1a12" anchorX="center">
              {slug}
            </Text>
          </group>
        )
      })}
      <group position={[SPAWN.x + 2.6, terrainHeight(SPAWN.x + 2.6, ROW_Z), ROW_Z]}>
        <AmmoPile slug="looney" />
      </group>
      <StationDressing id="praia" />
      <GameVFX />
      <VfxLoop />
    </>
  )
}
