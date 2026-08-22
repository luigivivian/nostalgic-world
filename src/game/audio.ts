import { useEffect } from 'react'
import { useGame, type GameEvent } from './store'

// Game audio: one AudioContext, three gain groups, every clip decoded once after the
// first user gesture. Purely a store subscriber — gameplay never calls into here.
// Clips live in public/game/audio (ElevenLabs SFX, see DEVLOG session 8).

type Group = 'sfx' | 'ui' | 'ambience'
const CLIPS = {
  shot: 'sfx',
  'dry-fire': 'sfx',
  'bag-pop': 'sfx',
  miss: 'sfx',
  collect: 'sfx',
  'collect-rare': 'sfx',
  ammo: 'sfx',
  'station-clear': 'ui',
  'round-over': 'ui',
  'ui-click': 'ui',
  'ambience-beach': 'ambience',
} as const satisfies Record<string, Group>
type Clip = keyof typeof CLIPS
const GROUP_GAIN: Record<Group, number> = { sfx: 0.9, ui: 0.7, ambience: 0.3 }
const MUTE_KEY = 'nw.mute'
// the same clip never fires twice inside this window (a burst of hits, a combo of collects)
const COOLDOWN_MS = 45

class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private groups = new Map<Group, GainNode>()
  private buffers = new Map<Clip, AudioBuffer>()
  private ambience: AudioBufferSourceNode | null = null
  private last = new Map<Clip, number>()
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'

  /** Must run inside a user gesture: creates the context, decodes clips, starts the bed. */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(ctx.destination)
      for (const g of Object.keys(GROUP_GAIN) as Group[]) {
        const node = ctx.createGain()
        node.gain.value = GROUP_GAIN[g]
        node.connect(this.master)
        this.groups.set(g, node)
      }
      for (const id of Object.keys(CLIPS) as Clip[]) {
        fetch(`/game/audio/${id}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((d) => ctx.decodeAudioData(d))
          .then((b) => {
            this.buffers.set(id, b)
            if (id === 'ambience-beach') this.startAmbience()
          })
          .catch((e) => console.warn('audio: failed to load', id, e))
      }
    }
    if (this.ctx.state !== 'running') void this.ctx.resume()
  }

  play(id: Clip, volume = 1, rate = 1) {
    const ctx = this.ctx
    const buffer = this.buffers.get(id)
    if (!ctx || !buffer) return
    const now = performance.now()
    if (now - (this.last.get(id) ?? -1e9) < COOLDOWN_MS) return
    this.last.set(id, now)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain).connect(this.groups.get(CLIPS[id])!)
    src.start()
  }

  startAmbience() {
    const ctx = this.ctx
    const buffer = this.buffers.get('ambience-beach')
    if (!ctx || !buffer || this.ambience) return
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(this.groups.get('ambience')!)
    src.start()
    this.ambience = src
  }

  stopAmbience() {
    this.ambience?.stop()
    this.ambience = null
  }

  setMuted(m: boolean) {
    this.muted = m
    localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05)
  }

  suspend() {
    void this.ctx?.suspend()
  }

  resume() {
    void this.ctx?.resume()
  }

  onEvent(e: GameEvent) {
    // small random detune keeps a dozen shots from sounding like one sample on repeat
    const vary = () => 0.94 + Math.random() * 0.12
    switch (e.type) {
      case 'shot':
        this.play('shot', 0.8, vary())
        break
      case 'dryFire':
        this.play('dry-fire', 0.7)
        break
      case 'hit':
        this.play('bag-pop', 1, vary())
        break
      case 'miss':
        this.play('miss', 0.45, vary())
        break
      case 'collect':
        if (e.isNew && e.rarity !== 'common') this.play('collect-rare', 1)
        else this.play('collect', 0.9, vary())
        break
      case 'ammoPickup':
        this.play('ammo', 0.9, vary())
        break
      case 'stationCleared':
        this.play('station-clear', 1)
        break
      case 'albumComplete':
        this.play('station-clear', 1, 1.2)
        break
      case 'roundStart':
        this.play('ui-click', 1)
        break
      case 'roundOver':
        this.play('round-over', 1)
        break
    }
  }
}

export const audio = new GameAudio()

/** Mount once per game session: unlock on the first gesture, follow store events + pause. */
export function useGameAudio() {
  useEffect(() => {
    const unlock = () => audio.unlock()
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) audio.setMuted(!audio.muted)
    }
    const onVisibility = () => {
      if (document.hidden) audio.suspend()
      else if (useGame.getState().phase !== 'paused') audio.resume()
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    window.addEventListener('game:fire', unlock)
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVisibility)
    const unsub = useGame.subscribe((s, prev) => {
      if (s.phase !== prev.phase) {
        if (s.phase === 'paused') audio.suspend()
        else if (prev.phase === 'paused') audio.resume()
      }
      if (s.eventSeq !== prev.eventSeq && s.lastEvent) audio.onEvent(s.lastEvent)
    })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('game:fire', unlock)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVisibility)
      unsub()
      audio.stopAmbience()
    }
  }, [])
}
