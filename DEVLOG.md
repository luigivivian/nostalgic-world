# Nostalgic World Dev Log

## Working State
**Session:** 6 | **Date:** 2026-08-21

### Active Task
Asset-variety pass (user: "o pacote de assets é muito maior dos recursos utilizados,
explore melhor") on top of the playtest fixes (archived below).
- [x] Inventory (.tmp script): Kenney 76/329 used, KayKit Forest 13/105, ResourceBits
      9/76, hexagon-kit 1/72 (tile style — left out), Ekfs Shrubs 0/20 (FBX only).
- [x] Ekfs pack → 20 GLB (public/game/models/shrubs, .tmp/shrubs-to-glb.py, Blender
      headless, atlas embedded).
- [x] Vegetation pools: RICH tier (= !LOW_END) layers textured variants on the base
      pools via rich(base, extra); UNIT map normalises per-file size inside put();
      LIFT map applies the poly minY lift on every placement path (the bosque backdrop
      sunflowers were buried to the head). KayKit Tree_1/2/3/4 groves (one non-autumn
      grove in three), Tree_Bare on the top band, KayKit/Ekfs bushes, Ekfs flowers +
      mushrooms + stones, KayKit stones, stump_old/oldTall, Ekfs grass; highland band
      now has Kenney pine stands (pineGround/Small/Round/Default) + bushes; lily pads
      (lily_large/small) on the shallows (h in [-0.55,-0.1], fbm-clustered, 70 max).
      Density: groves 42→58 (min spacing 13), scatter 900→1300, carpet 160→320, poly
      meadow 44→70. KayKit boulders shrunk (were 7 u cubes on the ridge).
- [x] POIs (Trails.tsx, RICH): homestead plot at (-36,-8) — 3 crop rows (corn, wheat,
      pumpkin+melon) in a fence with gate, pots, sign; quarry at (-26,-26) — stone
      chunks, brick stack, iron/silver nuggets, covered pallet, boulders, sign; bivouac
      pots; woodcutter camp + planks stack + 2 logs (Vegetation POIs).
- [x] props.ts MATERIAL_COLORS grew: wood/woodDark (fences, signs, pots were salmon),
      grass (corn/pumpkin leaves were teal), dirt/dirtDark.
- [x] BUG found by the density bump: formation-*.gltf (same pack as palm-detailed) carry
      a 5-12 u root-node translation — every formation rock rendered far from its spot
      (one landed behind the hero; the "sea pillars" SW of the island were these). Fix
      generalised in toonParts: any loose /game/models/*.gltf gets its root offsets
      zeroed. Found with .tmp/probe-which.mjs (hide each InstancedMesh, diff a pixel
      patch).
- [x] Verified: tsc, vitest 43/43, probe-gameplay ALL PASS, views (farm/quarry/
      woodcutter/shallows/meadow/overview/spawn) in .tmp/view-*.png.
- [ ] User playtest <-- CURRENT
- [ ] Commit only when the user asks (never a Co-Authored-By trailer)

### Perf (probe-budget, headless M1, calls = main + shadow pass)
| | idle | play | stress |
|---|---|---|---|
| desktop before (post-5k) | 339 | 361 | 397 |
| desktop now (variety pass) | 289 | 311 | 372 |
| mobile before | 273 | 295 | 319 |
| mobile now | 139 | 161 | 180 |
Tris 1.02M desktop / 0.72M mobile. The RICH tier costs desktop +48 idle calls (≈40 more
model files); stress sits ~20 over the 350 goal at 60+ fps — accepted for the variety,
trim candidates are the Ekfs mushrooms/grass. Mobile stays under 200.

### Key Files (current shape)
**`src/game/Vegetation.tsx`** (MODIFIED, ~470 lines) pools = rich(base, extra); UNIT /
LIFT maps in put(); groves (KayKit on RICH), highland pines, lily shallows, POIs.
**`src/game/assets/Trails.tsx`** (MODIFIED) trail loop + crags + accents; homestead and
quarry POIs behind RICH.
**`src/game/assets/props.ts`** (MODIFIED) MATERIAL_COLORS (9 kit material names) →
TINTS by file; root-offset strip for loose /game/models/*.gltf.
**`src/game/assets/SpawnBeach.tsx`** (REWRITTEN) authored spawn ground only.
**`public/game/models/shrubs/`** (NEW) 20 Ekfs GLBs, atlas embedded.

### Decisions (active)
- Static props never mount their own scatter: add spots to WorldProps (Island.tsx).
- LOW_END drops the scatter shadow pass (hero/bags/terrain keep theirs) — that is what
  brought mobile from 273 to 129 calls; revisit only with a real-device fps number.
- No sea landmarks: the island is the whole map; the horizon stays empty.
- Kit colour fixes go in props.ts MATERIAL_COLORS (by material name), never per file
  unless one file needs to differ (TINTS).
- Spawn ground is authored in SpawnBeach.tsx only; Vegetation keeps out (r 9).
- Variety is desktop-only (RICH): the base pools are the mobile draw-call budget.
- New kit material colours: MATERIAL_COLORS by material name, never per file.

### Next Steps
1. Roadmap 9: progression between collections + album in localStorage
2. Roadmap 8: hero collides with bags/debris (needs BVH colliders, not rapier)
3. Real phone test of the LOW_END tier (fps + touch) — numbers above are emulated
4. Roadmap 6/7/10: terrain surface grain, shot VFX + hitstop, audio (CC0)

### Blockers
- None hard. Paid generators unavailable by design.

### Watch Out
- **The player does NOT collide with rapier bodies.** Walkable props go into the
  controller's BVH (PlayerTPS extraColliders), not rapier.
- **controller.getPosition() ≈ feet + 1.5 u**, not the feet: any proximity test against
  ground objects must work in XZ (or subtract the offset), never raw 3D distance.
- Loose gltfs at the models root carry root-node offsets (toonParts strips them); a
  model that "appears somewhere else" → check node translations first (.tmp/bbox.mjs).
- Test hook 'active-play' calls store.startRound only — no ammo piles; press Enter
  (Game.beginRound) in probes that need them.
- A user GLB "environment" may ship its own sky/sea/ground meshes — strip them before
  mounting (sea-keep's black sky dome cost a session to notice).

---
---

## Session Archive

### Session 6c -- 2026-08-21: Asset-variety pass — KayKit/Ekfs pools, POIs, highland pines
**What we did:** Inventoried the packs (Kenney 23% used, KayKit 12%), converted the Ekfs
FBX pack to GLB, layered textured variants on every pool behind a RICH (= !LOW_END)
tier, added highland pine stands, lily shallows, a homestead, a quarry, camp extras;
remapped 5 more salmon/teal kit materials; fixed the formation-*.gltf root offsets.
**Files:** Vegetation.tsx, assets/Trails.tsx, assets/props.ts, assets/InstancedProps.tsx,
public/game/models/shrubs/*, poly/CREDITS.md.
**Decisions:** variety is desktop-only; desktop 289/311/372 calls accepted (mobile 180).

### Session 6b -- 2026-08-21: Playtest fixes — pickup bug, glowing debris, clean spawn, no islands
**What we did:** Fixed the uncollectable ammo pile (getPosition() sits 1.5 u above the
feet; +0.9 more put the test point out of radius → XZ test). Bag debris became bouncing
over-white yellow balls (Bloom) + yellow crumb burst. Removed hex islet, sea keep,
causeways and their colliders. Re-authored the spawn with Kenney palms + KayKit
understory only; kit-wide material remap (salmon bark → brown, teal leaves → green).
**Files:** AmmoPickups.tsx, Targets.tsx, vfx/GameVFX.tsx, assets/SpawnBeach.tsx,
Vegetation.tsx, assets/Trails.tsx, assets/props.ts, assets/InstancedProps.tsx,
assets/StationDressing.tsx, Island.tsx, Game.tsx; HexIslet.tsx deleted.
**Decisions:** island-only map; MATERIAL_COLORS by name in props.ts; spawn ground owned
by SpawnBeach. Desktop 241/263/293, mobile 132/154/181 calls.

### Session 6 -- 2026-08-21: Ammo legibility, spawn sightline, DeepSeek code review, draw-call pass
**What we did:** Found the real head-occlusion bug (palm-detailed root-node offset, fixed
in toonParts), rebuilt the ammo pile (pallet + merged bags + halo + burst), reviewed the
5k (DeepSeek) code — stripped the sea-keep's own sky dome and decimated it 19 MB → 2.9 MB,
fixed HexIslet hook order/dead rapier body, deduped Trails causeway math — and unified all
static props into one InstancedScatter, merged Luigi's skinned meshes, instanced debris.
**Files:** Island, Vegetation, Game, PlayerTPS, Targets, AmmoPickups, store, GameVFX,
assets/{AmmoPile,SnackBag,SpawnBeach,Trails,HexIslet,StationDressing,InstancedProps,props,heroLook,DevShowcase}, env/sea-keep.glb
**Decisions:** One WorldProps scatter; LOW_END skips scatter shadows; mobile 273→129 calls.

### Session 5k -- 2026-08-21: 5 new user GLBs analysed + island dressing pass
**What we did:** User dropped 5 GLBs at the repo root. Analysed each (node GLB probe:
sizes/bbox/materials/animations, then in-page baked-bbox measurement). Classified:
blue-tulips (0.75 u, 31k verts, 1 tex mat) and twisting-tree (7.5 u, 3k verts, textured)
= instanced props -> moved to poly/ and placed via putPoly (3 blue tulip beds, 5 twisting
showpiece trees). sea-keep (19.3 MB, 229k verts, 7 meshes) -> env/, mounted as a distant
landmark on the south horizon at the pier's sight line (Suspense, castShadow=false,
LOW_END-gated). shanghai-gardens (4155 meshes!) and zen-gallery (19 MB textures, 3088 u
world, animated) -> env/, NOT mounted: future portal/album rooms needing a bake pass.
Also: KAYKIT_ROCKS pool + formation-*.gltf (tinted #98836b) into the high band, beach and
a new 26-boulder shoreline scatter. Two bugs found via pixel probes: (1) accessor bbox
ignores node transforms (keep floated 16 u — pinned the baked sea disc instead);
(2) InstancedMesh frustum culling is instance-unaware and the baked geometry sits ~1200 u
from the object origin, so the keep was culled — added `frustumCulled` to
buildInstances/InstancedProps. Added __THREE_GAME_RENDERER__ dev hook; probe-keep renders
the live scene with a temp camera and diffs pixels (456k px delta proves the silhouette
draws at the horizon). Perf after: desktop idle 256 calls / 1005k tris / 60fps; vitest
43/43, probe-gameplay 30/30, tsc + prod build clean.
**Files:** src/game/Vegetation.tsx, src/game/Island.tsx, src/game/assets/props.ts,
src/game/assets/InstancedProps.tsx, src/game/diagnostics.ts,
public/game/models/{poly,env}/*, .tmp/probe-keep.mjs, .tmp/analyze-models.mjs (re-run)
**Decisions:** Env GLBs stay unmounted until a real merge/atlas pass. Baked-bbox math for
any environment-scale model. LOW_END skips the keep (download + 208k tris on phones).

### Session 5i -- 2026-08-21: Game director phases 2-7 (premium pass)
**What we did:** Three parallel Opus workers (gameplay / assets+VFX / UI+mobile) + director integration: store-driven station shooter with album progression, snack-bag targets wearing real packaging scans, beach spawn + dressing + instanced vegetation, pooled VFX, full HUD/menus/touch controls, mobile quality tier, shared curation module, test hooks + diagnostics, canvas inspector on prod preview. Review (Sonnet) + QA (43 tests) applied.
**Files:** src/game/{store,stations,Targets,AmmoPickups,diagnostics,quality}.ts(x), src/game/assets/*, src/game/vfx/GameVFX.tsx, src/game/ui/*, src/collectible/curation.ts (+tests), Game/Pickups/Projectiles/HeldTazo/tazoPool/PlayerTPS/Island/Vegetation, App.tsx (?play), index.html, tsconfig (exclude tests), vite.config (vitest exclude .claude).
**Decisions:** No paid generators (probe MISSING). Workers died once with the CLI process and were resumed from transcripts. Peer session owns the hero; coordinated via SendMessage before touching PlayerTPS.

### Session 5h -- 2026-08-21: Luigi animated via Blender retarget (no Mixamo needed)
**What we did:** "o gnomo nao esta animado, o luigi ficaria animado?" -- gnome has no skeleton (puppet only); Luigi has 79 bones but zero clips. Wrote `scripts/retarget-ual.py` (headless Blender): imports ual.glb next to the Luigi rig, and per frame applies each UAL bone's rotation delta from its own rest (armature space, `pose.matrix @ rest.inverted()`) to the mapped Luigi bone's rest rotation; pelvis translation delta scaled by pelvis-height ratio (23.0). Bone local axes never matter -- only that both rigs rest in the same pose (both T-pose, feet forward; Source "bip" bones have 0.1-unit tails and arbitrary rolls, so world-delta is the only sane method). 20 bone pairs; fingers/face left at rest. Each clip -> NLA track -> `export_animation_mode='NLA_TRACKS'` -> public/game/character/luigi.glb (3.0 MB, 6 clips, 25 textures). Rig yaw (-20 deg in the .blend) zeroed before export; glTF front = +Z, so `rotateY: Math.PI`. PlayerTPS: rigged GLB -> real clips + FootIK with `bip_*` names + `headBoneName: 'bip_head'` (first person back); no clips -> puppet fallback. All meshes MeshToonMaterial (albedo only, keep transparent/alphaTest/side for eyes/brows), `frustumCulled=false` on the skinned parts. Verified: `.tmp/anim-view.html` strip of Walk_Loop (stride + arm swing, front and side) and in-game back view mid-stride, no console errors.
**Files:** scripts/retarget-ual.py, public/game/character/luigi.glb, src/game/PlayerTPS.tsx
**Decisions:** Blender retarget over Mixamo: zero manual steps and reuses the UAL clip names the controller already maps. Luigi is a Nintendo asset -- private build only. Mixamo uploads in `.tmp/mixamo/` stay as the fallback if a clean-IP character is needed later.

### Session 5g -- 2026-08-21: Gnome as the character (unrigged, puppet-animated)
**What we did:** User dropped `gnome.glb` (root; copied to public/game/character/): one static mesh, 2543 verts, 1024^2 PNG, T-pose, FBX2glTF, 5.7 u tall -- NO skeleton, NO clips. Swapped it in anyway: three-player-controller normalises any model to its capsule height and parents it under the capsule, so PlayerTPS re-parents the mesh under a `puppet` pivot and animates that each frame from `playerVelocity`/`getIsOnGround`: hop (|sin| 7 cm), waddle roll, lean into speed, landing squash, airborne stretch, idle breathing. Six no-op AnimationClips (zero track on an `animDummy` node) keep the lib's state machine + jump LoopOnce/'finished' chain quiet. MeshToonMaterial with the GLB's texture. FootIK, heroLook and first-person toggle (needs a head bone) removed. `rotateY: Math.PI` -- gnome is authored facing +Z, controller forward is -Z (verified: back view at spawn). Also wrote `.tmp/gnome-mixamo.zip` (OBJ+MTL+PNG, world transform baked, UV v flipped) for Mixamo auto-rig.
**Files:** src/game/PlayerTPS.tsx, public/game/character/gnome.glb
**Blender installed** (`brew install --cask blender`, 5.2 LTS, `/Applications/Blender.app/Contents/MacOS/Blender -b`). With it: inspected `luigi model.blend` (Super Mario Odyssey rip: 79-bone `bip_*` Source skeleton, 5.4k verts, PBR textures, ZERO actions -- rigged but unanimated; Nintendo IP, private use only); exported a mesh-only T-pose FBX (`.tmp/mixamo/luigi-mixamo.fbx`, unparent must keep `matrix_world` or the pieces scatter) next to `.tmp/mixamo/gnome-mixamo.zip`. Wrote `scripts/mixamo-to-glb.py`: first FBX "With Skin" + N "Without Skin" -> actions parked as NLA tracks -> one GLB with clips named by KEY (`export_animation_mode='NLA_TRACKS'`). Tested on UAL re-exported to FBX: 52 joints, 2 clips.
**Decisions:** Mixamo (free) over Tripo (no API key). Puppet gnome is the stopgap until the Mixamo download lands. heroLook.ts is now unused by PlayerTPS (parallel session's file, left in place).

### Session 5f -- 2026-08-21: "bolas marrom ao redor do jogador"
**What we did:** Scene inspection (DEV `window.__scene`, traverse meshes near `__pp` by bounding radius) found the culprits: `heroCap` dome r=9.6 and brim r=9.4 parented to the Head bone, plus the inverted-hull outline inflated 1.5 units (#241a14 = the dark brown ball). `src/game/assets/heroLook.ts` (parallel session's costume pass) assumed rig units x0.01, but the UAL GLB is authored in metres (mesh bbox 1.83 high) and three-player-controller does NOT scale the model node -- its `scale` only maps its own physics numbers. Converted every constant to metres: outline 0.015, cap 0.096/0.094, offsets 0.085/0.015, stripe band 0.11, sole 0.022.
**Files:** src/game/assets/heroLook.ts, src/game/PlayerTPS.tsx (DEV `window.__scene` hook)
**Decisions:** Kept the `__scene` DEV hook next to `__pp`/`__air` -- `.tmp/inspect.mjs` makes "what is this giant thing" a 10 s question.

### Session 5e -- 2026-08-21: Double jump / air sprint
**What we did:** "espaço duplo = sprint voador que flutua". Space while airborne (once per airtime) in PlayerTPS.tsx: `playerVelocity.y = 520*scale` (ground jump is 600), `gravity` -2400 -> -700 (*scale) for 900 ms, xz velocity re-pinned to 11 u/s along the current move dir every frame (the controller eases xz back to walk/run speed each update, so a one-shot impulse would decay), `animation.startJump(true)` replays jumpLoop. Gravity restored when the window ends or on landing; `used` flag resets on ground. Measured (headed Playwright, in-page rAF recorder, DEV `window.__air`): single jump +0.7 u; air jump adds +1.9 u with a slow apex; walk 3.0 u/s -> glide 9.5 u/s for 0.88 s -> back to 3.0.
**Files:** src/game/PlayerTPS.tsx
**Decisions:** Listener on document keydown next to the lib's own window listener (lib does not stop propagation; it ignores Space when airborne, so no double handling). Re-pin only when xz speed > 1 u/s so decel tails are not amplified into a stray 11 u/s push. TouchControls' synthetic Space keydown also triggers it (mobile double-tap jump). Probing tip: `page.evaluate` polling is ~80 ms and useless for jump arcs -- record per frame inside the page (`.tmp/jump-probe.mjs`, `.tmp/sprint-probe.mjs`).

### Session 5d -- 2026-08-20: TPS aim: reticle above/ahead, shots converge on it
**What we did:** (1) "mira no umbigo": crosshair is a fixed screen-centre dot, so its world point is the controller's orbit target -- `camLookAtHeightRatio` 0.5 -> 1.9 (0 = capsule bottom, 1 = top, no clamp): character centred low in frame, reticle ~2 heads above him. Tried the lib's over-shoulder view (`enableOverShoulderView`, camera.setViewOffset) at 0.18 then 0.08 -- user wanted him centred, so removed. (2) "bolinha sai acima da mira": `playerCapsule.position` is the capsule's TOP sphere centre, so `body.y + 1.4` spawned ~1.4 u above the head, flying parallel to the camera ray. Now: Raycaster.setFromCamera((0,0)) (goes through the projection matrix, so honours the view offset) -> rapier `world.castRay` with the projectile's groups -> aim point (or 120 u out) -> shot spawns at shoulder (`body.y - 0.35`, 0.6 u along the aim dir) and is aimed spawn->aim point. Hits closer than the character (camera clipping into a slope) ignored. Projectile `gravityScale` 0 -- at world gravity -22 the ball dropped ~0.5 u over the 10 u to the wall; even 0.15 left a visible miss, user wants it to land ON the dot. Ray excludes sensors (`QueryFilterFlags.EXCLUDE_SENSORS`). ShootListener moved inside `<Physics>` for `useRapier`.
**Files:** src/game/PlayerTPS.tsx, src/game/Game.tsx, src/game/Projectiles.tsx
**Watch out:** a parallel session rewrote Game.tsx and Projectiles.tsx during this work and silently dropped the aim raycast + gravityScale (ball went back to spawning above the head) -- re-applied twice. Check `SHOULDER_DROP` still exists in Game.tsx before blaming aim math.
**Decisions:** rapier `RayColliderHit` field is `timeOfImpact` (nested @dimforge under @react-three/rapier), not the top-level package's `toi`. HeldTazo glues to camera centre, so it now sits slightly left of the reticle -- acceptable.

### Session 5c -- 2026-08-20: Game director phase 1 (assessment only)
**What we did:** /threejs-game-director discovery: five sibling skills + playbook + scorecard loaded, credential probe (Tripo/Gemini/ElevenLabs all MISSING), baseline scorecard avg 1.0 (HUD 0, obstacles 0, hero 1, world 1), mobile has no touch input. Wrote design brief / core loop / station-based level plan. Report: .tmp/director-phase1.md (not committed, .tmp ignored).
**Decisions:** No paid generators available -- premium pass would be procedural + existing packs. Phases 2-7 await user scope choice.

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
### 2026-08-21 - formation rocks rendered 12 u from their spots (and one behind the hero)
**What happened:** After densifying the scatter a tan block sat at the hero's back; the
instance list within 6 u of the spawn showed nothing. Hiding InstancedMeshes one by one
and diffing a pixel patch blamed formation-rock.gltf.
**Root cause:** The three formation-*.gltf (same source pack as palm-detailed-*.gltf)
carry a scene-placement translation on the root node (5.7,0,-10.7 etc.). The palm fix
from session 6 was file-specific, so the siblings kept the bug — the "sand pillars" out
at sea SW of the island were these rocks all along.
**How we fixed it:** toonParts zeroes root-node positions for any loose
/game/models/*.gltf (the kits keep theirs: Kenney's -0.05 y is meaningful).
**Lesson:** When one file from a pack needs a workaround, check its siblings the same
day. And `.tmp/bbox.mjs` prints node translations — run it on every new model.

### 2026-08-21 - Ammo pile could never be collected
**What happened:** Piles spawned, bobbed, glowed — and the ammo count never moved.
**Root cause:** three-player-controller's `getPosition()` returns a point ~1.5 u above
the feet. AmmoPickups added +0.9 (copied from Pickups.tsx) and measured 3D distance to
a pile on the ground: minimum possible distance 2.4 > collect radius 1.9. The tazo
pickups hid the same offset because their magnet radius (3.2) is larger than it.
**How we fixed it:** XZ distance + a 3 u height band; probe teleports onto a pile and
asserts the count rises.
**Lesson:** Never trust a "player position" without measuring what it is relative to
the feet (`__pp` vs terrainHeight in a probe takes 10 s). Proximity tests against
ground objects work in XZ.

### 2026-08-21 - "Palm on the hero's head" was a model offset, not a placement
**What happened:** Two sessions tuned SpawnBeach/StationDressing palm positions; a palm
crown still sat on Luigi's head at spawn.
**Root cause:** palm-detailed-short/long.gltf keep a (2.7|3.9, 0, -7.17) translation on
their root node. Every instance rendered ~7.7 u from its authored spot, rotated by its
yaw — keep-outs and authored framing were all checked against the wrong position.
**How we fixed it:** toonParts zeroes the root-child translation for /palm-detailed/;
re-authored the six spawn palms; probe-head2.mjs projects every mesh's 8 bbox corners
onto the head pixel to find occluders (origin-only projection missed it).
**Lesson:** When a prop is "in the wrong place", check the GLTF node transforms before
moving the placement; and probe with full bboxes, not origins.

### 2026-08-21 - The black dome on the horizon was inside the GLB
**What happened:** sea-keep.glb rendered a black half-dome over the sea.
**Root cause:** The model ships its own Sky_Sky_0 (baseColor black) and Sea_Sea_0 meshes;
toonParts merged them in with the fortress.
**How we fixed it:** Blender headless re-export stripping Sky/Sea + decimating
(19.3 MB → 2.9 MB, 168k → 14k tris).
**Lesson:** Inspect mesh names/materials of environment GLBs before mounting; strip
sky/sea/ground meshes and decimate landmarks seen only from afar.

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
