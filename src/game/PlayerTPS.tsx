import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { playerController } from 'three-player-controller'
import { FootIK } from 'three-player-controller/foot-ik'
import { createIslandGeometry, terrainHeight } from './terrain'
import { LOW_END } from './quality'
import { rimLight, toonRamp } from './toon'
import { createBlaster, loadBlaster } from './assets/Blaster'
import { mergeSkinnedByMaterial } from './assets/heroLook'

// Luigi rig with the UAL clips retargeted onto it (scripts/retarget-ual.py). The
// controller normalises any model to its capsule height, so the GLB's own size is moot.
// A GLB without clips (gnome.glb) still works: it gets the puppet fallback below.
const MODEL_URL = '/game/character/luigi.glb'

// Bone names of the Luigi (Source "bip") skeleton, for the foot-IK plugin.
const LUIGI_SKELETON = {
  hips: 'bip_pelvis',
  legs: {
    left: { upper: 'bip_hip_L', lower: 'bip_knee_L', foot: 'bip_foot_L', toe: 'bip_toe_L' },
    right: { upper: 'bip_hip_R', lower: 'bip_knee_R', foot: 'bip_foot_R', toe: 'bip_toe_R' },
  },
}

// three-player-controller works in "rig units": its capsule is 180 units tall and every
// gameplay number (speed, gravity, jump, camera distance) is multiplied by `scale`.
// 0.01 maps that rig onto our world: 1.8-unit character, 3 u/s walk, 8.5 u/s sprint,
// -24 u/s² gravity — i.e. the same feel the rapier capsule had (SPEED 8, gravity -22).
const MODEL_SCALE = 0.01
// Fist around the grip: each finger joint rotates about its measured local curl axis
// (finger runs along local +Y; axis = along x inward, expressed in bone space) after the
// animation has written the frame's pose. Angles per phalanx, radians.
const FINGER_CURL: [string, [number, number, number], number[]][] = [
  ['index', [0.36, 0, -0.93], [0.8, 1.05, 0.7]],
  ['middle', [0.56, 0, -0.83], [0.85, 1.1, 0.75]],
  ['ring', [0.57, 0, -0.82], [0.85, 1.1, 0.75]],
  ['pinky', [0.47, 0, -0.88], [0.8, 1.0, 0.7]],
]
// blaster attachment in the hand bone's space (rig units). pos = midpoint of the thumb's
// and middle finger's middle joints, read back through hand.worldToLocal (probe-grip2.mjs).
const WEAPON = { bone: 'bip_hand_R', scale: 36, pos: [-2.17, 6.07, -0.76] as [number, number, number], rot: [-1.7039, -0.6352, 2.0057] as [number, number, number] }
const WALK_SPEED = 300 // * scale = 3 u/s
const RUN_SPEED = 850 // * scale = 8.5 u/s
const CAM_MIN = 80 // * scale = 0.8 world units
const CAM_MAX = 450 // * scale = 4.5 world units

// Arrival: the south beach, not the peak. (0, 44) is the gameplay APPROACH point the
// stations aim at; the nearest sand there that clears the surf is z = 43 (terrain 1.54,
// i.e. WATER_LEVEL + 1.5). Facing -Z the player looks up the island at the high ground
// and the praia station, with the sea and the pier behind him — the framed first shot.
export const SPAWN_X = 0
export const SPAWN_Z = 43
/** computed per mount: the beach height depends on the active biome's terrain */
export const spawnPoint = () => new THREE.Vector3(SPAWN_X, terrainHeight(SPAWN_X, SPAWN_Z) + 2.2, SPAWN_Z)
/** camera/character heading at spawn: 0 = looking down -Z, inland */
export const SPAWN_YAW = 0
const DROWN_Y = -12
// Double jump: Space while airborne (once per airtime) kicks the character up again and
// opens a short glide — low gravity + a held horizontal sprint along the move direction.
const AIR_JUMP = 520 // * scale; ground jump is 600
const GLIDE_GRAVITY = -700 // * scale; normal is -2400
const GLIDE_SPEED = 1100 // * scale = 11 u/s
const GLIDE_MS = 900

