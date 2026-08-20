// Usage: node scripts/scrape.mjs <slug...> [--size 1024]
//        node scripts/scrape.mjs --all       (every collection in public/collections/index.json)
// Fetches collection pages, auto-parses sections/items, downloads images from the Wix
// CDN at the requested size, writes public/collections/<slug>/manifest.json.
import { mkdir, writeFile, access, readFile } from 'fs/promises'
import path from 'path'
import { parseCollectionAuto, transformUrl } from './lib/parse.mjs'

const BASE = 'https://www.elmachipscolecoes.com.br'
const args = process.argv.slice(2)
const sizeArg = args.indexOf('--size')
const SIZE = sizeArg !== -1 ? Number(args[sizeArg + 1]) : 1024
if (!Number.isFinite(SIZE) || SIZE < 64 || SIZE > 4096) {
  console.error(`invalid --size (expected 64-4096)`)
  process.exit(1)
}

const index = JSON.parse(await readFile('public/collections/index.json', 'utf8'))
const slugs = args.includes('--all')
  ? index.collections.map((c) => c.slug)
  : args.filter((a) => !a.startsWith('--') && a !== String(SIZE))
if (slugs.length === 0) {
  console.error('usage: node scripts/scrape.mjs <slug...> | --all  [--size 1024]')
  process.exit(1)
}

const exists = (p) => access(p).then(() => true, () => false)

async function download(url, dest) {
  if (await exists(dest)) return
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
  await new Promise((r) => setTimeout(r, 250))
}

let anyBad = false

for (const slug of slugs) {
  const meta = index.collections.find((c) => c.slug === slug)
  console.log(`\n########  ${slug}${meta ? ` — ${meta.name} (${meta.year})` : ''}`)
  // page: site path when it differs from the slug (accented Wix URLs, ASCII folders here)
  const pageUrl = `${BASE}/${encodeURIComponent(meta?.page ?? slug)}`
  const res = await fetch(pageUrl, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    console.error(`page fetch failed: HTTP ${res.status}`)
    anyBad = true
    continue
  }
  const parsed = parseCollectionAuto(await res.text(), slug)

  const outDir = path.join('public', 'collections', slug)
  const imgDir = path.join(outDir, 'items')
  await mkdir(imgDir, { recursive: true })

  const jobs = []
  const sections = []
  // fit preserves aspect (no CDN crop): required for galleries, card scans (portrait)
  // and montável plates. fill (square crop) only for disc scans, square by nature.
  const collectibleMode = (meta?.shape ?? 'disc') === 'disc' ? 'fill' : 'fit'
  for (const sec of parsed.sections) {
    const mode = sec.kind === 'gallery' ? 'fit' : collectibleMode
    const items = sec.items.map((it, idx) => {
      const id = `${sec.key}-${String(idx + 1).padStart(3, '0')}`
      const front = `items/${id}-front.jpg`
      jobs.push({ url: transformUrl(it.front, SIZE, mode), file: front })
      let back = null
      if (it.back) {
        back = `items/${id}-back.jpg`
        jobs.push({ url: transformUrl(it.back, SIZE, mode), file: back })
      }
      return { id, number: it.number, label: it.label, front, back }
    })
    let sharedBack = null
    if (sec.sharedBack) {
      sharedBack = `items/${sec.key}-shared-back.jpg`
      jobs.push({ url: transformUrl(sec.sharedBack, SIZE, collectibleMode), file: sharedBack })
    }
    sections.push({
      key: sec.key,
      title: sec.title,
      kind: sec.kind,
      points: sec.points,
      expected: sec.expected,
      sharedBack,
      items,
    })
    const flag = sec.anomalies.length ? `  !! ${JSON.stringify(sec.anomalies)}` : ''
    console.log(`  [${sec.kind}] ${sec.title}: ${items.length} items${flag}`)
    if (sec.anomalies.length) anyBad = true
  }

  console.log(`  downloading ${jobs.length} images at ${SIZE}px...`)
  let done = 0
  let failed = 0
  const queue = [...jobs]
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const job = queue.shift()
        try {
          await download(job.url, path.join(imgDir, path.basename(job.file)))
        } catch (e) {
          failed++
          console.error(`  FAIL ${job.file}: ${e.message}`)
        }
        if (++done % 50 === 0) console.log(`  ${done}/${jobs.length}`)
      }
    }),
  )
  if (failed) anyBad = true

  const manifest = {
    slug,
    name: meta?.name ?? parsed.title,
    year: meta?.year ?? null,
    category: meta?.category ?? null,
    shape: meta?.shape ?? 'disc',
    source: pageUrl,
    scrapedAt: new Date().toISOString(),
    imageSize: SIZE,
    sections,
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const total = sections.reduce((n, s) => n + s.items.length, 0)
  console.log(`  done: ${done - failed} ok, ${failed} failed | manifest: ${total} items`)
}

if (anyBad) {
  console.log('\nWARNING: some collections had anomalies or failures — review output above.')
  process.exitCode = 1
}
