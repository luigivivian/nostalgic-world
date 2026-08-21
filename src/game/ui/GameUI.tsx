import { useGame } from '../store'
import { AlbumCluster } from './AlbumCluster'
import { CombatCluster } from './CombatCluster'
import { Crosshair } from './Crosshair'
import { PausePanel, RoundOverPanel, StartPanel } from './Panels'
import { StationTracker } from './StationTracker'
import { AlbumBanner, Toasts } from './Toasts'
import { TouchControls } from './TouchControls'
import { useIsTouch } from './hooks'
import './game-ui.css'

/**
 * The whole DOM layer of the game: HUD, event feedback, modal states and touch
 * controls. Mount it as a sibling of the <Canvas> inside `.game-root`.
 *
 * It never decides anything — every value comes from `useGame`, and the only writes
 * are the store actions behind buttons (resume) plus two window events the game
 * listens for: `game:fire` (mobile trigger) and `game:restart` (play again).
 */
export function GameUI({ onExit }: { onExit: () => void }) {
  const phase = useGame((s) => s.phase)
  const isTouch = useIsTouch()
  const playing = phase === 'playing'
  const hud = playing || phase === 'paused'

  return (
    <div className={`game-ui${isTouch ? ' is-touch' : ''}`} data-phase={phase}>
      {hud && (
        <>
          <AlbumCluster />
          <CombatCluster />
          <StationTracker />
        </>
      )}
      {playing && <Crosshair />}
      {playing && isTouch && <TouchControls />}

      {/* one event column: the banner can never land on top of the toasts */}
      <div className="hud-feed">
        <AlbumBanner />
        <Toasts />
      </div>

      {phase === 'idle' && <StartPanel onExit={onExit} isTouch={isTouch} />}
      {phase === 'paused' && <PausePanel onExit={onExit} isTouch={isTouch} />}
      {phase === 'roundOver' && <RoundOverPanel onExit={onExit} />}
    </div>
  )
}
