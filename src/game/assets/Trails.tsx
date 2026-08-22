import { terrainHeight, WATER_LEVEL } from '../terrain'
import { fbm } from '../noise'
import type { Placement } from './props'
import { swapProp } from './biomeSwaps'
import { LOW_END } from '../quality'

// Authored terrain structures on top of the scatter: the island trail network and the
// cliff build-outs at the mirante crag and the snowy peak. Path slabs are flat 1-u pieces
// (long axis = local +X) sunk slightly into the terrain and pitched to follow the slope;
// cliffs are the kit's 1-u stone blocks scaled up. Spots feed the island-wide
// InstancedScatter (Island.tsx WorldProps), one draw call per model file.

const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const PATH_STONE = K + 'path_stone.glb'
const PATH_WOOD = K + 'path_wood.glb'
const CLIFF_SLOPE = K + 'cliff_blockSlope_stone.glb'
const CLIFF_LARGE = K + 'cliff_large_stone.glb'
const CLIFF_CAVE = K + 'cliff_blockCave_stone.glb'
const STATUE_HEAD = K + 'statue_head.glb'
const STATUE_BLOCK = K + 'statue_block.glb'
const GROUND_ROCKS = K + 'ground_pathRocks.glb'
const BRIDGE = K + 'bridge_woodRound.glb'
const FALL_OAK = K + 'tree_oak_fall.glb'
const FALL_CONE = K + 'tree_cone_fall.glb'
const MUSH_TAN = K + 'mushroom_tan.glb'
const CAMPFIRE_BRICKS = K + 'campfire_bricks.glb'
const TENT_SMALL = K + 'tent_smallClosed.glb'
const SIGN = K + 'sign.glb'
const FLOWER_PICK = [K + 'flower_purpleA.glb', K + 'flower_redC.glb', K + 'flower_yellowB.glb']
const POT_SMALL = K + 'pot_small.glb'
const POT_LARGE = K + 'pot_large.glb'
// homestead plot (desktop only: ~9 model files)
const DIRT_ROW = K + 'crops_dirtRow.glb'
const CORN = K + 'crops_cornStageC.glb'
const WHEAT = K + 'crops_wheatStageB.glb'
const PUMPKIN = K + 'crop_pumpkin.glb'
const MELON = K + 'crop_melon.glb'
const FENCE = K + 'fence_simple.glb'
const FENCE_CORNER = K + 'fence_corner.glb'
const FENCE_GATE = K + 'fence_gate.glb'
// quarry (KayKit ResourceBits)
const RB = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/'
const STONE_CHUNKS = RB + 'Stone_Chunks_Large.gltf'
const STONE_BRICKS = RB + 'Stone_Bricks_Stack_Large.gltf'
const IRON = RB + 'Iron_Nuggets.gltf'
const SILVER = RB + 'Silver_Nuggets.gltf'
const PALLET_COVERED = RB + 'Pallet_Wood_Covered_B.gltf'
const KK_ROCK = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Rock_3_D_Color1.gltf'
const RICH = !LOW_END

type Spot = Placement & { url: string }
type Pt = [number, number]

const MIRANTE: Pt = [24, -22]

// The loop: spawn planks → praia → bosque → mirante → east shore → spawn beach.
// Waypoints hug the station clearings (front/south sides only) so the trail never runs
// under a firing lane's dressing; legs end ~3-7 u from the station centres.
const TRAIL_LEGS: { url: string; pts: Pt[] }[] = [
  // A: the spawn stepping planks lead into the praia plaza (wood, matches the beach)
  { url: PATH_WOOD, pts: [[0.4, 34.4], [0, 30.8]] },
  // B: praia → bosque, climbing the west flank
  {
    url: PATH_STONE,
    pts: [[0, 29.6], [-4, 24], [-9, 18.5], [-14, 12.5], [-18, 8.5], [-21, 5.8], [-22.5, 5.4]],
  },
  // C: bosque → mirante, the long climb over the centre of the island
  {
    url: PATH_STONE,
    pts: [[-20.8, 0.6], [-14, -2.5], [-6, -6.5], [3, -10.5], [12, -14.5], [19, -17.8], [23.5, -19.6], [26.6, -20.9]],
  },
  // D: mirante → east shore → spawn, closing the loop past the snowy peak
  {
    url: PATH_STONE,
    pts: [
      [30.6, -24.8], [31.5, -16.5], [31.5, -8], [29.5, 0.5], [25, 9], [18.5, 16.5],
      [11.5, 22.5], [9, 27], [10, 31], [10.5, 35], [9.5, 38.5], [7, 41.5],
    ],
  },
]

