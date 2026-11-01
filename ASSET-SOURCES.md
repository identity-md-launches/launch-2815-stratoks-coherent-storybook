# Asset sources and licenses

## Shipped in this change

| Asset | Source | Creator | Version / hash | License | Modifications |
| --- | --- | --- | --- | --- | --- |
| Environment cells (67 keys: shelters ×8 + 16 states, storage ×6, hearths ×4, gardens ×4, trees ×16, shrubs ×6, rocks/logs ×7) | `web/src/expanse/storybook.ts`, painted at runtime into cached 320×320 canvases | Original work for this repository | Deterministic from source: same key, same pixels. Seeds come from stable ids. | Same as the repository's client code (see `web/public/licenses/client-and-art.txt`) | n/a (original) |
| Stratok character atlas | `web/public/art/living-characters.webp` (pre-existing) | Prior contributors, see `web/public/licenses/living-art.txt` | unchanged | unchanged | none |

Editable source: the painter functions themselves, plus the `PALETTE` table. To reproduce the contact sheet, build and open `dist/index.html#art-sheet` over HTTP. Each label there is the cell key, which is the source-to-render mapping (`family:region:variant:state`).

## Evaluated, not adopted

| Source | License verified (2026-11-01) | Why not used |
| --- | --- | --- |
| Kenney, https://kenney.nl/assets | https://kenney.nl/support: "all game assets on the asset pages are public domain licensed (CC0)" | Kenney's isometric packs are flat-shaded and unoutlined, which would clash with the outlined, painted Stratoks again. Rendering its 3D packs would also need an offline 3D renderer, which this run did not set up. |
| Quaternius, https://quaternius.com/ | https://quaternius.com/faq.html: "All models are under the CC0 License." | Low-poly 3D models. A consistent sprite render would need an offline Blender pipeline, which was not available in this run. Mixing a few renders with painted characters would recreate the clash the brief asks to remove. |
| OpenGameArt | Not checked per pack in this run | No pack was selected, so there are no per-pack terms to record |

No assets were purchased, downloaded into the repository, or ripped from a game. Under the brief's "If no pack fits, make consistent original assets" clause, all new art is original.
