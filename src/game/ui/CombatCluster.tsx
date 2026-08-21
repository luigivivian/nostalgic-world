import { useRef, useState } from 'react'
import { useGame, START_AMMO, COMBO_WINDOW_MS } from '../store'
import { useGameEvent, useTimers } from './hooks'
import { BagIcon } from './icons'

const PIPS = START_AMMO
const LOW_AMMO = 3

/** Top-right cluster: score, combo, and how many bags are left to throw. */
export function CombatCluster() {
  const ammo = useGame((s) => s.ammo)
  const score = useGame((s) => s.score)
  const [dry, setDry] = useState(0)
  const [combo, setCombo] = useState(0)
  const comboSeq = useRef(0)
  const setTimer = useTimers()

  useGameEvent((e) => {
    if (e.type === 'dryFire') {
      setDry((n) => n + 1)
      setTimer(() => setDry(0), 420)
    }
    if (e.type === 'hit' && e.combo >= 2) {
      comboSeq.current += 1
      const mine = comboSeq.current
      setCombo(e.combo)
      setTimer(() => {
        if (comboSeq.current === mine) setCombo(0)
      }, COMBO_WINDOW_MS)
    }
    if (e.type === 'roundStart' || e.type === 'miss') setCombo(0)
  })

  const filled = Math.min(ammo, PIPS)
  const extra = Math.max(0, ammo - PIPS)

  return (
    <div className="hud-combat">
      <div className="score-row">
        {combo > 0 && (
          <span key={comboSeq.current} className="combo-badge">
            x{combo}
          </span>
        )}
        <span className="score num">{score.toLocaleString('pt-BR')}</span>
      </div>
      <div
        className={`ammo${dry ? ' is-dry' : ''}${ammo <= LOW_AMMO ? ' is-low' : ''}`}
        key={dry}
        aria-label={`Munição: ${ammo}`}
      >
        <span className="ammo-pips">
          {Array.from({ length: PIPS }, (_, i) => (
            <BagIcon key={i} className={`pip${i < filled ? ' is-full' : ''}`} />
          ))}
        </span>
        {extra > 0 && <span className="ammo-extra num">+{extra}</span>}
      </div>
    </div>
  )
}
