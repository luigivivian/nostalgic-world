import { describe, it, expect } from 'vitest'
import { createHubGeometry, hubHeight, HUB_R, RING_R, PLAZA_R } from '../hub/hubIsland'

// The sky garden is a radial mesh the player walks on: the promenade must be flat enough
// for the portals, the plaza flat for the tree, and the rim must roll down, not up.
describe('hub island', () => {
  it('is a closed radial mesh with a walkable top', () => {
    const { top, bottom } = createHubGeometry()
    expect(top.index!.count % 3).toBe(0)
    expect(bottom.index!.count % 3).toBe(0)
    const pos = top.attributes.position
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getY(i))).toBe(true)
  })

  it('keeps the portal promenade level and the plaza flat', () => {
    const ringY = hubHeight(RING_R, 0)
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      expect(Math.abs(hubHeight(Math.cos(a) * RING_R, Math.sin(a) * RING_R) - ringY)).toBeLessThan(0.05)
    }
    const plazaY = hubHeight(0, 0)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      const r = PLAZA_R * 0.8
      expect(Math.abs(hubHeight(Math.cos(a) * r, Math.sin(a) * r) - plazaY)).toBeLessThan(0.05)
    }
  })

  it('rolls off at the rim and keeps the underside below the top', () => {
    expect(hubHeight(HUB_R, 0)).toBeLessThan(hubHeight(HUB_R * 0.85, 0))
    const { top, bottom } = createHubGeometry()
    const tp = top.attributes.position
    const bp = bottom.attributes.position
    // same vertex layout: ring i, segment j — every underside vertex sits at or below its top twin
    for (let i = 0; i < tp.count; i += 97) expect(bp.getY(i)).toBeLessThanOrEqual(tp.getY(i) + 1e-6)
  })
})
