import { terrainHeight, WATER_LEVEL } from './terrain'
import { fbm } from './noise'
import { preloadProps, type Placement } from './assets/props'
import { TRAIL_CLEAR } from './assets/Trails'
import { LOW_END } from './quality'

// Green-island decor built from the low-poly packs in public/game/models (see
// .tmp/model-catalog.json). kenney_nature-kit is the 1:1-scale self-contained base;
// KayKit pieces (2-5x larger, external bin+texture) appear only at points of interest.
// Every placement is instanced per model file (assets/props.ts) — ~700 plants cost one
// draw call per sub-mesh, not one per plant.
const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const KAYKIT = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/'
const RB = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/'
// Ekfs "Free Shrubs Flowers and Mushrooms" pack (one atlas), FBX → GLB via
// .tmp/shrubs-to-glb.py (Blender headless); native sizes ~1 u, so they carry a UNIT factor
const SH = '/game/models/shrubs/'
const KAYKIT_TREE = KAYKIT + 'Tree_2_A_Color1.gltf'
const KAYKIT_LOGS = RB + 'Wood_Log_Stack.gltf'
const KAYKIT_PLANKS = RB + 'Wood_Planks_Stack_Medium.gltf'
const KAYKIT_LOG_A = RB + 'Wood_Log_A.gltf'
const KAYKIT_GOLD = RB + 'Gold_Nuggets.gltf'
const KAYKIT_GOLD_BARS = RB + 'Gold_Bars_Stack_Large.gltf'
const KAYKIT_COPPER = RB + 'Copper_Bars.gltf'

// Variety tiers: every extra model file is one more draw call (+ a shadow draw), so the
// base pools are what the LOW_END tier draws and RICH layers the textured KayKit / Ekfs
// variants on top for desktop.
const RICH = !LOW_END
const rich = <T,>(base: T[], extra: T[]) => (RICH ? base.concat(extra) : base)

// Per-file size normaliser: the pools share one scale expression per placement role, and
// the kit models are ~0.3-0.5 u while the Ekfs/KayKit ones are ~1 u. put() multiplies.
const UNIT = new Map<string, number>()
const unit = (url: string, k: number) => (UNIT.set(url, k), url)

