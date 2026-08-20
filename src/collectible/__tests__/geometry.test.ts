import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createTazoGeometry } from '../geometry'

function triangleAvgNz(norm: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, triStart: number) {
  return (norm.getZ(triStart) + norm.getZ(triStart + 1) + norm.getZ(triStart + 2)) / 3
}

describe('createTazoGeometry: structure', () => {
  it('returns a BufferGeometry with position/normal/uv attributes of consistent, divisible-by-3 count', () => {
    const geo = createTazoGeometry()
    expect(geo).toBeInstanceOf(THREE.BufferGeometry)

    const pos = geo.getAttribute('position')
    const norm = geo.getAttribute('normal')
    const uv = geo.getAttribute('uv')
    expect(pos).toBeDefined()
    expect(norm).toBeDefined()
    expect(uv).toBeDefined()

    expect(pos.count).toBe(norm.count)
    expect(pos.count).toBe(uv.count)
    expect(pos.count % 3).toBe(0)
    expect(geo.index).toBeNull()
  })
})

describe('createTazoGeometry: material groups', () => {
  it('has exactly 3 groups with materialIndex 0/1/2, contiguous, covering all vertices exactly once', () => {
    const geo = createTazoGeometry()
    const pos = geo.getAttribute('position')

    expect(geo.groups.length).toBe(3)

    const sorted = [...geo.groups].sort((a, b) => a.materialIndex! - b.materialIndex!)
    expect(sorted.map((g) => g.materialIndex)).toEqual([0, 1, 2])

    let expectedStart = 0
    for (const g of sorted) {
      expect(g.start).toBe(expectedStart)
      expect(g.count % 3).toBe(0)
      expectedStart += g.count
    }
    expect(expectedStart).toBe(pos.count)
  })
})

describe('createTazoGeometry: normal invariants per group', () => {
  it('front group (materialIndex 0) triangles all have avg normal z > 0.9', () => {
    const geo = createTazoGeometry()
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute
    const front = geo.groups.find((g) => g.materialIndex === 0)!
    for (let i = front.start; i < front.start + front.count; i += 3) {
      expect(triangleAvgNz(norm, i)).toBeGreaterThan(0.9)
    }
  })

  it('back group (materialIndex 1) triangles all have avg normal z < -0.9', () => {
    const geo = createTazoGeometry()
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute
    const back = geo.groups.find((g) => g.materialIndex === 1)!
    for (let i = back.start; i < back.start + back.count; i += 3) {
      expect(triangleAvgNz(norm, i)).toBeLessThan(-0.9)
    }
  })

  it('rim group (materialIndex 2) triangles all have avg normal z between -0.9 and 0.9', () => {
    const geo = createTazoGeometry()
    const norm = geo.getAttribute('normal') as THREE.BufferAttribute
    const rim = geo.groups.find((g) => g.materialIndex === 2)!
    expect(rim.count).toBeGreaterThan(0)
    for (let i = rim.start; i < rim.start + rim.count; i += 3) {
      const nz = triangleAvgNz(norm, i)
      expect(nz).toBeGreaterThanOrEqual(-0.9)
      expect(nz).toBeLessThanOrEqual(0.9)
    }
  })
})

