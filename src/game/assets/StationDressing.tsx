import { terrainHeight } from '../terrain'
import { stationById } from '../stations'
import { preloadProps, type Placement } from './props'

// Set dressing per station. The stations themselves are gameplay (Targets.tsx); this is
// the authored place around them — what makes "Praia" read as a beach range, "Bosque" as
// a woodcutters' camp and "Mirante" as a stone lookout on the ridge.
//
// Placement is in station-local coordinates: `right` is the station's +X (the axis the
// rail slides on) and `back` is away from the player's approach. Nothing is placed in
// front of the bags above knee height, so no prop can eat a shot.

const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const R = '/game/models/KayKit_ResourceBits_1.0_FREE/Assets/gltf/'

const FENCE = K + 'fence_planksDouble.glb'
const FENCE_SIMPLE = K + 'fence_simple.glb'
const SIGN = K + 'sign.glb'
const CRATE = R + 'Pallet_Wood_Covered_A.gltf'
const PALLET = R + 'Pallet_Wood.gltf'
const BARREL = R + 'Fuel_A_Barrel.gltf'
const LOGS = R + 'Wood_Log_Stack.gltf'
const LOG_LARGE = K + 'log_large.glb'
const LOG_STACK = K + 'log_stack.glb'
const STUMP = K + 'stump_roundDetailed.glb'
const TENT = K + 'tent_detailedOpen.glb'
const CAMPFIRE = K + 'campfire_logs.glb'
const MOSS = K + 'hanging_moss.glb'
const STONE_CIRCLE = K + 'path_stoneCircle.glb'
const STONE_PATH = K + 'path_stone.glb'
const OBELISK = K + 'statue_obelisk.glb'
const COLUMN = K + 'statue_column.glb'
const COLUMN_BROKEN = K + 'statue_columnDamaged.glb'
const STATUE_RING = K + 'statue_ring.glb'
const STONE_LARGE = K + 'stone_largeD.glb'
const STONE_TALL = K + 'stone_tallA.glb'
const FLAT = K + 'stone_smallFlatA.glb'
const GRASS = K + 'grass_leafsLarge.glb'
const PALM = K + 'tree_palmDetailedShort.glb'
const CANOE = K + 'canoe.glb'
const WHEAT = K + 'crops_wheatStageB.glb'
const CORN = K + 'crops_cornStageB.glb'
const BED = K + 'bed.glb'
const STONE_BRICKS = R + 'Stone_Bricks_Stack_Small.gltf'
const TEXTILES = R + 'Textiles_A.gltf'

type Local = [url: string, right: number, back: number, rot: number, scale: number]

