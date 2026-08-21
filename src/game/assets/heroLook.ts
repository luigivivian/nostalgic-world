import * as THREE from 'three'
import { toonRamp } from '../toon'

// The Quaternius UAL rig ships as ONE mesh with two flat materials (orange body,
// purple joints) — a mannequin, not a character. There are no body-part meshes to
// recolour, so the costume is painted per vertex from the skinning weights: every
// vertex takes the colour of the bone that moves it most. That gives skin / t-shirt /
// shorts / sneakers zones on the untouched geometry, and the toon ramp does the rest.

type Region = 'skin' | 'shirt' | 'shirtAccent' | 'shorts' | 'shoe' | 'sole'

const PALETTE: Record<Region, THREE.Color> = {
  skin: new THREE.Color('#d99a6c'),
  shirt: new THREE.Color('#1fa9c4'),
  shirtAccent: new THREE.Color('#f4c020'),
  shorts: new THREE.Color('#7b3fc4'),
  shoe: new THREE.Color('#f2efe6'),
  sole: new THREE.Color('#d8443a'),
}

const CAP_COLOR = '#e0442f'
const CAP_BRIM = '#f4c020'
const OUTLINE_COLOR = new THREE.Color('#241a14')
// The GLB is authored in metres (mesh bbox 1.83 high) and the controller does NOT scale
// the model node — its `scale` only maps its own physics numbers. Everything here is in
// metres; the first pass used rig units and produced a 9.6 m cap and a 1.5 m outline hull.
/** ~1.5 cm of ink in world space */
const OUTLINE_THICKNESS = 0.015

/** bone name -> costume zone; anything unmatched falls back to the shirt */
function regionForBone(name: string): Region {
  const n = name.toLowerCase()
  if (n.startsWith('foot') || n.startsWith('ball')) return 'shoe'
  if (n.startsWith('thigh') || n === 'pelvis') return 'shorts'
  if (n.startsWith('calf')) return 'skin'
  if (n.startsWith('lowerarm') || n.startsWith('hand')) return 'skin'
  if (/^(index|middle|pinky|ring|thumb)/.test(n)) return 'skin'
  if (n === 'head' || n.startsWith('neck')) return 'skin'
  if (n.startsWith('upperarm') || n.startsWith('clavicle')) return 'shirt'
  return 'shirt'
}

/** Paint one skinned mesh; T-pose Y drives the stripe bands and the sneaker sole. */
function paint(mesh: THREE.SkinnedMesh) {
  const geo = mesh.geometry
  const skinIndex = geo.attributes.skinIndex as THREE.BufferAttribute | undefined
  const skinWeight = geo.attributes.skinWeight as THREE.BufferAttribute | undefined
  const pos = geo.attributes.position as THREE.BufferAttribute
  if (!skinIndex || !skinWeight) return

  const bones = mesh.skeleton.bones
  const regions = bones.map((b) => regionForBone(b.name))
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    // dominant bone = the one with the largest skinning weight
    let best = 0
    let bestW = -1
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k)
      if (w > bestW) {
        bestW = w
        best = skinIndex.getComponent(i, k)
      }
    }
    let region = regions[best] ?? 'shirt'
    const y = pos.getY(i)
    // t-shirt stripes: 11 cm bands, the 90s tee this whole island is dressed for
    if (region === 'shirt' && Math.floor(y / 0.11) % 2 === 0) region = 'shirtAccent'
    // sneaker sole: the bottom 2 cm of the shoe zone
    if (region === 'shoe' && y < 0.022) region = 'sole'
    c.copy(PALETTE[region])
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// Inverted-hull outline for a SkinnedMesh: drei's <Outlines> needs a mesh child in the
// React tree and this rig is created imperatively by the controller, so the same trick
// is done by hand — a BackSide clone that runs the stock skinning chunks and pushes
// each vertex along its (skinned) normal, so the ink follows the animation.
const outlineMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uThickness: { value: OUTLINE_THICKNESS },
    uColor: { value: OUTLINE_COLOR },
  },
  vertexShader: /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    uniform float uThickness;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      transformed += objectNormal * uThickness;
      #include <skinning_vertex>
      #include <project_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
})

