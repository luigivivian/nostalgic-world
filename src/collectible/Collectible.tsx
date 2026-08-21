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
  /**
   * Decode off the main thread and downscale to this width (keeps aspect). In-game
   * pickups are a few cm on screen: 256px instead of 1024px is 16x less GPU memory
   * and no decode hitch. Omit for the viewer (full resolution).
   */
  maxSize?: number
}

async function loadTexture(url: string, maxSize?: number): Promise<THREE.Texture> {
  if (!maxSize) return new THREE.TextureLoader().loadAsync(url)
  // flipY is ignored for ImageBitmaps — the orientation must be baked at decode time.
  try {
    const bitmap = await new THREE.ImageBitmapLoader()
      .setOptions({ imageOrientation: 'flipY', resizeWidth: maxSize, resizeQuality: 'medium' })
      .loadAsync(url)
    return new THREE.CanvasTexture(bitmap)
  } catch {
    // older Safari: no resize options on createImageBitmap — take the full-size path
    return new THREE.TextureLoader().loadAsync(url)
  }
}

function disposeTexture(t: THREE.Texture) {
  t.dispose()
  const img = t.image as { close?: () => void } | undefined
  img?.close?.()
}

export function Collectible({ shape, frontUrl, backUrl, maxSize }: Props) {
  const [maps, setMaps] = useState<{ front: THREE.Texture; back: THREE.Texture | null } | null>(
    null,
  )

  // Manual loading instead of useLoader: suspense re-fallback makes the mesh vanish for
  // a frame (a visible blink). The old pair stays on screen until the new one is ready,
  // and disposal is explicit — no GPU accumulation.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadTexture(frontUrl, maxSize), backUrl ? loadTexture(backUrl, maxSize) : null])
      .then(([front, back]) => {
        if (cancelled) {
          disposeTexture(front)
          if (back) disposeTexture(back)
          return
        }
        for (const t of [front, back]) {
          if (!t) continue
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = maxSize ? 2 : 8
        }
        setMaps({ front, back })
      })
      .catch((e) => console.error('collectible texture load failed:', frontUrl, backUrl, e))
    return () => {
      cancelled = true
    }
  }, [frontUrl, backUrl, shape, maxSize])

  // Dispose the previous texture pair when replaced, and the last one on unmount.
  useEffect(() => {
    if (!maps) return
    return () => {
      disposeTexture(maps.front)
      if (maps.back) disposeTexture(maps.back)
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
