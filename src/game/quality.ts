// Quality tier: phones/tablets (coarse pointer or narrow viewport) skip the post stack,
// cap DPR at 1.5 and drop foot IK — the toon look survives all three.
export const LOW_END =
  typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900)
