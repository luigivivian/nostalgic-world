import { useRef, useState } from 'react'
import { useGame, type Rarity } from '../store'
import { useGameEvent, useTimers } from './hooks'

const LIFE_MS = 2600
const MAX = 3

type Toast = { id: number; title: string; sub?: string; rarity: Rarity | 'station' }

function tazoName(label: string) {
  return /^\d+$/.test(label) ? `Tazo ${label}` : label
}

/** Centre-top event strip: what just dropped, what just opened up. */
export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const id = useRef(0)
  const setTimer = useTimers()

  const push = (t: Omit<Toast, 'id'>) => {
    const next = { ...t, id: ++id.current }
    setToasts((list) => [...list, next].slice(-MAX))
    setTimer(() => setToasts((list) => list.filter((x) => x.id !== next.id)), LIFE_MS)
  }

  useGameEvent((e) => {
    if (e.type === 'collect') {
      push(
        e.isNew
          ? { title: 'NOVO!', sub: tazoName(e.tazo.label), rarity: e.rarity }
          : { title: tazoName(e.tazo.label), sub: 'repetido', rarity: e.rarity },
      )
    }
    if (e.type === 'stationCleared') {
      // "estação limpa" instead of "liberado/liberada": station names have mixed
      // gender (a Praia, o Bosque) and the noun keeps the agreement correct.
      const st = useGame.getState().stations.find((s) => s.id === e.stationId)
      push({ title: st?.name ?? 'Estação', sub: 'estação limpa', rarity: 'station' })
    }
  })

  return (
    <div className="hud-toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast rarity-${t.rarity}`}>
          <span className="toast-title">{t.title}</span>
          {t.sub && <span className="toast-sub">{t.sub}</span>}
        </div>
      ))}
    </div>
  )
}

/** Non-blocking celebration when the last missing tazo lands. */
export function AlbumBanner() {
  const [on, setOn] = useState(false)
  const setTimer = useTimers()
  useGameEvent((e) => {
    if (e.type !== 'albumComplete') return
    setOn(true)
    setTimer(() => setOn(false), 4000)
  })
  if (!on) return null
  return (
    <div className="album-banner">
      <span className="banner-kicker">Álbum completo</span>
      <span className="banner-title">Você achou todos os tazos!</span>
    </div>
  )
}
