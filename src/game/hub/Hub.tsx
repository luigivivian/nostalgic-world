import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Cloud, Clouds, Html, Sparkles } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import type { playerController } from 'three-player-controller'
import { PlayerTPS } from '../PlayerTPS'
import { GradientSky } from '../Island'
import { InstancedScatter } from '../assets/InstancedProps'
import { useToonParts, type Placement } from '../assets/props'
import { rimLight, terrainGrain, toonRamp } from '../toon'
import { BIOMES, BIOME_IDS, type BiomeId } from '../biomes'
import { Diagnostics, installDebugHooks, type GameTestHooks } from '../diagnostics'
import { LOW_END } from '../quality'
import { createHubGeometry, hubHeight, RING_R } from './hubIsland'
import { HubUI } from './HubUI'

// The Sky Garden: the hub you spawn in before a phase. A floating island in a bright
// sky, a crystal tree in the middle, six portals on the promenade — walk into one and
// the island of that biome loads. Astro Bot rules: low poly, but every surface lit with
// intent (warm key, cool fill, bloom only on the crystals and portals), and always
// something moving (sparkles, orbiting tazos, floating rocks, the cloud sea).

const K = '/game/models/kenney_nature-kit/Models/GLTF%20format/'
const KK = '/game/models/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/'
const HO = '/game/models/kenney_holiday-kit/Models/GLB%20format/'
const GY = '/game/models/kenney_graveyard-kit/Models/GLB%20format/'
const SV = '/game/models/kenney_survival-kit/Models/GLB%20format/'
const TREE = '/game/models/poly/twisting-tree.glb'

const SKY = { top: '#2e6fd8', horizon: '#dcefff', below: '#eef6ff', sun: '#fff3d0' }
const SUN = new THREE.Vector3(-60, 70, 40)
export const HUB_SPAWN = () => new THREE.Vector3(0, hubHeight(0, 9.5) + 2.2, 9.5)

// Portal slots on the promenade, clockwise from north (the one you face at spawn).
const PORTAL_ORDER: BiomeId[] = ['praia', 'deserto', 'ruinas', 'pantano', 'montanha', 'neve']
export interface PortalDef {
  biome: BiomeId
  x: number
  z: number
  /** yaw so the ring faces the tree */
  yaw: number
}
export const PORTALS: PortalDef[] = PORTAL_ORDER.map((biome, i) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / PORTAL_ORDER.length
  const x = Math.cos(a) * RING_R
  const z = Math.sin(a) * RING_R
  return { biome, x, z, yaw: Math.atan2(-x, -z) }
})
/** walk this close to a ring's centre to enter */
const ENTER_R = 2.0
const NEAR_R = 7

// Diorama per portal: a few kit pieces on the pad behind the ring, [url, dx, dz, scale]
const DIORAMA: Record<BiomeId, [string, number, number, number][]> = {
  praia: [[K + 'tree_palmDetailedShort.glb', -2.2, -1.6, 1.5], [K + 'flower_redA.glb', 1.9, -1.2, 1.3], [K + 'grass_large.glb', 2.4, -2.0, 1.4], [KK + 'Bush_2_A_Color1.gltf', -2.6, -2.6, 0.45]],
  deserto: [[K + 'cactus_tall.glb', -2.2, -1.5, 2.4], [K + 'cactus_short.glb', 2.1, -1.3, 2.4], [SV + 'rock-sand-b.glb', 2.5, -2.6, 2.4]],
  neve: [[HO + 'tree-snow-a.glb', -2.3, -1.6, 1.2], [HO + 'snowman.glb', 2.0, -1.3, 1.0], [HO + 'snow-pile.glb', 2.6, -2.6, 1.2]],
  pantano: [[GY + 'pine-crooked.glb', -2.2, -1.8, 1.0], [K + 'mushroom_redGroup.glb', 2.0, -1.2, 1.6], [SV + 'tree-log.glb', 2.4, -2.6, 2.4]],
  montanha: [[K + 'tree_pineTallA.glb', -2.2, -1.6, 1.7], [HO + 'rocks-medium.glb', 2.2, -1.6, 0.8], [K + 'stone_tallA.glb', 2.8, -2.8, 1.8]],
  ruinas: [[GY + 'pillar-large.glb', -2.2, -1.5, 1.9], [GY + 'column-large.glb', 2.1, -1.4, 1.7], [GY + 'gravestone-cross.glb', 2.7, -2.7, 1.5]],
}

