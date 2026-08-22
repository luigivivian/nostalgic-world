import { Suspense, useMemo, useRef } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Sky, Cloud, Clouds } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createIslandGeometry, ISLAND_SIZE, WATER_LEVEL } from './terrain'
import { fbm } from './noise'
import { vegetationSpots } from './Vegetation'
import { SpawnBeach, spawnBeachSpots } from './assets/SpawnBeach'
import { trailSpots } from './assets/Trails'
import { stationSpots } from './assets/StationDressing'
import { DevShowcase } from './assets/DevShowcase'
import { InstancedScatter } from './assets/InstancedProps'
import { toonRamp } from './toon'

// ?showcase=1 mounts the asset showroom in front of the spawn (see assets/DevShowcase).
const SHOWCASE = typeof location !== 'undefined' && location.search.includes('showcase')

// Sun: mid-afternoon, low and to the west-south-west. From the beach spawn (looking -Z
// up the island) that puts the key light across the player's left shoulder — lit slopes
// facing the camera, long shadows for form, and a warm/cool split with the sky fill.
const SUN = new THREE.Vector3(-88, 46, 74)

const SAND_WET = new THREE.Color('#c9ab72')
const SAND = new THREE.Color('#eed7a1')
const GRASS = new THREE.Color('#6cb04f')
const GRASS_DRY = new THREE.Color('#9dbb56')
const ROCK = new THREE.Color('#98836b')

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/**
 * Re-tint the terrain's vertex colours (terrain.ts owns the shape; this owns the look).
 * Three things the flat height bands were missing: a wet-sand line at the water, a wide
 * sand->grass blend up the beach instead of a hard step, and per-vertex mottling plus a
 * slope darkening that fakes ambient occlusion in the gullies.
 */
function shoreBlend(geo: THREE.BufferGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const normal = geo.attributes.normal as THREE.BufferAttribute
  const color = geo.attributes.color as THREE.BufferAttribute
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const slope = 1 - normal.getY(i)
    if (y > 9.2) {
      c.set('#f6f4ec') // snow cap
    } else {
      // beach -> meadow, with the dry/lush mix driven by the same noise as the groves
      const wet = smoothstep(WATER_LEVEL + 0.55, WATER_LEVEL - 0.25, y)
      const sandy = smoothstep(WATER_LEVEL + 2.6, WATER_LEVEL + 0.8, y)
      const lush = smoothstep(-0.2, 0.35, fbm(x / 28, z / 28, 400))
      c.copy(GRASS_DRY).lerp(GRASS, lush)
      c.lerp(ROCK, Math.min(1, Math.max(0, (slope - 0.24) * 2.6)))
      c.lerp(SAND, sandy)
      c.lerp(SAND_WET, wet * 0.9)
    }
    // mottling + slope AO: breaks the flat toon bands without a texture
    const n = fbm(x * 0.35, z * 0.35, 611) * 0.05 + 1
    const ao = 0.84 + 0.16 * Math.max(0, normal.getY(i))
    c.multiplyScalar(n * ao)
    color.setXYZ(i, c.r, c.g, c.b)
  }
  color.needsUpdate = true
}

// Gentle vertex swell so the sea reads as alive without a custom shader.
function Water() {
  const mesh = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(ISLAND_SIZE * 8, ISLAND_SIZE * 8, 48, 48), [])
  const base = useMemo(() => (geo.attributes.position as THREE.BufferAttribute).array.slice(), [geo])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      const y = base[i * 3 + 1]
      pos.setZ(i, Math.sin(x * 0.045 + t * 0.9) * 0.22 + Math.cos(y * 0.05 + t * 0.7) * 0.18)
    }
    pos.needsUpdate = true
  })
  return (
    <mesh ref={mesh} geometry={geo} rotation-x={-Math.PI / 2} position-y={WATER_LEVEL}>
      <meshPhysicalMaterial
        color="#2a9cc4"
        transparent
        opacity={0.86}
        // rougher than a mirror: the sun's specular stayed above the Bloom threshold and
        // read as a white pillar on the horizon from the mirante
        roughness={0.55}
        metalness={0.05}
        clearcoat={0.2}
        clearcoatRoughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Every static prop on the island in ONE InstancedScatter: scatter, spawn beach, trail
 * network and station dressing. Components used to mount their
 * own scatter each, and the same model file placed by two of them cost two draw calls
 * (plus two shadow draws) — a sign post was being drawn five times.
 */
function WorldProps() {
  const spots = useMemo(() => {
    const all = [
      ...vegetationSpots(),
      ...spawnBeachSpots(),
      ...trailSpots(),
      ...stationSpots('praia'),
      ...stationSpots('bosque'),
      ...stationSpots('mirante'),
    ]
    return all
  }, [])
  return (
    <Suspense fallback={null}>
      <InstancedScatter spots={spots} />
    </Suspense>
  )
}

export function Island() {
  const geometry = useMemo(() => {
    const geo = createIslandGeometry()
    shoreBlend(geo)
    return geo
  }, [])

  return (
    <>
      {/* low turbidity/mie = deep blue sky instead of a white haze near the sun */}
      <Sky sunPosition={SUN} turbidity={2.6} rayleigh={1.4} mieCoefficient={0.004} mieDirectionalG={0.82} />
      {/* fog starts past the far station: depth on the horizon, nothing hidden in play */}
      <fog attach="fog" args={['#d8e6e6', 95, 520]} />
      {/* sky fill (cool) against the sun key (warm): the split keeps toon bands readable */}
      <hemisphereLight args={['#cfe8ff', '#6d8f52', 1.0]} />
      <directionalLight
        position={SUN}
        intensity={1.75}
        color="#ffe6bb"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      {/* rim from the opposite side, no shadow pass: separates silhouettes from the sea */}
      <directionalLight position={[70, 28, -90]} intensity={0.5} color="#cfe6ff" />
      <Clouds material={THREE.MeshBasicMaterial} limit={120}>
        <Cloud seed={2} bounds={[120, 8, 120]} segments={26} volume={22} position={[0, 55, -60]} color="#ffffff" opacity={0.55} speed={0.08} />
        <Cloud seed={7} bounds={[100, 6, 100]} segments={18} volume={18} position={[-80, 48, 40]} color="#f4faff" opacity={0.45} speed={0.06} />
      </Clouds>
      <RigidBody type="fixed" colliders="trimesh" friction={1}>
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshToonMaterial vertexColors gradientMap={toonRamp()} />
        </mesh>
      </RigidBody>
      <WorldProps />
      <SpawnBeach />
      <Water />
      {SHOWCASE && <DevShowcase />}
    </>
  )
}
