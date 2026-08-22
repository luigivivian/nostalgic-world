import { activeBiome } from '../biomes'
import { useMemo } from 'react'
import { useGame } from '../store'
import { ProgressRing } from './AlbumCluster'
import { BackIcon, PlayIcon } from './icons'

const MAX_THUMBS = 24

function stop(e: React.PointerEvent) {
  // the game root starts/restarts a round on any bubbled pointerdown
  e.stopPropagation()
}

function BackButton({ onExit }: { onExit: () => void }) {
  return (
    <button className="ui-btn ghost" type="button" onPointerDown={stop} onClick={onExit}>
      <BackIcon className="btn-icon" />
      Voltar ao acervo
    </button>
  )
}

function CollectionLine() {
  const collection = useGame((s) => s.collection)
  const have = useGame((s) => Object.keys(s.album).length)
  const total = useGame((s) => s.collection?.poolSize ?? 0)
  return (
    <div className="panel-collection">
      <div className="album-badge">
        <span className="badge-year">{collection?.year ?? '—'}</span>
        <span className="badge-name">{collection?.name ?? 'Carregando coleção...'}</span>
      </div>
      <div className="panel-progress">
        <ProgressRing have={have} total={total} size={56} />
        <span className="num">
          {have}
          <span className="slash">/</span>
          {total}
        </span>
      </div>
    </div>
  )
}

/** idle: the only screen that lets pointerdown through — the root starts the round. */
export function StartPanel({ onExit, isTouch }: { onExit: () => void; isTouch: boolean }) {
  return (
    <div className="ui-scrim is-open">
      <div className="ui-panel start-panel">
        <span className="panel-kicker">Fase · {activeBiome().name}</span>
        <h1 className="panel-title">Ilha Nostálgica</h1>
        <CollectionLine />
        <p className="panel-cta">{isTouch ? 'Toque para jogar' : 'Clique para jogar'}</p>
        <ul className="legend">
          {isTouch ? (
            <>
              <li>
                <span className="legend-key">Analógico</span> andar
              </li>
              <li>
                <span className="legend-key">Arraste</span> mirar
              </li>
              <li>
                <span className="legend-key">Botão</span> atirar
              </li>
              <li>
                <span className="legend-key">Seta</span> pular
              </li>
            </>
          ) : (
            <>
              <li>
                <span className="legend-key">W A S D</span> andar
              </li>
              <li>
                <span className="legend-key">Shift</span> correr
              </li>
              <li>
                <span className="legend-key">Espaço</span> pular
              </li>
              <li>
                <span className="legend-key">V</span> 1ª / 3ª pessoa
              </li>
              <li>
                <span className="legend-key">Mouse</span> mirar
              </li>
              <li>
                <span className="legend-key">Clique</span> atirar
              </li>
            </>
          )}
        </ul>
        <BackButton onExit={onExit} />
      </div>
    </div>
  )
}

export function PausePanel({ onExit, isTouch }: { onExit: () => void; isTouch: boolean }) {
  return (
    <div className="ui-scrim is-open is-blocking" onPointerDown={stop}>
      <div className="ui-panel pause-panel">
        <h2 className="panel-title">Pausado</h2>
        <p className="panel-sub">{isTouch ? 'Toque em Continuar para voltar' : 'Esc volta ao jogo'}</p>
        <div className="panel-actions">
          <button
            className="ui-btn primary"
            type="button"
            onPointerDown={stop}
            onClick={() => useGame.getState().setPhase('playing')}
          >
            <PlayIcon className="btn-icon" />
            Continuar
          </button>
          <BackButton onExit={onExit} />
        </div>
      </div>
    </div>
  )
}

export function RoundOverPanel({ onExit }: { onExit: () => void }) {
  const score = useGame((s) => s.score)
  const bestCombo = useGame((s) => s.bestCombo)
  const album = useGame((s) => s.album)
  const stations = useGame((s) => s.stations)
  const have = Object.keys(album).length
  const total = useGame((s) => s.collection?.poolSize ?? 0)

  const found = useMemo(
    () => Object.values(album).sort((a, b) => b.firstAt - a.firstAt),
    [album],
  )
  const shown = found.slice(0, MAX_THUMBS)
  const rest = found.length - shown.length
  const cleared = stations.filter((s) => s.targetsLeft === 0).length

  return (
    <div className="ui-scrim is-open is-blocking" onPointerDown={stop}>
      <div className="ui-panel over-panel">
        <span className="panel-kicker">Fim da rodada</span>
        <div className="over-score">
          <strong className="num">{score.toLocaleString('pt-BR')}</strong>
          <span>pontos</span>
        </div>
        <div className="over-stats">
          <div className="stat">
            <span className="stat-value num">x{bestCombo}</span>
            <span className="stat-label">melhor combo</span>
          </div>
          <div className="stat">
            <span className="stat-value num">
              {cleared}
              <span className="slash">/</span>
              {stations.length}
            </span>
            <span className="stat-label">estações</span>
          </div>
          <div className="stat stat-ring">
            <ProgressRing have={have} total={total} size={52} />
            <span className="stat-label">
              {have}
              <span className="slash">/</span>
              {total} no álbum
            </span>
          </div>
        </div>

        {shown.length > 0 && (
          <div className="over-grid">
            {shown.map((e) => (
              <span key={e.tazo.front} className={`over-thumb rarity-${e.rarity}`}>
                <img src={e.tazo.front} alt={e.tazo.label} draggable={false} />
                {e.count > 1 && <span className="thumb-count num">{e.count}</span>}
              </span>
            ))}
            {rest > 0 && <span className="over-thumb more num">+{rest}</span>}
          </div>
        )}

        <div className="panel-actions">
          <button
            className="ui-btn primary"
            type="button"
            onPointerDown={stop}
            onClick={() => window.dispatchEvent(new CustomEvent('game:restart'))}
          >
            <PlayIcon className="btn-icon" />
            Jogar de novo
          </button>
          <BackButton onExit={onExit} />
        </div>
      </div>
    </div>
  )
}