const SPACING = 0.92

function distToSegment(px: number, pz: number, x0: number, z0: number, x1: number, z1: number) {
  const dx = x1 - x0
  const dz = z1 - z0
  const len2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / len2))
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t))
}

/**
 * Walk a polyline at `spacing` and emit pitched path slabs. Pitch is the fore-aft slope
 * sampled ±`spacing` along the trail, so slabs lie flat on the terrain instead of
 * half-floating on grades.
 */
function sampleLeg(pts: Pt[], url: string, out: Spot[], spacing = SPACING) {
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s]
    const [x1, z1] = pts[s + 1]
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    const ux = dx / len
    const uz = dz / len
    const n = Math.max(1, Math.round(len / spacing))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = x0 + dx * t
      const z = z0 + dz * t
      const h = terrainHeight(x, z)
      if (h < WATER_LEVEL + 0.5) continue
      const ahead = terrainHeight(x + ux * spacing, z + uz * spacing)
      const behind = terrainHeight(x - ux * spacing, z - uz * spacing)
      out.push({
        url,
        pos: [x, h - 0.14, z],
        rot: Math.atan2(-dz, dx), // slab long axis (local +X) follows the trail
        pitch: Math.atan2(ahead - behind, 2 * spacing),
        scale: 1.1,
      })
    }
  }
}

