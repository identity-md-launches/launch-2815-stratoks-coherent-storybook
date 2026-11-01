# Fuel, wallet timing and evidence maintenance

> Historical first-round report. The [revision report](revision/VALIDATION.md) supersedes fuel behavior and long-run bounds below; wallet test timing remains as reported here.

This component continues `04f473dd3b1b6101efc37fb85418baa72605ee59`. It changes tests, engine comments and documentation only. Production simulation and authentication logic, schema, dependencies, saved worlds, preview bytes and deployment settings are unchanged. No new gameplay or deployment is included.

## Fuel diagnosis

The [inherited test reproduction](fuel-baseline.tap) failed with “fuel goes onto the existing pile, not a new tile.” It staged `{wood: 1}`, made the resident cold, and expected placement on a nearby pile. The pinned implementation already requires **stone** to offer this away from an on-tile pile. Flint alone does not suffice; flint plus stone improves the existing ignition attempt. Changing the engine to satisfy the old assertion would reintroduce unfinishable fuel preparation.

The corrected test retains a wood-only case that forbids scattering even when cold. Separate stone and flint-plus-stone cases execute the offered placement, assert the existing pile's exact contents, unchanged aggregate holdings, unchanged pile count and exact ledger. A flint-only negative case and the existing on-tile consolidation exception are explicit. [The chain contract](../../server/docs/CHAINS.md) and engine comments now describe these actual rules, including held cookable food as a placement prerequisite distinct from the hunger-sensitive fire-demand score. No ignition probability or planner behavior changed.

## Wallet timing

Real HTTP/crypto tests use the production 10-second network budget instead of 500 ms. Short 40/50/60/80 ms timeouts apply only to intentionally stalled fetch/provider operations; entry barriers ensure the intended operation was reached. The signature deadline is independently short while nonce/verify/logout requests retain their network budget. Late results, scope checks, real EIP-191 verification, rejected/changed wallets, quota/proxy controls and server-side revocation assertions remain.

Retry-After advances only the virtual **date**, then explicitly awaits the deduplicated refresh. The stale-refresh race has a cleared, rejecting 10-second failure watchdog instead of a 500-ms sleep. The HTTP expiry check waits for its actual `expired` event with a 60-second test session rather than assuming an 80-ms session can survive signing/network load and a 100-ms sleep will observe expiry. Standalone [virtual-clock deadline tests](../../tests/wallet-deadlines.test.js) check the exact pre-deadline/boundary transition, late provider result, AbortSignal cancellation, counter cleanup and retry without mocking global timers around live sockets.

The initial isolated inherited wallet run passed 29/29: this task does not claim a reliably reproduced production auth defect. During development, global fake timers around real HTTP produced a post-test socket-parser exception and leaked timers; that approach was removed. Intermediate runs were stopped and superseded by the final logs below. Authentication code was not relaxed to get green tests. Test signers are disposable, generated in-process; the fetch mock in the deadline unit check implements only cancellation, not authentication.

## README corrections for integration

The root `README.md` is outside this component's writable paths. These corrections supersede its stale statements and identify the exact edits for the integrating owner:

| Location | Correction and retained evidence |
| --- | --- |
| Opening paragraph, missing `.imd-responses.json` link | The file is transient and absent. Link to the retained [world-revision finding table](../../artifacts/world-revision/VALIDATION.md), not a deleted workflow response file. |
| Isolated-demo paragraph: 166 residents, five crops | The shipped checkpoint has **168 residents, seven crops, 73 standing shelters** (94 shelter records including sites), schema 5, tick 12,600. See the [shipped manifest](../../web/public/demo/agency-manifest.json). |
| Claim that the demo test reproduces the shipped checkpoint hash from original + 600 ticks | The current test pins original bytes and shipped manifest/dist hashes, verifies identity-preserving migration, deterministic 600-tick replay with the current engine and exact accounting. It does **not** assert that current replay reproduces the historical shipped demo hash. Engine resource fixes changed continuation behavior; preview regeneration belongs to integration. |
| Historical counts 206/247/256-of-258 presented alongside “current” | Those are historical runs. Use this component's final results below for backend maintenance; historical browser results have not been repeated here. |

The shipped checkpoint SHA-256 is `dfd1876c94afe40505583ed4f6094891bd8f5195439238e039bc44892ef907ab`; the original rollback checkpoint remains pinned by the replay test to `cf2dcd95a83ffa1cc50975b40f9c6cb5829637ae0b3b9ff3f07846be12a5d716`. Both were read, never replaced; [computed checkpoint facts](checkpoint.json) also verify the shipped preview bytes. Existing screenshot and recording evidence remains historical and is not evidence of a new visual delivery.

## Reproduce and inspect results

From the repository root:

```sh
node --test --test-concurrency=2 tests/*.test.js
node --test tests/expanse-auth-client.test.js tests/expanse-auth.test.js tests/wallet-auth.test.js tests/wallet-crosscheck.test.js tests/wallet-deadlines.test.js
node --test tests/chains.test.js tests/chains-multiseed.test.js
```

The chain suite uses the copied synthetic schema-5 fixture (324 residents), checks learned state/identity on load, backs up and reloads from temporary directories, compares full serialized state at disk restart and compares exact continuation after restarting mid-run. The existing auth suite separately copies a populated schema-4 fixture, verifies identity-preserving migration, verifies a real signed profile and restarts with that profile retained. No real owner world is used.

[Multi-seed and chain raw results](chains.tap) contain per-seed samples. Seeds 3, 7 and 19 each run 3,500 ordinary unattended ticks, initial population 40, without staged jobs, inventory or moves. Every 250 ticks each item's holdings equal `expectedHoldings(totals)`; pile quantities are positive integers and the existing 80-pile regression bound holds at every sample. Observed peak piles: **25, 37, 44**, respectively. This finite regression bound is not a proof of asymptotic growth or every seed.

Final check results are recorded in [VALIDATION.md](VALIDATION.md). Logs are observations from local checks, not independent certification. No new screenshot, running-world capture, aesthetic review, performance claim, production deployment or paid gameplay belongs to this bounded backend assignment.
