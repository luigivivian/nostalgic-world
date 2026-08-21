import { terrainHeight, WATER_LEVEL } from './terrain'
import type { StationState } from './store'

// Level plan: three stations on the island, escalating from static to moving to
// swinging. Positions are authored in world XZ; every Y comes from terrainHeight so
// the layout survives any terrain retune. This module is data only (no three.js),
// so the asset worker can read STATIONS for prop placement without pulling the scene.

/** Snack-bag proportions: the placeholder box and the real <SnackBag/> share these. */
export const TARGET_SIZE: [number, number, number] = [0.8, 1.2, 0.35]

/** Where the player enters the island; targets are yawed to face it. */
export const APPROACH: [number, number] = [0, 44]

export type StationLayout = 'wall' | 'rail' | 'pendulum'

export interface StationDef {
  id: string
  name: string
  tier: 1 | 2 | 3
  x: number
  z: number
  layout: StationLayout
  /** terrain height at (x, z) — the reference plane for every target in the station */
  groundY: number
  /** rotation about Y so the bags' broad face points back at APPROACH */
  yaw: number
  /** number of targets to clear */
  count: number
  /** drop table for this tier */
  rare: number
  legendary: number
}

export type TargetMotion =
  | { kind: 'static' }
  | { kind: 'rail'; amp: number; speed: number; phase: number }
  | { kind: 'pendulum'; arm: number; amp: number; speed: number; phase: number }

export interface TargetDef {
  /** ground height of a mast drawn under a raised static target */
  poleFrom?: number
  id: number
  stationId: string
  /** rest position in WORLD space (kinematic bodies are driven in world space) */
  pos: [number, number, number]
  yaw: number
  motion: TargetMotion
}

/** Stations that would sit in the sea are pulled toward the origin; reported for QA. */
export const STATION_NUDGES: { id: string; from: [number, number]; to: [number, number] }[] = []

function landAt(id: string, x: number, z: number): [number, number, number] {
  let px = x
  let pz = z
  let h = terrainHeight(px, pz)
  const start: [number, number] = [x, z]
  while (h < WATER_LEVEL + 1 && Math.hypot(px, pz) > 2) {
    px *= 0.9
    pz *= 0.9
    h = terrainHeight(px, pz)
  }
  if (px !== x || pz !== z) STATION_NUDGES.push({ id, from: start, to: [px, pz] })
  return [px, pz, h]
}

function facingYaw(x: number, z: number) {
  return Math.atan2(APPROACH[0] - x, APPROACH[1] - z)
}

function station(
  id: string,
  name: string,
  tier: 1 | 2 | 3,
  x: number,
  z: number,
  layout: StationLayout,
  count: number,
  rare: number,
  legendary: number,
): StationDef {
  const [px, pz, groundY] = landAt(id, x, z)
  return { id, name, tier, x: px, z: pz, layout, groundY, yaw: facingYaw(px, pz), count, rare, legendary }
}

export const STATIONS: StationDef[] = [
  station('praia', 'Praia', 1, 0, 28, 'wall', 6, 0.1, 0),
  station('bosque', 'Bosque', 2, -26, 4, 'rail', 6, 0.3, 0),
  station('mirante', 'Mirante', 3, 24, -22, 'pendulum', 6, 0.45, 0.1),
]

export function stationById(id: string) {
  return STATIONS.find((s) => s.id === id)
}

/** Highest ground a target can travel over, so a level rail never sinks into a dune. */
function clearGround(s: StationDef, halfSpan: number) {
  let h = s.groundY
  const tx = Math.cos(s.yaw)
  const tz = -Math.sin(s.yaw)
  for (let t = -halfSpan; t <= halfSpan; t += 0.5) {
    h = Math.max(h, terrainHeight(s.x + tx * t, s.z + tz * t))
  }
  return h
}

/** local (right, up) offset -> world position, using the station's facing yaw */
function place(s: StationDef, right: number, y: number): [number, number, number] {
  return [s.x + Math.cos(s.yaw) * right, y, s.z - Math.sin(s.yaw) * right]
}

/** Deterministic layout: same target ids and positions every round. */
export function buildStationTargets(s: StationDef): TargetDef[] {
  const base = STATIONS.indexOf(s) * 100
  const defs: TargetDef[] = []

  if (s.layout === 'wall') {
    // 3 x 2 greybox wall: the tutorial station — everything is hittable from one spot.
    const g = clearGround(s, 2.2)
    const cols = [-1.3, 0, 1.3]
    const rows = [0.95, 2.25]
    let i = 0
    for (const y of rows)
      for (const right of cols)
        defs.push({ id: base + i++, stationId: s.id, pos: place(s, right, g + y), yaw: s.yaw, motion: { kind: 'static' } })
    return defs
  }

  if (s.layout === 'rail') {
    // Two level rails, 3 bags each, sliding out of phase at 1.2-1.8 u/s: the player
    // must lead the shot instead of standing still.
    const g = clearGround(s, 4.0)
    const cols = [-2.6, 0, 2.6]
    const rows = [0.95, 2.3]
    let i = 0
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < cols.length; c++) {
        const speed = 1.2 + ((i * 0.13) % 0.6)
        defs.push({
          id: base + i,
          stationId: s.id,
          pos: place(s, cols[c], g + rows[r]),
          yaw: s.yaw,
          motion: { kind: 'rail', amp: 1.2, speed, phase: r * Math.PI + c * 0.7 },
        })
        i++
      }
    return defs
  }

  // pendulum: 5 swinging bags plus one high static "prize" that needs an arced shot.
  const g = clearGround(s, 4.2)
  const arm = 1.7
  let i = 0
  for (const right of [-3.2, -1.6, 0, 1.6, 3.2]) {
    defs.push({
      id: base + i,
      stationId: s.id,
      pos: place(s, right, g + 1.9),
      yaw: s.yaw,
      motion: { kind: 'pendulum', arm, amp: 0.45, speed: 1.0 + i * 0.12, phase: i * 0.8 },
    })
    i++
  }
  // prize bag on a mast just above the swing arc (projectiles fly straight — no arc needed)
  defs.push({ id: base + i, stationId: s.id, pos: place(s, 0, g + 3.9), yaw: s.yaw, motion: { kind: 'static' }, poleFrom: g })
  return defs
}

/** Fresh station states for a new round: only tier 1 starts unlocked. */
export function initialStationStates(): StationState[] {
  return STATIONS.map((s) => ({
    id: s.id,
    name: s.name,
    tier: s.tier,
    pos: [s.x, s.groundY, s.z] as [number, number, number],
    targetsTotal: s.count,
    targetsLeft: s.count,
    unlocked: s.tier === 1,
  }))
}
