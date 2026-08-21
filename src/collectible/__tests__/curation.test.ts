import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { curatedSections, isCollectibleSection, sectionShape } from '../curation'
import type { CollectionManifest, CollectionsIndex, ManifestSection } from '../../types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COLLECTIONS_DIR = path.resolve(__dirname, '../../../public/collections')

function readManifest(slug: string): CollectionManifest {
  const raw = fs.readFileSync(path.join(COLLECTIONS_DIR, slug, 'manifest.json'), 'utf8')
  return JSON.parse(raw) as CollectionManifest
}

const index: CollectionsIndex = JSON.parse(
  fs.readFileSync(path.join(COLLECTIONS_DIR, 'index.json'), 'utf8'),
)

describe('curatedSections: real manifests', () => {
  it('looney: no accessory section (PORTA-TAZO/TAPE-TAZO/ÁLBUM/KIT/CAIXA/EMBALAGEM) survives', () => {
    const manifest = readManifest('looney')
    const sections = curatedSections(manifest, 'looney')
    expect(sections.length).toBeGreaterThan(0)
    const blacklist = /^(PORTA-TAZO|TAPE-TAZO|[ÁA]LBUM|KIT|CAIXA|EMBALAGEM)/
    for (const s of sections) {
      expect(s.title).not.toMatch(blacklist)
    }
  })

  it('spacejam: curates to non-empty sections, none of which is shape "disc"', () => {
    const manifest = readManifest('spacejam')
    expect(manifest.shape).toBe('disc')
    const sections = curatedSections(manifest, 'spacejam')
    expect(sections.length).toBeGreaterThan(0)
    for (const s of sections) {
      expect(sectionShape('spacejam', s, manifest.shape)).not.toBe('disc')
    }
  })

  it('funki: puf-sticker, mega-sticker, 7-x-7 are hidden', () => {
    const manifest = readManifest('funki')
    const keys = curatedSections(manifest, 'funki').map((s) => s.key)
    expect(keys).not.toContain('puf-sticker')
    expect(keys).not.toContain('mega-sticker')
    expect(keys).not.toContain('7-x-7')
  })

  it('filhotes: only section 45-15 survives, renamed to ADESIVOS', () => {
    const manifest = readManifest('filhotes')
    const sections = curatedSections(manifest, 'filhotes')
    expect(sections.length).toBe(1)
    expect(sections[0].key).toBe('45-15')
    expect(sections[0].title).toBe('ADESIVOS')
  })

  it('natal: tazo section has no item labels matching /^TAZO( - EMBALAGEM)?$/', () => {
    const manifest = readManifest('natal')
    const sections = curatedSections(manifest, 'natal')
    const tazo = sections.find((s) => s.key === 'tazo')
    expect(tazo).toBeDefined()
    for (const item of tazo!.items) {
      expect(item.label).not.toMatch(/^TAZO( - EMBALAGEM)?$/)
    }
  })

  it('fonemania drop-sticker: no items with label starting with "2006."', () => {
    const manifest = readManifest('fonemania')
    const sections = curatedSections(manifest, 'fonemania')
    const dropSticker = sections.find((s) => s.key === 'drop-sticker')
    expect(dropSticker).toBeDefined()
    for (const item of dropSticker!.items) {
      expect(item.label).not.toMatch(/^2006\./)
    }
  })

  it('defensive fallback: an all-hidden manifest still returns its non-empty sections', () => {
    const manifest: CollectionManifest = {
      slug: 'synthetic-all-hidden',
      name: 'Synthetic',
      year: null,
      category: null,
      shape: 'disc',
      source: '',
      scrapedAt: '',
      imageSize: 0,
      sections: [
        {
          key: 'embalagem',
          title: 'EMBALAGEM',
          kind: 'gallery',
          points: null,
          expected: null,
          sharedBack: null,
          items: [{ id: '1', number: 1, label: 'A', front: 'a.jpg', back: null }],
        },
        {
          key: 'poster',
          title: 'PÔSTER',
          kind: 'gallery',
          points: null,
          expected: null,
          sharedBack: null,
          items: [{ id: '2', number: 1, label: 'B', front: 'b.jpg', back: null }],
        },
        {
          key: 'empty-but-hidden',
          title: 'KIT',
          kind: 'gallery',
          points: null,
          expected: null,
          sharedBack: null,
          items: [],
        },
      ],
    }
    // sanity: every section is indeed hidden by isCollectibleSection
    for (const s of manifest.sections) {
      expect(isCollectibleSection(s, 'synthetic-all-hidden')).toBe(false)
    }
    const sections = curatedSections(manifest, 'synthetic-all-hidden')
    // falls back to all sections with items, dropping the truly empty one
    expect(sections.map((s) => s.key).sort()).toEqual(['embalagem', 'poster'])
  })
})

