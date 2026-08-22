import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, type GameEvent } from '../store'
import { STATIONS } from '../stations'

// Event-driven VFX. Three pooled systems, three draw calls, no lights and no per-effect
// meshes: crumbs (Points), scraps/confetti (InstancedMesh of quads) and impact rings
// (InstancedMesh of rings). Everything is spawned from the store's event stream and
// dies inside 0.8-1.2s, so nothing accumulates over a round.

const CRUMBS = 320
const SCRAPS = 180
const RINGS = 10
const GRAVITY = -11

// palette shared with the world: snack orange/yellow for impacts, gold for a tazo,
// purple for a legendary. Threats and rewards differ by colour AND by effect shape.
const C_CRUMB = [new THREE.Color('#f2b134'), new THREE.Color('#e2622a'), new THREE.Color('#f7e1a8')]
// over-white yellows for the bag burst: the Points shader skips tone mapping, so >1
// channels push the sprites over the Bloom threshold — tiny glowing crumbs, not dust
const C_BURST = [new THREE.Color(2.2, 1.8, 0.5), new THREE.Color(1.9, 1.4, 0.3), new THREE.Color(2.4, 2.2, 0.9)]
const C_SCRAP = [new THREE.Color('#e8452f'), new THREE.Color('#f4c020'), new THREE.Color('#1fa9c4')]
const C_GOLD = new THREE.Color('#ffd45e')
const C_PURPLE = new THREE.Color('#b06cf0')
const C_RING_HIT = new THREE.Color(1.6, 0.9, 0.35)
const C_RING_GOLD = new THREE.Color(1.8, 1.4, 0.5)
const C_AMMO = new THREE.Color('#ff9a3c')
const C_RING_AMMO = new THREE.Color(2.0, 1.15, 0.35)

