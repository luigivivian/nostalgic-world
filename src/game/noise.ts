// Seeded 2D value-noise fbm — deterministic island every load, no dependency.
// Inspired by the three.js procedural terrain example (fbm over smooth noise).

function hash(ix: number, iy: number, seed: number) {
  let h = ix * 374761393 + iy * 668265263 + seed * 1442695040888963407
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  // map to [0, 1)
  return (h >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash(ix, iy, seed)
  const b = hash(ix + 1, iy, seed)
  const c = hash(ix, iy + 1, seed)
  const d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** fbm in [-1, 1], `octaves` layers of value noise. */
export function fbm(x: number, y: number, seed: number, octaves = 5) {
  let sum = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * (valueNoise(x * freq, y * freq, seed + o * 101) * 2 - 1)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}
