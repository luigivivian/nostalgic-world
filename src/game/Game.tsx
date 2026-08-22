import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Physics, interactionGroups, useRapier } from '@react-three/rapier'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Island } from './Island'
import { PlayerTPS } from './PlayerTPS'
import type { playerController } from 'three-player-controller'
import { Targets, type TargetsHandle } from './Targets'
import { Projectiles, type ProjectileDef } from './Projectiles'
import { Pickups, PICKUP_TTL_MS, type PickupDef } from './Pickups'
import { AmmoPickups, AMMO_PER_PICKUP, AMMO_TTL_MS, type AmmoPickupDef } from './AmmoPickups'
import { HeldTazo } from './HeldTazo'
import { loadTazoPool, randomTazo, rollRarity, type PoolTazo } from './tazoPool'
import { terrainHeight } from './terrain'
import { STATIONS, initialStationStates, stationById, type TargetDef } from './stations'
import { useGame } from './store'
import { Diagnostics, installDebugHooks, type GameTestHooks } from './diagnostics'
import { GameUI } from './ui/GameUI'
import { LOW_END } from './quality'
import { GameVFX } from './vfx/GameVFX'

const PROJECTILE_SPEED = 46
const PROJECTILE_TTL = 3000
// Each pickup is two textures + a physical material; uncollected drops are culled oldest-first.
const MAX_PICKUPS = 8
const MAX_AMMO_PICKUPS = 8

// Fires on pointerdown while playing; lives inside the Canvas to reach the camera.
const FIRE_COOLDOWN_MS = 220

// Reticle ray range: past this the shot just flies straight along the camera ray.
const AIM_RANGE = 120
// playerCapsule.position is the capsule's TOP sphere centre (~head height), not the feet.
const SHOULDER_DROP = 0.35
const MUZZLE_AHEAD = 0.6

// Third person: the camera sits ~4.5 units behind the character. The shot leaves the
// character's shoulder but is aimed at whatever the reticle is over, so spawn point and
// crosshair converge instead of flying parallel to the camera ray. Must live inside
// <Physics> for the rapier raycast.
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
  const { world, rapier } = useRapier()
  // read through a ref so the click that STARTS the round (enabled flips on that same
  // event, but the ref only updates on the next render) doesn't also fire a shot
  const enabledRef = useRef(enabled)
  // The click that starts/restarts a round must not also fire. enabledRef alone is not
  // enough: React flushes the discrete-event update (and its effects) before the event
  // finishes bubbling to document, so the ref can already be true here. Arming the
  // cooldown on the same transition closes the gap from the other side.
  const armedAt = useRef(0)
  useEffect(() => {
    enabledRef.current = enabled
    if (enabled) armedAt.current = performance.now()
  }, [enabled])
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const center = new THREE.Vector2(0, 0)
    const aim = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const pos = new THREE.Vector3()
    let lastShot = 0
    const handler = () => {
      if (!enabledRef.current) return
      const now = performance.now()
      if (now - lastShot < FIRE_COOLDOWN_MS || now - armedAt.current < FIRE_COOLDOWN_MS) return
      lastShot = now
      // Through the projection matrix (exact screen centre), not getWorldDirection.
      raycaster.setFromCamera(center, camera)
      const { origin, direction } = raycaster.ray
      const body = controllerRef.current?.getPosition()
      if (!body) {
        onShoot(pos.copy(origin).addScaledVector(direction, 1.1), dir.copy(direction))
        return
      }
      pos.set(body.x, body.y - SHOULDER_DROP, body.z)
      // Same groups as the projectile, so the reticle lands on what the ball can hit.
      // Ignore hits closer than the character (camera clipping into a slope behind him).
      const hit = world.castRay(
        new rapier.Ray(origin, direction),
        AIM_RANGE,
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        interactionGroups(2, [0]),
      )
      const toi = hit && hit.timeOfImpact > origin.distanceTo(pos) + 0.5 ? hit.timeOfImpact : AIM_RANGE
      aim.copy(origin).addScaledVector(direction, toi)
      dir.subVectors(aim, pos).normalize()
      pos.addScaledVector(dir, MUZZLE_AHEAD)
      onShoot(pos, dir)
    }
    document.addEventListener('pointerdown', handler)
    // the UI worker's mobile fire button dispatches this instead of a canvas click
    window.addEventListener('game:fire', handler)
    return () => {
      document.removeEventListener('pointerdown', handler)
      window.removeEventListener('game:fire', handler)
    }
  }, [camera, world, rapier, onShoot, controllerRef])
  return null
}

