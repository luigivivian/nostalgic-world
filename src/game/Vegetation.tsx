import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { terrainHeight, WATER_LEVEL } from './terrain'
import { fbm } from './noise'
import { toonRamp } from './toon'

// Green-island decor built from the low-poly packs in public/game/models (see
// .tmp/model-catalog.json). kenney_nature-kit is the 1:1-scale self-contained base;
// KayKit pieces (2-5x larger, external bin+texture) appear only at points of interest.
const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const KAYKIT_TREE = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_2_A_Color1.gltf'
const KAYKIT_LOGS = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/Wood_Log_Stack.gltf'
const KAYKIT_GOLD = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/Gold_Nuggets.gltf'

const TREES = [
  K + 'tree_default.glb',
  K + 'tree_oak.glb',
  K + 'tree_fat.glb',
  K + 'tree_pineRoundA.glb',
  K + 'tree_pineTallA.glb',
  K + 'tree_small.glb',
]
const PALMS = [K + 'tree_palmBend.glb', '/game/models/palm-detailed-long.gltf', '/game/models/palm-detailed-short.gltf']
const BUSHES = [K + 'plant_bushDetailed.glb', K + 'plant_bushLarge.glb']
const FLOWERS = [K + 'flower_purpleB.glb', K + 'flower_redA.glb', K + 'flower_yellowB.glb']
const MUSHROOMS = [K + 'mushroom_redGroup.glb', K + 'mushroom_red.glb', K + 'mushroom_tanTall.glb']
// stone_* variants are neutral grey; rock_* are dirt-salmon + teal grass caps, which
// read pink at a distance — stones sit better on the high ground.
const ROCKS = [K + 'stone_largeA.glb', K + 'stone_tallA.glb', K + 'stone_smallFlatA.glb']
const GRASS = [K + 'grass_leafsLarge.glb']
const STUMPS = [K + 'stump_roundDetailed.glb', K + 'log_stack.glb']

interface Spot {
  url: string
  pos: [number, number, number]
  rot: number
  scale: number
}

const pick = <T,>(arr: T[], v: number) => arr[Math.floor(v * arr.length) % arr.length]

