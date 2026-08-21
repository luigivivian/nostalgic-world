import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Collectible } from '../collectible/Collectible'
import type { PoolTazo } from './tazoPool'

const OFFSET = new THREE.Vector3(0.42, -0.26, -0.95) // camera space: low right "hand"
const SHOW_MS = 3200

// First-person inspect: the collected tazo floats up to the hand position and does a
// slow full spin (front and verso both read) before being tucked into the album.
export function HeldTazo({ tazo, onDone }: { tazo: PoolTazo; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const born = useRef(performance.now())
  const camera = useThree((s) => s.camera)
  const tmp = useRef(new THREE.Vector3())

  useEffect(() => {
    born.current = performance.now()
    const t = setTimeout(onDone, SHOW_MS)
    return () => clearTimeout(t)
  }, [tazo, onDone])

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    // glue to the camera: world position = camera position + camera-space offset
    tmp.current.copy(OFFSET).applyQuaternion(camera.quaternion)
    g.position.copy(camera.position).add(tmp.current)
    g.quaternion.copy(camera.quaternion)
    if (spin.current) spin.current.rotation.y += dt * 2.2
    // ease in
    const age = (performance.now() - born.current) / 1000
    const s = 0.17 * Math.min(1, age * 4)
    g.scale.setScalar(s)
  })

  return (
    <group ref={group}>
      <group ref={spin}>
        <Collectible shape="disc" frontUrl={tazo.front} backUrl={tazo.back} maxSize={512} />
      </group>
    </group>
  )
}