const TREES = rich(
  [
    K + 'tree_default.glb',
    K + 'tree_oak.glb',
    K + 'tree_fat.glb',
    K + 'tree_pineRoundA.glb',
    K + 'tree_pineTallA.glb',
    K + 'tree_small.glb',
    K + 'tree_cone.glb',
    K + 'tree_thin.glb',
    K + 'tree_pineRoundB.glb',
    K + 'tree_pineTallB.glb',
  ],
  [K + 'tree_detailed.glb', K + 'tree_plateau.glb'],
)
// textured KayKit trees (4-7 u native): whole groves switch to them on RICH
const KAYKIT_TREES = [
  KAYKIT + 'Tree_1_A_Color1.gltf',
  KAYKIT + 'Tree_1_B_Color1.gltf',
  KAYKIT_TREE,
  KAYKIT + 'Tree_2_B_Color1.gltf',
  KAYKIT + 'Tree_3_A_Color1.gltf',
  KAYKIT + 'Tree_4_A_Color1.gltf',
  KAYKIT + 'Tree_4_B_Color1.gltf',
]
// highland conifers (0.9-1.25 u native) for the plateau above the meadow band
const PINES = [
  K + 'tree_pineGroundA.glb', K + 'tree_pineGroundB.glb', K + 'tree_pineSmallA.glb',
  K + 'tree_pineSmallB.glb', K + 'tree_pineRoundD.glb', K + 'tree_pineDefaultA.glb',
]
// dead trees for the high rocky band
const BARE_TREES = [KAYKIT + 'Tree_Bare_1_A_Color1.gltf', KAYKIT + 'Tree_Bare_2_A_Color1.gltf']
// autumn variants on the "fall" groves
const FALL_TREES = [K + 'tree_oak_fall.glb', K + 'tree_cone_fall.glb']
const PALMS = [K + 'tree_palmBend.glb', K + 'tree_palmDetailedTall.glb', K + 'tree_palm.glb', K + 'tree_palmDetailedShort.glb']
const BUSHES = rich(
  [K + 'plant_bushDetailed.glb', K + 'plant_bushLarge.glb', K + 'plant_bush.glb'],
  [
    unit(KAYKIT + 'Bush_2_B_Color1.gltf', 0.55),
    unit(KAYKIT + 'Bush_4_B_Color1.gltf', 0.55),
    unit(KAYKIT + 'Bush_3_B_Color1.gltf', 0.5),
    unit(SH + 'bush_1.glb', 0.4),
    unit(SH + 'bush_3.glb', 0.4),
    unit(SH + 'bush_5.glb', 0.42),
  ],
)
const FERNS = [K + 'plant_flatShort.glb', K + 'plant_flatTall.glb']
const FLOWERS = rich(
  [
    K + 'flower_purpleB.glb', K + 'flower_redA.glb', K + 'flower_yellowB.glb',
    K + 'flower_purpleA.glb', K + 'flower_redC.glb', K + 'flower_yellowC.glb',
  ],
  [unit(SH + 'flower_1.glb', 0.5), unit(SH + 'flower_2.glb', 0.5), unit(SH + 'flower_4.glb', 0.5)],
)
const MUSHROOMS = rich(
  [
    K + 'mushroom_redGroup.glb', K + 'mushroom_red.glb', K + 'mushroom_tanTall.glb',
    K + 'mushroom_tan.glb', K + 'mushroom_redTall.glb',
  ],
  [K + 'mushroom_tanGroup.glb', unit(SH + 'mushroom_1.glb', 0.4), unit(SH + 'mushroom_2.glb', 0.38)],
)
// stone_* variants are neutral grey; rock_* are dirt-salmon + teal grass caps, which
// read pink at a distance — stones sit better on the high ground.
const ROCKS = rich(
  [
    K + 'stone_largeA.glb', K + 'stone_tallA.glb', K + 'stone_smallFlatA.glb',
    K + 'stone_largeB.glb', K + 'stone_tallB.glb', K + 'stone_smallFlatB.glb',
    K + 'stone_smallTopA.glb',
  ],
  [K + 'stone_largeC.glb', K + 'stone_tallC.glb', unit(SH + 'stones_1.glb', 0.6)],
)
// KayKit boulders (0.5-4.3 u native) for the high ground and the tideline; the
// formation_* gltfs are the self-contained Draco rocks at the models root (tinted
// island-rock grey via props.ts TINTS).
const KAYKIT_ROCKS = rich(
  [
    KAYKIT + 'Rock_1_C_Color1.gltf',
    KAYKIT + 'Rock_1_F_Color1.gltf',
    KAYKIT + 'Rock_2_C_Color1.gltf',
    KAYKIT + 'Rock_2_D_Color1.gltf',
    KAYKIT + 'Rock_2_E_Color1.gltf',
    KAYKIT + 'Rock_3_A_Color1.gltf',
  ],
  [KAYKIT + 'Rock_1_A_Color1.gltf', KAYKIT + 'Rock_3_D_Color1.gltf'],
)
const FORMATIONS = ['/game/models/formation-rock.gltf', '/game/models/formation-large-rock.gltf', '/game/models/formation-stone.gltf']
const GRASS = rich(
  [K + 'grass_leafsLarge.glb', K + 'grass_large.glb', K + 'grass.glb'],
  [unit(SH + 'grass_1.glb', 0.3), unit(SH + 'grass_2.glb', 0.28)],
)
// lightest tufts for the meadow carpet (hundreds of instances)
const CARPET = rich([K + 'grass.glb', K + 'grass_leafs.glb'], [unit(KAYKIT + 'Grass_1_B_Color1.gltf', 0.5)])
// lily pads on the shallows along the shore
const LILIES = [K + 'lily_large.glb', K + 'lily_small.glb']

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
  blueTulips: { url: P + 'blue-tulips.glb', nativeH: 0.755, minY: -0.49, h: 0.75 },
  twistTree: { url: P + 'twisting-tree.glb', nativeH: 7.457, minY: -4.55, h: 9.0 },
} as const
type PolyKey = keyof typeof POLY
// lowest-vertex lift per poly file, applied by put() for any placement path (the station
// backdrops pick poly urls too — without this the sunflowers were buried to the head)
const LIFT = new Map<string, number>(Object.values(POLY).map((m) => [m.url, m.minY]))
const STUMPS = rich([K + 'stump_roundDetailed.glb', K + 'log_stack.glb'], [K + 'stump_old.glb', K + 'stump_oldTall.glb'])

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
  [0, 44, 9], // beach spawn — SpawnBeach authors this ground; the scatter stays out
  [0, 38, 3.5], // the walk from spawn to the first station
  [-36, -8, 6.5], // homestead plot (Trails.tsx)
  [-26, -26, 7], // quarry (Trails.tsx)
  ...TRAIL_CLEAR, // no tree grows on the trail network (Trails.tsx owns the corridor)
]

