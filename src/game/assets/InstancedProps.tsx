import { useEffect, useMemo } from 'react'
import type * as THREE from 'three'
import { buildInstances, useToonParts, type Placement } from './props'

/**
 * Every placement of one model file, as one InstancedMesh per sub-mesh.
 * Shared geometries/materials live in the props cache, so only the per-instance
 * buffers are disposed on unmount.
 */
export function InstancedProps({
  url,
  spots,
  castShadow = true,
}: {
  url: string
  spots: Placement[]
  castShadow?: boolean
}) {
  const parts = useToonParts(url)
  const meshes = useMemo(
    () => (spots.length ? buildInstances(parts, spots, castShadow) : []),
    [parts, spots, castShadow],
  )
  useEffect(() => () => meshes.forEach((m: THREE.InstancedMesh) => m.dispose()), [meshes])
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} dispose={null} />
      ))}
    </>
  )
}

/** Group placements by model file and render them all instanced. */
export function InstancedScatter({ spots }: { spots: (Placement & { url: string })[] }) {
  const byUrl = useMemo(() => {
    const m = new Map<string, Placement[]>()
    for (const s of spots) {
      const list = m.get(s.url)
      if (list) list.push(s)
      else m.set(s.url, [s])
    }
    return [...m.entries()]
  }, [spots])
  return (
    <>
      {byUrl.map(([url, group]) => (
        <InstancedProps key={url} url={url} spots={group} />
      ))}
    </>
  )
}
