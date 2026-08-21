import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, WATER_LEVEL } from '../terrain'
import { InstancedScatter } from './InstancedProps'
import { preloadProps, type Placement } from './props'
import { SPAWN } from '../PlayerTPS'

// The arrival: south beach, camera looking inland. This is the first screenshot of the
// game, so it is authored by hand instead of scattered — a wooden pier running into the
// surf behind the player, a campfire he just left, a signpost pointing up the island,
// driftwood, and two palm groups framing the left and right edges of the shot.

const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const PIER = K + 'bridge_wood.glb'
const PIER_SIDE = K + 'bridge_side_wood.glb'
const SIGN = K + 'sign.glb'
const CAMPFIRE = K + 'campfire_stones.glb'
const LOG = K + 'log_large.glb'
const LOG_STACK = K + 'log_stack.glb'
const CANOE = K + 'canoe.glb'
const PADDLE = K + 'canoe_paddle.glb'
const PALM_LONG = '/game/models/palm-detailed-long.gltf'
const PALM_SHORT = '/game/models/palm-detailed-short.gltf'
const PALM_BEND = K + 'tree_palmBend.glb'
const STONE_FLAT = K + 'stone_smallFlatA.glb'
const PATH = K + 'path_wood.glb'
const GRASS = K + 'grass_leafsLarge.glb'

const PIER_SCALE = 1.7
const X = SPAWN.x
const Z = SPAWN.z

type Spot = Placement & { url: string }

function build(): Spot[] {
  const s: Spot[] = []
  const put = (url: string, x: number, z: number, y: number, rot: number, scale: number) =>
    s.push({ url, pos: [x, y, z], rot, scale })
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
  // a beached canoe under the pier head
  ground(CANOE, X + 2.6, Z + 3.4, 1.05, 2.4, 0.02)
  ground(PADDLE, X + 3.4, Z + 2.6, 2.2, 2.2, 0.02)

  // --- camp: fire ring, two seats, a stack of firewood ---
  ground(CAMPFIRE, X + 1.4, Z - 1.2, 0.4, 2.6, 0.02)
  ground(LOG, X + 2.9, Z - 0.6, 1.3, 1.5)
  ground(LOG, X + 0.2, Z - 2.4, 2.7, 1.4)
  ground(LOG_STACK, X + 3.1, Z - 2.3, 0.7, 1.8)

  // --- signpost + a few stepping planks pointing inland ---
  ground(SIGN, X - 0.9, Z - 2.6, Math.PI, 2.6, 0.02)
  for (let i = 0; i < 4; i++) ground(PATH, X - 0.3 + i * 0.25, Z - 4.2 - i * 1.9, 0.06 * i, 1.9, 0.0)

  // --- framing: palm groups left and right of the inland view ---
  // scales differ per model: the "detailed" palms are 2.4 units tall at scale 1
  const palms: [string, number, number, number, number][] = [
    // the west group sits SOUTH of the player: the sun is WSW, so their shadows fall
    // behind him instead of dropping the arrival shot into shade
    [PALM_LONG, -8.4, 5.0, 0.4, 1.5],
    [PALM_BEND, -9.6, 2.2, 1.9, 2.6],
    [PALM_SHORT, -7.6, 8.0, 3.0, 1.3],
    [PALM_LONG, 8.6, 1.8, 2.4, 1.6],
    [PALM_BEND, 9.8, -2.2, 0.9, 2.4],
    [PALM_SHORT, 7.2, -4.8, 4.1, 1.35],
  ]
  for (const [url, dx, dz, rot, scale] of palms) ground(url, X + dx, Z + dz, rot, scale)

  // --- driftwood, flat stones and grass tufts in the sand ---
  const litter: [string, number, number, number, number][] = [
    [LOG, -3.4, 1.6, 0.9, 1.3],
    [LOG, 4.6, 4.2, 2.1, 1.1],
    [STONE_FLAT, -2.2, 3.4, 0.3, 2.4],
    [STONE_FLAT, 3.2, -3.8, 1.7, 2.0],
    [STONE_FLAT, -4.8, -2.2, 2.6, 2.2],
    [GRASS, -3.9, -0.4, 1.1, 2.0],
    [GRASS, 4.1, 0.8, 2.4, 1.8],
    [GRASS, -1.6, -4.6, 0.5, 1.9],
    [GRASS, 2.2, -5.2, 3.0, 1.7],
  ]
  for (const [url, dx, dz, rot, scale] of litter) ground(url, X + dx, Z + dz, rot, scale)

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

export function SpawnBeach() {
  const spots = useMemo(build, [])
  return (
    <>
      <InstancedScatter spots={spots} />
      <Campfire />
    </>
  )
}

preloadProps([PIER, PIER_SIDE, SIGN, CAMPFIRE, LOG, LOG_STACK, CANOE, PADDLE, PALM_LONG, PALM_SHORT, PALM_BEND, STONE_FLAT, PATH, GRASS])