function dioramaSpots(): (Placement & { url: string })[] {
  const out: (Placement & { url: string })[] = []
  for (const p of PORTALS) {
    const cos = Math.cos(p.yaw)
    const sin = Math.sin(p.yaw)
    for (const [url, dx, dz, scale] of DIORAMA[p.biome]) {
      const x = p.x + cos * dx + sin * dz
      const z = p.z - sin * dx + cos * dz
      out.push({ url, pos: [x, hubHeight(x, z) + 0.3, z], rot: p.yaw + dx * 0.4, scale })
    }
  }
  // the crystal tree, lifted so its lowest root sits on the plaza (poly twisting-tree: minY -4.55 of 7.457)
  const treeScale = 2.0
  out.push({ url: TREE, pos: [0, hubHeight(0, 0) + 4.55 * treeScale - 0.1, 0], rot: 0.6, scale: treeScale })
  // boulders on the plaza edge and the rim
  const rocks = [KK + 'Rock_1_C_Color1.gltf', KK + 'Rock_2_C_Color1.gltf', KK + 'Rock_3_A_Color1.gltf']
  for (let k = 0; k < 14; k++) {
    const a = k * 0.9 + 0.3
    const r = k % 2 ? 7.5 : 27.5
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    out.push({ url: rocks[k % 3], pos: [x, hubHeight(x, z) - 0.15, z], rot: a * 2, scale: 0.45 + (k % 3) * 0.15 })
  }
  // grass tufts and flowers on the lawn between plaza and promenade
  const lawn = [K + 'grass_large.glb', K + 'grass_leafsLarge.glb', K + 'flower_yellowB.glb', K + 'flower_purpleA.glb', K + 'plant_bush.glb']
  for (let k = 0; k < 120; k++) {
    const a = k * 2.399
    const r = 8.5 + ((k * 37) % 100) * 0.085
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    out.push({ url: lawn[k % lawn.length], pos: [x, hubHeight(x, z) - 0.05, z], rot: a, scale: 1.4 + (k % 4) * 0.2 })
  }
  return out
}

// --- portal ring: stone pillars + glowing torus + the swirl disc -------------------
const swirlMaterial = (a: string, b: string) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uHot: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHot; uniform vec3 uA, uB; varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        float swirl = sin(ang * 3.0 - uTime * 1.7 + r * 7.0) * 0.5 + 0.5;
        float rim = smoothstep(1.0, 0.84, r);
        vec3 col = mix(uA, uB, swirl);
        float core = smoothstep(0.6, 0.0, r);
        col += vec3(1.0) * core * (0.5 + uHot * 0.9);
        col *= 1.25 + uHot * 0.7;
        gl_FragColor = vec4(col, rim * (0.82 + 0.18 * swirl));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })

const pillarGeo = new THREE.CylinderGeometry(0.34, 0.42, 3.2, 8)
const capGeo = new THREE.BoxGeometry(1.0, 0.5, 1.0)
const torusGeo = new THREE.TorusGeometry(2.25, 0.2, 10, 48)
const discGeo = new THREE.CircleGeometry(2.05, 48)
const padGeo = new THREE.CylinderGeometry(3.6, 3.9, 0.38, 24)
const stoneMat = rimLight(new THREE.MeshToonMaterial({ color: '#cdbfa3', gradientMap: toonRamp() }), '#fff2d0', 0.3)
const padMat = new THREE.MeshToonMaterial({ color: '#bfb08f', gradientMap: toonRamp() })

