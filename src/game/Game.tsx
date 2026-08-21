import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Island } from './Island'
import { PlayerTPS } from './PlayerTPS'
import type { playerController } from 'three-player-controller'
import { Blocks } from './Blocks'
import { Projectiles, type ProjectileDef } from './Projectiles'
import { Pickups, type PickupDef } from './Pickups'
import { HeldTazo } from './HeldTazo'
import { loadTazoPool, randomTazo, type PoolTazo } from './tazoPool'

const PROJECTILE_SPEED = 46
const PROJECTILE_TTL = 3000
// Each pickup is two textures + a physical material; uncollected drops are culled oldest-first.
const MAX_PICKUPS = 8

// Fires on pointerdown while pointer-locked; lives inside the Canvas to reach the camera.
const FIRE_COOLDOWN_MS = 220

// Third person: the camera sits ~4.5 units behind the character, so projectiles spawn
// from the character's chest (controller position + height), not from the camera.
function ShootListener({
  onShoot,
  controllerRef,
  enabled,
}: {
  onShoot: (pos: THREE.Vector3, dir: THREE.Vector3) => void
  controllerRef: React.MutableRefObject<playerController | null>
  enabled: boolean
}) {
  const camera = useThree((s) => s.camera)
  // read through a ref so the click that STARTS the game (enabled flips on that same
  // event, but the ref only updates on the next render) doesn't also fire a shot
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])
  useEffect(() => {
    const dir = new THREE.Vector3()
    const pos = new THREE.Vector3()
    let lastShot = 0
    const handler = () => {
      if (!enabledRef.current) return
      const now = performance.now()
      if (now - lastShot < FIRE_COOLDOWN_MS) return
      lastShot = now
      camera.getWorldDirection(dir)
      const body = controllerRef.current?.getPosition()
      if (body) pos.set(body.x, body.y + 1.4, body.z).add(dir.clone().multiplyScalar(0.9))
      else pos.copy(camera.position).add(dir.clone().multiplyScalar(1.1))
      onShoot(pos, dir)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [camera, onShoot, controllerRef])
  return null
}

export default function Game({ onExit }: { onExit: () => void }) {
  // "playing" drives the overlay, not the raw pointer-lock state: the third-person
  // controller acquires/releases pointer lock on its own (and lock requests can fail
  // without a user gesture), so mirroring pointerlockchange made the overlay flicker.
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setPlaying(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [pool, setPool] = useState<PoolTazo[] | null>(null)
  const [projectiles, setProjectiles] = useState<ProjectileDef[]>([])
  const [pickups, setPickups] = useState<PickupDef[]>([])
  const [held, setHeld] = useState<PoolTazo | null>(null)
  const [album, setAlbum] = useState<PoolTazo[]>([])
  const nextId = useRef(1)
  const poolRef = useRef<PoolTazo[] | null>(null)
  const controllerRef = useRef<playerController | null>(null)
  // Must be referentially stable: PlayerTPS re-inits the whole controller (GLB reload,
  // BVH rebuild, camera re-parent) whenever this prop changes.
  const handleControllerReady = useCallback((c: playerController) => {
    controllerRef.current = c
  }, [])
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    loadTazoPool()
      .then((p) => {
        poolRef.current = p
        setPool(p)
      })
      .catch((e) => console.error('tazo pool load failed:', e))
  }, [])

  const shoot = useCallback((pos: THREE.Vector3, dir: THREE.Vector3) => {
    const id = nextId.current++
    const def: ProjectileDef = {
      id,
      pos: [pos.x, pos.y, pos.z],
      vel: [dir.x * PROJECTILE_SPEED, dir.y * PROJECTILE_SPEED, dir.z * PROJECTILE_SPEED],
    }
    setProjectiles((ps) => [...ps, def])
    const t = setTimeout(() => {
      timers.current.delete(t)
      setProjectiles((ps) => ps.filter((p) => p.id !== id))
    }, PROJECTILE_TTL)
    timers.current.add(t)
  }, [])

  // One block per shot: the projectile dies on impact instead of bouncing on through
  // the wall (a single ccd ball could otherwise break half the wall in one frame).
  const handleBreak = useCallback((pos: [number, number, number], projectileId: number) => {
    setProjectiles((ps) => ps.filter((p) => p.id !== projectileId))
    const p = poolRef.current
    if (!p) return
    setPickups((ps) => [...ps, { id: nextId.current++, pos, tazo: randomTazo(p) }].slice(-MAX_PICKUPS))
  }, [])

  // Album commit happens HERE, not when the hold animation ends — collecting a second
  // tazo mid-animation replaces the held one, and its timer must not eat the first.
  const handleCollect = useCallback((def: PickupDef) => {
    setPickups((ps) => ps.filter((p) => p.id !== def.id))
    setAlbum((a) => [...a, def.tazo])
    setHeld(def.tazo)
  }, [])

  const handleHeldDone = useCallback(() => setHeld(null), [])

  // The overlay is pointer-events:none so the click reaches the canvas (the controller
  // only requests pointer lock for canvas clicks); the root catches the bubbled event.
  return (
    <div className="game-root" onPointerDown={() => setPlaying(true)}>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 900 }} dpr={[1, 2]}>
        {/* rapier's wasm load suspends: the boundary must live INSIDE the Canvas,
            or the suspension bubbles to App's <Suspense> and unmounts the whole
            Canvas (WebGL context + PointerLockControls die mid-flight) */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -22, 0]}>
            <Island />
            <PlayerTPS onReady={handleControllerReady} />
            <Blocks onBreak={handleBreak} />
            <Projectiles projectiles={projectiles} />
            <Pickups pickups={pickups} onCollect={handleCollect} controllerRef={controllerRef} />
          </Physics>
        </Suspense>
        {held && <HeldTazo tazo={held} onDone={handleHeldDone} />}
        <ShootListener onShoot={shoot} controllerRef={controllerRef} enabled={playing} />
        <EffectComposer>
          {/* threshold above sky luminance: only emissive shots/pickup glow bloom */}
          <Bloom luminanceThreshold={1.0} intensity={0.35} mipmapBlur />
          <Vignette darkness={0.55} offset={0.28} />
        </EffectComposer>
      </Canvas>

      {playing && <div className="crosshair" />}
      <div className="game-hud">
        <span>Tazos: {album.length}</span>
        {pool === null && <span className="hud-dim"> · carregando coleção...</span>}
      </div>

      {!playing && (
        <div className="lock-overlay">
          <div className="lock-panel">
            <h2>Ilha Nostálgica</h2>
            <p>Clique para jogar</p>
            <p className="lock-help">
              WASD — andar · Shift — correr · Espaço — pular · V — 1ª/3ª pessoa
              <br />
              Mouse — mirar · Clique — atirar · Quebre os blocos e colete os tazos
            </p>
            <button
              className="back-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onExit}
            >
              ← Voltar ao acervo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
