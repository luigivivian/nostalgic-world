import { useRef, useState } from 'react'
import { useGame } from '../store'
import { useGameEvent } from './hooks'

const R = 27
const CIRC = 2 * Math.PI * R

export function ProgressRing({
  have,
  total,
  size = 68,
  thumb,
  thumbKey,
}: {
  have: number
  total: number
  size?: number
  thumb?: string | null
  thumbKey?: number
}) {
  const pct = total > 0 ? Math.min(1, have / total) : 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 68 68" aria-hidden="true">
        {/* confetti-dot track: round caps on a 1-unit dash = a ring of dots */}
        <circle className="ring-track" cx="34" cy="34" r={R} strokeDasharray="0.5 5.2" />
        <circle
          className="ring-fill"
          cx="34"
          cy="34"
          r={R}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
        />
      </svg>
      <div className="ring-core">
        {thumb ? (
          <img key={thumbKey} className="ring-thumb" src={thumb} alt="" draggable={false} />
        ) : (
          <span className="ring-pct">{Math.round(pct * 100)}%</span>
        )}
      </div>
    </div>
  )
}

/** Top-left cluster: which collection you are filling, and how full it is. */
export function AlbumCluster() {
  const collection = useGame((s) => s.collection)
  const have = useGame((s) => Object.keys(s.album).length)
  const total = useGame((s) => s.collection?.poolSize ?? 0)
  const [last, setLast] = useState<{ front: string; seq: number } | null>(null)
  const seq = useRef(0)

  useGameEvent((e) => {
    if (e.type === 'collect' && e.tazo.front) setLast({ front: e.tazo.front, seq: ++seq.current })
  })

  return (
    <div className="hud-album">
      <div className="album-badge">
        <span className="badge-year">{collection?.year ?? '—'}</span>
        <span className="badge-name">{collection?.name ?? 'Coleção'}</span>
      </div>
      <div className="album-row">
        <ProgressRing have={have} total={total} thumb={last?.front} thumbKey={last?.seq} />
        <div className="album-count">
          <strong className="num">
            {have}
            <span className="slash">/</span>
            {total}
          </strong>
          <span className="album-label">no álbum</span>
        </div>
      </div>
    </div>
  )
}