// [url, right, back, rot(local), scale]
const LAYOUTS: Record<string, Local[]> = {
  praia: [
    // back wall of planks so the bags read against wood, not against sea haze
    [FENCE, -2.6, 1.9, 0, 2.6],
    [FENCE, 0, 1.9, 0, 2.6],
    [FENCE, 2.6, 1.9, 0, 2.6],
    [CRATE, -3.4, 1.1, 0.4, 1.0],
    [PALLET, -3.5, 1.1, 0.4, 1.0],
    [CRATE, 3.5, 0.9, -0.3, 1.0],
    [BARREL, 3.0, 1.6, 0, 1.0],
    [BARREL, -4.2, 1.4, 0, 0.9],
    [SIGN, -3.9, -1.6, 0.35, 2.6],
    [CANOE, 4.6, -2.2, 1.3, 2.2],
    [FLAT, -2.0, -2.6, 0.4, 2.2],
    [FLAT, 2.4, -3.0, 1.9, 2.0],
    [PALM, -6.0, -0.6, 0.8, 2.4],
    [PALM, 6.0, 0.4, 2.4, 2.6],
    [GRASS, -4.6, -0.4, 1.2, 1.9],
    [GRASS, 4.4, -1.2, 2.6, 1.8],
  ],
  bosque: [
    // woodcutters' camp: the rail runs past a working clearing, with a farm patch
    // beside the tent (wheat rows + corn + a bed — the camp that grows its food)
    [TENT, -4.6, 1.8, 0.5, 2.6],
    [CAMPFIRE, -3.4, 0.2, 0, 2.6],
    [LOG_LARGE, -2.4, -0.7, 1.2, 1.5],
    [LOG_STACK, 3.8, 1.4, 0.6, 2.2],
    [LOGS, 4.4, 0.4, 2.2, 0.55],
    [STUMP, 2.6, -1.2, 0.9, 2.2],
    [STUMP, -1.4, 2.2, 2.4, 2.0],
    [FENCE_SIMPLE, -1.3, 2.4, 0, 2.6],
    [FENCE_SIMPLE, 1.3, 2.4, 0, 2.6],
    [MOSS, -5.2, 0.6, 0.2, 3.0],
    [MOSS, 5.0, 1.0, 2.9, 2.6],
    [PALLET, 1.8, 1.9, 0.3, 1.0],
    [BARREL, -5.0, 0.9, 0, 0.9],
    [GRASS, -3.0, -2.4, 0.5, 2.0],
    [GRASS, 3.4, -2.6, 2.1, 1.9],
    [FLAT, 0.4, -3.2, 1.1, 2.2],
    [WHEAT, -5.6, 2.8, 0.3, 1.5],
    [WHEAT, -5.2, 3.0, 0.9, 1.6],
    [WHEAT, -4.8, 3.2, 1.6, 1.5],
    [WHEAT, -5.8, 3.6, 2.2, 1.6],
    [WHEAT, -5.3, 3.9, 2.8, 1.5],
    [WHEAT, -4.9, 4.1, 3.3, 1.6],
    [CORN, -5.9, 2.2, 1.1, 2.4],
    [CORN, -6.3, 3.2, 2.4, 2.2],
    [BED, -4.2, 2.9, 0.4, 1.9],
    [TEXTILES, -3.5, 2.5, 0.8, 0.9],
    [SIGN, 4.2, -0.8, 0.4, 2.6],
  ],
  mirante: [
    // stone ring on the ridge: a built lookout, the reward station
    [STONE_CIRCLE, 0, 0.2, 0, 5.2],
    [STONE_PATH, 0, -3.0, 0, 3.0],
    [STONE_PATH, 0, -4.6, 0.1, 3.0],
    [OBELISK, -4.4, 1.6, 0.3, 2.6],
    [COLUMN, -3.2, 2.4, 0, 2.4],
    [COLUMN_BROKEN, 3.4, 2.3, 0, 2.4],
    [STATUE_RING, 4.6, 1.2, -0.4, 2.6],
    [STONE_LARGE, -5.6, 0.2, 1.1, 2.4],
    [STONE_TALL, 5.4, -0.6, 2.2, 2.0],
    [SIGN, -2.6, -2.8, 0.4, 2.6],
    [STONE_BRICKS, -5.2, 1.4, 0.7, 0.9],
    [FENCE, -3.9, 0.6, 1.57, 2.6],
    [FENCE, 3.9, 0.6, 1.57, 2.6],
    [GRASS, -2.2, -3.4, 0.7, 1.8],
    [GRASS, 2.6, -3.6, 2.3, 1.7],
    [FLAT, 1.6, -2.4, 1.4, 2.0],
  ],
}

export type StationId = keyof typeof LAYOUTS

/** Props around one station, grounded on the terrain and yawed to face the player. */
export function stationSpots(id: StationId): (Placement & { url: string })[] {
  const s = stationById(id)
  const layout = LAYOUTS[id]
  if (!s || !layout) return []
  const cos = Math.cos(s.yaw)
  const sin = Math.sin(s.yaw)
  return layout.map(([url, right, back, rot, scale]) => {
    // right = station +X, back = away from the approach direction
    const x = s.x + cos * right - sin * back
    const z = s.z - sin * right - cos * back
    return { url, pos: [x, terrainHeight(x, z) - 0.06, z], rot: s.yaw + rot, scale }
  })
}

preloadProps([...new Set(Object.values(LAYOUTS).flat().map((l) => l[0]))])
