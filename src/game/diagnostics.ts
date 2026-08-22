import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useRapier } from '@react-three/rapier'
import { useGame } from './store'
import { setDropSeed } from './tazoPool'

/** Debug surface is dev-only unless the page is opened with ?debug. */
export const DEBUG_ENABLED =
  import.meta.env.DEV || (typeof location !== 'undefined' && location.search.includes('debug'))

const SAMPLE_MS = 500

export type TestStateName = 'active-play' | 'round-over' | 'album-complete' | 'stress'

/** Filled in by Game/Targets; the window hooks are thin wrappers over these. */
export interface GameTestHooks {
  spawnTazos?: (n: number) => void
  fillAlbum?: () => void
  breakAllTargets?: () => void
}

type HookWindow = Window & {
  __THREE_GAME_DIAGNOSTICS__?: () => ReturnType<typeof useGame.getState>
  /** live scene graph for draw-call attribution probes */
  __THREE_GAME_SCENE__?: THREE.Scene
  /** renderer, for offscreen-pixel probes (keep visibility etc) */
  __THREE_GAME_RENDERER__?: THREE.WebGLRenderer
  /** rapier world, for collider diagnostics */
  __THREE_GAME_WORLD__?: ReturnType<typeof useRapier>['world']
  __THREE_GAME_TEST_HOOKS__?: { setState: (name: TestStateName, seed?: number) => void }
}

/**
 * Deterministic state forcing for headless probes: a browser without pointer lock
 * cannot aim, so the automated playtest drives the loop through these instead.
 */
export function installDebugHooks(hooks: React.MutableRefObject<GameTestHooks>) {
  if (!DEBUG_ENABLED || typeof window === 'undefined') return
  const w = window as HookWindow
  w.__THREE_GAME_DIAGNOSTICS__ = () => useGame.getState()
  w.__THREE_GAME_TEST_HOOKS__ = {
    setState(name, seed) {
      if (seed !== undefined) setDropSeed(seed)
      const g = useGame.getState()
      switch (name) {
        case 'active-play':
          if (g.phase !== 'playing') g.startRound()
          hooks.current.spawnTazos?.(3)
          break
        case 'round-over':
          useGame.getState().endRound('ammo')
          break
        case 'album-complete':
          hooks.current.fillAlbum?.()
          break
        case 'stress':
          hooks.current.breakAllTargets?.()
          break
      }
    },
  }
  return () => {
    delete w.__THREE_GAME_DIAGNOSTICS__
    delete w.__THREE_GAME_TEST_HOOKS__
  }
}

/**
 * Renderer/physics counters into the store every 500ms. Must be mounted INSIDE
 * <Canvas> and inside <Physics> (useRapier). Returns null — no scene footprint.
 */
export function Diagnostics({ pickups }: { pickups: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const { world } = useRapier()

  useEffect(() => {
    if (!DEBUG_ENABLED) return
    const w = window as HookWindow
    w.__THREE_GAME_SCENE__ = scene
    w.__THREE_GAME_RENDERER__ = gl
    w.__THREE_GAME_WORLD__ = world
    return () => {
      delete w.__THREE_GAME_SCENE__
      delete w.__THREE_GAME_RENDERER__
      delete w.__THREE_GAME_WORLD__
    }
  }, [scene, gl, world])
  const frames = useRef(0)
  const last = useRef(performance.now())

  useEffect(() => {
    useGame.getState().setDiagnostics({ pickups })
  }, [pickups])

  // EffectComposer renders several passes per frame and gl.info resets on every
  // render() call, so the auto-reset value is just the final fullscreen pass. Take
  // ownership of the counter and average the accumulated total over the window.
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  useFrame(() => {
    frames.current++
    const now = performance.now()
    const dt = now - last.current
    if (dt < SAMPLE_MS) return
    const info = gl.info
    const n = Math.max(1, frames.current)
    useGame.getState().setDiagnostics({
      fps: Math.round((frames.current * 1000) / dt),
      calls: Math.round(info.render.calls / n),
      triangles: Math.round(info.render.triangles / n),
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      bodies: world.bodies.len(),
    })
    info.reset()
    frames.current = 0
    last.current = now
  })

  return null
}
