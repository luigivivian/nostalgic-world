import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, WATER_LEVEL } from '../terrain'
import type { Placement } from './props'
import { SPAWN_X, SPAWN_Z } from '../PlayerTPS'
import { swapProp } from './biomeSwaps'

// The arrival: south beach, camera looking inland. This is the first screenshot of the
// game, so it is authored by hand instead of scattered — a wooden pier running into the
// surf behind the player, the camp he just left (fire ring, two stump seats), a
// signpost pointing up the island, and two palm groups framing the inland view. Kept
// sparse on purpose: the beach has to read as a place you can walk into.

const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const KK = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/'
const PIER = K + 'bridge_wood.glb'
const PIER_SIDE = K + 'bridge_side_wood.glb'
const SIGN = K + 'sign.glb'
const CAMPFIRE = K + 'campfire_stones.glb'
const STUMP = K + 'stump_roundDetailed.glb'
const PALM_TALL = K + 'tree_palmDetailedTall.glb'
const PALM_SHORT = K + 'tree_palmDetailedShort.glb'
const PALM_BEND = K + 'tree_palmBend.glb'
const GRASS = K + 'grass_leafsLarge.glb'
// KayKit pieces: textured bushes/rocks/grass — richer than the flat kit plants up close
const BUSH_ROUND = KK + 'Bush_2_A_Color1.gltf'
const BUSH_WIDE = KK + 'Bush_3_A_Color1.gltf'
const BUSH_SMALL = KK + 'Bush_1_A_Color1.gltf'
const BOULDER = KK + 'Rock_2_C_Color1.gltf'
const ROCK = KK + 'Rock_1_A_Color1.gltf'
const ROCK_B = KK + 'Rock_1_B_Color1.gltf'
const TUFT = KK + 'Grass_2_A_Color1.gltf'

const PIER_SCALE = 1.7
const X = SPAWN_X
const Z = SPAWN_Z

type Spot = Placement & { url: string }

export function spawnBeachSpots(): Spot[] {
  const s: Spot[] = []
  // biomeSwaps: the palms/bushes become that biome's trees, same layout
  const put = (url: string, x: number, z: number, y: number, rot: number, scale: number) => {
    const swap = swapProp(url, scale)
    if (swap) s.push({ url: swap[0], pos: [x, y, z], rot, scale: swap[1] })
  }
  const ground = (url: string, x: number, z: number, rot: number, scale: number, sink = 0.08) =>
    put(url, x, z, terrainHeight(x, z) - sink, rot, scale)

  // --- pier: marches south from the sand into the water, deck kept level ---
  const deckY = Math.max(terrainHeight(X - 1.6, Z + 2), WATER_LEVEL) + 0.55
  for (let i = 0; i < 9; i++) {
    const pz = Z + 2.2 + i * PIER_SCALE
    put(PIER, X - 1.8, pz, deckY, 0, PIER_SCALE)
    if (i % 2 === 0) {
      put(PIER_SIDE, X - 1.8 - PIER_SCALE * 0.5, pz, deckY, 0, PIER_SCALE)
      put(PIER_SIDE, X - 1.8 + PIER_SCALE * 0.5, pz, deckY, Math.PI, PIER_SCALE)
    }
  }

  // --- camp: fire ring and two stump seats ---
  ground(CAMPFIRE, X + 1.4, Z - 1.2, 0.4, 2.6, 0.02)
  ground(STUMP, X + 2.9, Z - 0.4, 1.3, 2.0, 0.02)
  ground(STUMP, X + 0.1, Z - 2.6, 2.7, 1.9, 0.02)

  // --- signpost pointing inland (the trail's first wood slabs start at z 34) ---
  ground(SIGN, X - 2.6, Z - 2.0, 0.3, 2.6, 0.02)

  // --- framing: palm groups left and right of the inland view, both INLAND of the
  // player (-z) so they flank the arrival shot; the sun is WSW, shadows fall away ---
  const palms: [string, number, number, number, number][] = [
    [PALM_TALL, -7.0, -7.0, 0.4, 2.7],
    [PALM_BEND, -9.6, -3.4, 1.9, 2.5],
    [PALM_SHORT, -8.4, -10.6, 3.0, 2.3],
    [PALM_TALL, 8.0, -8.0, 2.4, 2.8],
    [PALM_BEND, 10.0, -3.8, 0.9, 2.4],
    [PALM_SHORT, 7.4, -11.6, 4.1, 2.2],
    // one each side of the pier head, for the turn-around view
    [PALM_BEND, -5.6, 3.2, 1.2, 2.3],
    [PALM_TALL, 6.2, 2.4, 4.0, 2.6],
  ]
  for (const [url, dx, dz, rot, scale] of palms) ground(url, X + dx, Z + dz, rot, scale)

  // --- understory at the palms' feet, a few rocks at the tideline, light tufts ---
  const dressing: [string, number, number, number, number, number][] = [
    [BUSH_ROUND, -8.6, -6.2, 0.6, 2.0, 0.02],
    [BUSH_ROUND, 8.8, -6.6, 2.1, 2.2, 0.02],
    [BUSH_WIDE, -6.0, -9.4, 1.4, 1.6, 0.02],
    [BUSH_WIDE, 6.6, -10.2, 0.3, 1.7, 0.02],
    [BUSH_SMALL, -3.0, -6.4, 2.2, 2.6, 0.02],
    [BUSH_SMALL, 3.4, -7.0, 0.9, 2.4, 0.02],
    [BOULDER, -4.4, 2.6, 0.8, 0.7, 0.1],
    [ROCK, 4.2, 3.6, 2.3, 1.5, 0.06],
    [ROCK_B, -3.2, -3.6, 1.1, 1.2, 0.05],
    [TUFT, -7.8, -5.0, 0.2, 1.0, 0.02],
    [TUFT, 9.0, -5.4, 1.7, 1.0, 0.02],
    [TUFT, -6.5, -8.6, 2.9, 0.9, 0.02],
    [GRASS, -3.9, -0.4, 1.1, 2.0, 0.08],
    [GRASS, 4.1, 0.8, 2.4, 1.8, 0.08],
    [GRASS, -5.0, -5.0, 0.5, 1.9, 0.08],
    [GRASS, 5.2, -5.4, 3.0, 1.7, 0.08],
  ]
  for (const [url, dx, dz, rot, scale, sink] of dressing) ground(url, X + dx, Z + dz, rot, scale, sink)

  return s
}

/** Two crossed emissive cards over the fire ring: cheap flame, no light, bloom-ready. */
function Campfire() {
  const y = terrainHeight(X + 1.4, Z - 1.2)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.4, 1.1, 0.25),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.16, 0)
    shape.quadraticCurveTo(-0.2, 0.3, 0, 0.52)
    shape.quadraticCurveTo(0.2, 0.3, 0.16, 0)
    shape.closePath()
    return new THREE.ShapeGeometry(shape, 8)
  }, [])
  return (
    <group position={[X + 1.4, y + 0.05, Z - 1.2]}>
      <mesh geometry={geometry} material={material} dispose={null} />
      <mesh geometry={geometry} material={material} rotation-y={Math.PI / 2} scale={0.8} dispose={null} />
    </group>
  )
}

/** The spawn beach's live bits; its props come through WorldProps (spawnBeachSpots). */
export function SpawnBeach() {
  return <Campfire />
}

