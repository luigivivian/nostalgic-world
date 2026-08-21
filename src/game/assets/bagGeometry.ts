import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fbm } from '../noise'

// Procedural "pillow pack": the shape a 90s Elma Chips bag actually has — a flat
// crimped seam top and bottom, a fat rounded middle, soft side edges and a crumpled
// foil surface. A box would read as a crate; the silhouette is what sells the target.

export const BAG_W = 0.8
export const BAG_H = 1.2
export const BAG_D = 0.35
/** printed face aspect — the cover crop matches the scan to this */
export const BAG_FACE_ASPECT = BAG_W / BAG_H

const ROWS = 13 // height segments
const HALF_COLS = 13 // segments per half ring (front, back)
const SEAM = 0.075 // crimp fin height
const FIN_TEETH = 16

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** how much depth the pillow has at height t: 0 at the seams, 1 in the belly */
const bulge = (t: number) => smoothstep(0.0, 0.22, t) * smoothstep(1.0, 0.78, t)

/** superellipse-ish sign-preserving power: flattens the printed face, rounds the edges */
const soft = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e)

function ringGeometry(variant: number): THREE.BufferGeometry {
  // columns: front half (a: 0..PI) then back half (a: PI..2PI), with the two side
  // seams duplicated so the planar UV can flip between the faces without a stretch.
  const cols: { a: number; back: boolean }[] = []
  for (let j = 0; j <= HALF_COLS; j++) cols.push({ a: (j / HALF_COLS) * Math.PI, back: false })
  for (let j = 0; j <= HALF_COLS; j++) cols.push({ a: Math.PI + (j / HALF_COLS) * Math.PI, back: true })

  const C = cols.length
  const pos = new Float32Array((ROWS + 1) * C * 3)
  const uv = new Float32Array((ROWS + 1) * C * 2)
  const seed = 31 + variant * 17

  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS
    const y = -BAG_H / 2 + t * BAG_H
    const d = bulge(t)
    for (let c = 0; c < C; c++) {
      const { a, back } = cols[c]
      const nx = soft(Math.cos(a), 0.55)
      const nz = soft(Math.sin(a), 0.55)
      let x = (BAG_W / 2) * nx
      let z = (BAG_D / 2) * d * nz
      // crumple: fbm along the surface + a fine vertical wrinkle, damped at the seams
      const crumple = (fbm(x * 6 + variant * 5, y * 6, seed, 3) * 0.016 + Math.sin(y * 26 + a * 4) * 0.004) * d
      x += nx * crumple
      z += nz * crumple * 1.4
      const i = r * C + c
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      // planar projection per face, mirrored on the back like a real print
      uv[i * 2] = back ? 0.5 - x / BAG_W : 0.5 + x / BAG_W
      uv[i * 2 + 1] = t
    }
  }

  const index: number[] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < C - 1; c++) {
      // skip the degenerate quad that would bridge the front and back UV islands
      if (c === HALF_COLS) continue
      const a = r * C + c
      const b = a + 1
      const d2 = a + C
      const e = d2 + 1
      index.push(a, d2, b, b, d2, e)
    }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo.toNonIndexed()
}

/** flat crimped fin with a zigzag edge, extruded thin */
function finGeometry(top: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const half = BAG_W / 2
  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  // serrated outer edge
  for (let i = FIN_TEETH; i >= 0; i--) {
    const x = -half + (i / FIN_TEETH) * BAG_W
    shape.lineTo(x, i % 2 === 0 ? SEAM : SEAM * 0.7)
  }
  shape.lineTo(-half, 0)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false, curveSegments: 1 })
  geo.translate(0, 0, -0.011)
  if (!top) geo.rotateZ(Math.PI)
  geo.translate(0, top ? BAG_H / 2 - 0.012 : -BAG_H / 2 + 0.012, 0)

  // print continues onto the crimp: planar UV, clamped to the top/bottom of the scan
  const p = geo.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    uv[i * 2] = 0.5 + x / BAG_W
    uv[i * 2 + 1] = Math.min(1, Math.max(0, 0.5 + y / BAG_H))
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo.toNonIndexed()
}

const cache = new Map<number, THREE.BufferGeometry>()

/**
 * 1.2 tall x 0.8 wide x 0.35 deep, centred at the origin, +Y up, printed face to +Z.
 * `variant` only changes the crumple seed, so geometries are shared per variant.
 */
export function bagGeometry(variant = 0): THREE.BufferGeometry {
  const key = variant % 8
  const hit = cache.get(key)
  if (hit) return hit
  // normals come from the parts (smooth on the pillow, flat on the fins) — a merged
  // computeVertexNormals() would facet the whole bag, since the merge is non-indexed.
  const merged = mergeGeometries([ringGeometry(key), finGeometry(true), finGeometry(false)], false)
  merged.computeBoundingSphere()
  cache.set(key, merged)
  return merged
}
