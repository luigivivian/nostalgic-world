import { create } from 'zustand'
import type { PoolTazo } from './tazoPool'

// Single source of truth for gameplay state. Gameplay systems write here; HUD, VFX and
// audio only read/subscribe. Nothing in this file touches three.js or the DOM.

export type GamePhase = 'idle' | 'playing' | 'paused' | 'roundOver'
export type Rarity = 'common' | 'rare' | 'legendary'
export type RoundEndReason = 'ammo' | 'cleared' | 'quit'

export type GameEvent =
  | { type: 'roundStart'; at: number; round: number }
  | { type: 'roundOver'; at: number; reason: RoundEndReason; score: number }
  | { type: 'shot'; at: number; ammoLeft: number; pos?: [number, number, number]; dir?: [number, number, number] }
  | { type: 'dryFire'; at: number }
  | { type: 'hit'; at: number; pos: [number, number, number]; targetId: number; stationId: string; combo: number }
  | { type: 'miss'; at: number }
  | { type: 'collect'; at: number; pos: [number, number, number]; tazo: PoolTazo; rarity: Rarity; isNew: boolean }
  | { type: 'ammoPickup'; at: number; amount: number; pos: [number, number, number] }
  | { type: 'stationCleared'; at: number; stationId: string }
  | { type: 'albumComplete'; at: number }

export interface AlbumEntry {
  tazo: PoolTazo
  rarity: Rarity
  count: number
  firstAt: number
}

export interface StationState {
  id: string
  name: string
  /** 1 = static targets near spawn, 2 = moving, 3 = swinging/far (rare drops) */
  tier: 1 | 2 | 3
  pos: [number, number, number]
  targetsTotal: number
  targetsLeft: number
  unlocked: boolean
}

export interface CollectionInfo {
  slug: string
  name: string
  year: number
  /** number of distinct tazos in the drop pool — the album denominator */
  poolSize: number
}

export interface Diagnostics {
  fps: number
  calls: number
  triangles: number
  geometries: number
  textures: number
  bodies: number
  pickups: number
  fragments: number
}

export const START_AMMO = 12
export const MAX_AMMO = 24
export const COMBO_WINDOW_MS = 2500
const EVENT_LOG = 32

interface GameState {
  phase: GamePhase
  round: number
  score: number
  combo: number
  bestCombo: number
  lastHitAt: number
  ammo: number
  collection: CollectionInfo | null
  /** keyed by tazo.front (unique per item) */
  album: Record<string, AlbumEntry>
  stations: StationState[]
  /** most recent event + a monotonically increasing sequence so subscribers can diff */
  lastEvent: GameEvent | null
  eventSeq: number
  events: GameEvent[]
  diagnostics: Diagnostics

  setCollection: (c: CollectionInfo) => void
  setStations: (s: StationState[]) => void
  patchStation: (id: string, patch: Partial<StationState>) => void
  startRound: () => void
  endRound: (reason: RoundEndReason) => void
  setPhase: (p: GamePhase) => void
  /** consumes one ammo; returns false (and emits dryFire) when empty */
  tryShoot: (pos?: [number, number, number], dir?: [number, number, number]) => boolean
  registerHit: (targetId: number, stationId: string, pos: [number, number, number]) => void
  registerMiss: () => void
  collect: (tazo: PoolTazo, rarity: Rarity, pos: [number, number, number]) => void
  addAmmo: (n: number, pos: [number, number, number]) => void
  setDiagnostics: (d: Partial<Diagnostics>) => void
  emit: (e: GameEvent) => void
  resetGame: () => void
}

const rarityScore: Record<Rarity, number> = { common: 100, rare: 300, legendary: 1000 }

const initial = {
  phase: 'idle' as GamePhase,
  round: 0,
  score: 0,
  combo: 0,
  bestCombo: 0,
  lastHitAt: 0,
  ammo: START_AMMO,
  collection: null,
  album: {},
  stations: [],
  lastEvent: null,
  eventSeq: 0,
  events: [],
  diagnostics: { fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, bodies: 0, pickups: 0, fragments: 0 },
}

export const useGame = create<GameState>()((set, get) => {
  const emit = (e: GameEvent) =>
    set((s) => ({ lastEvent: e, eventSeq: s.eventSeq + 1, events: [...s.events, e].slice(-EVENT_LOG) }))

  return {
    ...initial,

    setCollection: (collection) => set({ collection }),
    setStations: (stations) => set({ stations }),
    patchStation: (id, patch) =>
      set((s) => ({ stations: s.stations.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),

    startRound: () => {
      const round = get().round + 1
      set({ phase: 'playing', round, ammo: START_AMMO, combo: 0, lastHitAt: 0 })
      emit({ type: 'roundStart', at: performance.now(), round })
    },
    endRound: (reason) => {
      set({ phase: 'roundOver' })
      emit({ type: 'roundOver', at: performance.now(), reason, score: get().score })
    },
    setPhase: (phase) => set({ phase }),

    tryShoot: (pos, dir) => {
      const { ammo, phase } = get()
      if (phase !== 'playing') return false
      if (ammo <= 0) {
        emit({ type: 'dryFire', at: performance.now() })
        return false
      }
      set({ ammo: ammo - 1 })
      emit({ type: 'shot', at: performance.now(), ammoLeft: ammo - 1, pos, dir })
      return true
    },
    registerHit: (targetId, stationId, pos) => {
      const now = performance.now()
      const s = get()
      const combo = now - s.lastHitAt < COMBO_WINDOW_MS ? s.combo + 1 : 1
      const st = s.stations.find((x) => x.id === stationId)
      const targetsLeft = Math.max(0, (st?.targetsLeft ?? 1) - 1)
      set({
        combo,
        bestCombo: Math.max(s.bestCombo, combo),
        lastHitAt: now,
        score: s.score + 50 * combo,
        stations: s.stations.map((x) => (x.id === stationId ? { ...x, targetsLeft } : x)),
      })
      emit({ type: 'hit', at: now, pos, targetId, stationId, combo })
      if (st && st.targetsLeft > 0 && targetsLeft === 0) emit({ type: 'stationCleared', at: now, stationId })
    },
    registerMiss: () => {
      set({ combo: 0 })
      emit({ type: 'miss', at: performance.now() })
    },
    collect: (tazo, rarity, pos) => {
      const now = performance.now()
      const s = get()
      const prev = s.album[tazo.front]
      const isNew = !prev
      const album = {
        ...s.album,
        [tazo.front]: prev
          ? { ...prev, count: prev.count + 1 }
          : { tazo, rarity, count: 1, firstAt: now },
      }
      set({ album, score: s.score + (isNew ? rarityScore[rarity] : 25) })
      emit({ type: 'collect', at: now, pos, tazo, rarity, isNew })
      const total = s.collection?.poolSize ?? 0
      if (isNew && total > 0 && Object.keys(album).length >= total) emit({ type: 'albumComplete', at: now })
    },
    addAmmo: (n, pos) => {
      set((s) => ({ ammo: Math.min(MAX_AMMO, s.ammo + n) }))
      emit({ type: 'ammoPickup', at: performance.now(), amount: n, pos })
    },
    setDiagnostics: (d) => set((s) => ({ diagnostics: { ...s.diagnostics, ...d } })),
    emit,
    resetGame: () => set({ ...initial }),
  }
})

export const selectAlbumProgress = (s: GameState) => ({
  have: Object.keys(s.album).length,
  total: s.collection?.poolSize ?? 0,
})