// Puppet fallback for an unrigged mesh: the whole body hops, waddles and leans from a
// pivot at the feet, squashes on landing and stretches in the air — a toy-figurine walk.
const HOP_HEIGHT = 0.07
const WADDLE = 0.07
const STRIDE = 3.2 // phase advance per world unit travelled
const LEAN = 0.12
const LAND_SQUASH = 0.18

// The controller's animation system wants named clips for every state and warns on every
// transition otherwise. Feed it no-op clips (a zero track on a dummy node) so the mixer
// is happy and the jump state machine (LoopOnce + 'finished' events) still advances.
const CLIP_NAMES: [string, number][] = [
  ['Idle_Loop', 1],
  ['Walk_Loop', 1],
  ['Sprint_Loop', 1],
  ['Jump_Start', 0.25],
  ['Jump_Loop', 1],
  ['Jump_Land', 0.25],
]
function dummyClips(root: THREE.Object3D) {
  const dummy = new THREE.Object3D()
  dummy.name = 'animDummy'
  root.add(dummy)
  return CLIP_NAMES.map(
    ([name, dur]) =>
      new THREE.AnimationClip(name, dur, [
        new THREE.VectorKeyframeTrack('animDummy.position', [0, dur], [0, 0, 0, 0, 0, 0]),
      ]),
  )
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
  /** Additional static colliders (causeway stones etc), merged alongside `collider`. */
  extraColliders?: THREE.Object3D[]
  /** Escape hatch for the raw controller (animations, camera mode, reset, ...). */
  onReady?: (controller: playerController) => void
  /** Where to start and respawn; defaults to the island beach. */
  spawn?: () => THREE.Vector3
  /** Falling below this height resets to `spawn` (default: the sea floor). */
  fallY?: number
}

/**
 * Third-person controller (three-player-controller + its foot-IK plugin).
 *
 * It is fully imperative: it owns the camera, its own OrbitControls, a BVH capsule
 * sweep against `collider` and the character's animation mixer — rapier is not
 * involved, so the player does not collide with rapier bodies (blocks, projectiles).
 */
