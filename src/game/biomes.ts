// Biomes = the island's "phases". One definition owns everything that makes a phase read
// as a different place: the terrain shape knobs, the height-band palette, sky/fog/light
// colours and the water. The prop kits per biome live next to the scatter that uses them
// (Vegetation.tsx); per-biome material tints live in assets/props.ts.
//
// The active biome is module state, resolved once before the island mounts (App sets it
// from the Home picker or from ?biome=). Everything that derives geometry from the terrain
// (spawn height, station ground, scatter) runs at mount time, so a remount = a new island.

export type BiomeId = 'praia' | 'deserto' | 'neve' | 'pantano' | 'montanha' | 'ruinas'

export interface Biome {
  id: BiomeId
  name: string
  /** one-line flavour for the picker */
  blurb: string
  terrain: {
    /** peak height of the dunes before the radial falloff (praia = 14) */
    maxHeight: number
    /** wavelength of the broad dunes in world units (bigger = smoother island) */
    broad: number
    /** amplitude of the fine detail noise, relative to maxHeight */
    detailAmp: number
    /** height above which the ground is painted `peak` (snow/ice); null = never */
    peakLine: number | null
    /** slope (1 - normal.y) above which the ground turns to rock */
    rockSlope: number
    /** how far the whole height field is lowered: more sink = more sea, wetter beach (praia 1.8) */
    sink: number
  }
  palette: {
    low: string // the shore band (sand / mud / shingle)
    lowWet: string // the tideline
    mid: string // lush ground
    midDry: string // the drier ground the groves noise picks
    rock: string
    peak: string
    water: string
    waterOpacity: number
  }
  sky: {
    top: string
    horizon: string
    below: string
    sun: string
    /** fog colour — match the horizon so the dome and the haze agree */
    fog: string
    fogNear: number
    fogFar: number
    hemiSky: string
    hemiGround: string
    hemiIntensity: number
    sunColor: string
    sunIntensity: number
    rim: string
    /** drei <Cloud> puffs: [x, y, z, opacity, colour] — [] for a clear sky */
    clouds: [number, number, number, number, string][]
  }
}

const PRAIA: Biome = {
  id: 'praia',
  name: 'Praia',
  blurb: 'A ilha verde: palmeiras, campinas e o mirante',
  terrain: { maxHeight: 14, broad: 42, detailAmp: 0.15, peakLine: 9.2, rockSlope: 0.24, sink: 1.8 },
  palette: {
    low: '#eed7a1',
    lowWet: '#c9ab72',
    mid: '#6cb04f',
    midDry: '#9dbb56',
    rock: '#98836b',
    peak: '#f6f4ec',
    water: '#2a9cc4',
    waterOpacity: 0.86,
  },
  sky: {
    top: '#3d7cc9',
    horizon: '#c9dff0',
    below: '#5d86a3',
    sun: '#fff1c8',
    fog: '#cfe1ef',
    fogNear: 95,
    fogFar: 520,
    hemiSky: '#cfe8ff',
    hemiGround: '#6d8f52',
    hemiIntensity: 1.0,
    sunColor: '#ffe6bb',
    sunIntensity: 1.75,
    rim: '#cfe6ff',
    clouds: [
      [0, 55, -60, 0.55, '#ffffff'],
      [-80, 48, 40, 0.45, '#f4faff'],
    ],
  },
}

const DESERTO: Biome = {
  id: 'deserto',
  name: 'Deserto',
  blurb: 'Dunas, cactos e rocha vermelha sob o sol a pino',
  terrain: { maxHeight: 12, broad: 52, detailAmp: 0.05, peakLine: null, rockSlope: 0.3, sink: 1.8 },
  palette: {
    low: '#e9c784',
    lowWet: '#c9a35f',
    mid: '#c9a455',
    midDry: '#dbb872',
    rock: '#b5633d',
    peak: '#f6f4ec',
    water: '#3aa7b8',
    waterOpacity: 0.84,
  },
  sky: {
    top: '#4a8fd8',
    horizon: '#f3dcb0',
    below: '#7a6a55',
    sun: '#fff0c0',
    fog: '#e9d8b8',
    fogNear: 80,
    fogFar: 470,
    hemiSky: '#ffe2b0',
    hemiGround: '#b27a4a',
    hemiIntensity: 0.9,
    sunColor: '#fff1cf',
    sunIntensity: 2.05,
    rim: '#ffd9a8',
    clouds: [[60, 58, -70, 0.3, '#fff6e6']],
  },
}

const NEVE: Biome = {
  id: 'neve',
  name: 'Neve',
  blurb: 'Ilha gelada: pinheiros escuros, rocha de ardósia e névoa branca',
  terrain: { maxHeight: 16, broad: 40, detailAmp: 0.12, peakLine: 0.6, rockSlope: 0.3, sink: 1.8 },
  palette: {
    low: '#dfe8ee',
    lowWet: '#b4c6d1',
    mid: '#f4f6f8',
    midDry: '#e4ecf2',
    rock: '#6f7480',
    peak: '#f7f9fb',
    water: '#3b7fa8',
    waterOpacity: 0.9,
  },
  sky: {
    top: '#6f9fd6',
    horizon: '#e6eff8',
    below: '#8fa5b5',
    sun: '#fff6e8',
    fog: '#e4eef8',
    fogNear: 70,
    fogFar: 420,
    hemiSky: '#dfeaff',
    hemiGround: '#9fb2c0',
    hemiIntensity: 1.1,
    sunColor: '#fff4e4',
    sunIntensity: 1.5,
    rim: '#dde9ff',
    clouds: [
      [0, 50, -60, 0.6, '#f4f7fa'],
      [-80, 44, 40, 0.55, '#eef3f7'],
      [70, 46, 60, 0.5, '#f4f7fa'],
    ],
  },
}