function inClearing(x: number, z: number) {
  for (const [cx, cz, r] of CLEAR) if (Math.hypot(x - cx, z - cz) < r) return true
  return false
}

const pick = <T,>(arr: T[], v: number) => arr[Math.floor(v * arr.length) % arr.length]

// Deterministic scatter: same seeded fbm as the terrain, banded by altitude. The
// mid-band is built as DELIBERATE GROVES, not noise: rejection-sampled cluster centres
// (min ~16 u apart), each cluster a tight knot of 3-5 trees with an understory ring and
// a grass skirt; the open meadow between groves stays open (flower patches + tufts,
// the rare lone tree). That structure — not the per-spot randomness — is what makes the
// island read as designed.
export function vegetationSpots(): Spot[] {
  const spots: Spot[] = []
  const put = (url: string, x: number, z: number, rot: number, scale: number, sink = 0) => {
    const s = scale * (UNIT.get(url) ?? 1)
    spots.push({ url, pos: [x, terrainHeight(x, z) - 0.08 - sink - (LIFT.get(url) ?? 0) * s, z], rot, scale: s })
  }

  const putPoly = (key: PolyKey, x: number, z: number, rot: number, jitter = 1) => {
    const m = POLY[key]
    put(m.url, x, z, rot, (m.h * jitter) / m.nativeH, 0.04)
  }

  // --- grove centres: seeded rejection sampling over the mid band ---
  const clusters: [number, number, number, number][] = [] // x, z, size, seed
  for (let k = 0; k < 8000 && clusters.length < 58; k++) {
    const a = fbm(k * 0.53, k * 0.31, 201) * Math.PI * 4
    const r = ((fbm(k * 0.37, k * 0.71, 203) + 1) / 2) * 58 + 8
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 2.4 || h > 6.6 || inClearing(x, z)) continue
    if (clusters.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 13)) continue
    const size = 2.4 + ((fbm(k * 0.9, k * 1.1, 211) + 1) / 2) * 2.8
    clusters.push([x, z, size, (fbm(k * 1.3, k * 0.7, 213) + 1) / 2])
  }

  // --- each grove: tree knot + understory ring + grass skirt, one in three autumn ---
  for (const [cx, cz, size, seed] of clusters) {
    const isFall = Math.floor(seed * 97) % 3 === 0
    // on RICH, one grove in three (of the non-autumn ones) is a textured KayKit copse
    const isKayKit = RICH && !isFall && Math.floor(seed * 53) % 3 === 1
    const trees = 3 + Math.floor(seed * 3)
    for (let t = 0; t < trees; t++) {
      const ang = seed * 9 + (t * Math.PI * 2) / trees + fbm(cx + t, cz - t, 223) * 0.7
      const rr = 0.5 + fbm(cx * 0.5 + t, cz * 0.5 - t, 227) * (size * 0.7)
      const x = cx + Math.cos(ang) * rr
      const z = cz + Math.sin(ang) * rr
      if (inClearing(x, z)) continue // a tree never grows on the trail network
      if (isKayKit) put(pick(KAYKIT_TREES, seed + t * 0.31), x, z, ang * 3, 0.8 + ((seed * 7 + t) % 10) * 0.03, -0.05)
      else put(isFall ? pick(FALL_TREES, seed + t) : pick(TREES, seed + t), x, z, ang * 3, 2.3 + ((seed * 7 + t) % 10) * 0.08)
    }
    const under = 3 + Math.floor(seed * 4)
    for (let t = 0; t < under; t++) {
      const ang = seed * 4 + (t * Math.PI * 2) / under + fbm(cx + t * 2, cz - t, 229) * 0.5
      const rr = size * 0.9 + 0.6 + fbm(cx + t, cz + t, 231) * 1.4
      const x = cx + Math.cos(ang) * rr
      const z = cz + Math.sin(ang) * rr
      const w = (fbm(x * 1.7, z * 0.9, 233) + 1) / 2
      if (w < 0.32) put(pick(BUSHES, w), x, z, ang * 3, 1.9 + w * 0.6)
      else if (w < 0.52) put(pick(FERNS, w), x, z, ang * 2, 1.4 + w * 0.5)
      else if (w < 0.74) put(pick(MUSHROOMS, w), x, z, ang, 1.6 + w * 0.6)
      else put(pick(STUMPS, w), x, z, ang * 2, 2.0)
    }
    for (let t = 0; t < 6; t++) {
      const ang = seed * 5 + (t * Math.PI * 2) / 6
      const rr = size + 2.6 + fbm(cx + t, cz - t, 239) * 2.2
      put(pick(GRASS, seed + t), cx + Math.cos(ang) * rr, cz + Math.sin(ang) * rr, ang * 2, 1.5 + seed * 0.8)
    }
  }

  let i = 0
  let placed = 0
  while (placed < 1300 && i < 22000) {
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
      if (v < 0.5) put(pick(PALMS, w), x, z, a * 3, 2.0 + v)
      else if (v < 0.78) put(pick(GRASS, w), x, z, a * 2, 1.6 + w * 0.8)
      else if (v > 0.96) put(pick(FORMATIONS, w), x, z, a, 1.7 + w * 0.9, 0.1)
      else if (v > 0.92) put(K + 'stone_smallFlatA.glb', x, z, a, 2.2)
      else continue
    } else if (h > 6.8) {
      // highland: stones, wind-bent grass, the odd KayKit boulder, conifers in loose
      // stands, heather-like bushes; dead trees near the top on RICH
      if (v < 0.18) put(pick(ROCKS, w), x, z, a * 2, 1.6 + v * 1.4)
      else if (v < 0.27) put(pick(KAYKIT_ROCKS, w), x, z, a * 3, 0.5 + v * 0.6)
      else if (v < 0.45) put(pick(GRASS, w), x, z, a * 3, 1.4 + w * 0.6)
      else if (v < 0.58) {
        put(pick(PINES, w), x, z, a * 3, 2.6 + w * 0.9)
        if (w > 0.65) put(pick(PINES, w + 0.37), x + 1.3, z - 0.8, a * 2, 2.2 + v * 0.8)
      } else if (v < 0.68) put(pick(BUSHES, w), x, z, a * 4, 1.7 + w * 0.6)
      else if (RICH && v > 0.94) put(pick(BARE_TREES, w), x, z, a * 2, 1.1 + w * 0.4, -0.05)
      else continue
    } else if (clusters.some(([cx, cz, size]) => Math.hypot(x - cx, z - cz) < size + 8)) {
      continue // groves own their ground — the mid-band filler keeps out of them
    } else {
      // open meadow: flower patches and paired tufts, a bush here and there, the rare
      // lone tree as a landmark — the openness between groves is the point
      if (v < 0.26) {
        const f = pick(FLOWERS, w)
        put(f, x, z, a, 1.9)
        put(f, x + 0.7, z + 0.3, a * 2, 1.7)
        put(pick(FLOWERS, w + 0.31), x - 0.4, z + 0.6, a * 3, 1.8)
        placed += 2
      } else if (v < 0.72) {
        // tufts in pairs: the meadow reads as grass, not as a golf green
        put(pick(GRASS, w), x, z, a * 2, 1.8 + w)
        put(pick(GRASS, w + 0.5), x + 0.6, z - 0.5, a * 3, 1.5 + w * 0.8)
        placed++
      } else if (v < 0.84) put(pick(BUSHES, w), x, z, a * 4, 2.0 + w * 0.7)
      else if (v > 0.98) put(pick(FERNS, w), x, z, a * 2, 1.4 + w * 0.5)
      else if (v > 0.94) put(pick(TREES, w), x, z, a * 5, 2.4 + w)
      else continue
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
      ? [pick(PALMS, w), 2.2 + v * 0.6]
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
  for (let k = 0; k < 9000 && c < 320; k++) {
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

  // Poly plants — authored accents on top of the kit scatter (the spawn beach keeps
  // none: SpawnBeach.tsx owns that ground and it stays clean).
  // blue tulip bed by the bosque orchid
  for (const [bx, bz] of [[-19.6, -3.2]] as const)
    for (let k = 0; k < 3; k++) putPoly('blueTulips', bx + (k - 1) * 0.5, bz + (k % 2) * 0.35, k * 1.1, 0.9 + k * 0.08)
  // twisting showpiece trees: shade the bosque camp, crest the ridge
  putPoly('twistTree', -30.5, 13.2, 1.2)
  putPoly('twistTree', 31.5, -27.5, 0.4)
  putPoly('twistTree', -15.8, -21.6, 2.0)
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
  for (let k = 0; k < 12000 && (pm < 70 || pg < 24); k++) {
    const a = fbm(k * 0.41, k * 0.23, 61) * Math.PI * 4
    const r = ((fbm(k * 0.37, k * 0.71, 67) + 1) / 2) * 60 + 8
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 2.2 || h > 6.8 || inClearing(x, z)) continue
    const v = (fbm(k * 1.3, k * 0.9, 71) + 1) / 2
    const w = (fbm(k * 0.6, k * 1.7, 73) + 1) / 2
    if (fbm(x / 28, z / 28, 400) > 0.1) {
      if (pg >= 24) continue
      putPoly(v < 0.5 ? 'fiddlehead' : 'mushrooms', x + 0.6, z - 0.3, a, 0.85 + w * 0.4)
      pg++
    } else {
      if (pm >= 70) continue
      putPoly(pick(MEADOW_MIX, v), x, z, a * 2, 0.85 + w * 0.35)
      pm++
    }
  }

  // Lily pads on the shallows: where the sand runs out under the water, in clustered
  // patches (fbm gate) so they read as ponds of pads, not confetti on the sea.
  let lp = 0
  for (let k = 0; k < 8000 && lp < 70; k++) {
    const a = fbm(k * 0.27, k * 0.63, 501) * Math.PI * 4
    const r = ((fbm(k * 0.51, k * 0.23, 503) + 1) / 2) * 40 + 55
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL - 0.55 || h > WATER_LEVEL - 0.1 || inClearing(x, z)) continue
    if (fbm(x / 9, z / 9, 505) < 0.1) continue
    const w = (fbm(k * 0.9, k * 1.7, 507) + 1) / 2
    spots.push({ url: pick(LILIES, w), pos: [x, WATER_LEVEL + 0.08, z], rot: a * 3, scale: 3.6 + w * 1.8 })
    lp++
  }

  // Shoreline boulders: heavy rocks right at the tideline so the island rim isn't a
  // clean sand line — half-sunk KayKit rocks and formation rocks where waves break.
  let sb = 0
  for (let k = 0; k < 6000 && sb < 26; k++) {
    const a = fbm(k * 0.33, k * 0.71, 89) * Math.PI * 4
    const r = ((fbm(k * 0.47, k * 0.19, 97) + 1) / 2) * 78 + 6
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL - 0.25 || h > WATER_LEVEL + 1.1 || inClearing(x, z)) continue
    const v = (fbm(k * 1.1, k * 0.4, 103) + 1) / 2
    const w = (fbm(k * 0.9, k * 1.7, 101) + 1) / 2
    put(v < 0.45 ? pick(FORMATIONS, w) : pick(KAYKIT_ROCKS, w), x, z, a, v < 0.45 ? 1.6 + w * 0.9 : 0.7 + w * 0.5, 0.12)
    sb++
  }

  // Points of interest (fixed, deterministic; KayKit bases sit slightly below y=0)
  put(KAYKIT_TREE, -22, 10, 0.8, 1.1, -0.05) // showpiece tree
  put(K + 'stone_largeA.glb', -20, 8.4, 2.1, 2.4)
  put(K + 'stump_roundDetailed.glb', 16, 14, 1.2, 2.2) // woodcutter camp
  put(K + 'log_stack.glb', 17.4, 13.2, 2.6, 2.2)
  put(KAYKIT_LOGS, 15.1, 15.6, 0.4, 0.5, -0.05)
  if (RICH) {
    put(KAYKIT_PLANKS, 14.0, 12.8, 1.1, 0.7, -0.05)
    put(KAYKIT_LOG_A, 17.9, 15.5, 2.0, 0.8, 0.2)
    put(KAYKIT_LOG_A, 15.4, 17.0, 0.6, 0.75, 0.2)
  }
  put(KAYKIT_GOLD, -12, -20, 1.7, 0.6, -0.05) // treasure spot
  put(KAYKIT_GOLD_BARS, -12.9, -19.4, 2.3, 0.55, -0.05)
  put(KAYKIT_COPPER, -11.2, -20.9, 0.8, 0.5, -0.05)
  put(K + 'stone_largeA.glb', -13.2, -19.1, 0.3, 2.6)
  put(K + 'stone_tallA.glb', -10.8, -21.2, 2.9, 2.2)

  return spots
}


const ALL = [
  ...Object.values(POLY).map((m) => m.url),
  ...TREES,
  ...FALL_TREES,
  ...PINES,
  ...PALMS,
  ...BUSHES,
  ...FERNS,
  ...FLOWERS,
  ...MUSHROOMS,
  ...ROCKS,
  ...KAYKIT_ROCKS,
  ...FORMATIONS,
  ...GRASS,
  ...STUMPS,
  ...LILIES,
  ...(RICH ? [...KAYKIT_TREES, ...BARE_TREES, KAYKIT_PLANKS, KAYKIT_LOG_A] : [KAYKIT_TREE]),
  KAYKIT_LOGS,
  KAYKIT_GOLD,
  KAYKIT_GOLD_BARS,
  KAYKIT_COPPER,
]
preloadProps(ALL)
