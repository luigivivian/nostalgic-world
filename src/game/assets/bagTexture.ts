import * as THREE from 'three'
import { BAG_FACE_ASPECT } from './bagGeometry'

// The bag print comes from the real EMBALAGEM scans in public/collections. Many bags
// share one scan, so textures are cached per URL and refcounted: the scan is decoded
// once per collection and freed when the last bag using it goes away.

const TEX_SIZE = 512
/** scan borders are white paper — crop this much off each edge before the cover fit */
const INSET = 0.04

export interface BagSource {
  url: string
  /** display name of the collection, used by the procedural fallback label */
  name: string
}

interface Entry {
  promise: Promise<THREE.Texture>
  texture: THREE.Texture | null
  refs: number
  /** pending deferred disposal (see releaseBagTexture) */
  release: ReturnType<typeof setTimeout> | null
}

const textures = new Map<string, Entry>()
/** A round restart remounts every bag at once: hold freed scans briefly so the next
 *  mount reuses them instead of re-decoding, and so dependent caches get one signal. */
const RELEASE_GRACE_MS = 2000
const disposeListeners = new Set<(t: THREE.Texture) => void>()

/** Called when a cached scan is really disposed — material caches keyed by texture prune here. */
export function onBagTextureDisposed(fn: (t: THREE.Texture) => void) {
  disposeListeners.add(fn)
}
const sourceLists = new Map<string, Promise<BagSource[]>>()

/**
 * Cover-crop: the mesh's printed face is 0.8 x 1.2, the scans are ~0.66 — fit the
 * short axis and centre the rest so the white scan padding falls outside the face.
 */
function coverCrop(tex: THREE.Texture) {
  const img = tex.image as { width?: number; height?: number } | undefined
  const aspect = img?.width && img?.height ? img.width / img.height : BAG_FACE_ASPECT
  let rx = 1
  let ry = 1
  if (aspect > BAG_FACE_ASPECT) rx = BAG_FACE_ASPECT / aspect
  else ry = aspect / BAG_FACE_ASPECT
  rx *= 1 - INSET * 2
  ry *= 1 - INSET * 2
  tex.repeat.set(rx, ry)
  tex.offset.set((1 - rx) / 2, (1 - ry) / 2)
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
}

async function decode(url: string): Promise<THREE.Texture> {
  let tex: THREE.Texture
  try {
    // flipY is ignored for ImageBitmaps — the orientation is baked at decode time.
    const bitmap = await new THREE.ImageBitmapLoader()
      .setOptions({ imageOrientation: 'flipY', resizeWidth: TEX_SIZE, resizeQuality: 'medium' })
      .loadAsync(url)
    tex = new THREE.CanvasTexture(bitmap)
  } catch {
    // older Safari: no resize options on createImageBitmap — take the full-size path
    tex = await new THREE.TextureLoader().loadAsync(url)
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  coverCrop(tex)
  return tex
}

export function acquireBagTexture(url: string): Promise<THREE.Texture> {
  let e = textures.get(url)
  if (!e) {
    e = { promise: decode(url), texture: null, refs: 0, release: null }
    e.promise.then((t) => {
      e!.texture = t
    })
    textures.set(url, e)
  }
  if (e.release) {
    clearTimeout(e.release)
    e.release = null
  }
  e.refs++
  return e.promise
}

export function releaseBagTexture(url: string) {
  const e = textures.get(url)
  if (!e) return
  e.refs--
  if (e.refs > 0 || e.release) return
  e.release = setTimeout(() => {
    if (e.refs > 0) return
    textures.delete(url)
    e.promise.then((t) => {
      disposeListeners.forEach((fn) => fn(t))
      t.dispose()
      const img = t.image as { close?: () => void } | undefined
      img?.close?.()
    })
  }, RELEASE_GRACE_MS)
}

interface Manifest {
  name?: string
  sections?: { title: string; items: { front: string }[] }[]
}

/**
 * Bag scans for a collection, ordered. Prefers the offline-curated portrait list in
 * /game/bag-textures.json (built by .tmp/gen-bag-index.mjs — it drops the landscape
 * TV frames and lote photos that share the EMBALAGEM sections), then falls back to
 * reading the manifest's EMBALAGEM/LANCHINHO sections directly.
 */
export function bagSources(slug: string): Promise<BagSource[]> {
  const hit = sourceLists.get(slug)
  if (hit) return hit
  const load = (async (): Promise<BagSource[]> => {
    const base = `/collections/${slug}/`
    let name = slug
    let fronts: string[] = []
    try {
      const m: Manifest = await fetch(base + 'manifest.json').then((r) => r.json())
      name = m.name ?? slug
      fronts = (m.sections ?? [])
        .filter((s) => /EMBALAGE|LANCHINHO/i.test(s.title))
        .flatMap((s) => s.items.map((i) => i.front))
    } catch {
      /* collection has no manifest — the procedural bag covers it */
    }
    try {
      const curated: Record<string, string[]> = await fetch('/game/bag-textures.json').then((r) => r.json())
      if (curated[slug]?.length) fronts = curated[slug]
    } catch {
      /* index missing — the manifest order stands */
    }
    return fronts.map((f) => ({ url: base + f, name }))
  })()
  sourceLists.set(slug, load)
  return load
}

const fallbacks = new Map<string, THREE.Texture>()

/**
 * No EMBALAGEM scan for this collection: a generic Fandangos-red bag with a printed
 * "ELMA CHIPS · TAZO" burst and the collection name, so the target still reads as a
 * snack bag of this era instead of an untextured blob.
 */
export function proceduralBagTexture(label: string): THREE.Texture {
  const cached = fallbacks.get(label)
  if (cached) return cached
  const w = 256
  const h = 384
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  const bg = c.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#d0201c')
  bg.addColorStop(0.5, '#f04a22')
  bg.addColorStop(1, '#b3140f')
  c.fillStyle = bg
  c.fillRect(0, 0, w, h)

  // yellow belly band
  c.fillStyle = '#f7c11e'
  c.beginPath()
  c.moveTo(0, h * 0.46)
  c.quadraticCurveTo(w * 0.5, h * 0.38, w, h * 0.5)
  c.lineTo(w, h * 0.72)
  c.quadraticCurveTo(w * 0.5, h * 0.66, 0, h * 0.74)
  c.closePath()
  c.fill()

  c.fillStyle = '#ffffff'
  c.font = 'bold 34px Impact, Haettenschweiler, sans-serif'
  c.textAlign = 'center'
  c.fillText('ELMA CHIPS', w / 2, h * 0.2)
  c.strokeStyle = '#2a1a12'
  c.lineWidth = 2
  c.strokeText('ELMA CHIPS', w / 2, h * 0.2)

  // tazo burst
  c.save()
  c.translate(w * 0.5, h * 0.58)
  c.fillStyle = '#1b9ad6'
  c.beginPath()
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    const r = i % 2 === 0 ? 62 : 42
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8)
  }
  c.closePath()
  c.fill()
  c.fillStyle = '#ffffff'
  c.font = 'bold 30px Impact, Haettenschweiler, sans-serif'
  c.fillText('TAZO', 0, 10)
  c.restore()

  c.fillStyle = '#ffffff'
  c.font = 'bold 15px Arial, sans-serif'
  const name = label.length > 26 ? label.slice(0, 25) + '…' : label
  c.fillText(name.toUpperCase(), w / 2, h * 0.86)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  coverCrop(tex)
  fallbacks.set(label, tex)
  return tex
}
