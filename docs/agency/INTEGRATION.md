# Updated-engine observer integration

The production export now bundles schema 5. The default is an **isolated browser worker**, using the actual Expanse engine, with no network API, payments or inference. It resumes a copy of the previous demo: migrate the original schema-4 tick-12000 state, then run 600 ordinary ticks. Residents, learned weights, memories, relationships and terrain are preserved at migration. Births/deaths during the following ticks are ordinary engine outcomes. No scene scheduler, jobs, supplies or forced actions are added.

The original `web/public/demo/checkpoint.json.gz` remains byte-identical, including in `dist/demo/`. `agency-checkpoint.json.gz` is the updated copy. `agency-manifest.json` records both hashes and the migration. The shipped manifest records 168 residents, seven crops and 73 standing shelters at tick 12,600. `tools/living/upgrade-demo.mjs` is the upgrade recipe, but current resource-chain logic changes continuation: running it again need not reproduce the historical shipped hash. `tests/agency-demo.test.js` verifies deterministic current replay and exact accounting separately from shipped-byte integrity. See [maintenance corrections and current checks](../maintenance/README.md). The owner capture in `recording.json` remains explicitly frozen, and owner live mode reports only fields actually supplied. Goals/signals controls disappear on older inspectors that lack those fields.

## Terrain contract

`shared/relief.js` defines **display relief derived from authoritative tile kinds**: water 0, ordinary soil 0.18, snow 0.26, dunes 0.32, rock 0.42, blocked cliffs 1.35 half-tile units. These are visual units, not measured elevations in metres or a new movement mechanic. The observer API sends this same derived `heights` array; older frames derive it from their own tile IDs. No saved terrain bytes change.

`surface.ts` owns top/face polygons, the elevation projection and reverse picking. Only exposed east/south height differences form visible faces; equal adjacent heights join without internal faces. Unknown neighbours at viewport edges do not invent drops. The camera can center every valid edge tile, allowing off-world background around corners. Queries include a four-tile halo, remain within world bounds and are capped at 96×96. Negative coordinates use floor, not truncation.

Cliffs are redrawn in the entity painter queue, sorted by original ground depth; they can occlude residents. Picking checks foreground cliff occlusion and chooses the frontmost resident hit. Shelter, crop, pile, fire and resident foot anchors use the same surface projection. No painted bank creates a bridge, resource node or passable cliff. Engine passability is unchanged.

The terrain renderer keeps one DPR≤2 viewport raster and at most 384 68×128 surface tiles (about 12.75 MiB RGBA), plus the viewport surface. The key includes tile kind, biome, elevation, exposed neighbours and one of eight texture variants. This replaces the old 96 large chunk cache. A settled viewport is reused across ticks. Camera/frame rasterization can still spike; see measured render timings.

## Art extraction

Original supplied hashes:

- `terrain.png`: `5fdf1a718a8fe23bdf0d87bad43f19b619f13558d62b750482dc61f4adbdba51`
- `activities.png`: `d61b5eafc0402a39fd7c67e4f2fb83578c272972c9db0614305321cf017a6c24`

The PNGs are task inputs. The complete runtime derivatives are committed under `web/public/art/` and copied to `dist/art/`; rebuilding needs no removed input. `tools/agency/convert-runtime.mjs` documents extraction if the original inputs are available. Pixel selection and WebP encoding use Chromium Canvas; pixels are not repainted. The runtime keeps only the used rectangles, saving about 1.7 MB across source/export versus two complete unused sheets.

The supplied activity grid cuts the first actor at y=209. Its actual alpha>64 bounds are x=37–205, y=77–255. The corrected crop is `[0,30,209,250]`, with local foot anchor `[110,222]`. This preserves the full golden body and paired leaf crown. The high-magnification source matte fringe remains a low-level art limitation.

Four 40×64 rock-paint samples are extracted at `[96,112]`, `[96,368]`, `[96,624]`, `[608,880]` into a 160×64 texture strip. These cover forest slate, desert sandstone, snowy slate and coastal bank. They are clipped to actual mesh faces; the input's illustrated water, vegetation, broken gutters and disconnected terrain fragments cannot add terrain or objects.

## Truthful activity mapping

| Engine evidence | Presentation |
| --- | --- |
| `repair` state **and `repair` phase**, held axe/club, held wood/stone/fiber/stick | Existing work-tool poses; the incorrect `work` check is gone |
| `construct` phase, material-bearing site, held work tool | Existing work poses; empty site remains a ground marker |
| `plant` phase, actual seed material held | Full single kneeling actor + hand gesture |
| `tend` phase, actual nearby growing crop, fresh water reachable | Kneeling actor + hand gesture; no invented vessel |
| `harvest` phase, actual nearby ripe crop | Kneeling actor; actual crop species/stage remains visible until engine transfer |
| `cook` phase, held heatable food, nearby actual fire with ≥1.5 fuel | Held-food gesture over real heat; no invented kettle, spoon or cooked result |
| `helping` resident ID from actual step | Small link mark and target ID in inspector; no extra painted actor |
| Actual signal emission ≤12 ticks old | Neutral glyph; no translation; at most twelve visual glyphs |
| Travel/respond state or confirmed consecutive adjacent movement | Walking/carrying, never a farming/repair pose at a distant destination |

All these actions keep textual state/phase/progress evidence when motion is reduced. Scene motion is presentation time, never a change to engine ticks. The supplemental wheat, cooked-berry stew, water vessel, paired carry and paired repair illustrations are unused because their props/participants are not supported by these engine states. Existing fishing, tool wear, construction, rest, family, ageing, death and exploration remain in the same engine.

## Evidence and limitations

`AgencyEvidence.tsx` shows up to four persistent goals, interruptions/resumptions, avoided strategies, goal history and learned progress. Plans retain substeps, predictions and outcomes. Signals show local perceived/sent records, confidence, co-occurrence, mean delayed payoff, recent response movement outcomes, sender credit and individual trust. These are measured retained records, with explicit empty states and retention limits. Personality and relationships are individual evidence, not fictional thoughts.

Observer tile stores expose actual quantities with an observer label. Resident store knowledge comes exclusively from `knownStores`: last visit, stale age, or unverified inherited memory. Ruins render foundations and are explicitly unusable; their preserved contents are labeled separately.

Cooking and provisioning-help remain mechanically tested but were not observed in the new 14-run natural ablation. Signals showed no demonstrated causal benefit. This integration does not claim human intelligence, consciousness, universal action emergence, Safari compatibility, ARM capacity or structural acceptance. See the resolution table and six-domain review in `artifacts/agency-interface/VALIDATION.md`.
