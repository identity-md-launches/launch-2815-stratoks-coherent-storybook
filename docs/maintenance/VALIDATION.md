# Local validation — fuel and wallet maintenance

> Historical first-round report. The [revision report](revision/VALIDATION.md) supersedes fuel behavior and long-run bounds below; wallet test timing remains as reported here.

Base: `04f473dd3b1b6101efc37fb85418baa72605ee59`. The deliverable has no runtime logic or dependency changes. [Diagnosis, scope and README errata](README.md) distinguish this maintenance work from historical art/browser delivery.

| Check | Result | Raw evidence |
| --- | --- | --- |
| Original pinned fuel-placement test | Reproduced failure: wood-only cold resident does not receive a `place` offer | [Baseline TAP](fuel-baseline.tap) (expected failure) |
| Full backend, concurrency 2 | **266 passed, 0 failed** | [Backend TAP](backend.tap) |
| Fuel/accounting, three unattended seeds and copied-fixture restart | 12 passed, 0 failed; 3 × 3,500 ordinary ticks; accounting sampled every 250 ticks | [Chain TAP with samples](chains.tap) |
| Real HTTP wallet controller regressions | 29 passed, 0 failed | [Controller TAP](wallet-client.tap) |
| Server auth, wallet authentication and independent signature vectors | 19 passed, 0 failed | [Server wallet TAP](wallet-server.tap) |
| Isolated exact deadline boundaries and AbortSignal mock | 2 passed, 0 failed | [Deadline TAP](wallet-deadlines.tap) |
| Combined wallet regressions, concurrency 8, while full backend simulation ran | **50 passed, 0 failed** | [Concurrent wallet TAP](wallet-load.tap) |
| Frontend default package test command | 38 passed, 0 failed (does not include nested Expanse files) | [Package-test log](frontend-tests.txt) |
| All frontend tests, including nested Expanse files | 63 passed, 0 failed | [Complete frontend TAP](frontend-all.tap) |
| TypeScript | Exit 0, no diagnostics | [Typecheck](typecheck.txt) |
| Vite production build in isolated source copy | Exit 0 | [Build](build.txt) |
| Shipped checkpoint facts and integrity | 168 residents, seven crops, 73 standing shelters; byte hash matches manifest and dist | [Computed checkpoint facts](checkpoint.json) |
| Maintained documentation links | 28 relative links resolve, 0 missing | [Link check](link-check.json) |

## Commands and assumptions

Backend and wallet commands are listed in [README.md](README.md). `tests/chains-multiseed.test.js` runs seeds 3/7/19, 40 initial residents, and 14 accounting/pile samples per seed. Those finite samples support the regression bound, not a guarantee for all worlds or indefinite time. The separate seed-7 test also verifies emergence of materials, food/cooking and exploration chains and bounded decision evidence.

`tests/chains.test.js` loads the copied schema-5 synthetic fixture, checks identity/learned data, backs up and reloads it, asserts full state equality at disk restart, and asserts identical continuation after serializing/restarting mid-run. The existing auth test copies the schema-4 fixture and checks migration, signed-profile retention and restart without replacing resident identity. Neither test reads a production world. Tests use temporary directories and delete their copies.

Frontend source and its existing package manifest, lockfile, configuration and public files were copied to `test/scratch/frontend/web/`; `server/src`, `server/package.json` and `shared/` were copied alongside it. No original frontend or root export file was written. The existing locked dependencies were installed in that scratch copy with:

```sh
npm ci --prefix test/scratch/frontend/web --cache /tmp/stratoks-maintenance-cache --no-audit --no-fund
npm --prefix test/scratch/frontend/web test
npm --prefix test/scratch/frontend/web run typecheck
npm --prefix test/scratch/frontend/web run build
test/scratch/frontend/web/node_modules/.bin/tsx --test test/scratch/frontend/web/src/*.test.ts test/scratch/frontend/web/src/expanse/*.test.ts
```

There are no new dependencies in this component. Scratch installation is for checking the existing frontend, not a dependency of the delivered backend/tests. The first attempt using `web/scripts/task.mjs test` failed because its shared npm cache was not writable. The isolated cache resolved that check failure. No cache permissions or machine configuration were changed.

## Failures and limitations

The pinned fuel failure is retained as baseline evidence and resolved by testing the actual ignition prerequisite rather than weakening the implementation. The isolated inherited wallet test passed; its previous contention failure was historical evidence, not reproduced as an auth bug here. During development a global timer mock around live HTTP caused socket-parser asynchronous errors and leaked expiry handles. Those intermediate attempts were repaired and stopped; only the final post-repair results are claimed above. Timer mocks now run separately from live HTTP; the Retry-After integration test mocks only Date.

The root README remains outside the assigned file scope. Its exact count/replay/link corrections are delivered in [the integration errata](README.md), and the writable integration/chain documents link to them. A maintainer with root README ownership must apply those edits. The historical shipped preview is preserved, not regenerated to pretend it was produced by current engine continuation. The frontend checkpoint replay test verifies byte integrity and deterministic current-engine continuation as distinct claims.

The final complete backend run exited 0 with 266/266 passing; the separate concurrent wallet command exited 0 with 50/50 passing. No final check failed. `git diff --check` passed. The [scope check](scope-check.json) found no out-of-scope changes and confirms production auth, shared wallet code, frontend source and static preview are unchanged.

No new browser screenshots, running-world captures, visual cohesion/aesthetic certification, production performance, paid actions, owner deployment, physical-wallet tests or ARM checks are claimed. Production authentication code and world state are unchanged; this is a local test/review report, not an independent audit.
