# STRATOKS art direction: one storybook world

**Primary reference:** Fabledom (storybook buildings, readable silhouettes, coherent materials, lived-in village). **Secondary:** Tiny Glade (roof/wall/garden detail), Foundation (settlement fitted to terrain). They are references for qualities only. No game assets were copied and no 3D engine was recreated. **Limitation:** I did not fetch or study official screenshots during this run. The direction draws on these games' widely published look, and owner review against their official screenshots is still outstanding.

## The single system (implemented in `web/src/expanse/storybook.ts`)

| Axis | Decision |
| --- | --- |
| Projection | 2:1 isometric, the renderer's existing one. World x maps to screen (1, ½) and world y to (−1, ½). Cells are 320×320 with the foot anchor at (160, 280), the same contract as the character atlas. |
| Scale | Shelters are drawn 4.6 half-tiles wide, trees 4.4 (±10% by stable id), shrubs 1.8–2.7, rocks 2.6, stores 1.85–2.3, hearths 2.4, gardens 2.3. Stratoks remain 2.65 half-tiles tall. |
| Light | One light from the upper left. Left (south-west) wall faces use the light tone, right faces the dark tone, and roofs and foliage carry a highlight at the upper left. Nothing is mirrored, so the light never flips. |
| Shadow | `castShadow`: a single soft ellipse, `rgba(42,52,34,.30)`, offset to the lower right. Residents, trees, buildings, stores, hearths and piles all use it. The old ground "token" discs were removed. |
| Outline | Dark umber `#3a2a1e`, 2.4 px at cell scale, matching the painted Stratok edge. Ground dressing has no outline, so it never reads as an interactive object. |
| Palette | Material ramps (dark/mid/light): timber, plaster, thatch, clay tile, slate, stone, adobe, turf, leaf, needle, olive, frost, snow, berry, flame. They are listed in `PALETTE` and shown as swatches on `#art-sheet`. |
| Material language | Thick thatch with rounded eaves, half-timbered plaster, coursed stone, adobe, turf and clay tile. Foliage is built from clumped, outlined blob crowns, and conifers from scalloped tiers. |

## What is bound to what (no invented functions)

| Appearance | Source data | Variants |
| --- | --- | --- |
| Shelter | `view.shelters` (id, tile, integrity) | Two shape+material variants per biome, chosen by stable shelter id. Forest: half-timbered thatch cottage / wattle roundhouse with thatch cone. Desert: adobe block with reed awning / mud-brick dome. Cold: stone cottage with snowy slate roof / timber longhouse with turf roof. Coast: stilted plank hut with reed roof / whitewashed cottage with clay tiles. |
| Construction & damage | `view.sites` stage → foundation / frame; integrity < 40 → damaged (roof holes, no chimney smoke); integrity ≤ 0 or `view.ruins` → ruin | One per state and biome |
| Storage zone | `view.stores` (a shelter's real store; not a new building) | Covered timber rack when wood dominates, baskets/crates otherwise. Fill level follows the size class, and a ruined store is drawn toppled. |
| Work area | `view.fires` (+ `fireState.fuel` for flame height); `view.crops` (garden plot) | Hearth: stone ring / clay pit with log seats, by fire id. Garden: furrowed bed with wattle edge / mounded bed with stone edge, by crop id. A dry crop gets paler soil. |
| Trees | `tree` nodes with units > 0 | Forest: 60% broadleaf / 40% conifer. Cold: snowy conifer / bare snowy tree. Desert: palm / acacia. Coast: pine / windswept broadleaf. Each form has 3 seeded crowns. |
| Shrubs | `bush` (berries vs picked by units), `cactus`, `scrub`, `lichen` | Biome-specific: berry, frost, cactus, reeds, scrub |
| Rocks / logs | `stone`, `flint` (adds dark chips), `deadfall`, `driftwood` (bleached) | 2 per kind |
| Ground dressing | Real tile kind and real water adjacency only | Shore foam and pebbles, grass tufts, flowers, pebbles on sand/rock, snow drifts. At most one per tile, on about 1 tile in 9, never on an occupied tile, and never interactive. |
| Weather | `view.climate.rain`, `temperature` and biome | Rain streaks, or snowfall when cold. Snow on roofs and trees follows the cold biome only. |
| Characters | Existing atlas (unchanged species, poses bound to real state/inventory) | Only the shadow was changed to the shared rule |

Fallbacks: an unknown biome uses the forest palette (`regionOf`), and an unknown node kind draws nothing rather than a wrong prop. The legacy atlas tree is kept only as a last resort for a tree whose key cannot be produced. Every cell is generated in code, so no image file can go missing.
