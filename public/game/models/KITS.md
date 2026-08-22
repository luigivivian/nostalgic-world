# Model kits

Third-party 3D asset kits bundled under `public/game/models/`. Each kit keeps its own
`License.txt` inside its folder. Installed copies are trimmed to the GLB/GLTF models plus
their `Textures/` atlas — OBJ, FBX and preview folders are stripped to keep the repo small.

## Kenney (Creative Commons Zero, CC0 1.0)

Free for personal, educational and commercial use. Credit is not required but appreciated:
assets by **Kenney** — https://kenney.nl

| Kit folder | Kit | Source | Licence | Installed |
|---|---|---|---|---|
| `kenney_graveyard-kit` | Graveyard Kit 5.0 | https://kenney.nl/assets/graveyard-kit | CC0 | 2026-08-22 |
| `kenney_holiday-kit` | Holiday Kit 2.0 | https://kenney.nl/assets/holiday-kit | CC0 | 2026-08-22 |
| `kenney_survival-kit` | Survival Kit 2.0 | https://kenney.nl/assets/survival-kit | CC0 | 2026-08-22 |
| `kenney_pirate-kit` | Pirate Kit 2.1 | https://kenney.nl/assets/pirate-kit | CC0 | 2026-08-22 |
| `kenney_nature-kit` | Nature Kit | https://kenney.nl/assets/nature-kit | CC0 | earlier |
| `kenney_hexagon-kit` | Hexagon Kit | https://kenney.nl/assets/hexagon-kit | CC0 | earlier |

The four kits installed 2026-08-22 cover the desert / snow / swamp / mountain / ruins
biomes. Models live at `<kit>/Models/GLB format/*.glb` (reference them URL-encoded as
`Models/GLB%20format/`), each referencing the shared external atlas
`Models/GLB format/Textures/colormap.png`. Source zips are kept in `assets-src/kits/`.
Per-file biome breakdown: `.tmp/biome-kits-inventory.md`.