describe('createTazoGeometry: UVs', () => {
  it('front/back cap UVs are within [0,1]', () => {
    const geo = createTazoGeometry()
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    for (const materialIndex of [0, 1]) {
      const g = geo.groups.find((gr) => gr.materialIndex === materialIndex)!
      for (let i = g.start; i < g.start + g.count; i++) {
        expect(uv.getX(i)).toBeGreaterThanOrEqual(0)
        expect(uv.getX(i)).toBeLessThanOrEqual(1)
        expect(uv.getY(i)).toBeGreaterThanOrEqual(0)
        expect(uv.getY(i)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('rim UVs are exactly (0,0)', () => {
    const geo = createTazoGeometry()
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    const rim = geo.groups.find((g) => g.materialIndex === 2)!
    for (let i = rim.start; i < rim.start + rim.count; i++) {
      expect(uv.getX(i)).toBe(0)
      expect(uv.getY(i)).toBe(0)
    }
  })

  it('back UVs are mirrored in U relative to front: a back vertex near +x has u < 0.5', () => {
    const geo = createTazoGeometry()
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    const back = geo.groups.find((g) => g.materialIndex === 1)!

    let maxX = -Infinity
    let maxXIdx = -1
    for (let i = back.start; i < back.start + back.count; i++) {
      const x = pos.getX(i)
      if (x > maxX) {
        maxX = x
        maxXIdx = i
      }
    }
    expect(maxXIdx).toBeGreaterThanOrEqual(0)
    expect(uv.getX(maxXIdx)).toBeLessThan(0.5)
  })

  it('front UVs are NOT mirrored: a front vertex near +x has u > 0.5', () => {
    const geo = createTazoGeometry()
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    const front = geo.groups.find((g) => g.materialIndex === 0)!

    let maxX = -Infinity
    let maxXIdx = -1
    for (let i = front.start; i < front.start + front.count; i++) {
      const x = pos.getX(i)
      if (x > maxX) {
        maxX = x
        maxXIdx = i
      }
    }
    expect(maxXIdx).toBeGreaterThanOrEqual(0)
    expect(uv.getX(maxXIdx)).toBeGreaterThan(0.5)
  })
})

describe('createTazoGeometry: option effects', () => {
  it('radius scales the bounding sphere roughly linearly (bsphere ≈ radius + bevel)', () => {
    const bevel = 0.012 // default
    for (const radius of [0.5, 1, 2]) {
      const geo = createTazoGeometry({ radius })
      geo.computeBoundingSphere()
      const r = geo.boundingSphere!.radius
      expect(r).toBeGreaterThan(radius)
      expect(r).toBeCloseTo(radius + bevel, 1)
    }
  })

  it('thickness increases z extent by the same amount', () => {
    const geoDefault = createTazoGeometry()
    geoDefault.computeBoundingBox()
    const extentDefault = geoDefault.boundingBox!.max.z - geoDefault.boundingBox!.min.z

    const geoThick = createTazoGeometry({ thickness: 0.1 })
    geoThick.computeBoundingBox()
    const extentThick = geoThick.boundingBox!.max.z - geoThick.boundingBox!.min.z

    expect(extentThick).toBeGreaterThan(extentDefault)
    expect(extentThick - extentDefault).toBeCloseTo(0.1 - 0.055, 2)
  })

  it('bevel increases z extent by 2x the bevel delta', () => {
    const geoDefault = createTazoGeometry()
    geoDefault.computeBoundingBox()
    const extentDefault = geoDefault.boundingBox!.max.z - geoDefault.boundingBox!.min.z

    const geoBevel = createTazoGeometry({ bevel: 0.03 })
    geoBevel.computeBoundingBox()
    const extentBevel = geoBevel.boundingBox!.max.z - geoBevel.boundingBox!.min.z

    expect(extentBevel).toBeGreaterThan(extentDefault)
    expect(extentBevel - extentDefault).toBeCloseTo(2 * (0.03 - 0.012), 2)
  })

  it('different notchDepth changes min radius of the front-cap silhouette', () => {
    function minFrontRadius(notchDepth: number) {
      const geo = createTazoGeometry({ notchDepth })
      const pos = geo.getAttribute('position') as THREE.BufferAttribute
      const front = geo.groups.find((g) => g.materialIndex === 0)!
      let minR = Infinity
      for (let i = front.start; i < front.start + front.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        minR = Math.min(minR, Math.sqrt(x * x + y * y))
      }
      return minR
    }

    const shallowR = minFrontRadius(0)
    const defaultR = minFrontRadius(0.032)
    const deepR = minFrontRadius(0.08)

    expect(shallowR).toBeCloseTo(1, 2)
    expect(defaultR).toBeCloseTo(1 - 0.032, 2)
    expect(deepR).toBeCloseTo(1 - 0.08, 2)
    expect(deepR).toBeLessThan(defaultR)
    expect(defaultR).toBeLessThan(shallowR)
  })
})

describe('createTazoGeometry: defaults', () => {
  it('default geometry has bounding sphere radius slightly more than 1 (radius + bevel)', () => {
    const geo = createTazoGeometry()
    geo.computeBoundingSphere()
    const r = geo.boundingSphere!.radius
    expect(r).toBeGreaterThan(1)
    expect(r).toBeCloseTo(1 + 0.012, 2)
  })

  it('default geometry z extent ≈ thickness + 2*bevel', () => {
    const geo = createTazoGeometry()
    geo.computeBoundingBox()
    const extent = geo.boundingBox!.max.z - geo.boundingBox!.min.z
    const expected = 0.055 + 2 * 0.012
    expect(extent).toBeCloseTo(expected, 3)
  })
})
