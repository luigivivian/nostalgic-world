import type { CollectionsIndex, CollectionManifest } from '../types'
import { curatedSections, sectionShape } from '../collectible/curation'
import type { Rarity } from './store'
import type { StationDef } from './stations'

export interface PoolTazo {
  collection: string
  label: string
  front: string
  back: string | null
}

export interface TazoPool {
  slug: string
  name: string
  year: number
  tazos: PoolTazo[]
  /** distinct items = the album denominator */
  poolSize: number
}

// All drop randomness goes through one seeded generator so the debug/test hooks and
// screenshot baselines are reproducible (see setDropSeed).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let rng = mulberry32(Date.now() >>> 0)
// Collection selection draws from its own stream: the shuffle consumes a number of
// draws that depends on index.json, which must not shift the in-round drop rolls.
let pickRng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0)

export function setDropSeed(seed: number) {
  rng = mulberry32(seed)
  pickRng = mulberry32((seed ^ 0x9e3779b9) >>> 0)
}

// Random tazo pool for drops: one random disc collection per game session,
// paired items preferred (they flip with a real verso).
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

export async function loadTazoPool(): Promise<TazoPool> {
  const index = await fetchJson<CollectionsIndex>('/collections/index.json')
  // Shuffle the disc collections and take the first one that actually yields tazos —
  // a "disc" collection can curate down to cards only (spacejam), and an empty pool
  // would mean a textureless drop.
  const discs = index.collections.filter((c) => c.shape === 'disc')
  for (let i = discs.length - 1; i > 0; i--) {
    const j = Math.floor(pickRng() * (i + 1))
    ;[discs[i], discs[j]] = [discs[j], discs[i]]
  }
  for (const pick of discs) {
    let manifest: CollectionManifest
    try {
      manifest = await fetchJson<CollectionManifest>(`/collections/${pick.slug}/manifest.json`)
    } catch (e) {
      console.warn('tazo pool: skipping collection', pick.slug, e instanceof Error ? e.message : String(e))
      continue
    }
    const base = `/collections/${pick.slug}`
    const tazos: PoolTazo[] = []
    // Same curation as the acervo (strict: no empty-collection fallback, which would let
    // packaging photos through), and discs only — the pickup mesh is a tazo.
    for (const sec of curatedSections(manifest, pick.slug, false)) {
      if (sectionShape(pick.slug, sec, manifest.shape) !== 'disc') continue
      for (const it of sec.items) {
        tazos.push({
          collection: manifest.name,
          label: it.label,
          front: `${base}/${it.front}`,
          back: it.back ? `${base}/${it.back}` : sec.sharedBack ? `${base}/${sec.sharedBack}` : null,
        })
      }
    }
    if (tazos.length === 0) continue
    return {
      slug: pick.slug,
      name: pick.name,
      year: pick.year,
      tazos,
      poolSize: new Set(tazos.map((t) => t.front)).size,
    }
  }
  throw new Error('no disc collection with tazos found')
}

export function randomTazo(pool: PoolTazo[]): PoolTazo {
  return pool[Math.floor(rng() * pool.length)]
}

/** Drop table: better stations pay better. Legendary is rolled before rare. */
export function rollRarity(station: StationDef): Rarity {
  const r = rng()
  if (r < station.legendary) return 'legendary'
  if (r < station.legendary + station.rare) return 'rare'
  return 'common'
}
