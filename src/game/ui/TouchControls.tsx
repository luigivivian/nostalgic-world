import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../store'
import { FireIcon, JumpIcon, PauseIcon } from './icons'

const FIRE_REPEAT_MS = 220
const DEADZONE = 0.2
/** push past this fraction of the ring radius to sprint (matches the controller's own) */
const SPRINT_AT = 0.85

type Move = { x: number; y: number; sprint: boolean }
const ZERO: Move = { x: 0, y: 0, sprint: false }

/**
 * Movement intent for the player controller. `three-player-controller` builds its own
 * `#joy-zone` on <body> and exposes no way to bind an existing element, so this
 * joystick emits the same numbers its VirtualJoystick would (x right, y forward,
 * normalised past the deadzone) and the director forwards them to
 * `controller.setInput({ moveX, moveY, shift })`.
 */
function emitMove(m: Move) {
  window.dispatchEvent(new CustomEvent<Move>('game:move', { detail: m }))
}

function Joystick() {
  const zone = useRef<HTMLDivElement | null>(null)
  const pointer = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0, r: 1 })
  const last = useRef<Move>(ZERO)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const send = useCallback((m: Move) => {
    const p = last.current
    if (Math.abs(p.x - m.x) < 1e-3 && Math.abs(p.y - m.y) < 1e-3 && p.sprint === m.sprint) return
    last.current = m
    emitMove(m)
  }, [])

  const release = useCallback(() => {
    pointer.current = null
    setKnob({ x: 0, y: 0 })
    send(ZERO)
  }, [send])

  useEffect(() => {
    const off = () => release()
    window.addEventListener('blur', off)
    document.addEventListener('visibilitychange', off)
    return () => {
      window.removeEventListener('blur', off)
      document.removeEventListener('visibilitychange', off)
      emitMove(ZERO)
    }
  }, [release])

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const el = zone.current
    if (!el || pointer.current !== null) return
    const r = el.getBoundingClientRect()
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }
    pointer.current = e.pointerId
    el.setPointerCapture(e.pointerId)
    onMove(e)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return
    e.stopPropagation()
    const { x, y, r } = origin.current
    const dx = e.clientX - x
    const dy = e.clientY - y
    const dist = Math.hypot(dx, dy)
    const clamped = Math.min(dist, r)
    const ux = dist > 0 ? (dx / dist) * clamped : 0
    const uy = dist > 0 ? (dy / dist) * clamped : 0
    setKnob({ x: ux, y: uy })
    const mag = clamped / r
    // screen-down is +y, forward is -y
    send(
      mag > DEADZONE
        ? { x: ux / clamped, y: -uy / clamped, sprint: mag >= SPRINT_AT }
        : ZERO,
    )
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return
    e.stopPropagation()
    zone.current?.releasePointerCapture?.(e.pointerId)
    release()
  }

  return (
    <div
      id="joystick-zone"
      ref={zone}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span className="joy-base" />
      <span className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}

function FireButton() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [down, setDown] = useState(false)

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setDown(false)
  }, [])

  useEffect(() => {
    const off = () => stop()
    window.addEventListener('blur', off)
    document.addEventListener('visibilitychange', off)
    return () => {
      window.removeEventListener('blur', off)
      document.removeEventListener('visibilitychange', off)
      stop()
    }
  }, [stop])

  const fire = () => window.dispatchEvent(new CustomEvent('game:fire'))

  return (
    <button
      className={`touch-btn fire${down ? ' is-down' : ''}`}
      type="button"
      aria-label="Atirar"
      onPointerDown={(e) => {
        // never let a control press reach the world's own pointerdown shot handler
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        setDown(true)
        fire()
        timer.current = setInterval(fire, FIRE_REPEAT_MS)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <FireIcon className="touch-icon" />
    </button>
  )
}

function JumpButton() {
  const held = useRef(false)

  // The controller listens for keydown/keyup on window and reads e.code, so a
  // synthesised Space bubbling from document drives the same jump path as a keyboard.
  const key = (type: 'keydown' | 'keyup') =>
    document.dispatchEvent(
      new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true }),
    )

  const up = () => {
    if (!held.current) return
    held.current = false
    key('keyup')
  }

  useEffect(() => {
    const off = () => up()
    window.addEventListener('blur', off)
    document.addEventListener('visibilitychange', off)
    return () => {
      window.removeEventListener('blur', off)
      document.removeEventListener('visibilitychange', off)
      off()
    }
  })

  return (
    <button
      className="touch-btn jump"
      type="button"
      aria-label="Pular"
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        held.current = true
        key('keydown')
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <JumpIcon className="touch-icon" />
    </button>
  )
}

/** Thumb controls; only mounted on touch layouts while a round is running. */
export function TouchControls() {
  return (
    <div className="touch-ui">
      <button
        className="touch-btn pause"
        type="button"
        aria-label="Pausar"
        onPointerDown={(e) => {
          e.stopPropagation()
          useGame.getState().setPhase('paused')
        }}
      >
        <PauseIcon className="touch-icon" />
      </button>
      <Joystick />
      <div className="touch-actions">
        <JumpButton />
        <FireButton />
      </div>
    </div>
  )
}