// Deterministic scatter: same seeded fbm as the terrain, banded by altitude with a
// forest mask so trees clump into groves instead of an even sprinkle.
function buildSpots(): Spot[] {
  const spots: Spot[] = []
  const put = (url: string, x: number, z: number, rot: number, scale: number, sink = 0) => {
    spots.push({ url, pos: [x, terrainHeight(x, z) - 0.08 - sink, z], rot, scale })
  }

  let i = 0
  let placed = 0
  while (placed < 330 && i < 4000) {
    const a = fbm(i * 0.37, i * 0.91, 31) * Math.PI * 4
    const r = ((fbm(i * 0.53, i * 0.13, 77) + 1) / 2) * 72 + 5
    const v = (fbm(i * 1.7, i * 0.3, 5) + 1) / 2
    const w = (fbm(i * 0.9, i * 2.3, 913) + 1) / 2
    i++
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 0.5) continue
    if (Math.hypot(x, z + 11) < 10) continue // shooting arena stays clear
    if (Math.hypot(x, z) < 4) continue // spawn point

    if (h < WATER_LEVEL + 2.2) {
      // beach band: sparse palms + the odd flat rock
      if (v < 0.55) put(pick(PALMS, w), x, z, a * 3, 2.0 + v)
      else if (v > 0.9) put(K + 'stone_smallFlatA.glb', x, z, a, 2.2)
      else continue
    } else if (h > 6.8) {
      // high/rocky ground: sparse stones only (the peak is the spawn — keep it open)
      if (v < 0.4) put(pick(ROCKS, w), x, z, a * 2, 1.6 + v * 1.4)
      else continue
    } else if (fbm(x / 28, z / 28, 400) > 0.1) {
      // grove: trees with mushrooms and stumps in their shade
      if (v < 0.62) put(pick(TREES, w), x, z, a * 5, 2.3 + v * 0.9)
      else if (v < 0.78) put(pick(MUSHROOMS, w), x + 0.9, z - 0.4, a, 1.6 + w * 0.6)
      else if (v < 0.88) put(pick(STUMPS, w), x, z, a * 2, 2.0)
      else put(pick(BUSHES, w), x, z, a * 3, 1.9 + w * 0.6)
    } else {
      // open meadow: flowers in triplets, grass tufts, bushes, a lone tree
      if (v < 0.3) {
        const f = pick(FLOWERS, w)
        put(f, x, z, a, 1.9)
        put(f, x + 0.7, z + 0.3, a * 2, 1.7)
        put(pick(FLOWERS, w + 0.31), x - 0.4, z + 0.6, a * 3, 1.8)
        placed += 2
      } else if (v < 0.62) put(pick(GRASS, w), x, z, a * 2, 1.8 + w)
      else if (v < 0.85) put(pick(BUSHES, w), x, z, a * 4, 2.0 + w * 0.7)
      else put(pick(TREES, w), x, z, a * 5, 2.4 + w)
    }
    placed++
  }

  // Points of interest (fixed, deterministic; KayKit bases sit slightly below y=0)
  put(KAYKIT_TREE, -22, 10, 0.8, 1.1, -0.05) // showpiece tree
  put(K + 'stone_largeA.glb', -20, 8.4, 2.1, 2.4)
  put(K + 'stump_roundDetailed.glb', 16, 14, 1.2, 2.2) // woodcutter camp
  put(K + 'log_stack.glb', 17.4, 13.2, 2.6, 2.2)
  put(KAYKIT_LOGS, 15.1, 15.6, 0.4, 0.5, -0.05)
  put(KAYKIT_GOLD, -12, -20, 1.7, 0.6, -0.05) // treasure spot
  put(K + 'stone_largeA.glb', -13.2, -19.1, 0.3, 2.6)
  put(K + 'stone_tallA.glb', -10.8, -21.2, 2.9, 2.2)

  return spots
}

// One toonified template per model file; clones share the converted materials.
// Textured packs (KayKit) keep their texture map — the toon ramp only quantizes light.
function useToonTemplate(url: string) {
  const { scene } = useGLTF(url)
  return useMemo(() => {
    const template = scene.clone(true)
    template.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const src = o.material as THREE.MeshStandardMaterial
        o.material = new THREE.MeshToonMaterial({
          color: src.color,
          map: src.map ?? null,
          gradientMap: toonRamp(),
        })
        o.castShadow = true
      }
    })
    return template
  }, [scene])
}

function Cluster({ url, spots }: { url: string; spots: Spot[] }) {
  const template = useToonTemplate(url)
  const clones = useMemo(() => spots.map(() => template.clone(true)), [template, spots])
  return (
    <>
      {spots.map((s, k) => (
        <primitive key={k} object={clones[k]} position={s.pos} rotation-y={s.rot} scale={s.scale} />
      ))}
    </>
  )
}

export function Vegetation() {
  const spots = useMemo(buildSpots, [])
  const byUrl = useMemo(() => {
    const m = new Map<string, Spot[]>()
    for (const s of spots) {
      if (!m.has(s.url)) m.set(s.url, [])
      m.get(s.url)!.push(s)
    }
    return m
  }, [spots])
  return (
    <>
      {[...byUrl.entries()].map(([url, group]) => (
        <Cluster key={url} url={url} spots={group} />
      ))}
    </>
  )
}

const ALL = [
  ...TREES,
  ...PALMS,
  ...BUSHES,
  ...FLOWERS,
  ...MUSHROOMS,
  ...ROCKS,
  ...GRASS,
  ...STUMPS,
  KAYKIT_TREE,
  KAYKIT_LOGS,
  KAYKIT_GOLD,
]
for (const url of ALL) useGLTF.preload(url)
