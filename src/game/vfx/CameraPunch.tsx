import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useGame } from '../store'

// FOV kicks tied to the store's events: a shot widens the view a touch (recoil), a hit
// punches in. The controller owns the camera transform, so FOV is the one camera channel
// gameplay feedback can use. Decays in ~120 ms; off under prefers-reduced-motion.
const SHOT_KICK = 1.4
const HIT_PUNCH = -3.0
const DECAY = 16

export function CameraPunch() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const kick = useRef(0)
  const base = useRef<number | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return useGame.subscribe((s, prev) => {
      if (s.eventSeq === prev.eventSeq || !s.lastEvent) return
      const e = s.lastEvent
      if (e.type === 'shot') kick.current = SHOT_KICK
      else if (e.type === 'hit') kick.current = HIT_PUNCH
    })
  }, [])

  useFrame((_, dt) => {
    if (base.current === null) base.current = camera.fov
    if (kick.current === 0) return
    kick.current *= Math.exp(-DECAY * Math.min(dt, 0.05))
    if (Math.abs(kick.current) < 0.02) kick.current = 0
    camera.fov = base.current + kick.current
    camera.updateProjectionMatrix()
  })
  return null
}
