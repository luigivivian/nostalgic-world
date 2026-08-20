import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseCollectionAuto, transformUrl, originalUrl, slugifySection } from '../parse.mjs'

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const bySections = (r) => Object.fromEntries(r.sections.map((s) => [s.key, s]))

describe('parseCollectionAuto on real /looney page (paired tazos)', () => {
  let sections
  beforeAll(async () => {
    const html = await readFile(path.join(fixtures, 'looney.html'), 'utf8')
    sections = bySections(parseCollectionAuto(html, 'looney'))
  })

  it('finds the three official paired sections with page-declared counts (40/20/20)', () => {
    const tazo = sections['tazo-verso-amarelo-1-ponto']
    const sup = sections['super-tazo-verso-azul-2-pontos']
    const mega = sections['mega-tazo-verso-verde-3-pontos']
    for (const [sec, count, points] of [
      [tazo, 40, 1],
      [sup, 20, 2],
      [mega, 20, 3],
    ]) {
      expect(sec.kind).toBe('paired')
      expect(sec.items.length).toBe(count)
      expect(sec.expected).toBe(count)
      expect(sec.points).toBe(points)
      expect(sec.anomalies).toEqual([])
    }
  })

  it('official tazo numbers are contiguous 1-80 across the three sections', () => {
    const nums = [
      ...sections['tazo-verso-amarelo-1-ponto'].items,
      ...sections['super-tazo-verso-azul-2-pontos'].items,
      ...sections['mega-tazo-verso-verde-3-pontos'].items,
    ].map((t) => t.number)
    expect(nums).toEqual(Array.from({ length: 80 }, (_, i) => i + 1))
  })

  it('paired items have distinct front/back, unique across sections', () => {
    const all = Object.values(sections)
      .filter((s) => s.kind === 'paired')
      .flatMap((s) => s.items)
    const files = all.flatMap((t) => [t.front, t.back]).filter(Boolean)
    expect(new Set(files).size).toBe(files.length)
  })

  it('captures gallery sections (packaging, posters) with items', () => {
    const galleries = Object.values(sections).filter((s) => s.kind === 'gallery')
    expect(galleries.length).toBeGreaterThan(5)
    expect(galleries.every((s) => s.items.every((i) => i.front && i.back === null))).toBe(true)
  })
})

describe('parseCollectionAuto on real /starwars page (cards with shared back)', () => {
  let sections
  beforeAll(async () => {
    const html = await readFile(path.join(fixtures, 'starwars.html'), 'utf8')
    sections = bySections(parseCollectionAuto(html, 'starwars'))
  })

  it('detects the CARDS section as shared-back with 40 items matching page count', () => {
    const cards = sections['cards']
    expect(cards.kind).toBe('shared-back')
    expect(cards.items.length).toBe(40)
    expect(cards.expected).toBe(40)
    expect(cards.sharedBack).toBeTruthy()
    expect(cards.items.every((i) => i.back === null)).toBe(true)
    expect(cards.anomalies).toEqual([])
  })

  it('card numbers are 1-40', () => {
    expect(sections['cards'].items.map((i) => i.number)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    )
  })
})

describe('parseCollectionAuto on real /cadê page (fronts run then backs run)', () => {
  let sections
  beforeAll(async () => {
    const html = await readFile(path.join(fixtures, 'cade.html'), 'utf8')
    sections = bySections(parseCollectionAuto(html, 'cade'))
  })

  it('pairs mirrored front/back runs into 30 tazos matching the page count', () => {
    const tazos = sections['tazos']
    expect(tazos.kind).toBe('paired')
    expect(tazos.items.length).toBe(30)
    expect(tazos.expected).toBe(30)
    expect(tazos.anomalies).toEqual([])
    expect(tazos.items.every((i) => i.back && i.back !== i.front)).toBe(true)
    expect(tazos.items.map((i) => i.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
  })

  it('does not misfire on the non-repeating 30 x 4 section', () => {
    const sec = sections['30-x-4']
    expect(sec.kind).toBe('gallery')
    expect(sec.items.length).toBe(30)
    expect(sec.items.every((i) => i.back === null)).toBe(true)
  })
})

describe('parseCollectionAuto on real /dbz page (4-image variant groups)', () => {
  let sections
  beforeAll(async () => {
    const html = await readFile(path.join(fixtures, 'dbz.html'), 'utf8')
    sections = bySections(parseCollectionAuto(html, 'dbz'))
  })

  it('splits groups of 4 into two front/back variants, keeping every scan', () => {
    const sec = sections['60-x-2']
    expect(sec.kind).toBe('paired')
    expect(sec.items.length).toBe(123)
    expect(sec.items.filter((i) => i.back).length).toBe(115)
    const files = sec.items.flatMap((i) => [i.front, i.back]).filter(Boolean)
    expect(new Set(files).size).toBe(files.length)
    // site alts have typos on 5 numbers (e.g. "2005.03.01.43-B") — every scan is still
    // kept as its own item, and all 60 real numbers are present
    const nums = new Set(sec.items.map((i) => i.number))
    for (let n = 1; n <= 60; n++) expect(nums.has(n)).toBe(true)
    expect(sec.anomalies.some((a) => a.reason === 'oversized group')).toBe(false)
  })
})

describe('url helpers', () => {
  it('builds original and sized transform URLs with fill/fit modes', () => {
    expect(originalUrl('x~mv2.jpg')).toBe('https://static.wixstatic.com/media/x~mv2.jpg')
    expect(transformUrl('x~mv2.jpg', 1024)).toBe(
      'https://static.wixstatic.com/media/x~mv2.jpg/v1/fill/w_1024,h_1024,q_90/img.jpg',
    )
    expect(transformUrl('x~mv2.jpg', 512, 'fit')).toBe(
      'https://static.wixstatic.com/media/x~mv2.jpg/v1/fit/w_512,h_512,q_90/img.jpg',
    )
  })
})

describe('slugifySection', () => {
  it('strips accents and symbols', () => {
    expect(slugifySection('TAZO (VERSO AMARELO - 1 PONTO)')).toBe('tazo-verso-amarelo-1-ponto')
    expect(slugifySection('PÔSTER / PROPAGANDAS')).toBe('poster-propagandas')
  })
})
