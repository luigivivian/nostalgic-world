import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTazoPool, setDropSeed } from '../tazoPool'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, '../../../public')

// Collections whose "disc" curated sections are all empty (see
// src/collectible/__tests__/curation.test.ts): loadTazoPool must skip these when
// picking a random disc collection, never return one as the drop pool.
const ZERO_DISC_SLUGS = new Set([
  'spacejam',
  'mapa',
  'digimon',
  'jokenpokemon',
  'liga',
  'filhotes',
  'fonemania',
  'funki',
  'cbjr',
  'tecnofun',
])

const originalFetch = global.fetch

function fsFetch(url: string): Promise<Response> {
  // loadTazoPool only ever requests absolute paths under /collections/...
  const rel = url.replace(/^\/collections\//, '')
  const filePath = path.join(PUBLIC_DIR, 'collections', rel)
  if (!fs.existsSync(filePath)) {
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error(`not found: ${filePath}`)
      },
    } as Response)
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
  } as Response)
}

beforeEach(() => {
  global.fetch = fsFetch as typeof fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('loadTazoPool', () => {
  it('seed 1: returns a pool with poolSize >= 1 and real front image files', async () => {
    setDropSeed(1)
    const pool = await loadTazoPool()
    expect(pool.poolSize).toBeGreaterThanOrEqual(1)
    expect(pool.tazos.length).toBeGreaterThanOrEqual(1)
    for (const tazo of pool.tazos) {
      expect(tazo.front.startsWith('/collections/')).toBe(true)
      const filePath = path.join(PUBLIC_DIR, tazo.front)
      expect(fs.existsSync(filePath)).toBe(true)
      if (tazo.back) {
        expect(tazo.back.startsWith('/collections/')).toBe(true)
        expect(fs.existsSync(path.join(PUBLIC_DIR, tazo.back))).toBe(true)
      }
    }
  })

  it('never returns a zero-disc-section collection, across many seeds', async () => {
    for (let seed = 1; seed <= 25; seed++) {
      setDropSeed(seed)
      const pool = await loadTazoPool()
      expect(ZERO_DISC_SLUGS.has(pool.slug)).toBe(false)
      expect(pool.poolSize).toBeGreaterThanOrEqual(1)
    }
  })
})
