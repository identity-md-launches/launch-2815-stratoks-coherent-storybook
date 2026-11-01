# Storybook world: local validation (2026-11-01)

Base: `0f33730`, which includes the accepted fuel/wallet maintenance on top of pinned `04f473d`. Changed runtime source: `web/src/expanse/storybook.ts` (new), `worldRenderer.ts` (routes environment drawing through it), `ArtSheet.tsx` + `Router.tsx` (`#art-sheet` contact sheet) and `living.css` (sheet styles). `variants.ts` was removed because nothing uses it any more. Simulation, server, schema, checkpoints, wallet code, dependencies and lockfile are unchanged.

## Commands and results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `cd web && npx tsc --noEmit` | exit 0, no diagnostics |
| Production build | `cd web && npm run build` | exit 0, `dist/` rebuilt with base `./` |
| All frontend tests incl. Expanse | `cd web && npx tsx --test src/*.test.ts src/expanse/*.test.ts` | **63 pass, 0 fail** ([TAP](frontend-all.tap)) |
| Chains (copied fixture load/save/restart, wood-only vs ignition fuel cases), wallet deadlines, wallet controller | `node --test tests/chains.test.js tests/wallet-deadlines.test.js tests/expanse-auth-client.test.js` | **40 pass, 0 fail** ([TAP](backend-chains-wallet.tap)) |
| Design probe | `taste.mjs --out test/scratch/taste` against the final export | All 16 checks passed: render, layout (no overflow at 320/390/1440), targets, contrast, casing, tracking, eyebrows, type-sizes, type-faces, glyphs, slogans, repetition, copy-budget, chrome, motion, share |
| Browser capture + interactions | Playwright Chromium against `dist/` (scratch script, see below) | 0 page errors, 0 console errors, 0 failed requests |

The full backend suite (`node --test tests/*.test.js`, 266/266 in [maintenance](../maintenance/VALIDATION.md)) was **not re-run** in this change. No backend file changed. Multi-seed pile bounds are likewise the maintenance results.

## Captures (same fixture, same cameras)

The fixture is the isolated demo `?demo=1` (seed 2, shipped checkpoint), with camera (24, 24). Mid zoom is the default, close is three Zoom-in clicks (or until the control disables), and far is six Zoom-out clicks from close. Cold, arid and coast views come from minimap clicks at world (0, −80), (125, 0) and (−75, 110). "Before" is the previous commit's `dist/`, "after" is this build. All images are unedited Chromium screenshots, downscaled to 2/3 at 1440.

| View | Before | After |
| --- | --- | --- |
| 1440 mid | [before](before-1440-mid.jpg) | [after](after-1440-mid.jpg) |
| 1440 close | [before](before-1440-close.jpg) | [after](after-1440-close.jpg), [with tile dialog](after-1440-close-selected.jpg) |
| 1440 far | [before](before-1440-far.jpg) | [after](after-1440-far.jpg) |
| 1440 cold / arid / coast | [cold](before-1440-cold.jpg) · [arid](before-1440-arid.jpg) · [coast](before-1440-coast.jpg) | [cold](after-1440-cold.jpg) · [arid](after-1440-arid.jpg) · [coast](after-1440-coast.jpg) |
| 390 mid / close / far | [mid](before-390-mid.jpg) · [close](before-390-close.jpg) · [far](before-390-far.jpg) | [mid](after-390-mid.jpg) · [close](after-390-close.jpg) · [selected](after-390-close-selected.jpg) · [far](after-390-far.jpg) |
| 390 cold / arid / coast | [cold](before-390-cold.jpg) · [arid](before-390-arid.jpg) · [coast](before-390-coast.jpg) | [cold](after-390-cold.jpg) · [arid](after-390-arid.jpg) · [coast](after-390-coast.jpg) |
| Contact sheet (all 67 cells, keys = source-to-render map) | n/a | [contact-sheet.jpg](contact-sheet.jpg) |

