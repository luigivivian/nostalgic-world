import * as THREE from 'three'

interface CoreOptions {
  thickness: number
  bevel: number
  /** full width/height of the shape, used to normalize cap UVs */
  uvW: number
  uvH: number
  /** shrinks cap UVs so a scan's border falls outside the face */
  uvScale: number
}

// Shared core: extrudes a 2D outline, then re-buckets triangles into three material
// groups (0 = front cap, 1 = back cap, 2 = rim/bevel) with planar cap UVs so a scan
// maps 1:1 onto each face. Back UVs are mirrored in U, the same way a physical print
// reads when you flip the object.
function extrudeCollectible(pts: THREE.Vector2[], o: CoreOptions): THREE.BufferGeometry {
  const extruded = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: o.thickness,
    bevelEnabled: true,
    bevelThickness: o.bevel,
    bevelSize: o.bevel,
    bevelSegments: 2,
    curveSegments: 1,
  })
  extruded.translate(0, 0, -o.thickness / 2)

  // The bucketing below assumes 3 consecutive vertices = 1 triangle.
  const flat = extruded.index !== null ? extruded.toNonIndexed() : extruded
  const pos = flat.attributes.position
  const norm = flat.attributes.normal
  const triCount = pos.count / 3

  const buckets: Record<'front' | 'back' | 'rim', number[]> = { front: [], back: [], rim: [] }
  for (let f = 0; f < triCount; f++) {
    const nz = (norm.getZ(f * 3) + norm.getZ(f * 3 + 1) + norm.getZ(f * 3 + 2)) / 3
    buckets[nz > 0.9 ? 'front' : nz < -0.9 ? 'back' : 'rim'].push(f)
  }

  const newPos = new Float32Array(pos.count * 3)
  const newNorm = new Float32Array(pos.count * 3)
  const newUv = new Float32Array(pos.count * 2)
  const geo = new THREE.BufferGeometry()

  let vi = 0
  const keys = ['front', 'back', 'rim'] as const
  keys.forEach((key, materialIndex) => {
    const start = vi
    for (const f of buckets[key]) {
      for (let k = 0; k < 3; k++) {
        const src = f * 3 + k
        const x = pos.getX(src)
        const y = pos.getY(src)
        newPos.set([x, y, pos.getZ(src)], vi * 3)
        newNorm.set([norm.getX(src), norm.getY(src), norm.getZ(src)], vi * 3)
        const u = (x / o.uvW) * o.uvScale
        const v = 0.5 + (y / o.uvH) * o.uvScale
        if (key === 'front') newUv.set([0.5 + u, v], vi * 2)
        else if (key === 'back') newUv.set([0.5 - u, v], vi * 2)
        else newUv.set([0, 0], vi * 2)
        vi++
      }
    }
    geo.addGroup(start, vi - start, materialIndex)
  })

  geo.setAttribute('position', new THREE.BufferAttribute(newPos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(newUv, 2))
  geo.computeBoundingSphere()
  extruded.dispose()
  if (flat !== extruded) flat.dispose()
  return geo
}

export interface TazoGeometryOptions {
  radius?: number
  thickness?: number
  notches?: number
  notchDepth?: number
  /** angular width of each notch, in radians */
  notchArc?: number
  bevel?: number
  segments?: number
  uvScale?: number
}

// Classic tazo: cardboard disc with 8 shallow scalloped notches around the rim.
export function createTazoGeometry(opts: TazoGeometryOptions = {}): THREE.BufferGeometry {
  const {
    radius = 1,
    thickness = 0.055,
    notches = 8,
    notchDepth = 0.032,
    notchArc = 0.17,
    bevel = 0.012,
    segments = 384,
    uvScale = 0.96,
  } = opts

  const pts: THREE.Vector2[] = []
  const step = (Math.PI * 2) / notches
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const d = Math.abs(((t + step / 2) % step) - step / 2)
    const half = notchArc / 2
    let r = radius
    if (d < half) r -= notchDepth * 0.5 * (1 + Math.cos((d / half) * Math.PI))
    pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r))
  }
  return extrudeCollectible(pts, { thickness, bevel, uvW: 2 * radius, uvH: 2 * radius, uvScale })
}

export interface CardGeometryOptions {
  width?: number
  height?: number
  corner?: number
  thickness?: number
  bevel?: number
  uvScale?: number
}

function roundedRectPoints(w: number, h: number, r: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  const cx = w / 2 - r
  const cy = h / 2 - r
  const corners: Array<[number, number, number]> = [
    [cx, cy, 0],
    [-cx, cy, Math.PI / 2],
    [-cx, -cy, Math.PI],
    [cx, -cy, Math.PI * 1.5],
  ]
  for (const [ox, oy, start] of corners) {
    for (let i = 0; i <= 16; i++) {
      const a = start + (i / 16) * (Math.PI / 2)
      pts.push(new THREE.Vector2(ox + Math.cos(a) * r, oy + Math.sin(a) * r))
    }
  }
  return pts
}

export const CARD_FACE_ASPECT = 1.43 / 2

// Trading card: rounded rectangle in the classic 63x88mm proportion, thinner than a tazo.
export function createCardGeometry(opts: CardGeometryOptions = {}): THREE.BufferGeometry {
  const {
    width = 1.43,
    height = 2,
    corner = 0.09,
    thickness = 0.024,
    bevel = 0.006,
    uvScale = 0.985,
  } = opts
  return extrudeCollectible(roundedRectPoints(width, height, corner), {
    thickness,
    bevel,
    uvW: width,
    uvH: height,
    uvScale,
  })
}

// Unit photo "print" for gallery items (packaging, posters). Scale the mesh in x by the
// texture's aspect ratio at render time.
export function createPhotoGeometry(): THREE.BufferGeometry {
  return extrudeCollectible(roundedRectPoints(1, 1, 0.03), {
    thickness: 0.012,
    bevel: 0.004,
    uvW: 1,
    uvH: 1,
    uvScale: 1,
  })
}
