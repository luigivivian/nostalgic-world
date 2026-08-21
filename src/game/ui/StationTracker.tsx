import { useGame } from '../store'
import { CheckIcon, LockIcon } from './icons'

/** Bottom-centre: the three snack stations and how much of each is left. */
export function StationTracker() {
  const stations = useGame((s) => s.stations)
  if (stations.length === 0) return null
  const activeId = stations.find((s) => s.unlocked && s.targetsLeft > 0)?.id

  return (
    <div className="hud-stations">
      {stations.map((s) => {
        const cleared = s.unlocked && s.targetsLeft === 0
        const state = !s.unlocked ? 'is-locked' : cleared ? 'is-cleared' : s.id === activeId ? 'is-active' : ''
        return (
          <div key={s.id} className={`station-chip ${state}`}>
            {!s.unlocked && <LockIcon className="chip-icon" />}
            {cleared && <CheckIcon className="chip-icon" />}
            <span className="chip-name">{s.name}</span>
            {s.unlocked && !cleared && (
              <span className="chip-count num">
                {s.targetsTotal - s.targetsLeft}
                <span className="slash">/</span>
                {s.targetsTotal}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
