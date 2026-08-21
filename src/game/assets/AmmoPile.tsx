import { SnackBag, BAG_H } from './SnackBag'

// Ammo pickup visual: three mini bags tipped into a pile. Same mesh and scans as the
// targets, so "ammo" reads as "more of those bags" without a new asset language.
// Base sits at y = 0, total height ~0.5 (a bag on its side plus one leaning on top).

const SMALL = 0.38
const PILE: { pos: [number, number, number]; rot: [number, number, number]; variant: number }[] = [
  { pos: [-0.11, 0.13, 0.03], rot: [-1.35, 0.35, 0.2], variant: 1 },
  { pos: [0.12, 0.12, -0.06], rot: [-1.5, -0.5, -0.25], variant: 2 },
  { pos: [0.0, 0.3, 0.02], rot: [-1.05, 0.15, 0.9], variant: 3 },
]

/** ~0.5 units tall; `slug` picks which collection's bags are lying there. */
export function AmmoPile({ slug, scale = 1 }: { slug: string; scale?: number }) {
  return (
    <group scale={scale}>
      {PILE.map((b, i) => (
        <group key={i} position={b.pos} rotation={b.rot}>
          {/* no outline pass: at 0.32 scale it doubles the draw calls for ~2px of ink */}
          <SnackBag slug={slug} variant={b.variant} scale={SMALL} outline={false} />
        </group>
      ))}
    </group>
  )
}

/** height of the pile, for callers that need to sit it on the ground */
export const AMMO_PILE_HEIGHT = BAG_H * SMALL * 1.3