The demo was running (not paused) during every capture, with autonomous residents moving between shots. Raw reports: [after-report.json](after-report.json), [before-report.json](before-report.json).

## Measurements (headless Chromium, software rendering, this machine)

Draw time is the renderer's own per-frame `drawTimes` over its last 120 frames, at mid zoom. Heap is `performance.memory.usedJSHeapSize`.

| Build | Viewport | Draw median | Draw p95 | rAF mean interval | Objects drawn | JS heap |
| --- | --- | --- | --- | --- | --- | --- |
| before | 1440 | 11.6 ms | 26.7 ms | 33.0 ms | 209 | 31.9 MB |
| after | 1440 | 6.3 ms | 24.4 ms | 49.7 ms | 206 | 25.6 MB |
| before | 390 | 2.3 ms | 11.0 ms | 18.1 ms | 94 | 30.0 MB |
| after | 390 | 7.4 ms | 37.8 ms | 23.9 ms | 91 | 27.9 MB |

Painted cells are cached after first use, so first-use painting lands in the p95. These are single runs on a shared machine without a GPU. They are not device performance claims, and the drawing loop is capped at 30 Hz either way. Simulation tick time was not separately measured in this change; simulation code is unchanged.

## Interaction results

- **Resident selection at 390:** a click on a published resident hit opened the inspector ([shot](after-390-close-selected.jpg)). At 1440 the scripted click landed on a tile and opened the tile dialog instead, because the resident had moved. Resident selection at 1440 was therefore not confirmed by this script.
- **Resource selection:** a wood-pile group was selected at both widths. At 1440 the panel text included quantities. At 390 the script's text heuristic did not find them, so exact-quantity disclosure at 390 is unverified here.
- **Camera:** zoom in/out changed the span at both widths (1440: 22 → 12.7 → 38.0, 390: 9.5 → 9.0 → 18.3), and minimap travel reached cold, arid and coast at both widths.
- **Contact sheet:** `#art-sheet` rendered 67 cells with no errors.

## Better Interface review (six domains)

- **Accessibility:** contact-sheet canvases carry `role="img"` with the cell key as `aria-label`, and the palette list is labelled. The world canvas, HUD and inspector are unchanged. Decorations are excluded from hit lists, so keyboard and pointer targets did not change.
- **Layout:** no horizontal overflow at 320, 390 or 1440. The 390 first screen shows the world, Find residents and the map controls, and the controls stay unobstructed ([shot](after-390-mid.jpg)).
- **Writing:** the sheet copy is one plain line. No marketing overlay was added.
- **Typography:** the sheet uses the existing Manrope family. Its h1 is 28 px and h2 18 px; the probe measured 2 recurring sizes on the main screen.
- **Colors:** one palette, documented in ART-DIRECTION.md. HUD charcoal/forest panels and gold accents are unchanged. The probe measured all text at ≥ 4.5:1 or above its large-text threshold; text over the canvas is not measurable.
- **UI:** decorations have no outline and are never interactive. Stores, piles, nodes and shelters keep the shared outline.

Findings fixed during the build: `web/src/expanse/storybook.ts` (paintTree) had broadleaf trunks so tall the trees read as lollipops at mid zoom, so the trunk was lowered and the crown enlarged. Old ground "token" discs under every sprite conflicted with the one-shadow rule and were replaced by `castShadow`.

## Incomplete or not done

- I did not study official Fabledom, Tiny Glade or Foundation screenshots during this run (see ART-DIRECTION.md).
- No Kenney or Quaternius asset was adopted, and no offline 3D render pipeline was built (see ASSET-SOURCES.md for the reasons).
- No running-world video was captured. The before/after captures are stills of the running demo.
- The full backend suite was not re-run, and WebKit, real devices and real wallets were not tested.
- Rain and snowfall overlays are implemented from `climate.rain`, but none of the captured views had rain, so they were not observed in a screenshot.
- Foundation and ruin states differ, but at far zoom they read similarly.
- Owner aesthetic acceptance is separate and still pending.
