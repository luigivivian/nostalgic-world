import { useMemo } from 'react'
import { terrainHeight, WATER_LEVEL } from './terrain'
import { fbm } from './noise'
import { InstancedScatter } from './assets/InstancedProps'
import { preloadProps, type Placement } from './assets/props'

// Green-island decor built from the low-poly packs in public/game/models (see
// .tmp/model-catalog.json). kenney_nature-kit is the 1:1-scale self-contained base;
// KayKit pieces (2-5x larger, external bin+texture) appear only at points of interest.
// Every placement is instanced per model file (assets/props.ts) — ~700 plants cost one
// draw call per sub-mesh, not one per plant.
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
const GRASS = [K + 'grass_leafsLarge.glb', K + 'grass_large.glb', K + 'grass.glb']
// lightest tufts for the meadow carpet (hundreds of instances)
const CARPET = [K + 'grass.glb', K + 'grass_leafs.glb']

// Poly / Sketchfab plants (public/game/models/poly, see CREDITS.md). Each file has its
// own native size and origin, so placements go through putPoly(): target height in
// world units, lifted so the lowest vertex sits on the ground.
const P = '/game/models/poly/'
const POLY = {
  bulb: { url: P + 'bulb-flower.glb', nativeH: 2.332, minY: -1.862, h: 1.0 },
  marigold: { url: P + 'desert-marigold.glb', nativeH: 6.2, minY: -0.016, h: 0.9 },
  fiddlehead: { url: P + 'fiddlehead.glb', nativeH: 2.004, minY: -1.052, h: 1.1 },
  flower: { url: P + 'flower.glb', nativeH: 3.62, minY: -1.085, h: 1.0 },
  gnome: { url: P + 'gnome.glb', nativeH: 5.691, minY: -0.22, h: 1.0 },
  mushrooms: { url: P + 'mushrooms.glb', nativeH: 0.131, minY: -0.067, h: 0.55 },
  orchid: { url: P + 'orchid.glb', nativeH: 4.138, minY: 0, h: 0.9 },
  plume: { url: P + 'pastel-plume-flowers.glb', nativeH: 2.702, minY: -1.115, h: 1.0 },
  sunflower: { url: P + 'sunflower.glb', nativeH: 1.935, minY: -1.303, h: 1.6 },
  suspicious: { url: P + 'suspicious-plant.glb', nativeH: 3.246, minY: 0, h: 2.2 },
  tulip: { url: P + 'tulip-3.glb', nativeH: 1.246, minY: -0.64, h: 0.7 },
} as const
type PolyKey = keyof typeof POLY
const STUMPS = [K + 'stump_roundDetailed.glb', K + 'log_stack.glb']

type Spot = Placement & { url: string }

/**
 * Keep-out circles. The three stations and the beach spawn need clean ground: a bush
 * in front of a target is an unfair miss, and the arrival shot has to read as a place
 * you can walk into. Kept in sync with stations.ts by hand (data-only import would
 * pull the whole gameplay module into the decor).
 */
const CLEAR: [number, number, number][] = [
  [0, 28, 7], // praia station
  [-26, 4, 8], // bosque station
  [24, -22, 8], // mirante station
  [0, 44, 7.5], // beach spawn — wide enough that no palm shades the arrival shot
  [0, 38, 3.5], // the walk from spawn to the first station
]

function inClearing(x: number, z: number) {
  for (const [cx, cz, r] of CLEAR) if (Math.hypot(x - cx, z - cz) < r) return true
  return false
}

const pick = <T,>(arr: T[], v: number) => arr[Math.floor(v * arr.length) % arr.length]

