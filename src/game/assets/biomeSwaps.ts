import { activeBiome, type BiomeId } from '../biomes'

// The authored layers (spawn beach, trails, station dressing) were built once for the green
// island. Instead of re-authoring them per biome, their kit files are swapped on the way
// into the scatter: url -> [replacement, scale factor], or null to drop the prop (a corn
// field makes no sense in the snow). Layouts stay untouched.
const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const KK = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/'
const HO = '/game/models/kenney_holiday-kit/Models/GLB%20format/'
const GY = '/game/models/kenney_graveyard-kit/Models/GLB%20format/'

type Swap = [string, number] | null
type Table = Record<string, Swap>

const PALMS = [K + 'tree_palmDetailedTall.glb', K + 'tree_palmDetailedShort.glb', K + 'tree_palmBend.glb', K + 'tree_palm.glb', K + 'tree_palmTall.glb', K + 'tree_palmShort.glb']
const FALL = [K + 'tree_oak_fall.glb', K + 'tree_cone_fall.glb']
const CROPS = [K + 'crops_cornStageC.glb', K + 'crops_wheatStageB.glb', K + 'crop_pumpkin.glb', K + 'crop_melon.glb', K + 'crops_wheatStageB.glb', K + 'crops_cornStageB.glb']
const MUSH_TAN = K + 'mushroom_tan.glb'
const SPAWN_BUSHES = [KK + 'Bush_2_A_Color1.gltf', KK + 'Bush_3_A_Color1.gltf', KK + 'Bush_1_A_Color1.gltf']

const all = (urls: string[], swap: Swap): Table => Object.fromEntries(urls.map((u) => [u, swap]))
const cycle = (urls: string[], targets: Swap[]): Table => Object.fromEntries(urls.map((u, i) => [u, targets[i % targets.length]]))

const SWAPS: Partial<Record<BiomeId, Table>> = {
  deserto: {
    ...cycle(FALL, [[K + 'cactus_tall.glb', 1.3], [K + 'cactus_short.glb', 1.5]]),
    ...all(CROPS, null),
    [MUSH_TAN]: [K + 'stone_smallFlatA.glb', 1.0],
  },
  neve: {
    ...cycle(PALMS, [[HO + 'tree-snow-b.glb', 0.8], [HO + 'tree-snow-a.glb', 0.7], [HO + 'tree-snow-c.glb', 0.75]]),
    ...cycle(FALL, [[GY + 'pine.glb', 0.7], [HO + 'tree-snow-c.glb', 0.8]]),
    ...all(CROPS, null),
    [MUSH_TAN]: [HO + 'snow-pile.glb', 0.8],
    ...cycle(SPAWN_BUSHES, [[HO + 'snow-pile.glb', 1.0], [HO + 'snow-pile.glb', 1.2], [HO + 'rocks-small.glb', 0.5]]),
  },
  pantano: {
    ...cycle(PALMS, [[GY + 'pine-crooked.glb', 0.7], [K + 'tree_thin.glb', 1.0], [GY + 'pine-fall-crooked.glb', 0.7]]),
    ...cycle(FALL, [[GY + 'pine-fall-crooked.glb', 0.7], [K + 'tree_thin.glb', 1.0]]),
    ...all(CROPS, [K + 'mushroom_redGroup.glb', 0.9]),
  },
  montanha: {
    ...cycle(PALMS, [[K + 'tree_pineTallA.glb', 1.0], [K + 'tree_pineRoundA.glb', 0.9], [K + 'tree_pineTallB.glb', 1.0]]),
    ...cycle(FALL, [[K + 'tree_pineTallA.glb', 1.0], [K + 'tree_pineDefaultA.glb', 1.0]]),
    ...all(CROPS, [K + 'plant_bush.glb', 0.8]),
    [MUSH_TAN]: [K + 'stone_smallFlatA.glb', 1.0],
  },
  ruinas: {
    ...cycle(FALL, [[K + 'tree_oak.glb', 1.0], [K + 'tree_plateau.glb', 1.0]]),
    [MUSH_TAN]: [GY + 'gravestone-round.glb', 0.9],
  },
}

/** Returns the [url, scale] this biome wants for an authored prop, or null to skip it. */
export function swapProp(url: string, scale: number): [string, number] | null {
  const swap = SWAPS[activeBiome().id]?.[url]
  if (swap === undefined) return [url, scale]
  if (swap === null) return null
  return [swap[0], scale * swap[1]]
}
