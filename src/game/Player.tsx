import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { CapsuleCollider, RigidBody, interactionGroups, useRapier } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { terrainHeight } from './terrain'

const SPEED = 8
const JUMP = 7.5
const EYE_HEIGHT = 0.7 // above capsule center
const CAPSULE_HALF = 0.6
const CAPSULE_RADIUS = 0.35

interface Props {
  onLockChange: (locked: boolean) => void
}

// First-person controller in the spirit of the three.js pointer-lock example:
// mouse look via PointerLockControls, WASD relative to view yaw, space to jump —
// but the body is a rapier capsule so terrain/blocks collide for free.
export function Player({ onLockChange }: Props) {
  const body = useRef<RapierRigidBody>(null)
  const keys = useRef<Record<string, boolean>>({})
  const camera = useThree((s) => s.camera)
  const { world, rapier } = useRapier()

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true)
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const move = new THREE.Vector3()

  useFrame(() => {
    const rb = body.current
    if (!rb) return
    const pos = rb.translation()

    // WASD in camera yaw plane
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, THREE.Object3D.DEFAULT_UP)
    move.set(0, 0, 0)
    if (keys.current['KeyW']) move.add(forward)
    if (keys.current['KeyS']) move.sub(forward)
    if (keys.current['KeyD']) move.add(right)
    if (keys.current['KeyA']) move.sub(right)
    move.normalize().multiplyScalar(SPEED)

    const vel = rb.linvel()
    let vy = vel.y
    if (keys.current['Space']) {
      // grounded check: short ray below the capsule, ignoring the player itself
      const ray = new rapier.Ray(
        { x: pos.x, y: pos.y - CAPSULE_HALF - CAPSULE_RADIUS + 0.05, z: pos.z },
        { x: 0, y: -1, z: 0 },
      )
      const hit = world.castRay(ray, 0.25, true, undefined, undefined, undefined, rb)
      if (hit) {
        vy = JUMP
        keys.current['Space'] = false // one jump per press, no held-key bunny hop
      }
    }
    rb.setLinvel({ x: move.x, y: vy, z: move.z }, true)

    camera.position.set(pos.x, pos.y + EYE_HEIGHT, pos.z)
    if (import.meta.env.DEV) (window as { __pp?: number[] }).__pp = [pos.x, pos.y, pos.z]

    // fell into the ocean → respawn at the island center
    if (pos.y < -12) {
      rb.setTranslation({ x: 0, y: terrainHeight(0, 0) + 3, z: 0 }, true)
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  })

  return (
    <>
      <PointerLockControls onLock={() => onLockChange(true)} onUnlock={() => onLockChange(false)} />
      <RigidBody
        ref={body}
        colliders={false}
        enabledRotations={[false, false, false]}
        position={[0, terrainHeight(0, 0) + 3, 0]}
        friction={0}
      >
        {/* group 1, colliding only with the default world (group 0) — projectiles are
            group 2, so a steep downward shot can never spawn inside and launch the player */}
        <CapsuleCollider
          args={[CAPSULE_HALF, CAPSULE_RADIUS]}
          collisionGroups={interactionGroups(1, [0])}
        />
      </RigidBody>
    </>
  )
}
