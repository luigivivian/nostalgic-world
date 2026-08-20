import type { CollectionsIndex, CollectionManifest } from '../types'

export interface PoolTazo {
  collection: string
  label: string
  front: string
  back: string | null
}

// Random tazo pool for drops: one random disc collection per game session,
// paired items preferred (they flip with a real verso).
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

export async function loadTazoPool(): Promise<PoolTazo[]> {
  const index = await fetchJson<CollectionsIndex>('/collections/index.json')
  const discs = index.collections.filter((c) => c.shape === 'disc')
  const pick = discs[Math.floor(Math.random() * discs.length)]
  const manifest = await fetchJson<CollectionManifest>(`/collections/${pick.slug}/manifest.json`)
  const base = `/collections/${pick.slug}`
  const pool: PoolTazo[] = []
  for (const sec of manifest.sections) {
    if (sec.kind === 'gallery' && !/\bTAZOS?\b/.test(sec.title)) continue
    for (const it of sec.items) {
      pool.push({
        collection: manifest.name,
        label: it.label,
        front: `${base}/${it.front}`,
        back: it.back ? `${base}/${it.back}` : sec.sharedBack ? `${base}/${sec.sharedBack}` : null,
      })
    }
  }
  return pool.length > 0 ? pool : [{ collection: pick.name, label: '?', front: '', back: null }]
}

export function randomTazo(pool: PoolTazo[]): PoolTazo {
  return pool[Math.floor(Math.random() * pool.length)]
}
