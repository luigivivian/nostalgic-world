import { useEffect, useMemo, useState } from 'react'
import { Outlines } from '@react-three/drei'
import * as THREE from 'three'
import { rimLight, toonRamp } from '../toon'
import { bagGeometry } from './bagGeometry'
import { acquireBagTexture, bagSources, onBagTextureDisposed, proceduralBagTexture, releaseBagTexture } from './bagTexture'

export { BAG_W, BAG_H, BAG_D } from './bagGeometry'

// Snack bag: the thing the whole game is about shooting. Procedural pillow-pack mesh
// (bagGeometry.ts) wearing the real EMBALAGEM scan of its collection, toon-shaded with
// the shared ramp and outlined so it separates from the vegetation behind it.

const OUTLINE = '#2a1a12'
/** unprinted foil while the scan decodes — never leaves a hole in the wall */
const LOADING_COLOR = '#c8543a'

// One material per texture: bags of the same collection share the scan, so they share
// the material too (fewer programs, and the toon ramp is set up once).
const materials = new Map<THREE.Texture, THREE.MeshToonMaterial>()
// the scan cache owns texture lifetime; drop our material when it lets a scan go
onBagTextureDisposed((t) => {
  materials.get(t)?.dispose()
  materials.delete(t)
})

export function bagMaterial(map: THREE.Texture | null): THREE.MeshToonMaterial {
  if (!map) return loadingMaterial
  const hit = materials.get(map)
  if (hit) return hit
  const m = rimLight(new THREE.MeshToonMaterial({ map, gradientMap: toonRamp() }), '#fff1cc', 0.28)
  materials.set(map, m)
  return m
}

const loadingMaterial = new THREE.MeshToonMaterial({ color: LOADING_COLOR, gradientMap: toonRamp() })

interface Props {
  /** collection slug — the EMBALAGEM scans under /collections/<slug>/ */
  slug: string
  /** which bag scan of that collection; wraps around the available ones */
  variant?: number
  scale?: number
  /** the outline pass is a second draw call — off for small/background bags */
  outline?: boolean
}

/** Kicks off the manifest read and the first scan decode for a collection. */
export function preloadSnackBag(slug: string) {
  bagSources(slug).then((s) => {
    if (s.length) acquireBagTexture(s[0].url)
  })
}

/**
 * The collection's scan for one bag variant, or null while it decodes. Manual load
 * (not useLoader): a suspending texture swap blanks the mesh for a frame, and these
 * are the targets — a blink reads as a broken bag.
 */
export function useBagTexture(slug: string, variant: number): THREE.Texture | null {
  const [map, setMap] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    let held: string | null = null
    bagSources(slug)
      .then((sources) => {
        if (!alive) return
        if (!sources.length) {
          setMap(proceduralBagTexture(slug))
          return
        }
        const src = sources[variant % sources.length]
        held = src.url
        return acquireBagTexture(src.url).then((t) => {
          if (alive) setMap(t)
        })
      })
      .catch(() => alive && setMap(proceduralBagTexture(slug)))
    return () => {
      alive = false
      if (held) releaseBagTexture(held)
    }
  }, [slug, variant])
  return map
}

export function SnackBag({ slug, variant = 0, scale = 1, outline = true }: Props) {
  const geometry = useMemo(() => bagGeometry(variant), [variant])
  const map = useBagTexture(slug, variant)
  const material = bagMaterial(map)

  // dispose={null}: geometry and material are shared module-level singletons.
  return (
    <mesh geometry={geometry} material={material} scale={scale} castShadow receiveShadow dispose={null}>
      {outline && <Outlines thickness={0.03} color={OUTLINE} />}
    </mesh>
  )
}
