# Revision: striker predictions and long-run evidence

Incoming accepted component: `0f33730ba577d1502e746aa2ace611324549bf85`, based on pinned `04f473dd3b1b6101efc37fb85418baa72605ee59`. This revision changes the declared inventory effect of pile use, simplifies an equivalent ignition gate, extends accounting observations and corrects documentation claims. Placement, spark probabilities, costs, failure/replan handling and gameplay primitives remain as accepted. Authentication, schemas, saves, terrain, preview and frontend source are untouched.

## Reproduced mismatch — fixed

The stone pile-use offer declares consumption, but actual execution retains the stone ([direct reproduction](striker-before.json)). Flint has the same mismatch. `agent.js` subtracts declared consumption during prediction, so the original declaration incorrectly removes reusable strikers from predicted inventory.

Pile-use offers now declare `consumes: []`, matching execution, including non-striker pile uses that fail without consuming anything. No striker is destroyed to make the declaration true. The redundant `canIgnite` expression reduces to `!!inv.stone`; flint still affects spark probability only when held with stone.

Two new tests use the real planner and engine. They check three predicted same-striker attempts on an existing pile, then two forced misses and one success in separate actual plans. Each step retains the striker, each miss leaves fuel intact, success burns exactly one staged stick, and each resource ledger remains exact. The only new mock controls the spark RNG with values in its `[0,1)` interface. It is explicitly labeled; autonomous runs use the real RNG. These tests do **not** claim that a failed plan automatically retries: normal failure/replan handling remains unchanged.

Both tests [fail against the incoming engine](regressions-before.tap) and [pass against the final engine](regressions-after.tap). Separate accepted wood-only, flint-only, stone and stone-plus-flint transfer cases are retained without changing their staged pile contents or assertions.

## Longer pile growth — reproduced, unresolved

The review's observations reproduce on the incoming engine:

| Seed | Tick | Piles | Units | Residents |
| --- | ---: | ---: | ---: | ---: |
| 19 | 6,000 | 86 | 164 | 91 |
| 19 | 9,000 | 134 | 304 | 151 |
| 7 | 8,000 | 94 | 201 | 108 |
| 7 | 9,000 | 117 | 284 | 115 |

All sampled ledgers were exact. [Raw seed-7 baseline measurements](baseline-seed7.jsonl) also distinguish surviving piles originally created by placement from those created by drops. At tick 9,000 they contain 91 placement-origin and 26 drop-origin piles. Origin describes pile creation, not necessarily the provenance of every later unit in it.

The first-round report explicitly limited the `<80` regression to 3,500 ticks and disclaimed an indefinite guarantee. The finding's **observation** is correct; treating 80 as a permanent global cap is disputed. Population and explored area grow; the accepted implementation has no global pile cap. Enforcing one, deleting stocks, adding automatic cleanup or imposing a new resident policy would extend gameplay. This revision does not claim that longer-run growth has been solved.

The final multi-seed test retains **every original `<80` assertion through tick 3,500** and extends exact per-item accounting and positive whole-stock checks through **tick 9,000**, sampled every 250 ticks for seeds 3/7/19, starting with 40 autonomous residents. Every sample reports pile counts, units and population. There is deliberately no new assertion that a growing world must stay below 80 after tick 3,500. A green result means the documented finite bound and accounting checks pass; it does **not** mean scattering or indefinite growth is resolved.

Exploratory local candidates added nearby retry targeting, fuel-first gates, strike-energy gates or continuation of already-planned spark retries. All still exceeded the proposed long-run cap on at least one seed; one also exposed an exact-tile arrival bug in its new targeting path. They were removed in full. They are not part of this deliverable, and their tests/results are not claimed as final validation. The small accepted simulation policy is preserved rather than selecting a new policy to fit three seeds.

## Screenshot finding — disputed component mismatch

The referenced `docs/storybook/VALIDATION.md`, desktop JPGs and storybook evidence directory do not exist in this incoming branch ([enumeration](evidence-scope.json)). The historical `artifacts/agency-interface/phone-tour.webm` exists and remains historical; it is not presented as a current storybook capture. This contributor's accepted assignment is fuel, wallet timing and evidence maintenance, with frontend/static-preview changes outside its file ownership.

No current screenshot or recording was produced by this backend revision. Current full-size screenshots, animated storybook captures, visual integration and owner aesthetic acceptance remain incomplete in the broader brief. The claim about resizing specific JPGs cannot be reproduced against files absent from this component.