export default function Game({ onExit }: { onExit: () => void }) {
  const phase = useGame((s) => s.phase)
  const slug = useGame((s) => s.collection?.slug ?? '')
  const round = useGame((s) => s.round)
  const ammo = useGame((s) => s.ammo)

  const [projectiles, setProjectiles] = useState<ProjectileDef[]>([])
  const [pickups, setPickups] = useState<PickupDef[]>([])
  const [ammoPickups, setAmmoPickups] = useState<AmmoPickupDef[]>([])
  const [held, setHeld] = useState<PoolTazo | null>(null)
  const nextId = useRef(1)
  const poolRef = useRef<PoolTazo[] | null>(null)
  const controllerRef = useRef<playerController | null>(null)
  const targetsRef = useRef<TargetsHandle | null>(null)
  const hooksRef = useRef<GameTestHooks>({})
  // one outcome per projectile: a hit must not also be counted as a miss on TTL
  const resolved = useRef(new Set<number>())
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

  // Fresh session: the store outlives this component (module singleton).
  useEffect(() => {
    const g = useGame.getState()
    g.resetGame()
    g.setStations(initialStationStates())
  }, [])

  useEffect(() => {
    loadTazoPool()
      .then((p) => {
        poolRef.current = p.tazos
        useGame.getState().setCollection({ slug: p.slug, name: p.name, year: p.year, poolSize: p.poolSize })
      })
      .catch((e) => console.error('tazo pool load failed:', e))
  }, [])

  const ammoAround = useCallback((x: number, z: number, n: number): AmmoPickupDef[] => {
    const out: AmmoPickupDef[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.6
      const px = x + Math.cos(a) * 2.6
      const pz = z + Math.sin(a) * 2.6
      out.push({ id: nextId.current++, pos: [px, terrainHeight(px, pz) + 0.05, pz], amount: AMMO_PER_PICKUP, born: performance.now() })
    }
    return out
  }, [])

  const beginRound = useCallback(() => {
    // the drop pool (and the bag scans keyed by its slug) must be loaded first — GameUI's
    // idle panel reads "Carregando coleção..." until then
    if (!poolRef.current) return
    const g = useGame.getState()
    g.setStations(initialStationStates())
    g.startRound()
    resolved.current.clear()
    setProjectiles([])
    setPickups([])
    setHeld(null)
    setAmmoPickups(ammoAround(STATIONS[0].x, STATIONS[0].z, 1))
  }, [ammoAround])

  const shoot = useCallback((pos: THREE.Vector3, dir: THREE.Vector3) => {
    // dry fire consumes the cooldown but spawns nothing
    if (!useGame.getState().tryShoot()) return
    const id = nextId.current++
    setProjectiles((ps) => [
      ...ps,
      {
        id,
        pos: [pos.x, pos.y, pos.z],
        vel: [dir.x * PROJECTILE_SPEED, dir.y * PROJECTILE_SPEED, dir.z * PROJECTILE_SPEED],
      },
    ])
    const t = setTimeout(() => {
      timers.current.delete(t)
      setProjectiles((ps) => ps.filter((p) => p.id !== id))
      // flew off into the sea: still a miss, and it still breaks the combo
      if (!resolved.current.has(id)) {
        resolved.current.add(id)
        if (useGame.getState().phase === 'playing') useGame.getState().registerMiss()
      }
    }, PROJECTILE_TTL)
    timers.current.add(t)
  }, [])

  const handleMiss = useCallback((projectileId: number) => {
    if (resolved.current.has(projectileId)) return
    resolved.current.add(projectileId)
    setProjectiles((ps) => ps.filter((p) => p.id !== projectileId))
    if (useGame.getState().phase === 'playing') useGame.getState().registerMiss()
  }, [])

  // One bag per shot: the projectile dies on impact instead of bouncing on through
  // the wall (a single ccd ball could otherwise break half a station in one frame).
  const handleBreak = useCallback(
    (def: TargetDef, pos: [number, number, number], projectileId: number) => {
      resolved.current.add(projectileId)
      setProjectiles((ps) => ps.filter((p) => p.id !== projectileId))
      const g = useGame.getState()
      g.registerHit(def.id, def.stationId, pos)

      const station = stationById(def.stationId)
      const p = poolRef.current
      if (p && station) {
        const rarity = rollRarity(station)
        setPickups((ps) =>
          [...ps, { id: nextId.current++, pos, tazo: randomTazo(p), rarity, born: performance.now() }].slice(
            -MAX_PICKUPS,
          ),
        )
      }

      // station cleared -> ammo reward + unlock the next tier
      const after = useGame.getState()
      const st = after.stations.find((s) => s.id === def.stationId)
      if (!st || st.targetsLeft > 0) return
      const next = after.stations.find((s) => s.tier === st.tier + 1)
      const reward = [...ammoAround(st.pos[0], st.pos[2], 2)]
      if (next) {
        after.patchStation(next.id, { unlocked: true })
        reward.push(...ammoAround(next.pos[0], next.pos[2], 1))
      }
      setAmmoPickups((a) => [...a, ...reward].slice(-MAX_AMMO_PICKUPS))
      if (after.stations.every((s) => s.targetsLeft === 0)) after.endRound('cleared')
    },
    [ammoAround],
  )

  // Album commit happens HERE, not when the hold animation ends — collecting a second
  // tazo mid-animation replaces the held one, and its timer must not eat the first.
  const handleCollect = useCallback((def: PickupDef) => {
    setPickups((ps) => ps.filter((p) => p.id !== def.id))
    useGame.getState().collect(def.tazo, def.rarity, def.pos)
    setHeld(def.tazo)
  }, [])

  const handleAmmo = useCallback((def: AmmoPickupDef) => {
    setAmmoPickups((ps) => ps.filter((p) => p.id !== def.id))
    useGame.getState().addAmmo(def.amount, def.pos)
  }, [])

  const handleHeldDone = useCallback(() => setHeld(null), [])

  // Pressure: a drop the player did not reach in 10s is gone; ammo piles linger 20s so
  // an empty player can walk to one, but an ignored pile cannot hold the round open forever.
  const hasPickups = pickups.length > 0 || ammoPickups.length > 0
  useEffect(() => {
    if (!hasPickups) return
    const t = setInterval(() => {
      const now = performance.now()
      setPickups((ps) => ps.filter((p) => now - p.born < PICKUP_TTL_MS))
      setAmmoPickups((ps) => ps.filter((p) => now - p.born < AMMO_TTL_MS))
    }, 500)
    return () => clearInterval(t)
  }, [hasPickups])

  // Round ends only once the board is quiet: no ammo, nothing in flight, nothing to grab.
  useEffect(() => {
    if (phase !== 'playing' || ammo > 0) return
    if (projectiles.length > 0 || pickups.length > 0 || ammoPickups.length > 0) return
    useGame.getState().endRound('ammo')
  }, [phase, ammo, projectiles.length, pickups.length, ammoPickups.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = useGame.getState()
      if (e.code === 'Escape') {
        if (g.phase === 'playing') g.setPhase('paused')
        else if (g.phase === 'paused') g.setPhase('playing')
      } else if (e.code === 'Enter' && (g.phase === 'roundOver' || g.phase === 'idle')) {
        beginRound()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [beginRound])

  // "Jogar de novo" in the round-over panel (GameUI) — same path as Enter.
  useEffect(() => {
    const onRestart = () => {
      if (useGame.getState().phase === 'roundOver') beginRound()
    }
    window.addEventListener('game:restart', onRestart)
    return () => window.removeEventListener('game:restart', onRestart)
  }, [beginRound])

  // Debug/test hooks (dev or ?debug): headless probes cannot pointer-lock and aim.
  useEffect(() => {
    hooksRef.current = {
      spawnTazos: (n) => {
        const p = poolRef.current
        if (!p) return
        const body = controllerRef.current?.getPosition()
        const bx = body ? body.x : 0
        const bz = body ? body.z : 0
        const spawned: PickupDef[] = []
        for (let i = 0; i < n; i++) {
          const px = bx + (i - (n - 1) / 2) * 1.2
          const pz = bz - 3
          spawned.push({
            id: nextId.current++,
            pos: [px, terrainHeight(px, pz) + 1.1, pz],
            tazo: randomTazo(p),
            rarity: 'common',
            born: performance.now(),
          })
        }
        setPickups((ps) => [...ps, ...spawned].slice(-MAX_PICKUPS))
      },
      fillAlbum: () => {
        const p = poolRef.current
        if (!p) return
        const g = useGame.getState()
        for (const tazo of p) g.collect(tazo, 'common', [0, 0, 0])
      },
      breakAllTargets: () => targetsRef.current?.breakAll(),
    }
    return installDebugHooks(hooksRef)
  }, [])

  const playing = phase === 'playing'

  // The overlay is pointer-events:none so the click reaches the canvas (the controller
  // only requests pointer lock for canvas clicks); the root catches the bubbled event.
  const handleRootPointerDown = useCallback(() => {
    const g = useGame.getState()
    if (g.phase === 'idle' || g.phase === 'roundOver') beginRound()
    else if (g.phase === 'paused') g.setPhase('playing')
  }, [beginRound])

  return (
    <div className="game-root" onPointerDown={handleRootPointerDown}>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 900 }} dpr={[1, LOW_END ? 1.5 : 2]}>
        {/* rapier's wasm load suspends: the boundary must live INSIDE the Canvas,
            or the suspension bubbles to App's <Suspense> and unmounts the whole
            Canvas (WebGL context + PointerLockControls die mid-flight) */}
        <Suspense fallback={null}>
          <Physics gravity={[0, -22, 0]} paused={phase === 'paused'}>
            <Island />
            <PlayerTPS onReady={handleControllerReady} />
            {/* remount on every round: broken bags, fragments and hit guards reset */}
            {slug && <Targets key={round} slug={slug} onBreak={handleBreak} handle={targetsRef} />}
            <Projectiles projectiles={projectiles} onMiss={handleMiss} />
            <Pickups pickups={pickups} onCollect={handleCollect} controllerRef={controllerRef} />
            <GameVFX />
            <AmmoPickups slug={slug} pickups={ammoPickups} onCollect={handleAmmo} controllerRef={controllerRef} />
            <Diagnostics pickups={pickups.length} />
            <ShootListener onShoot={shoot} controllerRef={controllerRef} enabled={playing} />
          </Physics>
        </Suspense>
        {held && <HeldTazo tazo={held} onDone={handleHeldDone} />}
        {!LOW_END && (
          <EffectComposer>
            {/* threshold above sky luminance: only emissive shots/pickup glow bloom */}
            <Bloom luminanceThreshold={1.0} intensity={0.35} mipmapBlur />
            <Vignette darkness={0.55} offset={0.28} />
          </EffectComposer>
        )}
      </Canvas>
      <GameUI onExit={onExit} />
    </div>
  )
}
