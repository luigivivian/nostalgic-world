// Generic parser for Wix collection pages on elmachipscolecoes.com.br.
// Pages are fully server-rendered. Structure (verified on looney, tinytoon, pokemon1,
// dracomania, starwars):
// - Section titles appear as <span class="...wixui-button__label">TITLE</span>, first in a
//   nav block ("COMPOSIÇÃO DA COLEÇÃO") where each title button is followed by a numeric
//   button with the section's item count, then again right before the section's gallery.
// - Gallery items group by consecutive images sharing the same (trimmed) alt text:
//   2 per group = front/back; 3+ = front/back + extra photos; 1 = single photo.
// - Some card sections list fronts as singles plus one "VERSO"/"CARD" group whose first
//   image is the shared back for every card in the section.

const MEDIA_RE = /static\.wixstatic\.com\/media\/(\w+~mv2\.(?:jpe?g|png|webp))/
const BUTTON_RE = /wixui-button__label">([^<]+)<\/span>/g
const IMG_RE = /<img[^>]*>/g
const META_LABEL_RE = /^(DE:|ATÉ:|COMPOSIÇÃO DA COLEÇÃO)/
const SHARED_BACK_RE = /^(VERSO|CARD|CARDS)\b/i

export function originalUrl(mediaFile) {
  return `https://static.wixstatic.com/media/${mediaFile}`
}

// mode 'fill': square crop (collectible scans are ~square). mode 'fit': preserve aspect
// (packaging photos, posters and other gallery shots are arbitrary rectangles).
export function transformUrl(mediaFile, size, mode = 'fill') {
  return `${originalUrl(mediaFile)}/v1/${mode}/w_${size},h_${size},q_90/img.jpg`
}