function Portal({ def, hotRef }: { def: PortalDef; hotRef: React.MutableRefObject<Map<BiomeId, number>> }) {
  const biome = BIOMES[def.biome]
  const swirl = useMemo(() => swirlMaterial(biome.sky.top, biome.sky.horizon), [biome])
  const ringMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: '#e9dcc0', emissive: new THREE.Color(biome.sky.top), emissiveIntensity: 0.9, gradientMap: toonRamp() }),
    [biome],
  )
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const hot = hotRef.current.get(def.biome) ?? 0
    swirl.uniforms.uTime.value = clock.elapsedTime
    swirl.uniforms.uHot.value += (hot - swirl.uniforms.uHot.value) * 0.08
    ringMat.emissiveIntensity = 0.9 + swirl.uniforms.uHot.value * 1.6
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.15
  })
  const y = hubHeight(def.x, def.z)
  return (
    <group position={[def.x, y, def.z]} rotation-y={def.yaw}>
      <mesh geometry={padGeo} material={padMat} position-y={0.05} receiveShadow />
      {[-2.6, 2.6].map((dx) => (
        <group key={dx} position={[dx, 0.2, 0]}>
          <mesh geometry={pillarGeo} material={stoneMat} position-y={1.6} castShadow />
          <mesh geometry={capGeo} material={stoneMat} position-y={3.3} castShadow />
        </group>
      ))}
      <mesh ref={ring} geometry={torusGeo} material={ringMat} position-y={3.1} castShadow />
      <mesh geometry={discGeo} material={swirl} position-y={3.1} />
      {/* transform+sprite: the label lives in 3D (perspective scale, culled behind the camera) */}
      <Html position={[0, 5.6, 0]} center transform sprite distanceFactor={9} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="portal-label">
          <span className="portal-name">{biome.name}</span>
          <span className="portal-blurb">{biome.blurb}</span>
        </div>
      </Html>
    </group>
  )
}

// --- the crystal tree: glowing shards at the roots and tazos orbiting the crown -----
const shardGeo = new THREE.IcosahedronGeometry(0.42, 0)
const discTazo = new THREE.CylinderGeometry(0.55, 0.55, 0.07, 24)
const TAZO_COLORS = ['#ffd34d', '#ff6b6b', '#5ee0ff', '#9dff7a', '#ff9cf2', '#ffb070', '#7aa2ff', '#fff1a8', '#5ee0ff', '#ffd34d']

function CrystalTree() {
  const shardMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: '#bff4ff', emissive: new THREE.Color('#4fd2ff'), emissiveIntensity: 1.4, gradientMap: toonRamp() }),
    [],
  )
  const tazoMats = useMemo(() => TAZO_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.7), toneMapped: false })), [])
  const crown = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!crown.current) return
    crown.current.rotation.y = t * 0.25
    crown.current.children.forEach((c, i) => {
      c.position.y = 6.5 + Math.sin(t * 1.1 + i) * 0.5 + (i % 3) * 1.1
      c.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.35
    })
  })
  const y0 = hubHeight(0, 0)
  return (
    <group position={[0, y0, 0]}>
      {[...Array(9)].map((_, i) => {
        const a = i * 0.7 + 0.2
        const r = 1.8 + (i % 3) * 0.5
        return (
          <mesh key={i} geometry={shardGeo} material={shardMat} position={[Math.cos(a) * r, 0.6 + (i % 2) * 0.3, Math.sin(a) * r]} rotation={[0.3 * (i % 2), a, 0.25]} scale={[1, 2.2 + (i % 3) * 0.5, 1]} castShadow />
        )
      })}
      <group ref={crown}>
        {TAZO_COLORS.map((_, i) => {
          const a = (i / TAZO_COLORS.length) * Math.PI * 2
          const r = 3.2 + (i % 2) * 1.1
          return <mesh key={i} geometry={discTazo} material={tazoMats[i]} position={[Math.cos(a) * r, 7, Math.sin(a) * r]} />
        })}
      </group>
    </group>
  )
}

