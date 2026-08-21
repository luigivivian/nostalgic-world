import { useRef, useState } from 'react'
import { useGameEvent, useTimers } from './hooks'

type Flash = { kind: 'hit' | 'dry'; seq: number }

/** Centre reticle: a quiet dot that confirms hits and rejects empty shots. */
export function Crosshair() {
  const [flash, setFlash] = useState<Flash | null>(null)
  const seq = useRef(0)
  const setTimer = useTimers()

  useGameEvent((e) => {
    if (e.type !== 'hit' && e.type !== 'dryFire') return
    const mine = ++seq.current
    setFlash({ kind: e.type === 'hit' ? 'hit' : 'dry', seq: mine })
    setTimer(() => {
      if (seq.current === mine) setFlash(null)
    }, e.type === 'hit' ? 220 : 280)
  })

  return (
    <div className={`crosshair-ui${flash ? ` is-${flash.kind}` : ''}`} key={flash?.seq ?? 0}>
      <span className="crosshair-dot" />
      <span className="crosshair-ring" />
    </div>
  )
}
