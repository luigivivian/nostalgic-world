# Nostalgic World — PRD

3D web experience (Three.js) where the user walks a timeline of year-portals, enters an Elma Chips collection (starting with 1997 Tazo Mania / Looney Tunes), shoots snack bags with a cartoon gun, and collects the random Tazos that drop. Reference data source: https://www.elmachipscolecoes.com.br/

## Verified findings (site recon, 2026-08-04)

- Site is **Wix**. All images served from `static.wixstatic.com` with a transform suffix:
  `.../media/<id>~mv2.jpg/v1/fill/w_86,h_86,.../file.jpg` → thumbnails only.
- **Stripping everything after `~mv2.jpg` returns the ORIGINAL image: ~2055×2054 px JPG (~5MB).**
  This solves the biggest risk — texture quality for the 3D Tazo is excellent.
- `/looney` page (386 images) sections, in DOM order (paired counts verified by scraper):
  1. `TAZO (VERSO AMARELO - 1 PONTO)` — 40 front/back pairs (#1-40)
  2. `SUPER TAZO (VERSO AZUL - 2 PONTOS)` — 20 pairs (#41-60)
  3. `MEGA TAZO (VERSO VERDE - 3 PONTOS)` — 20 pairs (#61-80) → 80 official tazos total
  4. `MASTER-TAZO FINO (EDIÇÃO ESPECIAL)` — 20 units
  5. `MASTER-TAZO (BATEDOR)` — 36 units (6 characters × 6 colors), thick plastic
  6. `PORTA-TAZO`, `TAPE-TAZO`, `KIT-TAZO`
  7. `EMBALAGENS E TARJAS` — bag/packaging photos + promo strips ("tarjas")
- **Front/back pairing rule**: inside tazo sections, images alternate with the same alt text
  number: `![1](front) ![1](back) ![2](front) ![2](back)...` Consecutive same-alt = one tazo.
- Catalog page `/lista` lists ~60 collections as `[YYYY - NAME](slug)`, 1981→2005.
  Timeline portals come straight from this list. Tazo-type collections for later phases:
  `tinytoon` (1997), `animaniacs` (1997), `maskara` (1998), `pokemon2` (2000),
  `cartoon` (2002), `yugiohmagic`/`yugiohmetal` (2003), `bobesponja` (2004).

## Stack

- Vite + React + TypeScript — game is pure client-side; Next.js adds nothing here (no SEO/SSR
  for a canvas) and slows iteration. React kept for UI comfort.
- `three` + `@react-three/fiber` + `@react-three/drei` (Text, Environment, KTX2 loader, portals)
- `@react-three/rapier` — physics (tazo drop arc, bag pieces)
- `@react-three/postprocessing` — selective bloom (holograms), vignette
- `zustand` — game state (inventory, current collection, settings)
- Node scripts for the scraper/asset pipeline (`scripts/`), `sharp` for image processing
- Deploy: Vercel

## Architecture

```
nostalgic-world/
  scripts/
    scrape.mjs          # crawl collection page → manifest.json + original images
    process-assets.mjs  # circle-crop, resize tiers, KTX2 compress
  public/collections/<slug>/
    manifest.json       # [{id, name, section, rarity, front, back}]
    tazos/<id>/front-1k.ktx2 | back-1k.ktx2 | front-2k.jpg (inspect mode)
    packaging/...
  src/
    world/              # timeline scene, portals, hologram text, skybox
    collection/         # collection room, bag spawner, drop logic
    tazo/               # procedural tazo geometry + material + TazoViewer
    weapons/            # cartoon gun, raycast shooting, FX
    ui/                 # DOM overlays: album, HUD, menus
    state/              # zustand stores, localStorage persistence
```

Data flow: scraper (offline, one-time per collection) → manifest + processed textures →
app lazy-loads a collection bundle only when its portal is entered.

## Phase 1 — Scraper + asset pipeline (foundation)

1. `scrape.mjs <slug>`: fetch rendered page (Playwright — Wix needs JS), walk DOM in order,
   detect section headers, collect `wixstatic` URLs + alt text.
2. Strip transform suffix → download originals into `raw/<slug>/<section>/`.
3. Pair front/back by consecutive equal alt numbers. Sections without pairs (master batedor,
   packaging) stored as singles. Emit `manifest.json` + a **validation report**
   (looney expected: 40 tazo / 20 super / 20 mega pairs — mismatches flagged, not guessed).
4. `process-assets.mjs`: detect the disc in each photo (circle Hough or center-crop + alpha
   mask), output: 1024px KTX2 (game), 2048px JPG (inspect mode). Packaging images: keep
   rectangular, light trim.
5. Throttle requests (500ms), cache downloads — re-runs are idempotent.

Acceptance: `npm run scrape looney` produces complete manifest + assets with zero manual fixes.

## Phase 2 — The Tazo (vertical slice, quality bar)

- **Procedural geometry, not photogrammetry**: a tazo is a disc. `ExtrudeGeometry` from a 2D
  circle `Shape` with the classic 8-notch scalloped rim + small bevel. UV: top cap → front
  texture, bottom cap → back texture, rim → cardboard edge material.
- Material: `MeshStandardMaterial`, low roughness map (slight print gloss), normal map baked
  from bevel. Master-Tazo variant: thicker extrude + plastic material (higher clearcoat feel).
- One shared geometry, per-tazo texture swap → instancing-friendly, tiny memory.
- `TazoViewer` inspect mode: drag to rotate, click to flip (spring animation), 2k texture,
  key light + rim light. This is the "wow" moment — polish it first.

Acceptance: a Looney tazo at full screen looks crisp and reads as a physical object.

## Phase 3 — Shooting + bag break

- Bag: one mesh modeled once (Blender, low-poly crumpled bag, ~1k tris), UV front/back zones
  textured from scraped packaging photos. 2-3 bag variants.
- Gun: low-poly cartoon blaster, viewmodel bottom-right, subtle sway + recoil.
- Shot = raycast from camera + visible projectile tracer. Hit: bag "pops" — swap to 3 pre-cut
  bag pieces (rapier impulse), chip-crumb particle burst, confetti, tazo ejects upward with
  physics arc, slow-mo beat, floats + spins with glow → click to collect → album.
- Drop table by section rarity: tazo 1pt common, super 2pt uncommon, mega 3pt rare,
  master fino epic, batedor from special golden bags.

## Phase 4 — World + portals

- Stylized cartoon-realistic look: toon-ish gradient lighting, warm sky, low-poly terrain
  along a winding "timeline road", year markers from `/lista` data.
- Portal per collection: torus arch + swirling shader plane; hologram title above
  (drei `Text` + selective bloom, slight flicker/scanline shader) showing `1997 — TAZO MANIA`.
- Enter portal → fade transition → collection room (themed skybox, shelves showing collected
  tazos, bag-shooting range). MVP: 1 portal (looney) fully built; timeline shows future
  portals as locked silhouettes.
- Controls: pointer-lock WASD + mouse (desktop first), interaction prompts on hover/aim.
  Invisible colliders keep the player on the road.

## Phase 5 — Album, persistence, juice

- DOM overlay album: grid per section, silhouette = not collected, progress bar (`67/80`),
  click → TazoViewer. State in zustand, persisted to localStorage (later Supabase if accounts).
- Audio: bag pop, tazo clink, portal hum, ambient loop. Screen shake, hit markers.
- Onboarding: 3-step contextual hints, no walls of text.

## Phase 6 — Performance + ship

- Budgets: 60fps on mid laptop, <150 draw calls in scene, <80MB textures per collection
  (KTX2 makes this easy), DPR clamped at 2.
- Lazy `<Suspense>` per portal; dispose collection assets on exit.
- QA pass (code-reviewer + qa agents), Lighthouse, deploy to Vercel.

## Risks

- Some collections may break the alt-pairing rule → scraper validation report catches it;
  never silently guess pairs.
- IP: Looney Tunes/Elma Chips imagery — fan project, non-commercial, credit source site.
- Wix rate limiting → throttled, cached, one-time offline scrape (not runtime).