// --- floating rocks drifting around the island ---------------------------------------
function FloatingRocks() {
  const urls = [KK + 'Rock_1_A_Color1.gltf', KK + 'Rock_2_D_Color1.gltf', KK + 'Rock_3_D_Color1.gltf']
  const parts = [useToonParts(urls[0]), useToonParts(urls[1]), useToonParts(urls[2])]
  const group = useRef<THREE.Group>(null)
  const rocks = useMemo(
    () =>
      [...Array(10)].map((_, i) => ({
        r: 36 + (i % 4) * 3.5,
        y: -6 + ((i * 7) % 11) - 2,
        a0: i * 0.63,
        speed: 0.02 + (i % 3) * 0.008,
        scale: 0.6 + (i % 3) * 0.35,
        k: i % 3,
      })),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    group.current?.children.forEach((c, i) => {
      const d = rocks[i]
      const a = d.a0 + t * d.speed
      c.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.5 + i) * 0.8, Math.sin(a) * d.r)
      c.rotation.y = t * 0.05 + i
    })
  })
  return (
    <group ref={group}>
      {rocks.map((d, i) => (
        <group key={i} scale={d.scale}>
          {parts[d.k].map((p, j) => (
            <mesh key={j} geometry={p.geometry} material={p.material} />
          ))}
        </group>
      ))}
    </group>
  )
}

// --- cloud sea below the island ------------------------------------------------------
const cloudSeaMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#f4f9ff') }, uShade: { value: new THREE.Color('#c8dcf2') } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColor, uShade; varying vec2 vUv;
    float n2(vec2 p) { return sin(p.x) * sin(p.y); }
    void main() {
      vec2 p = vUv * 42.0;
      float t = uTime * 0.05;
      float n = n2(p + t) * 0.5 + n2(p * 2.1 - t * 1.3) * 0.25 + n2(p * 4.3 + t * 0.7) * 0.125;
      n = n * 0.5 + 0.5;
      float a = smoothstep(0.25, 0.75, n);
      vec3 col = mix(uShade, uColor, smoothstep(0.3, 0.9, n));
      float edge = 1.0 - smoothstep(0.25, 0.5, length(vUv - 0.5));
      gl_FragColor = vec4(col, a * 0.92 * edge + 0.35 * edge);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})
const cloudSeaGeo = new THREE.PlaneGeometry(700, 700, 1, 1)
function CloudSea() {
  useFrame(({ clock }) => {
    cloudSeaMat.uniforms.uTime.value = clock.elapsedTime
  })
  return <mesh geometry={cloudSeaGeo} material={cloudSeaMat} rotation-x={-Math.PI / 2} position-y={-36} frustumCulled={false} />
}