describe('isCollectibleSection', () => {
  it('hides accessory-prefixed titles regardless of slug', () => {
    const s: ManifestSection = {
      key: 'x',
      title: 'TARJA: TESTE',
      kind: 'gallery',
      points: null,
      expected: null,
      sharedBack: null,
      items: [],
    }
    expect(isCollectibleSection(s, 'anyslug')).toBe(false)
  })

  it('a non-gallery section is always collectible unless slug-hidden or prefix-hidden', () => {
    const s: ManifestSection = {
      key: 'x',
      title: 'ANYTHING GOES',
      kind: 'paired',
      points: null,
      expected: null,
      sharedBack: null,
      items: [],
    }
    expect(isCollectibleSection(s, 'anyslug')).toBe(true)
  })
})

describe('sectionShape', () => {
  it('jokenpokemon 60-x-2 -> card (manual override)', () => {
    const manifest = readManifest('jokenpokemon')
    const section = manifest.sections.find((s) => s.key === '60-x-2')!
    expect(section).toBeDefined()
    expect(sectionShape('jokenpokemon', section, manifest.shape)).toBe('card')
  })

  it('tazolive 1-60 -> disc (manual override)', () => {
    const manifest = readManifest('tazolive')
    const section = manifest.sections.find((s) => s.key === '1-60')!
    expect(section).toBeDefined()
    expect(sectionShape('tazolive', section, manifest.shape)).toBe('disc')
  })

  function gallerySection(title: string): ManifestSection {
    return {
      key: 'synthetic',
      title,
      kind: 'gallery',
      points: null,
      expected: null,
      sharedBack: null,
      items: [],
    }
  }

  it('a gallery titled "TAZOS ESPECIAIS" on a disc manifest -> disc', () => {
    expect(sectionShape('no-override-slug', gallerySection('TAZOS ESPECIAIS'), 'disc')).toBe('disc')
  })

  it('a gallery titled "CARDS" -> card', () => {
    expect(sectionShape('no-override-slug', gallerySection('CARDS'), 'disc')).toBe('card')
  })

  it('a gallery titled "PÔSTER" -> photo', () => {
    expect(sectionShape('no-override-slug', gallerySection('PÔSTER'), 'disc')).toBe('photo')
  })
})

describe('disc collections: how many curate to at least one disc section', () => {
  it('prints a table and reports collections with zero disc sections', () => {
    const discCollections = index.collections.filter((c) => c.shape === 'disc')
    const rows: { slug: string; discSections: number }[] = []
    for (const c of discCollections) {
      const manifest = readManifest(c.slug)
      const sections = curatedSections(manifest, c.slug)
      const discSections = sections.filter(
        (s) => sectionShape(c.slug, s, manifest.shape) === 'disc',
      ).length
      rows.push({ slug: c.slug, discSections })
    }

    // eslint-disable-next-line no-console
    console.table(rows)

    const withAtLeastOne = rows.filter((r) => r.discSections > 0)
    const withZero = rows.filter((r) => r.discSections === 0)
    // eslint-disable-next-line no-console
    console.log(
      `disc collections total=${rows.length} withAtLeastOneDiscSection=${withAtLeastOne.length} zero=${JSON.stringify(withZero.map((r) => r.slug))}`,
    )

    // index.json has 28 disc collections; the ones below are disc by category on the
    // site but curate down to cards/stickers/photos (no round scans) — the drop pool
    // skips them. Keep this list exact so a curation change that flips one is noticed.
    expect(withZero.map((r) => r.slug).sort()).toEqual(
      ['cbjr', 'digimon', 'filhotes', 'fonemania', 'funki', 'jokenpokemon', 'mapa', 'spacejam', 'tecnofun'].sort(),
    )
    expect(withAtLeastOne.length).toBe(rows.length - 9)
  })
})
