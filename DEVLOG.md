# Nostalgic World Dev Log

## Working State
**Session:** 4 | **Date:** 2026-08-05

### Active Task (part 2)
FP island game mode (user refs: threejs pointerlock + ammo_break + TSL procedural terrain).
- [x] npm i @react-three/rapier (2.2.0) + @react-three/postprocessing
- [x] src/game/: noise.ts (seeded value-noise fbm) + terrain.ts (128x128 plane, radial
      falloff island, vertex colors sand/grass/rock/snow, terrainHeight(x,z) shared with
      physics) + Island.tsx (trimesh collider, animated water plane, Sky+Clouds+fog)
- [x] Player.tsx: rapier capsule (lockRotations) + drei PointerLockControls, WASD in view
      yaw, space jump w/ ground ray, ocean-fall respawn. window.__pp debug (DEV only).
- [x] Blocks.tsx: 4x3 dynamic wall ahead of spawn; projectile hit (userData.projectile)
      -> 8 half-size fragments w/ radial impulse, 4s decay -> onBreak spawns pickup
- [x] Projectiles.tsx: ccd spheres 46 m/s from camera, 3s TTL
- [x] Pickups.tsx: floating spinning tazo (reuses Collectible + real scraped textures,
      random disc collection per session via tazoPool.ts); proximity collect
- [x] HeldTazo.tsx: FP inspect — collected tazo glued to camera (quaternion offset),
      full spin shows front+verso, 3.2s then counts into HUD album