const PANTANO: Biome = {
  id: 'pantano',
  name: 'Pântano',
  blurb: 'Água parada, troncos mortos, cogumelos e nevoeiro verde',
  terrain: { maxHeight: 8.5, broad: 36, detailAmp: 0.22, peakLine: null, rockSlope: 0.3, sink: 1.15 },
  palette: {
    low: '#6f5d3f',
    lowWet: '#4f4330',
    mid: '#5f7a36',
    midDry: '#7a8440',
    rock: '#6e6858',
    peak: '#f6f4ec',
    water: '#5c7a4a',
    waterOpacity: 0.93,
  },
  sky: {
    top: '#bcc6b6',
    horizon: '#c4cbb2',
    below: '#59665a',
    sun: '#f2e8c8',
    fog: '#c4cbb2',
    fogNear: 40,
    fogFar: 250,
    hemiSky: '#b8c7b0',
    hemiGround: '#4a5a38',
    hemiIntensity: 0.95,
    sunColor: '#f5ecd2',
    sunIntensity: 1.15,
    rim: '#c8d6c0',
    clouds: [
      [0, 38, -50, 0.55, '#c8cfc0'],
      [-60, 34, 30, 0.5, '#bfc8b8'],
    ],
  },
}

const MONTANHA: Biome = {
  id: 'montanha',
  name: 'Montanha',
  blurb: 'Picos com neve, pinheirais e pedregulhos',
  terrain: { maxHeight: 22, broad: 34, detailAmp: 0.26, peakLine: 12.5, rockSlope: 0.2, sink: 1.8 },
  palette: {
    low: '#c8bfae',
    lowWet: '#9e957f',
    mid: '#5f9e4a',
    midDry: '#86a64e',
    rock: '#7c7468',
    peak: '#f6f4ec',
    water: '#2f8fbf',
    waterOpacity: 0.86,
  },
  sky: {
    top: '#2f6fc2',
    horizon: '#d8e6f2',
    below: '#5d86a3',
    sun: '#fff0d0',
    fog: '#d2e0ec',
    fogNear: 110,
    fogFar: 560,
    hemiSky: '#d4e6ff',
    hemiGround: '#5f7a4a',
    hemiIntensity: 1.0,
    sunColor: '#ffe8c4',
    sunIntensity: 1.9,
    rim: '#cfe6ff',
    clouds: [
      [0, 60, -70, 0.5, '#ffffff'],
      [-90, 52, 40, 0.45, '#f4faff'],
      [80, 56, 50, 0.4, '#ffffff'],
    ],
  },
}

const RUINAS: Biome = {
  id: 'ruinas',
  name: 'Ruínas',
  blurb: 'Colunas caídas e pedra clara num fim de tarde dourado',
  terrain: { maxHeight: 13, broad: 42, detailAmp: 0.12, peakLine: null, rockSlope: 0.26, sink: 1.8 },
  palette: {
    low: '#e6d2a6',
    lowWet: '#bfa97e',
    mid: '#9aa35a',
    midDry: '#b8b06a',
    rock: '#b0a28c',
    peak: '#f6f4ec',
    water: '#2f98b5',
    waterOpacity: 0.86,
  },
  sky: {
    top: '#4d7fc4',
    horizon: '#f0d9b8',
    below: '#6b7a86',
    sun: '#ffd9a0',
    fog: '#e6d9c4',
    fogNear: 90,
    fogFar: 500,
    hemiSky: '#ffe8c8',
    hemiGround: '#8a8560',
    hemiIntensity: 1.0,
    sunColor: '#ffd9a8',
    sunIntensity: 1.85,
    rim: '#ffe2b8',
    clouds: [
      [0, 52, -60, 0.5, '#fff3e2'],
      [-80, 46, 40, 0.4, '#fff7ea'],
    ],
  },
}

export const BIOMES: Record<BiomeId, Biome> = { praia: PRAIA, deserto: DESERTO, neve: NEVE, pantano: PANTANO, montanha: MONTANHA, ruinas: RUINAS }
export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

export function isBiomeId(v: unknown): v is BiomeId {
  return typeof v === 'string' && v in BIOMES
}

let active: Biome = PRAIA

export function activeBiome() {
  return active
}

export function setBiome(id: BiomeId) {
  active = BIOMES[id]
}

/** ?biome=<id> wins (QA probes, deep links); otherwise the caller's default. */
export function biomeFromSearch(search: string, fallback: BiomeId = 'praia'): BiomeId {
  const v = new URLSearchParams(search).get('biome')
  return isBiomeId(v) ? v : fallback
}
