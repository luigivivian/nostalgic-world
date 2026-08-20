import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { playerController } from 'three-player-controller'
import { FootIK } from 'three-player-controller/foot-ik'
import { createIslandGeometry, terrainHeight } from './terrain'

const MODEL_URL = '/game/character/ual.glb'

// three-player-controller works in "rig units": its capsule is 180 units tall and every
// gameplay number (speed, gravity, jump, camera distance) is multiplied by `scale`.
// 0.01 maps that rig onto our world: 1.8-unit character, 3 u/s walk, 8.5 u/s sprint,
// -24 u/s² gravity — i.e. the same feel the rapier capsule had (SPEED 8, gravity -22).
const MODEL_SCALE = 0.01
const WALK_SPEED = 300 // * scale = 3 u/s
const RUN_SPEED = 850 // * scale = 8.5 u/s
const CAM_MIN = 80 // * scale = 0.8 world units
const CAM_MAX = 450 // * scale = 4.5 world units
const SPAWN = new THREE.Vector3(0, terrainHeight(0, 0) + 3, 0)
const DROWN_Y = -12

// Bone names of the Quaternius "Universal Animation Library" rig (ual.glb).
const UAL_SKELETON = {
  hips: 'pelvis',
  legs: {
    left: { upper: 'thigh_l', lower: 'calf_l', foot: 'foot_l', toe: 'ball_l' },
    right: { upper: 'thigh_r', lower: 'calf_r', foot: 'foot_r', toe: 'ball_r' },
  },
}

interface Props {
  /** Pointer-lock state, mirroring the first-person Player's callback. */
  onLockChange?: (locked: boolean) => void
  /**
   * What the controller walks on. It merges every mesh below this object into one
   * BVH, so pass only collision geometry. Defaults to a throwaway island mesh built
   * from the same analytic height field the visible terrain uses.
   */
  collider?: THREE.Object3D
  /** Escape hatch for the raw controller (animations, camera mode, reset, ...). */
  onReady?: (controller: playerController) => void
}

/**
 * Third-person controller (three-player-controller + its foot-IK plugin).
 *
 * It is fully imperative: it owns the camera, its own OrbitControls, a BVH capsule
 * sweep against `collider` and the character's animation mixer — rapier is not
 * involved, so the player does not collide with rapier bodies (blocks, projectiles).
 */
export function PlayerTPS({ onLockChange, collider, onReady }: Props) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const ctrl = useRef<playerController | null>(null)

  useEffect(() => {
    if (!onLockChange) return
    const handler = () => onLockChange(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', handler)
    return () => document.removeEventListener('pointerlockchange', handler)
  }, [onLockChange])

  useEffect(() => {
    let disposed = false
    let controller: playerController | null = null
    let controls: OrbitControls | null = null
    let ownedCollider: THREE.Mesh | null = null

    const start = async () => {
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL)
      if (disposed) return

      // The controller reads world matrices off the collider source but never adds it
      // to the scene, so a detached mesh is enough — no second draw call.
      let colliderSource = collider
      if (!colliderSource) {
        ownedCollider = new THREE.Mesh(createIslandGeometry())
        ownedCollider.updateMatrixWorld(true)
        colliderSource = ownedCollider
      }

      controls = new OrbitControls(camera, gl.domElement)
      controls.enableDamping = true
      controls.maxPolarAngle = Math.PI / 2.05

      controller = new playerController()
      await controller.init({
        scene,
        camera: camera as THREE.PerspectiveCamera,
        controls,
        staticCollider: colliderSource,
        initPos: SPAWN.clone(),
        minCamDistance: CAM_MIN,
        maxCamDistance: CAM_MAX,
        camLookAtHeightRatio: 0.5,
        enableSpringCamera: true,
        // mode 1: cursor hidden (pointer lock on <body>), mouse orbits the camera and
        // the character turns toward its movement direction — the footIK.html feel.
        thirdMouseMode: 1,
        // No vehicles in this game, and flight would let the player leave the island.
        keyMap: { toggleFly: null, toggleVehicle: null },
        playerModelConfig: {
          model: gltf.scene,
          animations: gltf.animations,
          scale: MODEL_SCALE,
          idleAnim: 'Idle_Loop',
          walkAnim: 'Walk_Loop',
          runAnim: 'Sprint_Loop',
          jumpAnim: ['Jump_Start', 'Jump_Loop', 'Jump_Land'],
          backwardAnim: 'Walk_Loop',
          speed: WALK_SPEED,
          runSpeed: RUN_SPEED,
          headBoneName: 'Head',
          firstPersonCameraOffset: [0, 0.15, 0.12],
          rotateY: Math.PI / 2,
        },
      })
      if (disposed) {
        controller.destroy()
        controller = null
        return
      }

      controller.getPlayerModel()?.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
      })

      controller.use(new FootIK({ skeleton: UAL_SKELETON, soleSkinThickness: 1.6 }))

      ctrl.current = controller
      onReady?.(controller)
    }

    start().catch((e) => console.error('third-person controller init failed:', e))

    return () => {
      disposed = true
      ctrl.current = null
      // destroy() only unparents the camera from the capsule; in first person it hangs
      // off the head bone, so hand it back to the scene before the rig goes away.
      scene.attach(camera)
      controller?.destroy()
      controls?.dispose()
      ownedCollider?.geometry.dispose()
    }
    // Re-initialising on a changed collider is intentional; the other deps are stable.
  }, [scene, camera, gl, collider, onReady])

  useFrame((_, delta) => {
    const c = ctrl.current
    if (!c) return
    c.update(delta)

    const pos = c.getPosition()
    if (!pos) return
    if (import.meta.env.DEV) {
      ;(window as { __pp?: number[] }).__pp = [pos.x, pos.y, pos.z]
      const pc = camera as THREE.PerspectiveCamera
      ;(window as { __cam?: number[] }).__cam = [pc.near, pc.far, pc.fov]
    }
    if (pos.y < DROWN_Y) c.reset(SPAWN.clone())
  })

  return null
}
