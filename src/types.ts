export interface CollectionInfo {
  slug: string
  /** site path when it differs from the slug (accented Wix URLs) */
  page?: string
  year: number
  name: string
  category: string
  shape: 'disc' | 'card' | 'photo'
}

export interface CollectionsIndex {
  categories: { key: string; label: string }[]
  collections: CollectionInfo[]
}

export interface ManifestItem {
  id: string
  number: number
  label: string
  front: string
  back: string | null
}

export interface ManifestSection {
  key: string
  title: string
  kind: 'paired' | 'shared-back' | 'gallery'
  points: number | null
  expected: number | null
  sharedBack: string | null
  items: ManifestItem[]
}

export interface CollectionManifest {
  slug: string
  name: string
  year: number | null
  category: string | null
  shape: 'disc' | 'card' | 'photo'
  source: string
  scrapedAt: string
  imageSize: number
  sections: ManifestSection[]
}
