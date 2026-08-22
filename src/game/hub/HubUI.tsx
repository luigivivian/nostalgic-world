import { useEffect, useState } from 'react'
import { BIOMES, type BiomeId } from '../biomes'
import { useIsTouch } from '../ui/hooks'
import { TouchControls } from '../ui/TouchControls'
import { BackIcon } from '../ui/icons'
import '../ui/game-ui.css'

/** DOM layer over the hub canvas: title, the walk hint, the nearest portal card, fade. */
export function HubUI({ near, entering, onExit }: { near: BiomeId | null; entering: BiomeId | null; onExit: () => void; portals: BiomeId[] }) {
  const isTouch = useIsTouch()
  const [hint, setHint] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 9000)
    return () => clearTimeout(t)
  }, [])
  const card = entering ?? near
  return (
    <div className={`game-ui hub-ui${isTouch ? ' is-touch' : ''}`} data-phase="playing">
      <div className="hub-title">
        <span className="panel-kicker">Nostalgic World</span>
        <h1>Jardim do Céu</h1>
      </div>
      {hint && !card && <p className="hub-hint">{isTouch ? 'Ande até um portal para escolher a fase' : 'Clique para mirar · WASD anda · ande até um portal'}</p>}
      {card && (
        <div className={`hub-card${entering ? ' is-entering' : ''}`}>
          <span className="panel-kicker">{entering ? 'Entrando' : 'Portal'}</span>
          <strong>{BIOMES[card].name}</strong>
          <span className="hub-card-blurb">{BIOMES[card].blurb}</span>
        </div>
      )}
      <button className="ui-btn back-btn hub-back" type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onExit}>
        <BackIcon className="btn-icon" /> Voltar ao acervo
      </button>
      {isTouch && <TouchControls />}
      <div className={`hub-fade${entering ? ' is-on' : ''}`} />
    </div>
  )
}
