import * as THREE from 'three'

// Shared 4-step ramp: the entire stylized look comes from this quantized lighting.
// NearestFilter is what makes MeshToonMaterial band instead of blend.
let ramp: THREE.DataTexture | null = null

export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp
  const steps = new Uint8Array([90, 150, 210, 255])
  ramp = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.needsUpdate = true
  return ramp
}
