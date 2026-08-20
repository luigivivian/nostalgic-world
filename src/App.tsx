import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CollectibleViewer } from './collectible/CollectibleViewer'
import type { CollectibleShape } from './collectible/Collectible'
import type { CollectionsIndex, CollectionManifest, ManifestItem, ManifestSection } from './types'

// Game pulls in rapier (wasm) — keep it out of the acervo bundle.
const Game = lazy(() => import('./game/Game'))

function Home({
  index,
  onOpen,
  onPlay,
}: {
  index: CollectionsIndex
  onOpen: (slug: string) => void
  onPlay: () => void
}) {
  return (
    <div className="home">
      <h1>Nostalgic World</h1>
      <p className="subtitle">Coleções Elma Chips — acervo virtual</p>
      <button className="play-btn" onClick={onPlay}>
        ▶ Jogar — Ilha Nostálgica
      </button>
      {index.categories.map((cat) => (
        <section key={cat.key}>
          <h2>{cat.label}</h2>
          <div className="collection-grid">
            {index.collections
              .filter((c) => c.category === cat.key)
              .map((c) => (
                <button key={c.slug} className="collection-card" onClick={() => onOpen(c.slug)}>
                  <span className="year">{c.year}</span>
                  <span className="name">{c.name}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
      <p className="credit">
        Imagens: <a href="https://www.elmachipscolecoes.com.br">elmachipscolecoes.com.br</a>
      </p>
    </div>
  )
}

// Only collectible sections are shown; accessory galleries (packaging, posters, tarjas,
// kits, albums...) stay in the manifests — Phase 3 reuses EMBALAGEM for bag textures —
// but are hidden here. Paired/shared-back sections are collectibles by construction;
// galleries only when the title names one (uefa/pacman tazos, montáveis, stamps).
// Accessory titles start with their kind on the site ("TARJA: ...", "EMBALAGEM: ..."),
// so the blacklist is anchored — "SILVER STIX / EMBALAGEM ROXA" (a collectible) survives
// while "EMBALAGEM: CONTÉM 1 TAZO" does not. Pure-numeric titles ("3 + 6 + 6", "60 x 2")
// are the site's collectible-count sections.
const HIDDEN_SECTION =
  /^(TARJA|EMBALAGE|LOTES|P[ÔO]STER|PROPAGANDA|VALE|LANCHINHO|PORTA|TAPE|KIT|CAIXA|BALDE|FICH[ÁA]RIO|[ÁA]LBUM|ARENA|JOGO|COMERCIAL)/
const NUMERIC_TITLE = /^[\d\s+xX()]+$/
const COLLECTIBLE_GALLERY = /TAZO|MONT[ÁA]VE|STAMP|ADESIVO|SPINER|CARD|CARTA|FIGURINHA|STICKER|STIX/
// Manual per-collection overrides (section keys) for accessory sections the generic
// rules can't tell apart — e.g. tinytoon "5 + 2" is porta-tazo photos, not tazos.
const HIDDEN_BY_SLUG: Record<string, string[]> = {
  tinytoon: ['5-2'], // porta-tazo photos
  maskara: ['pega-tazo', '6-6', '2-2'], // launcher toy + its photo sets
  yugiohmagic: ['1-2', '1-1'],
  yugiohmetal: ['1-12'],
  liga: ['stamp-adesivos'],
  filhotes: ['figurinha-cinza', 'figurinhas-cinzas-quadradas-toddynho'],
  funki: ['puf-sticker', 'mega-sticker', '7-x-7'],
  tecnofun: ['27-x-3'],
}
// Item-level hides: stray non-collectible photos inside otherwise good sections.
const HIDDEN_ITEM_LABELS: Record<string, Record<string, RegExp>> = {
  fonemania: { 'drop-sticker': /^2006\./ },
  natal: { tazo: /^TAZO( - EMBALAGEM)?$/ },
}
// Display renames and per-section shape fixes (site titles/shapes don't always match
// the physical collectible — joken tazos are rounded squares, best read as cards).
const RENAMED_BY_SLUG: Record<string, Record<string, string>> = {
  filhotes: { '45-15': 'ADESIVOS' },
}
const SHAPE_BY_SLUG: Record<string, Record<string, CollectibleShape>> = {
  jokenpokemon: { '60-x-2': 'card' },
  tazolive: { '1-60': 'disc', '1-10': 'disc' },
  cbjr: { '3-6-6': 'card' },
  digimon: { digicartas: 'card' },
  spacejam: { 'figurinhas-cards': 'card' },
  mapa: { cards: 'card' },
}

function isCollectibleSection(s: ManifestSection, slug: string) {
  if (HIDDEN_BY_SLUG[slug]?.includes(s.key)) return false
  if (HIDDEN_SECTION.test(s.title)) return false
  if (s.kind !== 'gallery') return true
  return NUMERIC_TITLE.test(s.title) || COLLECTIBLE_GALLERY.test(s.title)
}

function CollectionView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [manifest, setManifest] = useState<CollectionManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sections = useMemo(() => {
    if (!manifest) return []
    const renamed = manifest.sections.map((s) => {
      const title = RENAMED_BY_SLUG[slug]?.[s.key]
      const hideItem = HIDDEN_ITEM_LABELS[slug]?.[s.key]
      const items = hideItem ? s.items.filter((i) => !hideItem.test(i.label)) : s.items
      return title || items !== s.items ? { ...s, title: title ?? s.title, items } : s
    })
    const visible = renamed.filter((s) => isCollectibleSection(s, slug) && s.items.length > 0)
    // defensive: never render an empty collection because the filter was too eager
    return visible.length > 0 ? visible : renamed.filter((s) => s.items.length > 0)
  }, [manifest, slug])

  useEffect(() => {
    setManifest(null)
    setError(null)
    setSelectedId(null)
    fetch(`/collections/${slug}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setManifest)
      .catch(() => setError(`Coleção ainda não baixada. Rode: npm run scrape ${slug}`))
  }, [slug])

  // Initial selection comes from the FILTERED sections — the manifest's literal first
  // item may be one the display rules hide (e.g. natal's packaging shots).
  useEffect(() => {
    if (selectedId || sections.length === 0) return
    const first = sections.find((s) => s.kind !== 'gallery') ?? sections[0]
    setSelectedId(first.items[0]?.id ?? null)
  }, [sections, selectedId])

  const selected = useMemo<{ item: ManifestItem; section: ManifestSection } | null>(() => {
    if (!selectedId) return null
    for (const s of sections) {
      const item = s.items.find((i) => i.id === selectedId)
      if (item) return { item, section: s }
    }
    return null
  }, [sections, selectedId])

  if (error)
    return (
      <div className="center-msg">
        <div>
          <p>{error}</p>
          <button className="back-btn" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
    )
  if (!manifest) return <div className="center-msg">Carregando coleção...</div>

  const base = `/collections/${slug}`
  // Newer pages list collectibles without front/back pairs (kind gallery); still render
  // those with a real shape — TAZO galleries as discs, CARTA/CARD galleries as cards
  // (the card mesh's corner rounding + UV inset hide the scanner's white margin, which
  // the flat photo print would show). Only true photo sections get the flat print.
  const shape: CollectibleShape = selected
    ? (SHAPE_BY_SLUG[slug]?.[selected.section.key] ??
      (selected.section.kind !== 'gallery'
        ? manifest.shape
        : /\bTAZOS?\b/.test(selected.section.title) && manifest.shape === 'disc'
          ? 'disc'
          : /CARTA|CARD/.test(selected.section.title)
            ? 'card'
            : 'photo'))
    : 'photo'
  const backUrl = selected
    ? selected.item.back
      ? `${base}/${selected.item.back}`
      : selected.section.sharedBack
        ? `${base}/${selected.section.sharedBack}`
        : null
    : null

  return (
    <div className="layout">
      <aside className="sidebar">
        <button className="back-btn" onClick={onBack}>
          ← Coleções
        </button>
        <h1>{manifest.name}</h1>
        <p className="subtitle">{manifest.year}</p>
        {sections.map((s) => (
            <section key={s.key}>
              <h2>
                {s.title} <span className="count">({s.items.length})</span>
              </h2>
              <div className="grid">
                {s.items.map((t) => (
                  <button
                    key={t.id}
                    title={t.label}
                    className={t.id === selectedId ? 'cell active' : 'cell'}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.number}
                  </button>
                ))}
              </div>
            </section>
          ))}
        <p className="credit">
          Imagens: <a href={manifest.source}>elmachipscolecoes.com.br</a>
        </p>
      </aside>
      <main className="stage">
        {selected && (
          <>
            <div className="tazo-info">
              <span className="badge">{selected.section.title}</span>
              <span className="tazo-number">{selected.item.label}</span>
            </div>
            <CollectibleViewer
              itemId={selected.item.id}
              shape={shape}
              frontUrl={`${base}/${selected.item.front}`}
              backUrl={backUrl}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const [index, setIndex] = useState<CollectionsIndex | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    fetch('/collections/index.json')
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex({ categories: [], collections: [] }))
  }, [])

  if (playing)
    return (
      <Suspense fallback={<div className="center-msg">Carregando ilha...</div>}>
        <Game onExit={() => setPlaying(false)} />
      </Suspense>
    )
  if (!index) return <div className="center-msg">Carregando...</div>
  if (!slug) return <Home index={index} onOpen={setSlug} onPlay={() => setPlaying(true)} />
  return <CollectionView slug={slug} onBack={() => setSlug(null)} />
}
