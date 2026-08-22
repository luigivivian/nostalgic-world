# Requirements Checklist: Album Persistence + Collection Progression (Roadmap 9)

**Purpose**: Unit tests for the requirements of Roadmap 9 (DEVLOG Next Steps #1) — validate that
the spec, once written, is complete, clear, consistent and measurable before implementation.
**Created**: 2026-08-21
**Sources**: PRD.md §Phase 4 (portals), §Phase 5 (album, persistence), §Phase 6 (budgets);
DEVLOG.md Working State → Next Steps #1; `src/game/store.ts` (current `album` / `CollectionInfo`
shape); `public/collections/index.json` (catalog: slug/year/name/category/shape).
**Note**: no `spec.md` exists yet (speckit not initialised in this repo). Items tagged `[Gap]`
are requirements that must be written; items tagged `[PRD §…]` test what the PRD already says.

## Requirement Completeness

- [ ] CHK001 - Is the persisted album data model specified (keyed by collection slug, then by tazo id), and is "tazo id" defined as a stable key rather than a texture path? [Gap, store.ts keys album by `tazo.front`]
- [ ] CHK002 - Are the fields kept per collected tazo (count, rarity, first-collected timestamp) listed, and is the timestamp source specified as wall-clock rather than `performance.now()`? [Gap, store.ts `firstAt`]
- [ ] CHK003 - Is the storage key name and a schema version for localStorage documented? [Gap, PRD §Phase 5]
- [ ] CHK004 - Are requirements defined for what is persisted beyond the album (score, unlocked collections, settings) and what is explicitly session-only (ammo, combo, station state)? [Gap]
- [ ] CHK005 - Is the set of collections eligible for progression specified (tazo-type only vs every `index.json` entry, including `cards`/`extras` categories and `photo`-shaped items)? [Gap, index.json `category`/`shape`]
- [ ] CHK006 - Is the ordering of collections in the progression defined (year from `index.json`, catalog order, or curated list), including tie-breaks for same-year collections (1997 has looney/tinytoon/animaniacs)? [Gap, PRD §Verified findings]
- [ ] CHK007 - Are the requirements for the album overlay contents specified: grouping by section, silhouette for uncollected, progress counter format (`67/80`), click → viewer? [PRD §Phase 5, Completeness]
- [ ] CHK008 - Is it specified how the album overlay is opened/closed (key, HUD button, touch) and whether it pauses the round? [Gap, PRD §Phase 5]
- [ ] CHK009 - Is the collection-switch flow specified end to end (select → unload current pool/textures → load next manifest → reset stations), including what happens to an in-progress round? [Gap, PRD §Phase 4 "dispose on exit"]
- [ ] CHK010 - Are requirements defined for the "album complete" outcome beyond the existing event: reward, unlock trigger, replayability of a completed collection? [Gap, store.ts `albumComplete`]

## Requirement Clarity