// Deterministic scatter: same seeded fbm as the terrain, banded by altitude with a
// forest mask so trees clump into groves instead of an even sprinkle.
function buildSpots(): Spot[] {
  const spots: Spot[] = []
  const put = (url: string, x: number, z: number, rot: number, scale: number, sink = 0) => {
    spots.push({ url, pos: [x, terrainHeight(x, z) - 0.08 - sink, z], rot, scale })
  }

  const putPoly = (key: PolyKey, x: number, z: number, rot: number, jitter = 1) => {
    const m = POLY[key]
    const scale = (m.h * jitter) / m.nativeH
    put(m.url, x, z, rot, scale, m.minY * scale + 0.04)
  }

  let i = 0
  let placed = 0
  while (placed < 900 && i < 12000) {
    const a = fbm(i * 0.37, i * 0.91, 31) * Math.PI * 4
    const r = ((fbm(i * 0.53, i * 0.13, 77) + 1) / 2) * 72 + 5
    const v = (fbm(i * 1.7, i * 0.3, 5) + 1) / 2
    const w = (fbm(i * 0.9, i * 2.3, 913) + 1) / 2
    i++
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 0.5) continue
    if (inClearing(x, z)) continue

    if (h < WATER_LEVEL + 2.2) {
      // beach band: palms and grass clumps, denser than the rest — this is the
      // foreground of the arrival shot, so it carries the framing
      // the "detailed" palms are 2.4 units tall at scale 1, the Kenney one 1.4 —
      // one scale for both would give a grove of either bushes or radio masts
      if (v < 0.5) {
        const palm = pick(PALMS, w)
        put(palm, x, z, a * 3, palm.includes('palm-detailed') ? 1.1 + v * 0.4 : 2.0 + v)
      }
      else if (v < 0.78) put(pick(GRASS, w), x, z, a * 2, 1.6 + w * 0.8)
      else if (v > 0.92) put(K + 'stone_smallFlatA.glb', x, z, a, 2.2)
      else continue
    } else if (h > 6.8) {
      // high/rocky ground: stones and wind-bent grass
      if (v < 0.34) put(pick(ROCKS, w), x, z, a * 2, 1.6 + v * 1.4)
      else if (v < 0.55) put(pick(GRASS, w), x, z, a * 3, 1.4 + w * 0.6)
      else continue
    } else if (fbm(x / 28, z / 28, 400) > 0.1) {
      // grove: trees with mushrooms and stumps in their shade
      if (v < 0.52) put(pick(TREES, w), x, z, a * 5, 2.3 + v * 0.9)
      else if (v < 0.66) put(pick(MUSHROOMS, w), x + 0.9, z - 0.4, a, 1.6 + w * 0.6)
      else if (v < 0.76) put(pick(STUMPS, w), x, z, a * 2, 2.0)
      else if (v < 0.9) put(pick(BUSHES, w), x, z, a * 3, 1.9 + w * 0.6)
      else {
        // grass skirt around the grove edge
        put(pick(GRASS, w), x, z, a, 1.7 + w * 0.7)
        put(pick(GRASS, w + 0.4), x + 0.8, z + 0.5, a * 2, 1.5 + w * 0.6)
        placed++
      }
    } else {
      // open meadow: tufts and flower triplets, the odd bush or lone tree
      if (v < 0.22) {
        const f = pick(FLOWERS, w)
        put(f, x, z, a, 1.9)
        put(f, x + 0.7, z + 0.3, a * 2, 1.7)
        put(pick(FLOWERS, w + 0.31), x - 0.4, z + 0.6, a * 3, 1.8)
        placed += 2
      } else if (v < 0.66) {
        // tufts in pairs: the meadow reads as grass, not as a golf green
        put(pick(GRASS, w), x, z, a * 2, 1.8 + w)
        put(pick(GRASS, w + 0.5), x + 0.6, z - 0.5, a * 3, 1.5 + w * 0.8)
        placed++
      } else if (v < 0.86) put(pick(BUSHES, w), x, z, a * 4, 2.0 + w * 0.7)
      else put(pick(TREES, w), x, z, a * 5, 2.4 + w)
    }
    placed++
  }

  // Station backdrops: the keep-out circles leave the firing lane clean, but a station
  // also needs a midground behind and beside it or the wall floats on bare hillside.
  // Arcs hug the clearing (r+1..r+5) on every side except the player's approach (south).
  const backdrop = (
    cx: number,
    cz: number,
    r: number,
    n: number,
    seed: number,
    pickModel: (v: number, w: number, k: number) => [string, number],
  ) => {
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      const ang = Math.PI * (0.15 + 0.7 * t) // 27°..153° = the far half, as seen from the south
      const v = (fbm(seed + k * 0.7, k * 1.3, 19) + 1) / 2
      const w = (fbm(k * 0.4, seed + k * 2.1, 23) + 1) / 2
      const rr = r + 1 + v * 4
      const x = cx + Math.cos(ang) * rr
      const z = cz - Math.sin(ang) * rr
      if (terrainHeight(x, z) < WATER_LEVEL + 0.6) continue
      const [url, scale] = pickModel(v, w, k)
      put(url, x, z, v * Math.PI * 2, scale)
    }
  }
  // praia: a palm screen with grass and flowers at its feet — the beach range backdrop
  backdrop(0, 28, 7, 20, 3, (v, w, k) =>
    k % 3 === 0
      ? [pick(PALMS, w), pick(PALMS, w).includes('palm-detailed') ? 1.2 + v * 0.3 : 2.2 + v * 0.6]
      : v < 0.5
        ? [pick(GRASS, w), 1.7 + w * 0.8]
        : [pick(FLOWERS, w), 1.8],
  )
  backdrop(0, 28, 9.5, 10, 11, (v, w) => (v < 0.6 ? [pick(BUSHES, w), 1.9 + w * 0.6] : [pick(GRASS, w), 1.6 + w]))
  // mirante: a pine and boulder ridge behind the lookout
  backdrop(24, -22, 8, 16, 5, (v, w, k) =>
    k % 2 === 0
      ? [pick(TREES, w), 2.2 + v * 0.8]
      : v < 0.5
        ? [pick(ROCKS, w), 1.8 + v * 1.2]
        : [pick(GRASS, w), 1.5 + w * 0.6],
  )
  backdrop(24, -22, 11, 8, 17, (v, w) => (v < 0.5 ? [pick(TREES, w), 2.6 + v] : [pick(BUSHES, w), 1.8 + w * 0.5]))

  // Meadow carpet: cheap tufts and flowers on the open ground between the stations, so
  // the walk from one range to the next never crosses bare hillside (grass is ~100
  // tris an instance — 160 of them cost less than two trees).
  let c = 0
  for (let k = 0; k < 6000 && c < 160; k++) {
    const a = fbm(k * 0.61, k * 0.17, 41) * Math.PI * 4
    const r = ((fbm(k * 0.29, k * 0.83, 43) + 1) / 2) * 60 + 8
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 2.2 || h > 6.8 || inClearing(x, z)) continue
    const v = (fbm(k * 1.1, k * 0.5, 47) + 1) / 2
    const w = (fbm(k * 0.7, k * 1.9, 53) + 1) / 2
    if (v < 0.8) put(pick(CARPET, w), x, z, a * 2, 1.6 + w * 0.9)
    else put(pick(FLOWERS, w), x, z, a, 1.7 + w * 0.4)
    c++
  }

  // Poly plants — authored accents on top of the kit scatter.
  // spawn: flower beds either side of the pier walk, an orchid and a gnome by the campfire
  for (const [bx, bz] of [[-5.2, 41.5], [5.4, 42.2], [-4.6, 46.4], [5.8, 46.8]] as const)
    for (let k = 0; k < 3; k++) putPoly('tulip', bx + (k - 1) * 0.55, bz + (k % 2) * 0.4, k * 1.3, 0.9 + k * 0.1)
  putPoly('orchid', 2.9, 45.6, 0.6)
  putPoly('gnome', -2.3, 45.9, 2.4)
  putPoly('marigold', -6.4, 44.2, 0.2, 1.1)
  putPoly('marigold', 6.9, 44.8, 1.9)
  // bosque camp: sunflower row behind the rails, an orchid by the tent, a gnome guarding it
  backdrop(-26, 4, 7.5, 7, 29, () => [POLY.sunflower.url, POLY.sunflower.h / POLY.sunflower.nativeH])
  putPoly('orchid', -22.6, 0.4, 1.1)
  putPoly('gnome', -21.4, 1.2, -0.8)
  // mirante ridge: odd silhouettes against the sky
  for (const [sx, sz, r] of [[18.5, -28.2, 0.3], [31, -23.8, 1.2], [20, -30.5, 2.2]] as const) putPoly('suspicious', sx, sz, r, 0.85 + r * 0.1)
  // treasure spot: a third gnome
  putPoly('gnome', -10.6, -18.6, 0.9, 0.9)
  // meadow: mixed flower accents between the stations; grove shade: ferns and mushrooms
  const MEADOW_MIX: PolyKey[] = ['flower', 'plume', 'bulb', 'marigold', 'flower', 'plume', 'sunflower']
  let pm = 0
  let pg = 0
  for (let k = 0; k < 8000 && (pm < 44 || pg < 16); k++) {
    const a = fbm(k * 0.41, k * 0.23, 61) * Math.PI * 4
    const r = ((fbm(k * 0.37, k * 0.71, 67) + 1) / 2) * 60 + 8
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 2.2 || h > 6.8 || inClearing(x, z)) continue
    const v = (fbm(k * 1.3, k * 0.9, 71) + 1) / 2
    const w = (fbm(k * 0.6, k * 1.7, 73) + 1) / 2
    if (fbm(x / 28, z / 28, 400) > 0.1) {
      if (pg >= 16) continue
      putPoly(v < 0.5 ? 'fiddlehead' : 'mushrooms', x + 0.6, z - 0.3, a, 0.85 + w * 0.4)
      pg++
    } else {
      if (pm >= 44) continue
      putPoly(pick(MEADOW_MIX, v), x, z, a * 2, 0.85 + w * 0.35)
      pm++
    }
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

export function Vegetation() {
  const spots = useMemo(buildSpots, [])
  return <InstancedScatter spots={spots} />
}

const ALL = [
  ...Object.values(POLY).map((m) => m.url),
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
preloadProps(ALL)