function addOutline(mesh: THREE.SkinnedMesh) {
  if (mesh.children.some((c) => c.name.endsWith('_outline'))) return
  const outline = new THREE.SkinnedMesh(mesh.geometry, outlineMaterial)
  outline.name = mesh.name + '_outline'
  outline.bind(mesh.skeleton, mesh.bindMatrix)
  outline.castShadow = false
  outline.receiveShadow = false
  outline.frustumCulled = false
  mesh.add(outline)
}

/**
 * Baseball cap, procedural: a half-dome plus a brim, parented to the head bone.
 * Two frames to reconcile — the bone's axes are the rig's (units are rig units, 1/100
 * of a world unit), and the model group carries the controller's `rotateY` offset — so
 * the cap is re-oriented into the model frame and the brim is aimed down the character's
 * real facing, taken from the capsule.
 */
function addCap(head: THREE.Bone, root: THREE.Object3D, facing?: THREE.Object3D) {
  const cap = new THREE.Group()
  cap.name = 'heroCap'

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(7.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshToonMaterial({ color: CAP_COLOR, gradientMap: toonRamp() }),
  )
  dome.scale.set(1, 0.62, 1.05)
  dome.castShadow = true
  cap.add(dome)

  const brimPivot = new THREE.Group()
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(7.0, 7.0, 0.9, 18, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
    new THREE.MeshToonMaterial({ color: CAP_BRIM, gradientMap: toonRamp() }),
  )
  brim.scale.set(1, 1, 1.45)
  brim.position.set(0, 0.2, 2.6)
  brim.castShadow = true
  brimPivot.add(brim)
  cap.add(brimPivot)

  root.updateWorldMatrix(true, true)
  const q = head.getWorldQuaternion(new THREE.Quaternion()).invert()
  q.multiply(root.getWorldQuaternion(new THREE.Quaternion()))
  cap.quaternion.copy(q)
  cap.position.copy(new THREE.Vector3(0, 5.6, 0.6).applyQuaternion(q))

  if (facing) {
    // the capsule's +Z is where the character looks; express it in the cap's frame
    const fwd = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(facing.getWorldQuaternion(new THREE.Quaternion()))
      .applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert())
    fwd.y = 0
    if (fwd.lengthSq() > 1e-4)
      brimPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.normalize())
  }
  head.add(cap)
}

/**
 * Ink pass only: every other object on the island carries a drei <Outlines> hull, and
 * the hero has to read the same way. Works on any rig (the skinning chunks compile out
 * for a plain Mesh), so it survives a character swap.
 */
export function addHeroOutline(model: THREE.Object3D) {
  const meshes: THREE.SkinnedMesh[] = []
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if ((m.isSkinnedMesh || (m as unknown as THREE.Mesh).isMesh) && !m.name.endsWith('_outline'))
      meshes.push(m)
  })
  for (const m of meshes) {
    if (m.isSkinnedMesh) addOutline(m)
    else if (!m.children.some((c) => c.name.endsWith('_outline'))) {
      const outline = new THREE.Mesh(m.geometry, outlineMaterial)
      outline.name = m.name + '_outline'
      outline.frustumCulled = false
      m.add(outline)
    }
  }
}

/**
 * Give the controller's mannequin an authored look. Call once, after
 * `controller.getPlayerModel()` resolves; safe to call again (it no-ops on repaint).
 */
export function applyHeroLook(model: THREE.Object3D, facing?: THREE.Object3D) {
  const skinned: THREE.SkinnedMesh[] = []
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh || mesh.name.endsWith('_outline')) return
    skinned.push(mesh)
  })

  for (const mesh of skinned) {
    if (!mesh.geometry.getAttribute('color')) paint(mesh)
    const old = mesh.material
    mesh.material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() })
    if (Array.isArray(old)) old.forEach((m) => m.dispose())
    else old.dispose()
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (!mesh.children.some((c) => c.name.endsWith('_outline'))) addOutline(mesh)
  }

  const head = skinned[0]?.skeleton.bones.find((b) => b.name === 'Head')
  if (head && !head.children.some((c) => c.name === 'heroCap')) addCap(head, model, facing)
}