- [x] Game.tsx: Canvas + Physics INSIDE <Suspense> (rapier wasm suspends; boundary must
      be inside Canvas or App's Suspense unmounts the whole Canvas — WebGL + PLC die)
- [x] App: lazy(Game) "Jogar" mode; lock overlay pointer-events:none (click passes to
      canvas -> PLC lock), crosshair, HUD counter. Polish: fog, hemisphere light, bloom
      +vignette, 28 seeded low-poly palms, cloud layer, vertex-swell water.
- [x] Validated via scripts/smoke-game.mjs (HEADED — pointer lock rejected in headless):
      lock, walk, 8 shots, wall breaks, tazos drop w/ real looney textures. tsc clean.
- [x] Review applied: projectile/player collision groups (self-hit on steep down-aim),
      dispose={null} on shared Collectible geometry (R3F disposed the singleton on every
      pickup unmount), album commit on collect not on animation end (2nd collect ate the
      1st), fire cooldown 220ms, jump per-press, projectile timers cleared on unmount,
      fetch .ok checks in tazoPool. Skipped as deliberate: velocity override (tight FPS
      control), piercing shots, vegetation instancing (within budget).
- [x] Toon pass (user: "vete bala 1 e 2"): shared 4-step DataTexture ramp (toon.ts),
      MeshToonMaterial on terrain/blocks/fragments/vegetation, drei Outlines on blocks
      (world-units thickness ~0.03, NOT pixels). Tazos stay glossy physical (prints).
- [x] Kenney CC0 nature GLTFs (pmndrs/market-assets mirror, Draco-compressed, decoder
      from gstatic CDN on first load): 4 palms + 3 rock formations + plant ->
      public/game/models/. Vegetation v2: 70 seeded spots, palms on beach band, rocks
      high ground, plants on grass; one toonified template per file, clones share
      materials. Validated: models render toonified, tsc clean, no console errors.
- [x] Section filter (user: hide non-collectible sections): isCollectibleSection in
      App.tsx — anchored blacklist (^TARJA|^EMBALAGE|^PORTA|^KIT|...: site accessory
      titles always START with their kind), numeric titles ("60 x 2", "3 + 6 + 6") are
      collectible counts, gallery whitelist TAZO|MONTÁVE|STAMP|ADESIVO|SPINER|CARD|CARTA|
      FIGURINHA|STICKER|STIX. Validated against all 39 manifests: zero empty collections.
      Data stays in manifests (Phase 3 needs EMBALAGEM for bag textures) — display only.
- [x] Filter refinements (user): HIDDEN_BY_SLUG manual overrides — tinytoon '5-2'
      (porta-tazo photos), maskara 'pega-tazo'/'6-6'/'2-2' (launcher toy). Gallery
      sections titled CARTA/CARD now render as shape card (corner rounding + UV inset
      hide scanner margin) — fixes digimon DIGICARTAS white border. Verified headless.
- [x] More curation (user): hidden — yugiohmagic 1+2/1+1, yugiohmetal 1+12, liga stamps,
      filhotes figurinha sections. RENAMED_BY_SLUG (filhotes 45-15 -> ADESIVOS) and
      SHAPE_BY_SLUG (jokenpokemon 60-x-2 -> card: rounded-square tazos, kills white
      scan margin). bobesponja manifest rewritten by one-off script: 100 alt-coded
      items ("2005.02.01.NN-A/-B") paired A=front B=back, renumbered 1-50, kind paired.
      NOTE: re-scraping bobesponja regenerates the wrong labels — parser doesn't know
      the -A/-B suffix pattern yet (tech debt).
- [x] Batch curation round 2 (user): sharp trim({threshold:35}) rewrote 372 images
      in-place (fonemania metal/drop, funki metal/black/105-7, cbjr 3-6-6) — kills
      scanner margins at the file level; sharp now a devDependency. cbjr manifest
      one-off: label-duplicate runs paired front/back -> 15 items (TAG/COLAR/CHAVEIRO).
      App: HIDDEN_ITEM_LABELS (fonemania drop 2006.*, natal TAZO/TAZO - EMBALAGEM),
      funki puf/mega/7x7 + tecnofun 27x3 hidden, tazolive 1-60/1-10 -> disc, cbjr ->
      card. FIX: initial selection now derives from filtered sections (natal's first
      raw item is hidden -> canvas never mounted).
- [x] Versos for all card collections (user: "espelhe as cartas"): mythomania stray
      items removed in-manifest, stray verso scan promoted to sharedBack; digimon
      digicartas (50) and spacejam pops (30) paired by duplicate-label runs (1st=front,
      2nd=verso); mapa cards get VERSO-MODELO-1 as sharedBack (site has 15 verso models,
      no per-card mapping). SHAPE_BY_SLUG: digimon/spacejam/mapa card sections -> card
      (collections are shape disc). naruto has no verso scans on the site. starwars/
      dracomania/wolverine/eco/vampiros/ferro/pokemon1 already flipped.
- [x] Fake-verso audit (user: "dracomania nao espelhou"): every shared-back EXCEPT
      starwars was a SEALED-PACK photo, not a verso scan — the parser's SHARED_BACK_RE
      matched "CARD LACRADO" groups. Cleared sharedBack in dracomania(2)/wolverine/eco/
      vampiros(2)/ferro; no Virar button now (honest: site has no verso scans for these).
- [!] SITE IS DOWN as of 2026-08-20: elmachipscolecoes.com.br returns Wix
      "ConnectYourDomain Error" 404. Wayback only has the homepage. The offline archive
      (public/collections, 1GB+) is now the ONLY copy — do not delete/purge it.
- [x] Multi-agent round (user: skills + model analysis + green island + footIK):
      * 10 project skills installed in .claude/skills/ (threejs-game-skills ×9,
        webgpu-threejs-tsl ×1; the 3 generator skills need paid API keys).
      * Model catalog: .tmp/model-catalog.json (610 entries, analyzer script at
        .tmp/analyze-models.mjs). kenney_nature-kit = 1:1 scale, self-contained;
        KayKit 2-5x too big (use ~0.25-0.5); hexagon-kit unusable; Shrubs pack fbx-only.
        kenney palette is pastel: leaves TEAL, dirt SALMON — rock_* read pink, use stone_*.
      * Vegetation v3 (parent wrote it — map agent died on API session limit): 330 seeded
        spots, 27 templates, groves via fbm mask, flower triplets, 3 POIs (KayKit
        showpiece tree, woodcutter camp, gold treasure). Toon conversion now keeps .map.
      * PlayerTPS.tsx (agent): three-player-controller@0.6.0 + three-mesh-bvh, footIK
        plugin, Quaternius UAL mannequin (CC0) at public/game/character/ual.glb.
        Controller is BVH-based, NOT rapier: player ignores blocks/projectiles.
        Integration: shots spawn from controller.getPosition()+1.4, pickups collect vs
        character pos, HUD lists Shift/V. Player.tsx (FP) left unused (V toggles FP).
      * Visual fixes: Sky turbidity 2.2/mie 0.003 + Bloom threshold 1.0 (sky was washing
        white), water #2a9cc4, peak stones sparse (spawn sits on the summit).
- [x] Bug (user: "tela piscando sem parar ao mover"): two causes fixed — (a) inline
      onReady prop re-created per Game render -> PlayerTPS effect tore down + re-inited
      the controller (GLB reload, BVH rebuild, camera re-parent) on every state change;
      now useCallback. (b) overlay/crosshair mirrored pointerlockchange while the TPS
      controller acquires/releases lock itself -> overlay flashed. Now a `playing` flag:
      first pointerdown on .game-root starts, Escape stops; ShootListener gated by
      `playing` (via ref, so the starting click doesn't fire).
- [ ] User manual test: TPS walk/footIK feel, shooting from 3rd person, island decor
      <-- CURRENT

### Watch Out (additions)
- Headless screenshots ALWAYS show the dark lock overlay (no pointer lock) — hide it
  with addStyleTag('.lock-overlay{display:none}') before judging colors/sky.
- First game load after new deps: vite re-optimizes → canvas takes >20s; probes must
  wait or retry.
- TPS player does not collide with rapier blocks (BVH terrain only) — addDynamicCollider
  per block via onReady if needed.

### Previous task (same session): scrape remaining tazo-family collections — DONE.
- [x] Site inventory via /pages-sitemap.xml + /lista: ~95 pages; 5 tazo-family
      collections missing from index: cadê, máquinadotempo, dbz, montáveismarvel, tech.
      (surpresa1-3 = CHEETOS COM SURPRESA physical toys, multi-promo pages — skipped;
      cat1-3 = kits/pelúcias/revistas — out of scope.)
- [x] Parser: pairMirroredRuns — cadê lists fronts/backs as separate runs in blocks of 10
      (fronts 01-10, backs 01-10, ...); matched by leading number (site alts carry typos,
      e.g. "29 - CORÉIA DO SUL01-29-A"). TAZOS now paired 30/30, zero anomalies.
- [x] Parser: numbered groups of exactly 4 images = two variants of the same number, each
      front+back (dbz spinners come in 2 edge cuts) — split into 2 items; previously
      images[2..3] were silently dropped. Oversized-group anomaly now only for >4.
- [x] Scraper: optional `page` field in index.json (site path with accents, ASCII slug
      for folder/URL-safety), encodeURIComponent on fetch; fill only for shape disc
      (montável plates are arbitrary rectangles → fit).
- [x] Index: +5 collections (cade, maquinadotempo, dbz = tazos; montaveismarvel, tech =
      new category "extras", shape photo). types.ts: shape union + page?.
- [x] Scrape: 5/5 downloaded — 878 images, 184MB, 0 failed. All anomalies benign EXCESS
      (montável 108 = 36 figures × 3 plates; tech stamps 36 vs 30 = variants).
- [x] Tests: +cade/dbz fixtures, 26/26 pass (mirrored-run pairing, 4-group split,
      no misfire on non-repeating sections). tsc clean.
- [x] Visual spot-check: cade front↔back pairing correct, dbz variant split correct
      (wavy vs fine-toothed edges), montável aspect preserved.
- [ ] Manual test by user (new: Extras category on home, cade/dbz flips) <-- CURRENT

### Key Files (current shape)
**`scripts/lib/parse.mjs`** (~230 lines, v2.1)
Generic Wix parser: button-label markers, nav expected counts, consecutive-equal-alt
grouping + mirrored front/back runs + 4-image variant split, shared-back, gallery fallback.

**`scripts/scrape.mjs`** (~125 lines, v2.1)
Multi-collection CLI (--all), meta.page for accented site paths, fill only for disc,
manifest v2, exit code on anomalies, idempotent.

**`public/collections/index.json`**
39 collections (28 tazos, 9 cards, 2 extras) + 3 categories. `page` = site path when
slug is ASCII-normalized.

**`src/types.ts`**
CollectionInfo/CollectionManifest: shape 'disc' | 'card' | 'photo', optional page.

**`src/App.tsx`**
Home (categories from index.json) + CollectionView; photo shape flips too (back material).

### Decisions (active)
- ASCII slugs on disk, accented site path via `page` — avoids accent-encoded folder/URL pairs.
- dbz 4-image groups = 2 variants per number, both kept as separate items (same number).
- Montáveis = category "extras", shape photo (rect plates, fit download, flip supported).
- Site alt typos (dbz #17/29/43/56/58, "2005.03.01.43-B") left as-is: extra unpaired items,
  every scan kept, nothing guessed.

### Next Steps
1. User manual test: Extras category, cade tazo flip, dbz variant pairs, montável photos.
2. MVP step 3: bag models from EMBALAGEM galleries + shooting mechanic.

### Blockers
- None.

### Watch Out
- smoke-game.mjs runs HEADED (headless chromium rejects pointer lock, WrongDocumentError)
  and CAPTURES THE REAL MOUSE — touching the mouse mid-run spins the camera and fails
  screenshots. Warn the user before running it.
- Scraper exits 1 on ANY anomaly, including benign EXCESS — check "0 failed" lines before
  treating a scrape as broken.
- npm/scrape MUST run from nostalgic-world/ — session cwd resets between some tool calls.
- Smoke needs dev server on port 5199.

---
---

## Session Archive

### Session 5b -- 2026-08-20: Block-break performance pass
**What we did:** "quebrar blocos spawna muitos tazos e fica lento". Four causes fixed: (1) a block's rapier body outlives its React state by a frame, so one projectile fired `onCollisionEnter` several times and kept flying through the wall -- `broken` Set guard + projectile removed on impact (one block per shot); (2) each pickup carried a `pointLight` -- light-count change recompiles EVERY material (terrain, ~330 plants) on each spawn/collect -- replaced by a shared additive halo mesh that Bloom picks up; (3) pickups decoded 1024px front+back on the main thread -- `Collectible` gained `maxSize` (ImageBitmapLoader `resizeWidth`, `imageOrientation:'flipY'` because flipY is ignored for bitmaps; TextureLoader fallback), pickups 256px, held tazo 512px; (4) fragments/blocks/projectiles now share one geometry + material, debris has no Outlines/shadow, 2.5s TTL, caps: 40 fragments, 8 pickups (oldest culled).
**Files:** src/game/Blocks.tsx, Pickups.tsx, Projectiles.tsx, Game.tsx, HeldTazo.tsx, src/collectible/Collectible.tsx
**Decisions:** Kept per-body RigidBody for debris (InstancedRigidBodies not worth it at 40 bodies). Headless probe can't aim at the wall (camera orbit needs pointer lock) -- break flow validated by tsc + user test only.

### Session 5 -- 2026-08-20: Git init + GitHub push
**What we did:** `git init`, private repo github.com/luigivivian/nostalgic-world. Code + game assets in one commit; public/collections (1.2 GB, 5942 files) in 8 commits of <=200 MB each.
**Files:** .gitignore (node_modules, dist, .tmp, .env, *.tsbuildinfo), package-lock.json force-added (global gitignore excludes it).
**Decisions:** Private because the scans are Elma Chips IP. Collections committed (not LFS/excluded) -- site is dead, the repo is now the backup. Single 1.14 GiB pack push over https fails (`curl 55 Recv failure: Operation timed out`); batching by collection folder + retry loop worked (one hang-up on batch 2, retried). No SSH key on this machine. Commits carry no Co-Authored-By trailer (user rule).

### Session 4 (part 2) -- 2026-08-05: FP island game mode (MVP Phase 3/4 slice)
**What we did:** Procedural island (seeded fbm, radial falloff, vertex colors) with rapier
trimesh; pointer-lock FP capsule controller; projectile shooting; breakable block wall
(8-fragment burst); tazo drops with real scraped textures; FP held-tazo inspect; bloom/fog/
palms/clouds/water polish. Key fix: Suspense boundary INSIDE Canvas for rapier wasm.
**Files:** src/game/* (10 new), src/App.tsx, src/vite-env.d.ts, scripts/smoke-game.mjs,
src/styles.css
**Decisions:** rapier (installed 2.2.0) not ammo; fragments approximate ammo_break; drops
reuse Collectible; headed smoke (pointer lock needs it). Toon look: shared 4-step ramp +
MeshToonMaterial everywhere except collectibles; Kenney CC0 GLTFs (Draco) from the pmndrs
market-assets mirror for palms/rocks/plants.

### Session 4 -- 2026-08-05: Remaining tazo-family collections (5 new, +Extras)
**What we did:** Inventoried site via sitemap+/lista (~95 pages); added cadê, máquinadotempo,
dbz, montáveismarvel, tech. Parser v2.1: mirrored front/back runs (cadê blocks of 10, matched
by number due to alt typos) and 4-image variant split (dbz 2 edge cuts — old parser dropped
half the scans). Scraper: `page` field for accented site paths, fill only for disc. 878
images, 184MB, 0 failed. 26/26 tests with new cade/dbz fixtures.
**Files:** scripts/lib/parse.mjs, scripts/scrape.mjs, src/types.ts,
public/collections/index.json, scripts/lib/__tests__/*
**Decisions:** ASCII slugs + page field; variants kept as separate items; montáveis =
category extras, shape photo; surpresa1-3 (physical toys) out of scope.

### Session 3 -- 2026-08-04: Generalization — all collections, cards in 3D
**What we did:** Parser v2 with auto-discovered sections + page-declared expected counts;
34-collection curated index; scraper v2 (fill/fit, manifest v2); shared geometry core with
disc/card/photo shapes; cover-crop UV for card scans; App v2 with category home. 5
collections downloaded (270MB). 23/23 tests, 4-screen smoke pass.
**Files:** scripts/lib/parse.mjs, scripts/scrape.mjs, src/collectible/*, src/App.tsx,
public/collections/index.json
**Decisions:** validation via page's own counts; fit for galleries; anomalies flagged not guessed.

### Session 2 (part 2) -- 2026-08-04: Flip polish rounds
**What we did:** Review/QA fixes applied (validation, disposal, guards). Two user-driven
polish rounds on the flip: (1) exponential damp read as a blink -> eased tween + dt clamp;
(2) still blinking -> real root cause was useLoader.clear + StrictMode emptying drei's
suspense cache (every flip re-suspended -> mesh vanished frames). Replaced useLoader with
manual TextureLoader + explicit disposal; flip became a spring + x-tilt (never edge-on).
**Files:** src/tazo/Tazo.tsx, src/tazo/TazoViewer.tsx, scripts/scrape.mjs
**Decisions:** never clear a suspense cache while consumers are mounted; frame-capture
verification for visual bugs.

### Session 2 -- 2026-08-04: MVP step 1 — scrape + 3D viewer + tests
**What we did:** Built scraper (80 tazos, 0 anomalies, 160 images), procedural notched-disc
geometry with front/back/rim groups, viewer with flip + drag, picker UI. 7/7 unit tests,
Playwright smoke pass. Two polish rounds via screenshot review (notch size, specular wash).
**Files:** scripts/lib/parse.mjs, scripts/scrape.mjs, scripts/smoke.mjs, src/tazo/*, src/App.tsx
**Decisions:** 1024px CDN downloads; no image processing (geometry crops corners).

### Session 1 -- 2026-08-04: Inception + site recon
**What we did:** Analyzed game concept, scraped reference site, discovered Wix full-res URL
trick (strip after `~mv2.jpg` → 2055px originals; or request any size via /v1/fill/w_N),
mapped /looney sections and /lista catalog (~60 collections 1981-2005). Wrote PRD/CLAUDE/DEVLOG.
**Files:** PRD.md, CLAUDE.md, DEVLOG.md
**Decisions:** Vite+R3F stack; procedural tazo geometry; offline scrape pipeline.

---

## Milestones
- [x] Phase 1 — scraper produces complete looney manifest with zero manual fixes
- [x] Phase 2 (partial) — tazo vertical slice renders at quality bar (pending user manual test)
- [ ] Phase 3 — bag shooting + drop loop
- [ ] Phase 4 — timeline world + looney portal
- [ ] Phase 5 — album + persistence + audio
- [ ] Phase 6 — perf pass + Vercel deploy

## Mistakes & Lessons
### 2026-08-05 - key={itemId} on the Canvas wrapper leaked WebGL contexts
**What happened:** User reported PORTA-TAZO "not rendering" — actually the whole canvas
died after browsing items ("THREE.WebGLRenderer: Context Lost").
**Root cause:** ViewerErrorBoundary (wrapping <Canvas>) had key={itemId} for error retry,
so every item click remounted the Canvas and created a new WebGL context; browsers cap
~8-16 contexts and kill the oldest.
**How we fixed it:** Boundary resets via a resetKey prop (componentDidUpdate) — one Canvas
per collection view, no remounts.
**Lesson:** Never key-remount a component that owns a GPU context. Reset state via props.

### 2026-08-04 - GPU-leak fix introduced the flip blink
**What happened:** After adding useLoader.clear + texture dispose in Tazo's cleanup (code
review fix), every "Virar tazo" click made the mesh vanish for a few frames.
**Root cause:** StrictMode runs mount->cleanup->mount, so the cleanup emptied drei's
suspense cache while the component stayed mounted; the next re-render re-suspended and
Suspense fallback (null) unmounted the mesh mid-frame.
**How we fixed it:** Dropped useLoader entirely — manual TextureLoader.loadAsync with
explicit disposal; old textures stay visible until the new pair is ready.
**Lesson:** Never clear a suspense resource cache from a cleanup that can run while the
consumer is still mounted. Verify visual fixes with frame-by-frame capture, not just tests.

### 2026-08-04 - Media regex missed underscore
**What happened:** Parser found 0 images; `[A-Za-z0-9]+` didn't match `f1ded6_...` media ids.
**Root cause:** Character class missing `_`.
**How we fixed it:** `\w+`.
**Lesson:** Test parsers against the real fixture before building downstream.

### 2026-08-04 - Section leak without boundary titles
**What happened:** Mega section swallowed 264 images (everything after its header).
**Root cause:** Only paired-section titles were markers; page continues with more sections.
**How we fixed it:** BOUNDARY_TITLES list delimits where paired sections end.
**Lesson:** When slicing a linear document by headers, always mark the *next* header too.

## Technical Debt & Future Ideas
- KTX2 compression + 2048px inspect-mode tier (Phase 6).
- Master-tazo fino/batedor sections (different structure: color variants, singles).
- git init + first commit (project not yet under version control).
- More collections: tinytoon, animaniacs, maskara, pokemon2, cartoon, yugioh, bobesponja.
