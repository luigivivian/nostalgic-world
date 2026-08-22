# Nostalgic World

3D web game (React Three Fiber): timeline of year-portals into Elma Chips collections; shoot snack bags to drop collectible Tazos. Asset source: elmachipscolecoes.com.br (scraped offline). SITE IS DEAD since 2026-08-20 (Wix domain error; Wayback has only the homepage) — public/collections/ is the only copy, never purge it; re-scraping is impossible.

## Stack

- Vite + React + TypeScript
- three / @react-three/fiber / drei / rapier / postprocessing
- zustand (state), localStorage (persistence)
- Node + sharp + Playwright for scraper/asset pipeline (`scripts/`)

## Commands

```
npm run dev                 # Vite dev server
npm run build               # Production build
npm run scrape <slug...>    # Scrape collections (or --all) → manifest + 1024px images
npm test                    # Vitest: parser (real fixtures) + geometry invariants
npm run smoke               # Playwright visual smoke (needs dev server on port 5199)
/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/mixamo-to-glb.py -- --out X.glb Idle_Loop=a.fbx ...
                            # Mixamo FBX downloads -> one rigged GLB with named clips
```

## Structure

```
scripts/               # scrape.mjs + lib/parse.mjs (generic Wix page parser)
public/collections/    # index.json (curated: slug/year/name/category/shape)
                       # <slug>/manifest.json + items/*.jpg (after scrape)
src/collectible/       # geometry.ts (disc/card/photo), Collectible, CollectibleViewer
src/App.tsx            # home (collections by category + biome picker) + collection view
src/game/biomes.ts     # the six phases: terrain knobs, palette, sky — set before the island mounts
src/game/hub/          # "Jardim do Céu": floating sky-garden hub with one portal per biome (?hub)
src/game/Vegetation.tsx# prop kit per biome (KITS) + Tripo landmark per biome
```

## Key Context

- **Wix image trick**: `~mv2.jpg/v1/<fill|fit>/w_N,h_N,q_90/x.jpg` serves any size from the
  CDN (original is ~2055px). fill (square crop) ONLY for disc scans (square by nature);
  fit (keep aspect) for card scans (tight portrait, ~0.61-0.68) and galleries — fill would
  decapitate them. The mesh adapts to the texture aspect, never crop the texture.
  Never hotlink at runtime — scrape offline.
- **Generic parser** (scripts/lib/parse.mjs): section titles come from wixui-button labels;
  the nav block pairs each title with a numeric button = expected count (auto-validation).
  Items group by consecutive equal alt text: 2+ per group = front/back pairs; sections of
  singles with a "VERSO"/"CARD" group = shared back for the whole section; otherwise gallery.
  Also: fronts/backs as separate runs pair by leading number (cade, blocks of 10); numbered
  groups of exactly 4 images split into 2 variant items (dbz edge cuts). Accented site paths
  live in index.json `page`; slugs (= folders) stay ASCII.
- 3D items = procedural ExtrudeGeometry (shared core in src/collectible/geometry.ts):
  disc (notched tazo), card (63x88 rounded rect), photo (unit plane scaled by aspect).
  Card textures get "cover" UV crop to hide white scan padding.
- Texture loading is manual (TextureLoader + explicit dispose) — never useLoader/suspense
  for texture swaps: cache-miss re-suspends and blanks the mesh for a frame (visible blink).
- Collections lazy-load per portal; dispose on exit. Perf budget: 60fps mid laptop, DPR ≤ 2.
- **Flow**: Home → Hub (`?hub`) → walk into a portal → island (`?play&biome=<id>`) → Voltar → Hub.
- **Biomes**: `?play&biome=<praia|deserto|neve|pantano|montanha|ruinas>`.
  One authored island, six shapes/palettes/kits; anything derived from `terrainHeight` must
  be a function or a mount-time memo, never a module const (it goes stale on `setBiome`).
  Headless check per biome: `node .tmp/probe-biomes.mjs [ids]` (dev server on 5199).
- Full plan and phase breakdown: PRD.md. Session journal: DEVLOG.md.