// --- scene ---------------------------------------------------------------------------
function HubScene({ onNear, onEnter }: { onNear: (b: BiomeId | null) => void; onEnter: (b: BiomeId) => void }) {
  const { top, bottom } = useMemo(createHubGeometry, [])
  const topMesh = useMemo(() => {
    const m = new THREE.Mesh(top, terrainGrain(rimLight(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }), '#fff2d0', 0.25)))
    m.receiveShadow = true
    m.castShadow = true
    m.updateMatrixWorld(true)
    return m
  }, [top])
  const bottomMat = useMemo(() => rimLight(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }), '#dce8ff', 0.5, 2.2), [])
  const spots = useMemo(dioramaSpots, [])
  const ctrl = useRef<playerController | null>(null)
  const hot = useRef(new Map<BiomeId, number>())
  const near = useRef<BiomeId | null>(null)
  const entered = useRef(false)
  const onReady = useCallback((c: playerController) => {
    ctrl.current = c
  }, [])

  useFrame(() => {
    const c = ctrl.current
    if (!c || entered.current) return
    const p = c.getPosition()
    let best: BiomeId | null = null
    let bestD = Infinity
    for (const def of PORTALS) {
      const d = Math.hypot(p.x - def.x, p.z - def.z)
      hot.current.set(def.biome, Math.max(0, 1 - d / NEAR_R))
      if (d < bestD) {
        bestD = d
        best = def.biome
      }
    }
    const id = bestD < NEAR_R ? best : null
    if (id !== near.current) {
      near.current = id
      onNear(id)
    }
    if (id && bestD < ENTER_R) {
      entered.current = true
      onEnter(id)
    }
  })

  return (
    <>
      <GradientSky colors={SKY} />
      <fog attach="fog" args={[SKY.horizon, 120, 420]} />
      <hemisphereLight args={['#dff0ff', '#7fa86a', 1.15]} />
      <directionalLight
        position={SUN}
        intensity={1.9}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
      />
      <directionalLight position={[50, 20, -60]} intensity={0.55} color="#cfe6ff" />
      <primitive object={topMesh} />
      <mesh geometry={bottom} material={bottomMat} />
      <Suspense fallback={null}>
        <InstancedScatter spots={spots} />
        <FloatingRocks />
      </Suspense>
      <CrystalTree />
      {PORTALS.map((def) => (
        <Portal key={def.biome} def={def} hotRef={hot} />
      ))}
      <Sparkles count={LOW_END ? 90 : 260} scale={[64, 16, 64]} position={[0, 7, 0]} size={LOW_END ? 2 : 3} speed={0.3} color="#fff4c8" />
      <CloudSea />
      <Clouds material={THREE.MeshBasicMaterial} limit={200}>
        {[...Array(6)].map((_, i) => {
          const a = (i / 6) * Math.PI * 2 + 0.4
          return <Cloud key={i} seed={3 + i} bounds={[40, 6, 40]} segments={14} volume={16} position={[Math.cos(a) * 58, -16 - (i % 2) * 6, Math.sin(a) * 58]} color="#ffffff" opacity={0.7} speed={0.05} />
        })}
        <Cloud seed={21} bounds={[90, 8, 90]} segments={18} volume={20} position={[30, 46, -110]} color="#f6faff" opacity={0.45} speed={0.05} />
      </Clouds>
      <PlayerTPS collider={topMesh} spawn={HUB_SPAWN} fallY={-40} onReady={onReady} />
      <Diagnostics pickups={0} />
    </>
  )
}

export default function Hub({ onEnter, onExit }: { onEnter: (b: BiomeId) => void; onExit: () => void }) {
  const [near, setNear] = useState<BiomeId | null>(null)
  const [entering, setEntering] = useState<BiomeId | null>(null)
  // probes read renderer counters through the same window hook the island installs
  const hooks = useRef<GameTestHooks>({})
  useEffect(() => installDebugHooks(hooks), [])
  useEffect(() => {
    if (!entering) return
    const t = setTimeout(() => onEnter(entering), 750)
    return () => clearTimeout(t)
  }, [entering, onEnter])
  return (
    <div className="game-root">
      <Canvas shadows camera={{ fov: 70, near: 0.1, far: 900 }} dpr={[1, LOW_END ? 1.5 : 2]}>
        <Suspense fallback={null}>
          {/* no bodies here; <Physics> only so Diagnostics (useRapier) can expose the scene to probes */}
          <Physics gravity={[0, -22, 0]} paused>
            <HubScene onNear={setNear} onEnter={setEntering} />
          </Physics>
        </Suspense>
        {!LOW_END && (
          <EffectComposer>
            <Bloom luminanceThreshold={1.0} intensity={0.55} mipmapBlur />
            <Vignette darkness={0.45} offset={0.3} />
          </EffectComposer>
        )}
      </Canvas>
      <HubUI near={near} entering={entering} onExit={onExit} portals={BIOME_IDS} />
    </div>
  )
}
