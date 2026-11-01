# Review follow-up on the actual revision checkout

This follow-up starts from `a45bf2cc06e613b0dd01331c04bf74779aea93ad`, the accepted backend component following `0f33730`. No simulation, authentication, wallet timing, schema, checkpoint, frontend or deployment implementation is changed. The two findings are answered in the root `.imd-responses.json`. Neither outstanding requirement is claimed fixed.

## Final storybook evidence: combined tree unavailable

The reviewer explicitly distinguishes the combined tree from this contributor's incoming component. The same distinction still applies to the actual revision checkout, including its **HEAD**, not just `0f33730`: `git ls-tree -r --name-only HEAD docs/storybook` returns no entries. `docs/storybook/VALIDATION.md` and the referenced JPEGs are absent. `git cat-file -t 5abcbdd` fails because the cited final foliage commit is unavailable here. The [new scope enumeration](evidence-scope.json) records these observations.

The preview script and historical static demo do exist. Serving those can capture that historical export; it cannot establish evidence for the separate final foliage revision. No current storybook capture, original-size before/after comparison, cold/desert view or running-world recording is supplied by this follow-up. The combined-delivery finding remains valid for integration; its requested final export is not in this checkout. The prior component's absence statement must not be read as an enumeration of the reviewer's combined tree.

## Long-run piles: observation confirmed, behavior retained

The exact review recipe reproduces: create seed 7 with 40 residents, run 1,000 ordinary ticks eight times and enumerate chunk piles. The ninth interval was also sampled. [Raw observations](seed7.jsonl) show 82 piles at tick 7,000, 99 at tick 8,000 and 113 at tick 9,000. All item ledgers are exact at every recorded interval. Single-unit piles reach 61 at tick 8,000. Nothing was inserted, moved, capped or deleted.

The current multi-seed test asserts `<80` only through tick 3,500 and exact accounting through tick 9,000. Passing it does **not** resolve fuel scattering. No finite observation proves mathematical unboundedness, but these measurements suffice to refute an 80-pile bound over the full observed horizon. Population growth does not excuse the unmet requirement.

The advisory proposes a new retry behavior, a stricter placement policy or a growth model. No such policy is selected by the bounded backend revision, which explicitly requires preserving the accepted implementation and no new gameplay. This follow-up retains the earlier explicit unresolved status rather than changing planner behavior to fit sampled seeds, silently imposing a stock cap, or relabeling a diagnostic as a successful bound. The disputed verdict disputes implementing a new policy in this maintenance follow-up; it does **not** dispute the reproduced scattering or claim completion. Bounded long-run pile growth remains incomplete.

## Reproduction and checks

Run from the repository root, with Node 24.21.0 used here:

```sh
node --test --test-concurrency=2 tests/*.test.js
node --test --test-concurrency=8 tests/wallet-*.test.js tests/expanse-auth*.test.js
```

The commands were run concurrently to exercise wallet timing under simulation load. The full suite includes all three unattended 9,000-tick seeds, separate wood-only/ignition placement tests, reusable-striker prediction/execution regressions, and copied-fixture load/save/backup/restart/continuation checks. The only mocks are those already documented in the accepted tests; no new mock or runtime dependency is introduced. Frontend build and browser captures are not rerun for this evidence-only follow-up; prior results remain historical.

| Check | Result | Raw evidence |
| --- | --- | --- |
| Full backend, concurrency 2 | 268 passed; 0 failed/cancelled/skipped; exit 0 | [Backend log](backend.tap) |
| Wallet/auth, concurrency 8 during backend run | 50 passed; 0 failed/cancelled/skipped; exit 0 | [Wallet log](wallet-load.tap) |
| Three unattended seeds, 9,000 ticks each | All 108 sampled ledgers exact; piles at tick 9,000: 66 / 113 / 71 for seeds 3 / 7 / 19 | [Backend log](backend.tap) |
| Independent seed-7 repetition, 1,000-tick intervals | All nine sampled ledgers exact; crosses 80 piles by tick 7,000 | [Measurements](seed7.jsonl) |
| Response JSON and documentation links | Two valid verdict records; both maintained validation pages' local links resolve | Local Node assertions, exit 0 |
| Whitespace | `git diff --check` passes | Exit 0 |

No executed check failed. Counts overlap and are not additive. The test results do not certify the two incomplete requirements described above. Original accepted source and shipped checkpoint bytes are unchanged.

To reproduce the separate seed-7 observation:

```js
import assert from 'node:assert/strict';
import { Expanse, expectedHoldings } from './server/src/expanse/engine.js';
const e = Expanse.create({ initialCount: 40 }, { seed: 7 });
for (let tick = 1000; tick <= 9000; tick += 1000) {
  e.run(1000);
  const actual = e.holdings(), expected = expectedHoldings(e.totals);
  for (const item of new Set([...Object.keys(actual), ...Object.keys(expected)]))
    assert.equal(actual[item] ?? 0, expected[item] ?? 0, item);
  let piles = 0, single = 0, units = 0;
  for (const chunk of e.chunks.values()) for (const pile of chunk.piles) {
    piles++;
    const n = Object.values(pile.items).reduce((a, b) => a + b, 0);
    units += n;
    if (n === 1) single++;
  }
  console.log({ tick: e.tick, piles, single, units, residents: e.creatures.length });
}
```

This is a diagnostic recipe, not a passing assertion of bounded pile growth.