- [ ] CHK011 - Is the unlock rule quantified (exact percentage or count of the pool, or station-clear based) rather than "progression between collections"? [Ambiguity, DEVLOG Next Steps #1]
- [ ] CHK012 - Is "album denominator" unambiguous — distinct fronts in the drop pool (`poolSize`) vs official catalog count (80 in looney) vs all manifest items including extras/packaging? [Ambiguity, store.ts `CollectionInfo.poolSize`, PRD §Verified findings]
- [ ] CHK013 - Is "silhouette = not collected" defined visually (greyed texture, solid shape, blurred) so it can be reviewed objectively? [Clarity, PRD §Phase 5]
- [ ] CHK014 - Is the meaning of "locked" for a collection defined: hidden, visible-but-inert, visible with requirement shown? [Clarity, PRD §Phase 4 "locked silhouettes"]
- [ ] CHK015 - Is it clear whether duplicates (count > 1) have any gameplay value (score, trade, nothing) so the UI knows whether to surface the count? [Clarity, store.ts `AlbumEntry.count`]

## Requirement Consistency

- [ ] CHK016 - Does the progression model (unlock next by completing previous) agree with the PRD timeline concept where every portal is walkable and only the room content is gated? [Conflict?, PRD §Phase 4 vs DEVLOG Next Steps #1]
- [ ] CHK017 - Are rarity tiers used by the album (1pt/2pt/3pt/master fino/batedor) the same tiers defined in the drop table and in `rollRarity`, with one naming scheme? [Consistency, PRD §Phase 3, tazoPool.ts]
- [ ] CHK018 - Is the per-collection album consistent with the existing single `album: Record<string, AlbumEntry>` — is a migration from the flat shape required or is pre-release state discardable? [Consistency, store.ts, Gap]
- [ ] CHK019 - Does the persistence requirement "later Supabase if accounts" constrain the local schema now (e.g. must be serialisable/mergeable), or is it explicitly out of scope? [Consistency, PRD §Phase 5, Assumption]

## Acceptance Criteria Quality

- [ ] CHK020 - Can "progress survives reload" be stated as a testable criterion (collect N, reload, album shows N, counter unchanged)? [Measurability, Gap]
- [ ] CHK021 - Is the unlock criterion expressed so a test can assert the exact boundary (e.g. 79/80 locked, 80/80 unlocked; or ≥ 50% rounding rule)? [Measurability, Gap]
- [ ] CHK022 - Are album overlay performance budgets defined (time-to-open, texture memory for a full 80-item grid, thumbnail size tier) consistent with the PRD DPR/draw-call budgets? [Measurability, PRD §Phase 6]

## Scenario Coverage

- [ ] CHK023 - Are requirements defined for the first-run state (no saved data): which collection is active, which are unlocked, what the album shows? [Coverage, Gap]
- [ ] CHK024 - Are requirements defined for a returning player who completed a collection: can they replay it, and do drops still count? [Coverage, Gap]
- [ ] CHK025 - Are requirements defined for switching to a collection whose manifest has not been scraped (index.json entry without `manifest.json`)? [Coverage, Exception, Gap]
- [ ] CHK026 - Are requirements defined for a reset/clear-progress action and its confirmation, given progress is irreversible user effort? [Coverage, Recovery, Gap]

## Edge Case Coverage

- [ ] CHK027 - Is behaviour specified when localStorage is unavailable or throws (private mode, quota exceeded, disabled) — play without persistence, warn, or block? [Edge Case, Gap]
- [ ] CHK028 - Is behaviour specified when saved data fails to parse or has an older/newer schema version (discard, migrate, keep-as-is)? [Edge Case, Gap]
- [ ] CHK029 - Is behaviour specified when a persisted tazo id no longer exists in the re-scraped manifest (orphaned album entries)? [Edge Case, Gap — note re-scraping is impossible, site is dead; state whether this case is therefore excluded]
- [ ] CHK030 - Is behaviour specified when the drop pool is smaller than the catalog (e.g. items filtered out), so the album can never reach 100% by design? [Edge Case, store.ts `poolSize`]
- [ ] CHK031 - Are requirements defined for the album overlay on touch/LOW_END devices (layout, thumbnail tier, scrolling) given the mobile draw-call budget? [Edge Case, DEVLOG Decisions "variety is desktop-only"]

## Non-Functional Requirements

- [ ] CHK032 - Is the write frequency/strategy for persistence specified (on every collect, debounced, on unload) with a max acceptable data-loss window? [NFR, Gap]
- [ ] CHK033 - Are memory/disposal requirements stated for collection switching (textures of the previous collection released; budget per collection <80MB per PRD)? [NFR, PRD §Phase 6]
- [ ] CHK034 - Are accessibility requirements stated for the album overlay (keyboard navigation of the grid, focus return on close, readable progress text)? [NFR, Gap]

## Dependencies & Assumptions

- [ ] CHK035 - Is the assumption documented that `index.json` is the single source of truth for the progression list and that its `year`/`slug` fields are stable? [Assumption, index.json]
- [ ] CHK036 - Is the dependency on per-collection `manifest.json` shape (id, section, rarity, front, back) recorded, including which collections are actually scraped today? [Dependency, PRD §Architecture]
- [ ] CHK037 - Is it stated whether the Phase 4 portal/timeline world is a prerequisite for progression UI, or whether a menu-based collection picker is the accepted interim? [Dependency, PRD §Phase 4, DEVLOG Decisions "the island is the whole map"]

## Ambiguities & Conflicts

- [ ] CHK038 - Does "the island is the whole map / no sea landmarks" (DEVLOG) conflict with the PRD timeline-road-of-portals, and which one governs how the player changes collection? [Conflict, DEVLOG Decisions vs PRD §Phase 4]
- [ ] CHK039 - Is "score" defined as per-collection or global, and is it persisted — the current store mixes both (rarity points on collect, flat 25 on duplicates)? [Ambiguity, store.ts `score`]