## Reproduce

```sh
node --test --test-concurrency=2 tests/*.test.js
node --test --test-concurrency=8 tests/wallet-*.test.js tests/expanse-auth*.test.js
node --test tests/chains.test.js
node --test tests/chains-multiseed.test.js
node --test --test-name-pattern='pile strikes' tests/chains.test.js
```

For original-engine comparison, copy `server/`, `shared/`, `tests/chains.test.js` and `tests/fixtures/expanse-v5-300/` into matching paths under `test/scratch/`. Replace only the copy's engine using `git show 0f33730:server/src/expanse/engine.js` and run the focused command there. The two new tests fail on predicted repeat availability. The direct reproduction stages `{wood:1,stone:1}`, warmth 50 and one stick on the current tile; select the `stone@pile` offer, execute it using `startStep`/`stepAct`, then compare `consumes` and actual inventory.

For growth measurements, use `Expanse.create({initialCount:40},{seed})`, run ordinary ticks and enumerate all chunks' pile items. Compare `holdings()` with `expectedHoldings(totals)` across the union of item keys. The final multi-seed test performs this comparison every 250 ticks. No jobs, inventory, moves or production worlds are injected into these runs.

Existing copied-fixture tests check identity, brain weights, memories and stocks on load; back up/reload on disk; compare full restarted state; and compare deterministic continuation after a mid-run serialization. Auth/migration checks retain signed profiles and recovery. No production authentication code or wallet timing test is changed by this revision.

Frontend source, manifest, lockfile and public files are copied into `test/scratch/revision/frontend/web/`, with final `server/src`, `server/package.json` and `shared/` alongside. Locked dependencies are installed only in scratch using an isolated `/tmp` npm cache. No new runtime dependency is introduced.

```sh
npm ci --prefix test/scratch/revision/frontend/web --cache /tmp/stratoks-revision-npm --no-audit --no-fund
npm --prefix test/scratch/revision/frontend/web run typecheck
npm --prefix test/scratch/revision/frontend/web run build
test/scratch/revision/frontend/web/node_modules/.bin/tsx --test test/scratch/revision/frontend/web/src/*.test.ts test/scratch/revision/frontend/web/src/expanse/*.test.ts
```

## Final local checks

| Check | Result | Raw evidence |
| --- | --- | --- |
| Full backend, concurrency 2 | **268 passed, 0 failed** | [Backend](backend-final.tap) |
| Chains, accounting and copied-fixture persistence subset | 11 passed, 0 failed | [Chains](chains-final.tap) |
| Three autonomous seeds, 9,000 ticks each | All 108 sampled ledgers exact; original finite pile bounds pass | [Samples extracted from backend log](growth-samples.json) |
| Wallet/auth regressions, concurrency 8 during full backend run | **50 passed, 0 failed** | [Wallet under load](wallet-load.tap) |
| All frontend tests, including nested Expanse tests | 63 passed, 0 failed | [Frontend](frontend.tap) |
| Typecheck | Exit 0, no diagnostics | [TypeScript](typecheck.txt) |
| Production build in scratch | Exit 0 | [Build](build.txt) |
| Final focused striker regressions | 2 passed, 0 failed | [Final](regressions-after.tap) |
| Same new tests against incoming engine | 2 failed as expected | [Baseline](regressions-before.tap) |

Final engine measurements (40 initial residents per seed):

| Seed | Peak piles through 3,500 | Piles at 9,000 | Units at 9,000 | Residents at 9,000 |
| --- | ---: | ---: | ---: | ---: |
| 3 | 31 | 66 | 157 | 130 |
| 7 | 39 | **113** | 248 | 115 |
| 19 | 37 | 71 | 169 | 129 |

Seed 7 first reaches/exceeds 80 in the sampled final run at tick 7,000 (82 piles). The other two seeds remain below 80 through tick 9,000. These observations demonstrate the remaining growth limitation; they are not presented as a solution to the advisory's desired permanent cap. Different predicted inventories change autonomous choices, so later populations and stocks can differ without any reset.

Subset checks overlap the backend suite; counts are not additive. No final check failed. Original-engine failures and failed exploratory long-cap checks are distinguished above. `git diff --check` passes; the [scope/link check](scope-check.json) records allowed changed paths and resolves the maintained documentation links. Root `.imd-responses.json` supplies the four review verdicts, including both disputes. Logs are local observations, not independent certification. Broader long-run growth and visual evidence remain incomplete as described above.