export function PlayerTPS({ onLockChange, collider, extraColliders, onReady, spawn = spawnPoint, fallY = DROWN_Y }: Props) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const ctrl = useRef<playerController | null>(null)
  const glide = useRef({ used: false, until: 0, baseGravity: 0 })
  const puppet = useRef<THREE.Group | null>(null)
  const gait = useRef({ phase: 0, squash: 0, wasGround: true })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const c = ctrl.current
      const g = glide.current
      if (!c || c.getIsOnGround() || c.getIsFlying() || g.used) return
      g.used = true
      g.until = performance.now() + GLIDE_MS
      c.playerVelocity.y = AIR_JUMP * MODEL_SCALE
      c.gravity = GLIDE_GRAVITY * MODEL_SCALE
      c.animation.startJump(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // GameUI's touch joystick (src/game/ui/TouchControls.tsx): x = right, y = forward,
  // already normalised/deadzoned; zeros on release/blur.
  useEffect(() => {
    const onMove = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number; sprint: boolean }>).detail
      ctrl.current?.setInput({ moveX: d.x, moveY: d.y, shift: d.sprint })
    }
    window.addEventListener('game:move', onMove)
    return () => window.removeEventListener('game:move', onMove)
  }, [])

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
      const rigged = gltf.animations.length > 0
      // Unrigged: re-parent the mesh under a pivot we own — the controller positions
      // gltf.scene itself, the puppet animates the pivot, and the two never fight.
      let pivot: THREE.Group | null = null
      if (!rigged) {
        pivot = new THREE.Group()
        pivot.name = 'puppet'
        pivot.add(...gltf.scene.children)
        gltf.scene.add(pivot)
      }
      // 21 body-part meshes share 8 atlases: merge per atlas so the hero costs 8 draw
      // calls (16 with shadows) instead of 42.
      mergeSkinnedByMaterial(gltf.scene)
      // Toon-shade with the albedo only, like everything else on the island.
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        const old = mesh.material as THREE.MeshStandardMaterial
        mesh.material = rimLight(
          new THREE.MeshToonMaterial({
            map: old.map,
            gradientMap: toonRamp(),
            transparent: old.transparent,
            alphaTest: old.alphaTest,
            side: old.side,
          }),
          '#dff0ff',
          0.75,
          2.6,
        )
        old.dispose()
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.frustumCulled = false
      })
      // The blaster rides the right-hand bone. Bone space is rig units (cm), so the
      // metre-authored model is scaled back up; offsets tuned against a close-up capture.
      const hand = gltf.scene.getObjectByName(WEAPON.bone)
      if (hand) {
        const blaster = await loadBlaster().catch((e) => {
          console.warn('blaster: generated GLB failed, using the procedural one', e)
          return createBlaster()
        })
        blaster.scale.setScalar(WEAPON.scale)
        blaster.position.set(...WEAPON.pos)
        blaster.rotation.set(...WEAPON.rot)
        hand.add(blaster)
        // base × curl every frame (never multiply in place: the idle clip has no finger
        // tracks, so an in-place multiply accumulates and the fingers spin)
        const list: [THREE.Object3D, THREE.Quaternion][] = []
        for (const [finger, axis, angles] of FINGER_CURL)
          angles.forEach((a, i) => {
            const bone = gltf.scene.getObjectByName(`bip_${finger}_${i}_R`)
            if (!bone) return
            const curl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), a)
            list.push([bone, bone.quaternion.clone().multiply(curl)])
          })
        fingers.current = list
      }
      // NOT outlined: addHeroOutline(gltf.scene) works (assets/heroLook.ts) but this rig
      // is 20 sub-meshes, so the inverted-hull pass costs 20 draw calls and at play
      // distance the 15 mm of ink never showed up in a capture. Kept for a simpler rig.
      const animations = rigged ? gltf.animations : dummyClips(gltf.scene)

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
        staticCollider: extraColliders?.length ? [colliderSource, ...extraColliders] : colliderSource,
        initPos: spawn(),
        minCamDistance: CAM_MIN,
        maxCamDistance: CAM_MAX,
        // 0 = capsule bottom, 1 = top. >1 parks the orbit target (= screen-centre
        // reticle) well above the head, character centred horizontally underneath it.
        camLookAtHeightRatio: 1.9,
        enableSpringCamera: true,
        // mode 1: cursor hidden (pointer lock on <body>), mouse orbits the camera and
        // the character turns toward its movement direction — the footIK.html feel.
        thirdMouseMode: 1,
        // Touch: keep the controller's look-area (right half of the screen orbits the
        // camera) but none of its own buttons/joystick — GameUI draws those and feeds
        // movement through the 'game:move' event below.
        isShowMobileControls: true,
        mobileControls: { joystick: false, jump: false, fly: false, view: false, vehicle: false },
        // No vehicles in this game, and flight would let the player leave the island.
        keyMap: { toggleFly: null, toggleVehicle: null },
        playerModelConfig: {
          model: gltf.scene,
          animations,
          scale: MODEL_SCALE,
          idleAnim: 'Idle_Loop',
          walkAnim: 'Walk_Loop',
          runAnim: 'Sprint_Loop',
          jumpAnim: ['Jump_Start', 'Jump_Loop', 'Jump_Land'],
          backwardAnim: 'Walk_Loop',
          speed: WALK_SPEED,
          runSpeed: RUN_SPEED,
          headBoneName: 'bip_head',
          firstPersonCameraOffset: [0, 0.15, 0.12],
          // glTF models front +Z; the controller's forward is -Z
          rotateY: Math.PI,
        },
      })
      if (disposed) {
        controller.destroy()
        controller = null
        return
      }
      if (import.meta.env.DEV) {
        // teleport hook for headless probes (causeway support checks etc)
        const c = controller
        ;(window as { __tp?: (x: number, y: number, z: number) => void }).__tp = (x, y, z) =>
          c.reset(new THREE.Vector3(x, y, z))
      }

      // foot IK on 11 skinned meshes is the heaviest per-frame cost — desktop only
      if (rigged && !LOW_END) controller.use(new FootIK({ skeleton: LUIGI_SKELETON, soleSkinThickness: 1.6 }))
      puppet.current = pivot
      gait.current = { phase: 0, squash: 0, wasGround: true }
      glide.current = { used: false, until: 0, baseGravity: controller.gravity }
      ctrl.current = controller
      onReady?.(controller)
    }

    start().catch((e) => console.error('third-person controller init failed:', e))

    return () => {
      disposed = true
      ctrl.current = null
      puppet.current = null
      // destroy() only unparents the camera from the capsule; in first person it hangs
      // off the head bone, so hand it back to the scene before the rig goes away.
      scene.attach(camera)
      controller?.destroy()
      controls?.dispose()
      ownedCollider?.geometry.dispose()
    }
    // Re-initialising on a changed collider is intentional; the other deps are stable.
  }, [scene, camera, gl, collider, extraColliders, onReady])

  const fingers = useRef<[THREE.Object3D, THREE.Quaternion][]>([])
  useFrame((_, delta) => {
    const c = ctrl.current
    if (!c) return
    c.update(delta)
    for (const [bone, pose] of fingers.current) bone.quaternion.copy(pose)

    const g = glide.current
    if (c.getIsOnGround()) {
      g.used = false
      g.until = 0
    }
    if (g.until) {
      if (performance.now() > g.until) {
        g.until = 0
      } else {
        // the controller eases xz velocity back to walk/run speed every frame; re-pin it
        const v = c.playerVelocity
        const speed = Math.hypot(v.x, v.z)
        if (speed > 1) {
          const k = (GLIDE_SPEED * MODEL_SCALE) / speed
          v.x *= k
          v.z *= k
        }
      }
    }
    if (!g.until && c.gravity !== g.baseGravity) c.gravity = g.baseGravity

    const p = puppet.current
    if (p) {
      const v = c.playerVelocity
      const speed = Math.hypot(v.x, v.z)
      const onGround = c.getIsOnGround()
      const k = gait.current
      if (onGround && !k.wasGround) k.squash = 1
      k.wasGround = onGround
      k.squash = Math.max(0, k.squash - delta * 6)
      const walk = onGround ? Math.min(1, speed / 3) : 0
      k.phase += delta * speed * STRIDE
      p.position.y = Math.abs(Math.sin(k.phase)) * HOP_HEIGHT * walk
      p.rotation.z = Math.sin(k.phase) * WADDLE * walk
      // pivot local +Z is the gnome's front: +x rotation tips the head forward
      p.rotation.x = LEAN * Math.min(1, speed / 8)
      const squash = k.squash * LAND_SQUASH
      const stretch = onGround ? 0 : Math.min(0.1, Math.abs(v.y) * 0.012)
      const breathe = onGround && speed < 0.2 ? Math.sin(performance.now() * 0.0022) * 0.012 : 0
      p.scale.set(1 + squash * 0.6 - stretch * 0.4, 1 - squash + stretch + breathe, 1 + squash * 0.6 - stretch * 0.4)
    }

    const pos = c.getPosition()
    if (!pos) return
    if (import.meta.env.DEV) {
      ;(window as { __pp?: number[] }).__pp = [pos.x, pos.y, pos.z]
      ;(window as { __air?: boolean }).__air = g.until > 0
      ;(window as { __scene?: THREE.Scene }).__scene = scene
      const pc = camera as THREE.PerspectiveCamera
      ;(window as { __cam?: number[] }).__cam = [pc.near, pc.far, pc.fov]
    }
    if (pos.y < fallY) c.reset(spawn())
  })

  return null
}
