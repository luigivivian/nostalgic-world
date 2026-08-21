// Dev-only contact sheet for the Poly/Sketchfab GLBs in public/game/models/poly:
// http://localhost:5199/src/game/assets/__preview__/poly.html — each model normalised to
// 1.5 u tall on a 2 u grid, original bounds logged to window.__polyBounds.
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

const FILES = [
  'bulb-flower', 'desert-marigold', 'fiddlehead', 'flower', 'gnome',
  'mushrooms', 'orchid', 'pastel-plume-flowers', 'sunflower', 'suspicious-plant', 'tulip-3',
]
const bounds: Record<string, { size: number[]; minY: number }> = {}
;(window as unknown as { __polyBounds: typeof bounds }).__polyBounds = bounds

function Model({ name, x }: { name: string; x: number }) {
  const { scene } = useGLTF(`/game/models/poly/${name}.glb`)
  const obj = useMemo(() => {
    const o = scene.clone(true)
    const box = new THREE.Box3().setFromObject(o)
    const size = box.getSize(new THREE.Vector3())
    bounds[name] = { size: [size.x, size.y, size.z].map((v) => +v.toFixed(3)), minY: +box.min.y.toFixed(3) }
    const s = 1.5 / (size.y || 1)
    o.scale.setScalar(s)
    o.position.set(x, -box.min.y * s, 0)
    return o
  }, [scene, name, x])
  return <primitive object={obj} />
}

createRoot(document.getElementById('root')!).render(
  <Canvas camera={{ position: [0, 2.6, 7.5], fov: 38 }} shadows>
    <color attach="background" args={['#bfe0ff']} />
    <hemisphereLight args={['#bfe0ff', '#4a7a44', 0.9]} />
    <directionalLight position={[8, 12, 6]} intensity={1.6} castShadow />
    <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[40, 12]} /><meshStandardMaterial color="#6fae52" /></mesh>
    <Suspense fallback={null}>
      {FILES.map((f, i) => <Model key={f} name={f} x={(i - 5.5) * 1.35} />)}
    </Suspense>
    <OrbitControls target={[0, 0.8, 0]} />
  </Canvas>,
)