export function trailSpots(): Spot[] {
  const spots: Spot[] = []
  for (const leg of TRAIL_LEGS) sampleLeg(leg.pts, leg.url, spots)

  // boardwalk over the steepest gully on leg D (~26.8, 5.6, slope −0.7): railed bridge
  // decks replace the slabs there, so the trail visibly crosses the ravine
  const boardwalk: Pt[] = [[27.3, 4.7], [26.7, 5.85], [26.05, 6.95]]
  sampleLeg(boardwalk, BRIDGE, spots, 0.85)
  // drop the trail slabs the boardwalk replaced
  for (let i = spots.length - 1; i >= 0; i--) {
    const s = spots[i]
    if (s.url !== PATH_STONE) continue
    const onBridge = (() => {
      for (let k = 0; k < boardwalk.length - 1; k++) {
        const [x0, z0] = boardwalk[k]
        const [x1, z1] = boardwalk[k + 1]
        const d = distToSegment(s.pos[0], s.pos[2], x0, z0, x1, z1)
        if (d < 1.2) return true
      }
      return false
    })()
    if (onBridge) spots.splice(i, 1)
  }

  // mirante crag: a low ring of cliff blocks on the far (north) half behind the lookout,
  // inside the dressing (r~5) and outside the vegetation backdrop (r 8+)
  for (let k = 0; k < 12; k++) {
    const t = k / 11
    const ang = Math.PI * (0.18 + 0.64 * t) // 32°..147°, the far half as seen from the south
    const v = (fbm(31 + k * 0.7, k * 1.3, 19) + 1) / 2
    const w = (fbm(k * 0.4, 31 + k * 2.1, 23) + 1) / 2
    const r = 5.6 + v * 1.8
    const x = MIRANTE[0] + Math.cos(ang) * r
    const z = MIRANTE[1] - Math.sin(ang) * r
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 0.6) continue
    const url = k % 3 === 0 ? CLIFF_CAVE : k % 3 === 1 ? CLIFF_SLOPE : CLIFF_LARGE
    spots.push({ url, pos: [x, h - 0.24, z], rot: w * Math.PI * 2, scale: 1.2 + v * 0.6 })
  }

  // snowy peak: stone crags poking through the snow band on the SE face of the island
  // high point (~44, 0) — the mountain stops being a smooth white dome
  const peakCrags: [number, number, number, number][] = [
    [39.5, -1.5, 0.4, 1.7],
    [41.5, -4.5, 2.1, 1.4],
    [38, -5.5, 1.2, 1.6],
    [43, -1, 2.8, 1.3],
    [37.5, -3.5, 0.9, 1.5],
    [40.8, -6.8, 0.1, 1.2],
  ]
  peakCrags.forEach(([x, z, rot, scale], i) => {
    const h = terrainHeight(x, z)
    spots.push({ url: i % 2 === 0 ? CLIFF_LARGE : CLIFF_SLOPE, pos: [x, h - 0.3, z], rot, scale })
  })

  // treasure shrine: a tipped stone head half-buried behind the gold pile, a plinth
  // beside it — the ruin the cache was buried in front of
  const hHead = terrainHeight(-12.4, -22.6)
  spots.push({ url: STATUE_HEAD, pos: [-12.4, hHead - 0.3, -22.6], rot: 2.1, pitch: 1.35, scale: 1.5 })
  const hBlock = terrainHeight(-13.8, -21.8)
  spots.push({ url: STATUE_BLOCK, pos: [-13.8, hBlock - 0.12, -21.8], rot: 0.5, scale: 2.1 })

  // flat rocky ground patches on the high band — the mountain stops reading as a smooth
  // green dome between the boulders (authored spots, clear of stations/trail/crags)
  const rockPatches: [number, number, number, number][] = [
    [29, -30.7, 0.5, 2.2],
    [32.7, -27, 1.8, 1.9],
    [34, -22, 0.2, 2.3],
    [29, -14, 2.4, 2.0],
    [35, -9, 1.2, 1.7],
    [36, -3, 2.8, 1.8],
    [23, 12, 0.7, 1.6],
    [17, -6, 1.5, 1.7],
    [12, 2, 0.9, 1.6],
    [-8, -12, 2.6, 1.8],
    [-16, 12, 1.1, 1.7],
  ]
  for (const [x, z, rot, scale] of rockPatches) {
    const h = terrainHeight(x, z)
    if (h < WATER_LEVEL + 5) continue
    spots.push({ url: GROUND_ROCKS, pos: [x, h - 0.02, z], rot, scale })
  }

  // High-visibility accents: the variety pools scatter thin, so these clumps are what
  // the player actually notices walking the trail.
  // authored accents go through biomeSwaps (no corn field in the snow)
  const accent = (url: string, x: number, z: number, rot: number, scale: number, sink = 0) => {
    const swap = swapProp(url, scale)
    if (swap) spots.push({ url: swap[0], pos: [x, terrainHeight(x, z) - 0.08 - sink, z], rot, scale: swap[1] })
  }

  // autumn grove: an orange copse where leg B climbs out of the praia valley
  for (let k = 0; k < 7; k++) {
    const a = (k * Math.PI * 2) / 7 + 0.4
    accent(k % 2 ? FALL_OAK : FALL_CONE, -6.2 + Math.cos(a) * 2.2, 23.2 + Math.sin(a) * 1.8, k * 1.2, 2.3 + (k % 3) * 0.2)
  }
  // flower field right of the spawn walk — purple/red/yellow patch in the arrival shot
  const field: [string, number, number][] = []
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI * 2) / 16
    const r = 1.2 + (k % 4) * 0.7
    field.push([FLOWER_PICK[k % FLOWER_PICK.length], 4.6 + Math.cos(a) * r, 36.4 + Math.sin(a) * r])
  }
  for (const [url, x, z] of field) accent(url, x, z, (x + z) * 0.5, 1.9 + ((x * 7 + z * 3) % 1) * 0.4)
  // fairy ring of tan mushrooms in the meadow between the stations
  for (let k = 0; k < 9; k++) {
    const a = (k * Math.PI * 2) / 9
    accent(MUSH_TAN, 10 + Math.cos(a) * 1.7, -5 + Math.sin(a) * 1.7, k * 0.8, 1.9)
  }

  // mountaineer's bivouac below the snowy peak, off the east leg: small tent + brick
  // fire ring + a signpost pointing at the summit
  accent(TENT_SMALL, 33.4, 4.2, 0.9, 2.6)
  accent(CAMPFIRE_BRICKS, 34.8, 3.4, 0.2, 2.6)
  accent(SIGN, 33.0, 2.6, 0.35, 2.6)
  accent(POT_SMALL, 34.3, 4.9, 1.2, 2.2)
  accent(POT_LARGE, 32.3, 3.3, 0.4, 2.2)

  if (RICH) {
    // homestead plot on the flat west meadow (-36,-8): three crop rows (corn, wheat,
    // pumpkins + melons) inside a fence with a gate on the trail side, pots by the gate
    const [fx, fz] = [-36, -8]
    const F = 1.8 // kit fence/dirt pieces are 1 u long
    for (let r = -1; r <= 1; r++)
      for (let c = -1; c <= 1; c++) {
        const x = fx + c * F
        const z = fz + r * 1.6
        accent(DIRT_ROW, x, z, 0, F, 0.04)
        for (const dx of [-0.45, 0.45]) {
          if (r === -1) accent(CORN, x + dx, z, c + dx, 1.3)
          else if (r === 0) accent(WHEAT, x + dx, z, c * 2 + dx, 1.7)
          else accent(dx < 0 ? PUMPKIN : MELON, x + dx, z + (c % 2) * 0.2, c + dx * 3, 1.8)
        }
      }
    const hw = 2 * F // half width of the fenced square
    for (let i = -1; i <= 1; i++) {
      accent(FENCE, fx + i * F, fz - hw, 0, F) // north
      accent(FENCE, fx - hw, fz + i * F, Math.PI / 2, F) // west
      accent(FENCE, fx + hw, fz + i * F, Math.PI / 2, F) // east
      if (i !== 0) accent(FENCE, fx + i * F, fz + hw, 0, F) // south, gate in the middle
    }
    accent(FENCE_GATE, fx, fz + hw, 0, F)
    accent(FENCE_CORNER, fx - hw, fz - hw, 0, F)
    accent(FENCE_CORNER, fx + hw, fz - hw, Math.PI / 2, F)
    accent(FENCE_CORNER, fx + hw, fz + hw, Math.PI, F)
    accent(FENCE_CORNER, fx - hw, fz + hw, -Math.PI / 2, F)
    accent(POT_LARGE, fx + 1.4, fz + hw + 0.9, 0.7, 2.2)
    accent(POT_SMALL, fx + 2.0, fz + hw + 0.7, 2.1, 2.2)
    accent(SIGN, fx - 1.6, fz + hw + 0.8, 0.2, 2.6)

    // quarry on the rocky SW shoulder (-26,-26): broken stone, a brick stack, ore piles
    // and a covered pallet — the island's "industry", in sight of the treasure shrine
    const [qx, qz] = [-26, -26]
    accent(STONE_CHUNKS, qx, qz, 0.4, 1.7, -0.05)
    accent(STONE_CHUNKS, qx + 3.4, qz - 1.6, 2.3, 1.4, -0.05)
    accent(STONE_BRICKS, qx - 3.0, qz + 1.8, 0.9, 1.5, -0.05)
    accent(IRON, qx + 1.8, qz + 2.8, 1.1, 1.6, -0.05)
    accent(IRON, qx - 1.4, qz - 3.2, 2.7, 1.4, -0.05)
    accent(SILVER, qx + 4.2, qz + 1.4, 0.2, 1.6, -0.05)
    accent(PALLET_COVERED, qx - 4.6, qz - 2.2, 1.6, 1.5, -0.05)
    accent(KK_ROCK, qx + 5.6, qz - 4.0, 0.8, 2.2, 0.1)
    accent(KK_ROCK, qx - 6.0, qz + 3.4, 2.4, 1.8, 0.1)
    accent(SIGN, qx + 2.2, qz + 3.6, 3.0, 2.6)
  }

  return spots
}

/** Trail keep-out zones for the vegetation scatter: no tree grows on the path. */
export const TRAIL_CLEAR: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  const pts = new Set<string>()
  for (const leg of TRAIL_LEGS) {
    for (let s = 0; s < leg.pts.length - 1; s++) {
      const [x0, z0] = leg.pts[s]
      const [x1, z1] = leg.pts[s + 1]
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 2))
      for (let i = 0; i <= n; i++) {
        const x = Math.round((x0 + ((x1 - x0) * i) / n) * 2) / 2
        const z = Math.round((z0 + ((z1 - z0) * i) / n) * 2) / 2
        const key = `${x},${z}`
        if (pts.has(key)) continue
        pts.add(key)
        out.push([x, z, 1.3])
      }
    }
  }
  return out
})()

