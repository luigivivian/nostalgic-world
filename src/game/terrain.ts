import * as THREE from 'three'
import { fbm } from './noise'

export const ISLAND_SIZE = 160 // world units, square
export const WATER_LEVEL = 0
const SEGMENTS = 128
const MAX_HEIGHT = 14
const SEED = 7

// Height at world (x, z): fbm dunes shaped by a radial falloff so the terrain
// sinks below water toward the edges — an island, same recipe as the three.js
// procedural terrain demo but on the CPU (heights double as the physics source).
export function terrainHeight(x: number, z: number) {
  const n = fbm(x / 42, z / 42, SEED) // [-1, 1], broad dunes
  const detail = fbm(x / 9, z / 9, SEED + 900) * 0.15
  const r = Math.hypot(x, z) / (ISLAND_SIZE * 0.48)
  const falloff = 1 - smoothstep(0.55, 1, r)
  const h = ((n + 1) / 2 + detail) * MAX_HEIGHT * falloff
  return h - 1.8 // sink so edges sit under water
}

function smoothstep(a: number, b: number, t: number) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

const SAND = new THREE.Color('#eed7a1')
const GRASS = new THREE.Color('#6cb04f')
const ROCK = new THREE.Color('#98836b')
const SNOW = new THREE.Color('#f6f4ec')

/** Island mesh geometry: plane on XZ, displaced by terrainHeight, vertex-colored by height/slope. */
export function createIslandGeometry() {
  const geo = new THREE.PlaneGeometry(ISLAND_SIZE, ISLAND_SIZE, SEGMENTS, SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = terrainHeight(x, z)
    pos.setY(i, h)
  }
  geo.computeVertexNormals()
  const normal = geo.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i)
    const slope = 1 - normal.getY(i) // 0 flat, 1 vertical
    if (h < WATER_LEVEL + 0.7) c.copy(SAND)
    else if (h > 9.5) c.copy(SNOW)
    else if (slope > 0.28) c.copy(ROCK)
    else c.copy(GRASS).lerp(ROCK, Math.min(1, slope * 2.2))
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}
