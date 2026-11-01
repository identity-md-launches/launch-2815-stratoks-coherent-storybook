// Unattended, ordinary planner ticks: no staged jobs, supplies or resident moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expanse, expectedHoldings } from '../server/src/expanse/engine.js';

for (const seed of [3, 7, 19]) {
  test(`resource accounting through 9000 ticks and original 3500-tick pile bound, seed ${seed}`, (t) => {
    const e = Expanse.create({ initialCount: 40 }, { seed });
    let peakPiles = 0;
    const samples = [];
    for (let tick = 250; tick <= 9000; tick += 250) {
      e.run(250);
      const actual = e.holdings(), expected = expectedHoldings(e.totals);
      for (const item of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
        assert.equal(actual[item] ?? 0, expected[item] ?? 0, `${item} at tick ${tick}`);
        assert.ok((actual[item] ?? 0) >= 0, `nonnegative ${item}`);
      }
      let piles = 0, units = 0;
      for (const chunk of e.chunks.values()) for (const pile of chunk.piles) {
        piles++;
        for (const n of Object.values(pile.items)) {
          assert.ok(Number.isInteger(n) && n > 0, `positive whole pile stock at ${tick}`);
          units += n;
        }
      }
      peakPiles = Math.max(peakPiles, piles);
      // Retain the accepted 3500-tick regression. Later samples characterize growth and
      // exact accounting as population and explored area expand.
      if (tick <= 3500) assert.ok(piles < 80, `${piles} piles at tick ${tick}, seed ${seed}`);
      samples.push({ tick, piles, units, residents: e.creatures.length });
    }
    t.diagnostic(JSON.stringify({ seed, peakPiles, samples }));
  });
}
