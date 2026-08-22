import { describe, it, expect, vi } from 'vitest'

// Vegetation/Trails preload through drei's useGLTF; the invariants only need the spots.
vi.mock('../assets/props', () => ({ preloadProps: () => {} }))
vi.mock('../quality', () => ({ LOW_END: false }))

import { BIOME_IDS, setBiome, activeBiome } from '../biomes'
import { terrainHeight, WATER_LEVEL } from '../terrain'
import { stations, STATION_NUDGES } from '../stations'
import { vegetationSpots, SIGNATURE_SPOT } from '../Vegetation'
import { TRAIL_CLEAR } from '../assets/Trails'
import { SPAWN_X, SPAWN_Z } from '../PlayerTPS'

// Every biome reshapes the same island. The authored gameplay layer (stations, spawn,
// trails, landmark knoll) must stay on walkable land in all of them.
describe.each(BIOME_IDS)('biome %s', (id) => {
  it('keeps the three stations on land where they were authored', () => {
    setBiome(id)
    const list = stations()
    expect(activeBiome().id).toBe(id)
    expect(list.map((s) => s.id)).toEqual(['praia', 'bosque', 'mirante'])
    expect(STATION_NUDGES).toEqual([])
    for (const s of list) expect(s.groundY).toBeGreaterThan(WATER_LEVEL + 1)
  })

  it('spawns the player on the beach above the surf', () => {
    setBiome(id)
    const h = terrainHeight(SPAWN_X, SPAWN_Z)
    expect(h).toBeGreaterThan(WATER_LEVEL + 0.8)
    expect(h).toBeLessThan(WATER_LEVEL + 4)
  })

  it('puts the landmark knoll on land, off the trail network', () => {
    setBiome(id)
    const [x, z] = SIGNATURE_SPOT
    expect(terrainHeight(x, z)).toBeGreaterThan(WATER_LEVEL + 2)
    for (const [cx, cz, r] of TRAIL_CLEAR) expect(Math.hypot(x - cx, z - cz)).toBeGreaterThan(r)
  })

  it('scatters a full kit: hundreds of props, all on land except the lily pads', () => {
    setBiome(id)
    const spots = vegetationSpots()
    expect(spots.length).toBeGreaterThan(400)
    expect(spots.length).toBeLessThan(3200)
    const urls = new Set(spots.map((s) => s.url))
    expect(urls.size).toBeGreaterThan(12)
    for (const s of spots) {
      if (/lily_/.test(s.url)) continue
      expect(s.pos[1]).toBeGreaterThan(WATER_LEVEL - 1.2)
      expect(Number.isFinite(s.scale) && s.scale > 0).toBe(true)
    }
    if (id !== 'praia') expect([...urls].some((u) => u.includes(`/gen/biome-${id}.glb`))).toBe(true)
  })
})

it('biomes differ in shape: the mountain is taller than the swamp', () => {
  setBiome('montanha')
  const peak = Math.max(...[...Array(40)].map((_, i) => terrainHeight(i * 2 - 40, 5)))
  setBiome('pantano')
  const low = Math.max(...[...Array(40)].map((_, i) => terrainHeight(i * 2 - 40, 5)))
  expect(peak).toBeGreaterThan(low + 5)
  setBiome('praia')
})
