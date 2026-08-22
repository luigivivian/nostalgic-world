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

const NOISE_GLSL = /* glsl */ `
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x),
               mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`

/**
 * Procedural surface grain for the island: three octaves of value noise in world XZ
 * modulate the albedo (±10%) and a broad warm "dry patch" mask breaks up the flat
 * vertex-colour bands — no texture, a few ALU ops. The terrain mesh sits at the origin
 * with no transform, so object space is world space.
 */
export function terrainGrain(material: THREE.MeshToonMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 vGrainPos;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGrainPos = transformed;')
    shader.fragmentShader =
      'varying vec3 vGrainPos;\n' +
      NOISE_GLSL +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        {
          vec2 gp = vGrainPos.xz;
          // painted blotches: mid-frequency noise with a soft threshold, two tones
          float blotch = smoothstep(0.42, 0.62, gNoise(gp * 0.45) * 0.7 + gNoise(gp * 1.3) * 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.86, 0.92, 0.80), blotch * 0.55);
          // fine grain on top, the "paper" of the toon look
          float grain = (gNoise(gp * 3.7) - 0.5) * 0.10 + (gNoise(gp * 11.0) - 0.5) * 0.06;
          diffuseColor.rgb *= 1.0 + grain;
          float dryMask = smoothstep(0.5, 0.78, gNoise(gp * 0.06 + 13.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.0, 0.78), dryMask * 0.6);
        }`,
      )
  }
  material.customProgramCacheKey = () => 'toon-terrain-grain'
  return material
}

/**
 * Fresnel rim on a toon material: a thin cool edge light that separates the hero and
 * the bags from the vegetation behind them (the toon ramp alone flattens silhouettes
 * against a busy background). Added to the emissive term so it survives the ramp.
 */
export function rimLight(material: THREE.MeshToonMaterial, color = '#cfe6ff', strength = 0.35, power = 3.0) {
  const rimColor = new THREE.Color(color)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor }
    shader.uniforms.uRimStrength = { value: strength }
    shader.uniforms.uRimPower = { value: power }
    shader.fragmentShader =
      'uniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;\n' +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        {
          float rimF = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
          totalEmissiveRadiance += uRimColor * rimF * uRimStrength;
        }`,
      )
  }
  material.customProgramCacheKey = () => 'toon-rim'
  return material
}
