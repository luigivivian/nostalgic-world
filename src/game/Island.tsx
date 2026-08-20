import { useMemo, useRef } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Sky, Cloud, Clouds } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createIslandGeometry, ISLAND_SIZE, WATER_LEVEL } from './terrain'
import { Vegetation } from './Vegetation'
import { toonRamp } from './toon'

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
        roughness={0.12}
        metalness={0.05}
        clearcoat={0.6}
        clearcoatRoughness={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function Island() {
  const geometry = useMemo(() => createIslandGeometry(), [])

  return (
    <>
      {/* low turbidity/mie = deep blue sky instead of a white haze near the sun */}
      <Sky sunPosition={[80, 60, -40]} turbidity={2.2} rayleigh={1.1} mieCoefficient={0.003} mieDirectionalG={0.8} />
      <fog attach="fog" args={['#cfe4ef', 60, 420]} />
      <hemisphereLight args={['#bfe0ff', '#4a7a44', 0.85]} />
      <directionalLight
        position={[80, 90, -40]}
        intensity={1.7}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <Clouds material={THREE.MeshBasicMaterial} limit={120}>
        <Cloud seed={2} bounds={[120, 8, 120]} segments={26} volume={22} position={[0, 55, -60]} color="#ffffff" opacity={0.55} speed={0.08} />
        <Cloud seed={7} bounds={[100, 6, 100]} segments={18} volume={18} position={[-80, 48, 40]} color="#f4faff" opacity={0.45} speed={0.06} />
      </Clouds>
      <RigidBody type="fixed" colliders="trimesh" friction={1}>
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshToonMaterial vertexColors gradientMap={toonRamp()} />
        </mesh>
      </RigidBody>
      <Vegetation />
      <Water />
    </>
  )
}
