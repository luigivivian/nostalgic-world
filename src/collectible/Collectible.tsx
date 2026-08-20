import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import {
  createTazoGeometry,
  createCardGeometry,
  createPhotoGeometry,
  CARD_FACE_ASPECT,
} from './geometry'

// One shared geometry per shape — only textures change per item.
const geometries = {
  disc: createTazoGeometry(),
  card: createCardGeometry(),
  photo: createPhotoGeometry(),
}

export type CollectibleShape = keyof typeof geometries

interface Props {
  shape: CollectibleShape
  frontUrl: string
  backUrl: string | null
}

export function Collectible({ shape, frontUrl, backUrl }: Props) {
  const [maps, setMaps] = useState<{ front: THREE.Texture; back: THREE.Texture | null } | null>(
    null,
  )

  // Manual loading instead of useLoader: suspense re-fallback makes the mesh vanish for
  // a frame (a visible blink). The old pair stays on screen until the new one is ready,
  // and disposal is explicit — no GPU accumulation.
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    Promise.all([loader.loadAsync(frontUrl), backUrl ? loader.loadAsync(backUrl) : null])
      .then(([front, back]) => {
        if (cancelled) {
          front.dispose()
          back?.dispose()
          return
        }
        for (const t of [front, back]) {
          if (!t) continue
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = 8
        }
        setMaps({ front, back })
      })
      .catch((e) => console.error('collectible texture load failed:', frontUrl, backUrl, e))
    return () => {
      cancelled = true
    }
  }, [frontUrl, backUrl, shape])

  // Dispose the previous texture pair when replaced, and the last one on unmount.
  useEffect(() => {
    if (!maps) return
    return () => {
      maps.front.dispose()
      maps.back?.dispose()
    }
  }, [maps])

  const materials = useMemo(() => {
    if (!maps) return null
    const print = (map: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.55,
        specularIntensity: 0.35,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.3,
      })
    const cardboard = new THREE.MeshStandardMaterial({
      color: '#e6ddcc',
      roughness: 0.85,
      envMapIntensity: 0.3,
    })
    return [print(maps.front), maps.back ? print(maps.back) : cardboard.clone(), cardboard]
  }, [maps])

  useEffect(() => {
    if (!materials) return
    return () => materials.forEach((m) => m.dispose())
  }, [materials])

  // Scans are downloaded with their real aspect (fit): the mesh adapts to the texture,
  // never the other way around — nothing gets cropped.
  const texAspect = useMemo(() => {
    if (!maps) return 1
    const img = maps.front.image as { width?: number; height?: number } | undefined
    if (!img?.width || !img?.height) return 1
    return img.width / img.height
  }, [maps])

  if (!materials) return null
  const scale: [number, number, number] =
    shape === 'photo'
      ? [texAspect * 1.6, 1.6, 1]
      : shape === 'card'
        ? [texAspect / CARD_FACE_ASPECT, 1, 1]
        : [1, 1, 1]
  // dispose={null}: the geometries are module-level singletons shared across every
  // viewer/pickup — R3F must not dispose them when one mesh unmounts.
  return (
    <mesh geometry={geometries[shape]} material={materials} castShadow scale={scale} dispose={null} />
  )
}
