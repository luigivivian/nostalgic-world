import * as THREE from 'three'
import { fbm } from '../noise'

// The sky garden: one floating island, radial mesh. The top is a soft grass mound with a
// flat stone ring (the portal promenade) and a flat plaza under the tree; the underside
// is a jagged rock cone. Both halves share the rim ring so there is no seam.
export const HUB_R = 30
/** portal promenade radius */
export const RING_R = 21
export const PLAZA_R = 5.5
const RINGS = 48
const SEGS = 128
const DEPTH = 17

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mound(t: number) {
  return 2.6 * Math.pow(Math.max(0, 1 - t), 1.4)
}
const RING_Y = mound(RING_R / HUB_R)
const PLAZA_Y = mound(0)

/** Top surface height at (x, z); only meaningful for r <= HUB_R. */
export function hubHeight(x: number, z: number) {
  const r = Math.hypot(x, z)
  const t = r / HUB_R
  let y = mound(t) + fbm(x / 6, z / 6, 31) * 0.45 * (1 - t * t)
  // flat promenade for the portals, flat plaza for the tree
  y = lerp(y, RING_Y, 1 - smoothstep(2.6, 5.2, Math.abs(r - RING_R)))
  y = lerp(y, PLAZA_Y, 1 - smoothstep(PLAZA_R, PLAZA_R + 3, r))
  // the rim rolls off so the edge reads as an edge
  y -= 1.4 * smoothstep(0.9, 1, t)
  return y
}

function underside(x: number, z: number) {
  const r = Math.hypot(x, z)
  const t = Math.min(1, r / HUB_R)
  const shape = Math.pow(Math.max(0, 1 - t * t), 0.7)
  const jag = fbm(x / 4.5, z / 4.5, 77) * 2.2 * (1 - t)
  return hubHeight(x, z) - DEPTH * shape * (0.85 + 0.15 * fbm(x / 11, z / 11, 79)) - jag
}

const GRASS_IN = new THREE.Color('#86cc64')
const GRASS_OUT = new THREE.Color('#5f9f4b')
const STONE = new THREE.Color('#d6ccb0')
const STONE_EDGE = new THREE.Color('#bfb292')
const DIRT = new THREE.Color('#8b6a45')
const ROCK = new THREE.Color('#7a6c5f')
const ROCK_DEEP = new THREE.Color('#4e463f')
const ROOTS = new THREE.Color('#6f5238')

function radial(heightAt: (x: number, z: number) => number, colorAt: (x: number, z: number, y: number, c: THREE.Color) => void, flip: boolean) {
  const positions: number[] = []
  const colors: number[] = []
  const index: number[] = []
  const c = new THREE.Color()
  for (let i = 0; i <= RINGS; i++) {
    const r = (HUB_R * i) / RINGS
    for (let j = 0; j < SEGS; j++) {
      const a = (j / SEGS) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = heightAt(x, z)
      positions.push(x, y, z)
      colorAt(x, z, y, c)
      colors.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const a = i * SEGS + j
      const b = i * SEGS + ((j + 1) % SEGS)
      const cc = (i + 1) * SEGS + j
      const d = (i + 1) * SEGS + ((j + 1) % SEGS)
      if (flip) index.push(a, cc, b, b, cc, d)
      else index.push(a, b, cc, b, d, cc)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

/** Visible + walkable top, and the rock underside (visual only). */
export function createHubGeometry() {
  const top = radial(
    hubHeight,
    (x, z, _y, c) => {
      const r = Math.hypot(x, z)
      const t = r / HUB_R
      c.copy(GRASS_IN).lerp(GRASS_OUT, t)
      const ring = 1 - smoothstep(2.0, 2.9, Math.abs(r - RING_R))
      c.lerp(STONE, ring * 0.9)
      c.lerp(STONE_EDGE, (1 - smoothstep(1.9, 2.3, Math.abs(r - RING_R))) * (fbm(x * 0.8, z * 0.8, 41) > 0.15 ? 0.6 : 0))
      c.lerp(STONE, (1 - smoothstep(PLAZA_R - 0.4, PLAZA_R + 0.6, r)) * 0.9)
      c.lerp(DIRT, smoothstep(0.9, 1, t))
      c.multiplyScalar(1 + fbm(x * 0.5, z * 0.5, 43) * 0.06)
    },
    false,
  )
  const bottom = radial(
    underside,
    (x, z, _y, c) => {
      const t = Math.hypot(x, z) / HUB_R
      c.copy(ROCK).lerp(ROCK_DEEP, 1 - t)
      c.lerp(ROOTS, smoothstep(0.78, 0.98, t) * 0.8)
      c.multiplyScalar(1 + fbm(x * 0.4, z * 0.4, 45) * 0.1)
    },
    true,
  )
  return { top, bottom }
}
