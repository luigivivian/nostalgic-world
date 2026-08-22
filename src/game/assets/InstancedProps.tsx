import { useEffect, useMemo } from 'react'
import type * as THREE from 'three'
import { buildInstances, useToonParts, type Placement } from './props'
import { LOW_END } from '../quality'

/**
 * Every placement of one model file, as one InstancedMesh per sub-mesh.
 * Shared geometries/materials live in the props cache, so only the per-instance
 * buffers are disposed on unmount.
 */
export function InstancedProps({
  url,
  spots,
  castShadow = true,
}: {
  url: string
  spots: Placement[]
  castShadow?: boolean
}) {
  const parts = useToonParts(url)
  const meshes = useMemo(
    () => {
      const list = spots.length ? buildInstances(parts, spots, castShadow) : []
      for (const m of list) m.name = url
      return list
    },
    [url, parts, spots, castShadow],
  )
  useEffect(() => () => meshes.forEach((m: THREE.InstancedMesh) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} dispose={null} />
      ))}
    </>
  )
}

// Skip the shadow pass where it buys nothing: knee-high plants, stumps, pots, fences,
// crops (shadows invisible at play distance), flat path slabs, lily pads and ground
// patches (no height to cast). On the LOW_END tier the
// whole scatter skips it — the shadow pass is ~40% of a phone's draw calls, and the
// hero, bags and terrain keep theirs so the scene still has grounding shadows.
const NO_SHADOW =
  /poly\/(flower|pastel-plume|tulip|desert-marigold|bulb|mushrooms|fiddlehead|suspicious|orchid)|grass|Grass_|Bush_|flower_|mushroom_|path_|ground_pathRocks|plant_|stump_|lily_|pot_|fence_|crops?_|Nuggets|Wood_Log_A|shrubs\/(bush|flower|grass|mushroom)/

/** Group placements by model file and render them all instanced. */
export function InstancedScatter({
  spots,
  castShadow,
}: {
  spots: (Placement & { url: string })[]
  /** override the NO_SHADOW heuristic — e.g. distant landmarks never cast */
  castShadow?: boolean
}) {
  const byUrl = useMemo(() => {
    const m = new Map<string, Placement[]>()
    for (const s of spots) {
      const list = m.get(s.url)
      if (list) list.push(s)
      else m.set(s.url, [s])
    }
    return [...m.entries()]
  }, [spots])
  return (
    <>
      {byUrl.map(([url, group]) => (
        <InstancedProps
          key={url}
          url={url}
          spots={group}
          castShadow={castShadow ?? (!LOW_END && !NO_SHADOW.test(url))}
        />
      ))}
    </>
  )
}