function decodeEntities(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export function slugifySection(title) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractButtons(html) {
  const out = []
  let m
  while ((m = BUTTON_RE.exec(html)) !== null) {
    out.push({ pos: m.index, label: decodeEntities(m[1]) })
  }
  return out
}

function extractImages(html) {
  const out = []
  let m
  while ((m = IMG_RE.exec(html)) !== null) {
    const media = m[0].match(MEDIA_RE)
    if (!media) continue
    const alt = decodeEntities((m[0].match(/alt="([^"]*)"/) || [])[1] ?? '')
    out.push({ pos: m.index, mediaFile: media[1], alt })
  }
  return out
}

// Groups consecutive images sharing the same alt.
function groupByAlt(images) {
  const groups = []
  let i = 0
  while (i < images.length) {
    const alt = images[i].alt
    let j = i
    while (j < images.length && images[j].alt === alt) j++
    groups.push({ alt, images: images.slice(i, j).map((x) => x.mediaFile) })
    i = j
  }
  return groups
}

// Some pages list fronts and backs as separate runs (fronts 01-10 then backs 01-10,
// next block, ...) instead of interleaving pairs — e.g. cadê's TAZOS section. Runs are
// matched by leading number (site alts occasionally carry typos), blocks of 3+ only.
function pairMirroredRuns(groups) {
  if (groups.length < 6 || !groups.every((g) => g.images.length === 1 && /^\d/.test(g.alt)))
    return null
  const nums = groups.map((g) => parseInt(g.alt, 10))
  const items = []
  let i = 0
  while (i < groups.length) {
    // Shortest match first: when a numbering restarts across sub-series (1..n fronts,
    // 1..n backs, 1..n fronts, ...) the longest match would pair front runs together.
    let len = 0
    for (let cand = 3; cand <= Math.floor((groups.length - i) / 2); cand++) {
      if (nums.slice(i, i + cand).every((n, k) => n === nums[i + cand + k])) {
        len = cand
        break
      }
    }
    if (len === 0) return null
    for (let k = 0; k < len; k++) {
      items.push({
        number: nums[i + k],
        label: groups[i + k].alt,
        front: groups[i + k].images[0],
        back: groups[i + len + k].images[0],
      })
    }
    i += 2 * len
  }
  return items
}

function parseSection(title, images, expected) {
  const groups = groupByAlt(images)
  const numbered = groups.filter((g) => /^\d/.test(g.alt))
  const unnumbered = groups.filter((g) => !/^\d/.test(g.alt))

  let sharedBack = null
  let splitVariants = false
  let items = pairMirroredRuns(groups)
  if (items) {
    // handled: fronts run + backs run
  } else if (numbered.length >= 3) {
    // Collectible section: one item per numbered group (front, optional own back).
    // When MOST numbered groups have 4 images, the section lists two variants per
    // number, each front+back (e.g. dbz spinners come in two edge cuts) — split so no
    // scan is dropped. An isolated 4-group is more likely front/back + stray photos,
    // so it keeps the old behavior and gets flagged instead.
    const backGroup = unnumbered.find((g) => SHARED_BACK_RE.test(g.alt))
    if (backGroup) sharedBack = backGroup.images[0]
    splitVariants =
      numbered.filter((g) => g.images.length === 4).length >= numbered.length / 2
    items = numbered.flatMap((g) => {
      const base = { number: parseInt(g.alt, 10), label: g.alt }
      if (splitVariants && g.images.length === 4)
        return [
          { ...base, front: g.images[0], back: g.images[1] },
          { ...base, front: g.images[2], back: g.images[3] },
        ]
      return [{ ...base, front: g.images[0], back: g.images[1] ?? null }]
    })
  } else {
    // Gallery section (packaging, posters, kits...): one item per image; alts often empty.
    items = images.map((img, idx) => ({
      number: idx + 1,
      label: img.alt || `Foto ${idx + 1}`,
      front: img.mediaFile,
      back: null,
    }))
  }

  const withOwnBack = items.filter((it) => it.back).length
  const kind =
    withOwnBack >= items.length / 2 && items.length > 0
      ? 'paired'
      : sharedBack
        ? 'shared-back'
        : 'gallery'

  const pointsMatch = title.match(/(\d+)\s*PONTO/)
  const anomalies = []
  if (expected != null && items.length !== expected) {
    anomalies.push({ reason: 'count mismatch', expected, actual: items.length })
  }
  for (const g of groups) {
    if (/^\d/.test(g.alt) && g.images.length > (splitVariants ? 4 : 3)) {
      anomalies.push({ reason: 'oversized group', alt: g.alt, count: g.images.length })
    }
  }

  return {
    key: slugifySection(title),
    title,
    kind,
    points: pointsMatch ? Number(pointsMatch[1]) : null,
    expected: expected ?? null,
    sharedBack,
    items,
    anomalies,
  }
}

export function parseCollectionAuto(html, slug) {
  const buttons = extractButtons(html)
  const images = extractImages(html)

  // Expected per-section counts: in the nav block a numeric button follows each title.
  const expectedCounts = new Map()
  for (let i = 0; i + 1 < buttons.length; i++) {
    const label = buttons[i].label
    const next = buttons[i + 1].label
    if (!/^\d+$/.test(label) && /^\d+$/.test(next) && !META_LABEL_RE.test(label)) {
      if (!expectedCounts.has(label)) expectedCounts.set(label, Number(next))
    }
  }

  const collectionTitle = buttons[0]?.label ?? slug
  const markerLabels = new Set(
    buttons
      .map((b) => b.label)
      .filter(
        (l) => !/^\d+$/.test(l) && !META_LABEL_RE.test(l) && l !== collectionTitle,
      ),
  )

  const markers = buttons.filter((b) => markerLabels.has(b.label))
  const segments = new Map()
  for (const img of images) {
    let owner = null
    for (const mk of markers) {
      if (mk.pos < img.pos) owner = mk.label
      else break
    }
    if (!owner) continue
    if (!segments.has(owner)) segments.set(owner, [])
    segments.get(owner).push(img)
  }

  const sections = []
  for (const [title, imgs] of segments) {
    if (imgs.length === 0) continue
    sections.push(parseSection(title, imgs, expectedCounts.get(title)))
  }

  return { slug, title: collectionTitle, sections }
}
