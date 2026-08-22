import { Suspense, useMemo, useRef } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Cloud, Clouds } from '@react-three/drei'
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
import { preloadProps } from './assets/props'
import { terrainGrain, toonRamp } from './toon'
import { activeBiome } from './biomes'

// ?showcase=1 mounts the asset showroom in front of the spawn (see assets/DevShowcase).
const SHOWCASE = typeof location !== 'undefined' && location.search.includes('showcase')

// Sun: mid-afternoon, low and to the west-south-west. From the beach spawn (looking -Z
// up the island) that puts the key light across the player's left shoulder — lit slopes
// facing the camera, long shadows for form, and a warm/cool split with the sky fill.
const SUN = new THREE.Vector3(-88, 46, 74)

// Gradient sky dome (shader-cookbook recipe): authored top/horizon colours plus a sun disc
// and halo. Replaced drei's <Sky>: its HDR output saturated to pure white around the sun
// under ACES, which blew out a quarter of the frame when looking west from the shallows.
// Colours are linear (THREE.Color converts); the shader runs the stock tone-mapping and
// colour-space chunks so it matches lit materials with or without the post stack.
const SKY_UNIFORMS = {
  uTop: { value: new THREE.Color('#3d7cc9') },
  uHorizon: { value: new THREE.Color('#c9dff0') },
  uBelow: { value: new THREE.Color('#5d86a3') },
  uSunColor: { value: new THREE.Color('#fff1c8') },
  uSunDir: { value: SUN.clone().normalize() },
}
export interface SkyColors {
  top: string
  horizon: string
  below: string
  sun: string
}
function applySkyPalette(colors: SkyColors) {
  SKY_UNIFORMS.uTop.value.set(colors.top)
  SKY_UNIFORMS.uHorizon.value.set(colors.horizon)
  SKY_UNIFORMS.uBelow.value.set(colors.below)
  SKY_UNIFORMS.uSunColor.value.set(colors.sun)
}
const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: SKY_UNIFORMS,
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vDir;
    uniform vec3 uTop, uHorizon, uBelow, uSunColor, uSunDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
      // below the horizon the dome reads as distant sea, not a white wall (seen from the ridge / overview)
      col = mix(col, uBelow, smoothstep(0.0, -0.12, d.y));
      float s = clamp(dot(d, uSunDir), 0.0, 1.0);
      // soft disc + wide warm halo: a glow falloff, not a clipped white dot
      col += uSunColor * (pow(s, 260.0) * 1.1 + pow(s, 24.0) * 0.35 + pow(s, 5.0) * 0.12);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
})
const skyGeometry = new THREE.SphereGeometry(820, 32, 16)

/** The dome is a singleton (one scene at a time); colours default to the active biome's. */
export function GradientSky({ colors }: { colors?: SkyColors }) {
  useMemo(() => applySkyPalette(colors ?? activeBiome().sky), [colors])
  return <mesh geometry={skyGeometry} material={skyMaterial} frustumCulled={false} renderOrder={-1} />
}


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
  const { palette, terrain } = activeBiome()
  const SAND_WET = new THREE.Color(palette.lowWet)
  const SAND = new THREE.Color(palette.low)
  const GRASS = new THREE.Color(palette.mid)
  const GRASS_DRY = new THREE.Color(palette.midDry)
  const ROCK = new THREE.Color(palette.rock)
  const PEAK = new THREE.Color(palette.peak)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const normal = geo.attributes.normal as THREE.BufferAttribute
  const color = geo.attributes.color as THREE.BufferAttribute
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const slope = 1 - normal.getY(i)
    if (terrain.peakLine !== null && y > terrain.peakLine) {
      c.copy(PEAK) // snow cap
    } else {
      // beach -> meadow, with the dry/lush mix driven by the same noise as the groves
      const wet = smoothstep(WATER_LEVEL + 0.55, WATER_LEVEL - 0.25, y)
      const sandy = smoothstep(WATER_LEVEL + 2.6, WATER_LEVEL + 0.8, y)
      const lush = smoothstep(-0.2, 0.35, fbm(x / 28, z / 28, 400))
      c.copy(GRASS_DRY).lerp(GRASS, lush)
      c.lerp(ROCK, Math.min(1, Math.max(0, (slope - terrain.rockSlope) * 2.6)))
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
  const { palette } = activeBiome()
  // 16x the island: the far edge sits well past the fog, so no horizon step when looking out to sea
  const geo = useMemo(() => new THREE.PlaneGeometry(ISLAND_SIZE * 16, ISLAND_SIZE * 16, 48, 48), [])
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
        color={palette.water}
        transparent
        opacity={palette.waterOpacity}
        // rougher than a mirror: the sun's specular stayed above the Bloom threshold and
        // read as a white pillar on the horizon from the mirante
        roughness={0.72}
        metalness={0.05}
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
    // one preload for every layer, after the biome swaps — nothing loads lazily mid-frame
    preloadProps([...new Set(all.map((s) => s.url))])
    return all
  }, [])
  return (
    <Suspense fallback={null}>
      <InstancedScatter spots={spots} />
    </Suspense>
  )
}

export function Island() {
  const { sky } = activeBiome()
  const geometry = useMemo(() => {
    const geo = createIslandGeometry()
    shoreBlend(geo)
    return geo
  }, [])
  const material = useMemo(() => terrainGrain(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() })), [])

  return (
    <>
      <GradientSky />
      {/* fog starts past the far station: depth on the horizon, nothing hidden in play */}
      <fog attach="fog" args={[sky.fog, sky.fogNear, sky.fogFar]} />
      {/* sky fill (cool) against the sun key (warm): the split keeps toon bands readable */}
      <hemisphereLight args={[sky.hemiSky, sky.hemiGround, sky.hemiIntensity]} />
      <directionalLight
        position={SUN}
        intensity={sky.sunIntensity}
        color={sky.sunColor}
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
      <directionalLight position={[70, 28, -90]} intensity={0.5} color={sky.rim} />
      {sky.clouds.length > 0 && (
        <Clouds material={THREE.MeshBasicMaterial} limit={160}>
          {sky.clouds.map(([x, y, z, opacity, color], i) => (
            <Cloud key={i} seed={2 + i * 5} bounds={[120 - i * 10, 8, 120 - i * 10]} segments={26 - i * 4} volume={22 - i * 2} position={[x, y, z]} color={color} opacity={opacity} speed={0.08 - i * 0.01} />
          ))}
        </Clouds>
      )}
      <RigidBody type="fixed" colliders="trimesh" friction={1}>
        <mesh geometry={geometry} material={material} receiveShadow castShadow />
      </RigidBody>
      <WorldProps />
      <SpawnBeach />
      <Water />
      {SHOWCASE && <DevShowcase />}
    </>
  )
}
