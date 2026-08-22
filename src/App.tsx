import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CollectibleViewer } from './collectible/CollectibleViewer'
import type { CollectibleShape } from './collectible/Collectible'
import { curatedSections, sectionShape } from './collectible/curation'
import type { CollectionsIndex, CollectionManifest, ManifestItem, ManifestSection } from './types'
import { biomeFromSearch, setBiome, type BiomeId } from './game/biomes'

// Game pulls in rapier (wasm) — keep it out of the acervo bundle.
const Game = lazy(() => import('./game/Game'))
const Hub = lazy(() => import('./game/hub/Hub'))

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
        ▶ Jogar — Jardim do Céu
      </button>
      <p className="biome-blurb">Seis ilhas: praia, deserto, neve, pântano, montanha e ruínas — escolha no portal</p>
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

function CollectionView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [manifest, setManifest] = useState<CollectionManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sections = useMemo(() => (manifest ? curatedSections(manifest, slug) : []), [manifest, slug])

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
  const shape: CollectibleShape = selected && manifest ? sectionShape(slug, selected.section, manifest.shape) : 'photo'
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
  // ?play opens an island directly, ?hub the sky garden (QA tooling: canvas inspector,
  // visual harness); ?biome=<id> picks the phase (set before the island module computes
  // any terrain). Normal flow: Home -> hub -> portal -> island -> back to the hub.
  const [screen, setScreen] = useState<'home' | 'hub' | 'play'>(() => {
    const q = new URLSearchParams(location.search)
    if (q.has('play')) {
      setBiome(biomeFromSearch(location.search))
      return 'play'
    }
    return q.has('hub') ? 'hub' : 'home'
  })
  const play = (biome: BiomeId) => {
    setBiome(biome)
    const url = new URL(location.href)
    url.searchParams.set('biome', biome)
    history.replaceState(null, '', url)
    setScreen('play')
  }

  useEffect(() => {
    fetch('/collections/index.json')
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex({ categories: [], collections: [] }))
  }, [])

  if (screen === 'play')
    return (
      <Suspense fallback={<div className="center-msg">Carregando ilha...</div>}>
        <Game onExit={() => setScreen('hub')} />
      </Suspense>
    )
  if (screen === 'hub')
    return (
      <Suspense fallback={<div className="center-msg">Carregando o Jardim do Céu...</div>}>
        <Hub onEnter={play} onExit={() => setScreen('home')} />
      </Suspense>
    )
  if (!index) return <div className="center-msg">Carregando...</div>
  if (!slug) return <Home index={index} onOpen={setSlug} onPlay={() => setScreen('hub')} />
  return <CollectionView slug={slug} onBack={() => setSlug(null)} />
}
