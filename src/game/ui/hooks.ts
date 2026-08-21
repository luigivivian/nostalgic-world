import { useEffect, useRef, useState } from 'react'
import { useGame, type GameEvent } from '../store'

/**
 * Fires `handler` once per store event. The store has no subscribeWithSelector
 * middleware, so we diff `eventSeq` ourselves; `lastEvent` is the payload.
 * The handler is read through a ref so the subscription is created once.
 */
export function useGameEvent(handler: (e: GameEvent) => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    let seq = useGame.getState().eventSeq
    return useGame.subscribe((s) => {
      if (s.eventSeq === seq) return
      seq = s.eventSeq
      if (s.lastEvent) ref.current(s.lastEvent)
    })
  }, [])
}

const TOUCH_QUERIES = ['(pointer: coarse)', '(max-width: 900px)']

/** Touch layout: coarse pointer OR a phone-sized viewport. Re-evaluates on change. */
export function useIsTouch() {
  const [touch, setTouch] = useState(() =>
    typeof window === 'undefined' ? false : TOUCH_QUERIES.some((q) => window.matchMedia(q).matches),
  )
  useEffect(() => {
    const mqs = TOUCH_QUERIES.map((q) => window.matchMedia(q))
    const sync = () => setTouch(mqs.some((m) => m.matches))
    mqs.forEach((m) => m.addEventListener('change', sync))
    sync()
    return () => mqs.forEach((m) => m.removeEventListener('change', sync))
  }, [])
  return touch
}

/** setTimeout that is always cleared on unmount (HUD flashes outlive their component). */
export function useTimers() {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  return useRef((fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t)
      fn()
    }, ms)
    timers.current.add(t)
    return t
  }).current
}