function crumbSprite() {
  const s = 32
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Points with a per-particle size/alpha — the one bit of custom GLSL in the VFX. */
function crumbMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: map }, uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // uScale = drawingBufferHeight / (2 * tan(fov/2)): world size -> pixels
        gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.001), 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        if (t.a * vAlpha < 0.02) discard;
        gl_FragColor = vec4(vColor, t.a * vAlpha);
      }`,
    vertexColors: true,
  })
}

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  ttl: number
  size: number
  spin: number
  drag: number
}

const dead = (): Particle => ({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, ttl: 0, size: 0, spin: 0, drag: 0.98 })

// Effects can also be driven directly (the ?showcase view), without writing to the
// store — the store is gameplay's, and VFX only ever reads it.
const listeners = new Set<(e: GameEvent) => void>()

/** Play one effect as if the store had emitted it. Dev/showcase use. */
export function playVfxEvent(e: GameEvent) {
  for (const l of listeners) l(e)
}

// Game.tsx mounts one; the ?showcase view mounts its own. Only the first one lives —
// two pools would double every burst and every draw call.
let mounted = false

export function GameVFX() {
  const owner = useRef(false)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (mounted && !owner.current) return
    mounted = true
    owner.current = true
    setOk(true)
    return () => {
      mounted = false
      owner.current = false
    }
  }, [])

  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const sys = useMemo(() => {
    // --- crumbs (Points) ---
    const cGeo = new THREE.BufferGeometry()
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CRUMBS * 3).fill(-9999), 3))
    cGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CRUMBS * 3), 3))
    cGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(CRUMBS), 1))
    cGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(CRUMBS), 1))
    cGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
    const sprite = crumbSprite()
    const crumbs = new THREE.Points(cGeo, crumbMaterial(sprite))
    crumbs.frustumCulled = false

    // --- scraps / confetti (instanced quads) ---
    const scraps = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.075, 0.11),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: true }),
      SCRAPS,
    )
    scraps.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scraps.frustumCulled = false
    scraps.count = SCRAPS

    // --- impact rings (instanced, additive so the fade is a colour fade) ---
    const rings = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.62, 0.8, 24),
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      RINGS,
    )
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    rings.frustumCulled = false

    return { crumbs, scraps, rings, sprite }
  }, [])

  const state = useRef({
    ringColors: new Float32Array(RINGS * 3),
    crumbs: Array.from({ length: CRUMBS }, dead),
    scraps: Array.from({ length: SCRAPS }, dead),
    rings: Array.from({ length: RINGS }, dead),
    ci: 0,
    si: 0,
    ri: 0,
    color: new THREE.Color(),
    m: new THREE.Matrix4(),
    q: new THREE.Quaternion(),
    e: new THREE.Euler(),
    v: new THREE.Vector3(),
    s: new THREE.Vector3(),
  })

  useEffect(
    () => () => {
      sys.crumbs.geometry.dispose()
      ;(sys.crumbs.material as THREE.Material).dispose()
      sys.scraps.geometry.dispose()
      ;(sys.scraps.material as THREE.Material).dispose()
      sys.scraps.dispose()
      sys.rings.geometry.dispose()
      ;(sys.rings.material as THREE.Material).dispose()
      sys.rings.dispose()
      sys.sprite.dispose()
    },
    [sys],
  )

  // --- spawners ---------------------------------------------------------------
  useEffect(() => {
    const st = state.current
    const colorAttr = sys.crumbs.geometry.attributes.color as THREE.BufferAttribute
    const sizeAttr = sys.crumbs.geometry.attributes.aSize as THREE.BufferAttribute

    const crumb = (x: number, y: number, z: number, spread: number, up: number, size: number, col: THREE.Color, ttl: number) => {
      const i = st.ci++ % CRUMBS
      const p = st.crumbs[i]
      p.x = x
      p.y = y
      p.z = z
      p.vx = (Math.random() - 0.5) * spread
      p.vy = up + Math.random() * spread * 0.6
      p.vz = (Math.random() - 0.5) * spread
      p.life = ttl
      p.ttl = ttl
      p.size = size * (0.7 + Math.random() * 0.6)
      p.drag = 0.96
      colorAttr.setXYZ(i, col.r, col.g, col.b)
      sizeAttr.setX(i, p.size)
    }

    const scrap = (x: number, y: number, z: number, spread: number, up: number, col: THREE.Color, ttl: number, drag: number) => {
      const i = st.si++ % SCRAPS
      const p = st.scraps[i]
      p.x = x
      p.y = y
      p.z = z
      p.vx = (Math.random() - 0.5) * spread
      p.vy = up + Math.random() * spread * 0.5
      p.vz = (Math.random() - 0.5) * spread
      p.life = ttl
      p.ttl = ttl
      p.size = 0.8 + Math.random() * 0.7
      p.spin = (Math.random() - 0.5) * 14
      p.drag = drag
      sys.scraps.setColorAt(i, col)
      if (sys.scraps.instanceColor) sys.scraps.instanceColor.needsUpdate = true
    }

    const ring = (x: number, y: number, z: number, col: THREE.Color, ttl: number, rise: number, size: number) => {
      const i = st.ri++ % RINGS
      const p = st.rings[i]
      p.x = x
      p.y = y
      p.z = z
      p.vy = rise
      p.life = ttl
      p.ttl = ttl
      p.size = size
      st.ringColors.set([col.r, col.g, col.b], i * 3)
    }

    /** confetti rain in front of the camera — celebration, never over the play path */
    const confetti = (n: number, gold: boolean) => {
      const c = camera
      const fwd = st.v.set(0, 0, -1).applyQuaternion(c.quaternion)
      for (let i = 0; i < n; i++) {
        const col = gold ? (i % 2 ? C_GOLD : C_PURPLE) : C_SCRAP[i % C_SCRAP.length]
        scrap(
          c.position.x + fwd.x * 6 + (Math.random() - 0.5) * 9,
          c.position.y + 5 + Math.random() * 3,
          c.position.z + fwd.z * 6 + (Math.random() - 0.5) * 9,
          1.2,
          -1,
          col,
          1.6,
          0.995,
        )
      }
    }

    const handle = (e: GameEvent) => {
      switch (e.type) {
        case 'hit': {
          const [x, y, z] = e.pos
          for (let i = 0; i < 30; i++) crumb(x, y, z, 4.2, 2.2, 0.09 + (i % 3) * 0.025, C_BURST[i % 3], 0.7)
          for (let i = 0; i < 8; i++) scrap(x, y, z, 3.4, 1.8, C_SCRAP[i % 3], 0.7, 0.94)
          ring(x, y, z, C_RING_HIT, 0.32, 0, 0.6)
          break
        }
        case 'collect': {
          const [x, y, z] = e.pos
          const gold = e.rarity !== 'common'
          for (let i = 0; i < 16; i++)
            crumb(x, y + 0.2, z, 2.2, 1.9, 0.08, gold ? C_GOLD : C_CRUMB[2], 0.6)
          // the "+tazo" coin ring: rises off the pickup toward the HUD counter
          ring(x, y, z, C_RING_GOLD, 0.6, 2.2, 0.45)
          if (gold) for (let i = 0; i < 20; i++) scrap(x, y + 0.3, z, 2.6, 2.6, i % 2 ? C_GOLD : C_PURPLE, 1.1, 0.96)
          break
        }
        case 'ammoPickup': {
          const [x, y, z] = e.pos
          // orange to match the HUD pips that just filled; chips fly wide, low
          for (let i = 0; i < 24; i++) crumb(x, y + 0.5, z, 3.0, 2.2, 0.13, i % 3 ? C_AMMO : C_CRUMB[0], 0.65)
          ring(x, y + 0.3, z, C_RING_AMMO, 0.6, 1.8, 0.9)
          break
        }
        case 'stationCleared': {
          const s = STATIONS.find((x) => x.id === e.stationId)
          if (s) ring(s.x, s.groundY + 1.4, s.z, C_RING_GOLD, 0.8, 1.2, 1.6)
          break
        }
        case 'roundOver':
          if (e.score > 0) confetti(40, false)
          break
        case 'albumComplete':
          confetti(70, true)
          break
      }
    }

    const fire = (e: GameEvent) => {
      handle(e)
      colorAttr.needsUpdate = true
      sizeAttr.needsUpdate = true
    }

    // fire on every new store event, whatever wrote it, plus the dev showcase bus
    const unsub = useGame.subscribe((s, prev) => {
      if (s.eventSeq === prev.eventSeq || !s.lastEvent) return
      fire(s.lastEvent)
    })
    listeners.add(fire)
    return () => {
      unsub()
      listeners.delete(fire)
    }
  }, [sys, camera])

  // --- simulation -------------------------------------------------------------
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = state.current
    // world size -> pixels for the crumb points; recomputed for resize / fov changes
    const cam = camera as THREE.PerspectiveCamera
    ;(sys.crumbs.material as THREE.ShaderMaterial).uniforms.uScale.value =
      gl.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov ?? 60) / 2))
    const pos = sys.crumbs.geometry.attributes.position as THREE.BufferAttribute
    const alpha = sys.crumbs.geometry.attributes.aAlpha as THREE.BufferAttribute

    for (let i = 0; i < CRUMBS; i++) {
      const p = st.crumbs[i]
      if (p.life <= 0) {
        if (alpha.getX(i) !== 0) alpha.setX(i, 0)
        continue
      }
      p.life -= dt
      p.vy += GRAVITY * dt
      p.vx *= p.drag
      p.vz *= p.drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      pos.setXYZ(i, p.x, p.y, p.z)
      alpha.setX(i, Math.max(0, p.life / p.ttl))
    }
    pos.needsUpdate = true
    alpha.needsUpdate = true

    for (let i = 0; i < SCRAPS; i++) {
      const p = st.scraps[i]
      if (p.life <= 0) {
        st.m.makeScale(0, 0, 0)
        sys.scraps.setMatrixAt(i, st.m)
        continue
      }
      p.life -= dt
      p.vy += GRAVITY * 0.45 * dt
      p.vx *= p.drag
      p.vz *= p.drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      const k = Math.min(1, (p.life / p.ttl) * 2.2) * p.size
      st.e.set(p.spin * (p.ttl - p.life), p.spin * 0.7 * (p.ttl - p.life), 0)
      st.q.setFromEuler(st.e)
      st.m.compose(st.v.set(p.x, p.y, p.z), st.q, st.s.setScalar(k))
      sys.scraps.setMatrixAt(i, st.m)
    }
    sys.scraps.instanceMatrix.needsUpdate = true

    for (let i = 0; i < RINGS; i++) {
      const p = st.rings[i]
      if (p.life <= 0) {
        st.m.makeScale(0, 0, 0)
        sys.rings.setMatrixAt(i, st.m)
        continue
      }
      p.life -= dt
      p.y += p.vy * dt
      const t = 1 - p.life / p.ttl
      const k = p.size * (0.35 + t * 1.5)
      // rings always face the camera: an impact read, not a decal on the ground
      st.m.compose(st.v.set(p.x, p.y, p.z), camera.quaternion, st.s.set(k, k, k))
      sys.rings.setMatrixAt(i, st.m)
      // fade: with additive blending a darkening colour IS the dissolve
      const f = 1 - t
      st.color.fromArray(st.ringColors, i * 3).multiplyScalar(f * f)
      sys.rings.setColorAt(i, st.color)
    }
    sys.rings.instanceMatrix.needsUpdate = true
    if (sys.rings.instanceColor) sys.rings.instanceColor.needsUpdate = true
  })

  if (!ok) return null
  return (
    <>
      <primitive object={sys.crumbs} dispose={null} />
      <primitive object={sys.scraps} dispose={null} />
      <primitive object={sys.rings} dispose={null} />
    </>
  )
}
