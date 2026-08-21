import type { CollectibleShape } from './Collectible'
import type { CollectionManifest, ManifestSection } from '../types'

// Display curation shared by the acervo viewer and the game's drop pool: which manifest
// sections are real collectibles, which items inside them are strays, display renames,
// and per-section shape fixes. Manifests keep every scraped section (the game needs the
// EMBALAGEM photos for snack-bag textures) — curation is applied at read time only.
// Only collectible sections are shown; accessory galleries (packaging, posters, tarjas,
// kits, albums...) stay in the manifests — Phase 3 reuses EMBALAGEM for bag textures —
// but are hidden here. Paired/shared-back sections are collectibles by construction;
// galleries only when the title names one (uefa/pacman tazos, montáveis, stamps).
// Accessory titles start with their kind on the site ("TARJA: ...", "EMBALAGEM: ..."),
// so the blacklist is anchored — "SILVER STIX / EMBALAGEM ROXA" (a collectible) survives
// while "EMBALAGEM: CONTÉM 1 TAZO" does not. Pure-numeric titles ("3 + 6 + 6", "60 x 2")
// are the site's collectible-count sections.
const HIDDEN_SECTION =
  /^(TARJA|EMBALAGE|LOTES|P[ÔO]STER|PROPAGANDA|VALE|LANCHINHO|PORTA|TAPE|KIT|CAIXA|BALDE|FICH[ÁA]RIO|[ÁA]LBUM|ARENA|JOGO|COMERCIAL)/
const NUMERIC_TITLE = /^[\d\s+xX()]+$/
const COLLECTIBLE_GALLERY = /TAZO|MONT[ÁA]VE|STAMP|ADESIVO|SPINER|CARD|CARTA|FIGURINHA|STICKER|STIX/
// Manual per-collection overrides (section keys) for accessory sections the generic
// rules can't tell apart — e.g. tinytoon "5 + 2" is porta-tazo photos, not tazos.
const HIDDEN_BY_SLUG: Record<string, string[]> = {
  tinytoon: ['5-2'], // porta-tazo photos
  maskara: ['pega-tazo', '6-6', '2-2'], // launcher toy + its photo sets
  yugiohmagic: ['1-2', '1-1'],
  yugiohmetal: ['1-12'],
  liga: ['stamp-adesivos'],
  filhotes: ['figurinha-cinza', 'figurinhas-cinzas-quadradas-toddynho'],
  funki: ['puf-sticker', 'mega-sticker', '7-x-7'],
  tecnofun: ['27-x-3'],
}
// Item-level hides: stray non-collectible photos inside otherwise good sections.
const HIDDEN_ITEM_LABELS: Record<string, Record<string, RegExp>> = {
  fonemania: { 'drop-sticker': /^2006\./ },
  natal: { tazo: /^TAZO( - EMBALAGEM)?$/ },
}
// Display renames and per-section shape fixes (site titles/shapes don't always match
// the physical collectible — joken tazos are rounded squares, best read as cards).
const RENAMED_BY_SLUG: Record<string, Record<string, string>> = {
  filhotes: { '45-15': 'ADESIVOS' },
}
const SHAPE_BY_SLUG: Record<string, Record<string, CollectibleShape>> = {
  jokenpokemon: { '60-x-2': 'card' },
  liga: { spiner: 'disc' }, // Super Spiners are notched discs; the site files them as a gallery
  tazolive: { '1-60': 'disc', '1-10': 'disc' },
  cbjr: { '3-6-6': 'card' },
  digimon: { digicartas: 'card' },
  spacejam: { 'figurinhas-cards': 'card' },
  mapa: { cards: 'card' },
}

export function isCollectibleSection(s: ManifestSection, slug: string) {
  if (HIDDEN_BY_SLUG[slug]?.includes(s.key)) return false
  if (HIDDEN_SECTION.test(s.title)) return false
  if (s.kind !== 'gallery') return true
  return NUMERIC_TITLE.test(s.title) || COLLECTIBLE_GALLERY.test(s.title)
}

/**
 * Sections as the viewer shows them: renamed, stray items dropped, accessories hidden.
 * `fallback` (viewer default) returns the unfiltered sections when the rules hide
 * everything, so a collection never renders empty; pass false when the caller needs
 * only genuine collectibles (the game's drop pool).
 */
export function curatedSections(manifest: CollectionManifest, slug: string, fallback = true): ManifestSection[] {
  const renamed = manifest.sections.map((s) => {
    const title = RENAMED_BY_SLUG[slug]?.[s.key]
    const hideItem = HIDDEN_ITEM_LABELS[slug]?.[s.key]
    const items = hideItem ? s.items.filter((i) => !hideItem.test(i.label)) : s.items
    return title || items !== s.items ? { ...s, title: title ?? s.title, items } : s
  })
  const visible = renamed.filter((s) => isCollectibleSection(s, slug) && s.items.length > 0)
  if (visible.length > 0 || !fallback) return visible
  // defensive: never render an empty collection because the filter was too eager
  return renamed.filter((s) => s.items.length > 0)
}

/** Physical shape of a section's items (site titles/shapes don't always match). */
export function sectionShape(slug: string, section: ManifestSection, manifestShape: CollectibleShape): CollectibleShape {
  return (
    SHAPE_BY_SLUG[slug]?.[section.key] ??
    (section.kind !== 'gallery'
      ? manifestShape
      : /\bTAZOS?\b/.test(section.title) && manifestShape === 'disc'
        ? 'disc'
        : /CARTA|CARD/.test(section.title)
          ? 'card'
          : 'photo')
  )
}
