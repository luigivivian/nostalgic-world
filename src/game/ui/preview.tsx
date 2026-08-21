import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useGame, type StationState } from '../store'
import type { PoolTazo } from '../tazoPool'
import { GameUI } from './GameUI'

// Standalone harness for the DOM layer: the real store, the real components, a still
// frame of the island instead of a live Canvas. Drive it from Playwright through
// window.__uiPreview — no gameplay module is imported, so it cannot fight the game.

const COLLECTION = { slug: 'looney', name: 'Tazo Mania - Looney Tunes', year: 1997, poolSize: 40 }
const BG = '/game/ui-preview-bg.jpg'

const tazo = (n: number): PoolTazo => ({
  collection: COLLECTION.name,
  label: String(n),
  front: `/collections/looney/items/tazo-verso-amarelo-1-ponto-${String(n).padStart(3, '0')}-front.jpg`,
  back: null,
})

const stations = (): StationState[] => [
  { id: 'praia', name: 'Praia', tier: 1, pos: [0, 0, 28], targetsTotal: 6, targetsLeft: 2, unlocked: true },
  { id: 'bosque', name: 'Bosque', tier: 2, pos: [-26, 0, 4], targetsTotal: 6, targetsLeft: 6, unlocked: true },
  { id: 'mirante', name: 'Mirante', tier: 3, pos: [24, 0, -22], targetsTotal: 6, targetsLeft: 6, unlocked: false },
]

function reset() {
  const g = useGame.getState()
  g.resetGame()
  g.setCollection(COLLECTION)
  g.setStations(stations())
}

/** A round already in progress: spent ammo, a filling album, one station half done. */
function playing(collected = 7) {
  reset()
  const g = useGame.getState()
  g.startRound()
  for (let i = 0; i < 5; i++) g.tryShoot()
  for (let i = 1; i <= collected; i++) {
    g.collect(tazo(i), i % 7 === 0 ? 'legendary' : i % 3 === 0 ? 'rare' : 'common', [0, 0, 0])
  }
  useGame.setState({ score: 4820, combo: 0, bestCombo: 4 })
}

const scenes: Record<string, () => void> = {
  idle: reset,
  playing: () => playing(),
  paused: () => {
    playing()
    useGame.getState().setPhase('paused')
  },
  roundOver: () => {
    playing(21)
    useGame.setState({ ammo: 0, score: 12750, bestCombo: 6 })
    useGame.getState().endRound('ammo')
  },
  albumComplete: () => {
    playing()
    useGame.getState().emit({ type: 'albumComplete', at: performance.now() })
  },
  lowAmmo: () => {
    playing()
    useGame.setState({ ammo: 2 })
  },
}

const events: Record<string, () => void> = {
  shot: () => useGame.getState().tryShoot(),
  hit: () => useGame.getState().registerHit(1, 'praia', [0, 0, 0]),
  combo: () => {
    const g = useGame.getState()
    g.registerHit(1, 'praia', [0, 0, 0])
    g.registerHit(2, 'praia', [0, 0, 0])
    g.registerHit(3, 'praia', [0, 0, 0])
  },
  collectNew: () => useGame.getState().collect(tazo(31), 'common', [0, 0, 0]),
  collectRare: () => useGame.getState().collect(tazo(32), 'rare', [0, 0, 0]),
  collectRepeat: () => useGame.getState().collect(tazo(1), 'common', [0, 0, 0]),
  dryFire: () => {
    useGame.setState({ ammo: 0 })
    useGame.getState().tryShoot()
  },
  stationCleared: () => {
    useGame.getState().patchStation('bosque', { targetsLeft: 1 })
    useGame.getState().registerHit(9, 'bosque', [0, 0, 0])
  },
}

declare global {
  interface Window {
    __uiPreview?: {
      scene: (name: string) => void
      event: (name: string) => void
      state: () => ReturnType<typeof useGame.getState>
    }
  }
}

function Preview() {
  const [exits, setExits] = useState(0)
  useEffect(() => {
    reset()
    window.__uiPreview = {
      scene: (name) => scenes[name]?.(),
      event: (name) => events[name]?.(),
      state: () => useGame.getState(),
    }
    const restart = () => scenes.playing()
    window.addEventListener('game:restart', restart)
    return () => window.removeEventListener('game:restart', restart)
  }, [])

  // Mirrors Game.tsx: the round starts/resumes on any pointerdown that reaches the
  // game root, so this is also the test that the UI's own controls stop propagating.
  const onPointerDown = () => {
    const g = useGame.getState()
    if (g.phase === 'idle' || g.phase === 'roundOver') scenes.playing()
    else if (g.phase === 'paused') g.setPhase('playing')
  }

  return (
    <div className="preview-stage" onPointerDown={onPointerDown}>
      <img className="preview-bg" src={BG} alt="" />
      <GameUI onExit={() => setExits((n) => n + 1)} />
      <span id="exit-count" hidden>
        {exits}
      </span>
    </div>
  )
}

createRoot(document.getElementById('preview-root') as HTMLElement).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
