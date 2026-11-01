import test from "node:test";
import assert from "node:assert/strict";
import { catalogue, fireBeside, hasChimney, nodeKey, shelterKey, shelterVariant, storeKey, hearthKey, type Region } from "./storybook";

const regions: Region[] = ["forest", "desert", "cold", "coast"];

test("chimney smoke needs a real burning fire on or beside the shelter", () => {
  const id = [...Array(50).keys()].find((i) => shelterVariant(i) === 0)!;
  assert.equal(shelterKey("forest", id, "complete"), "shelter:forest:0:complete");
  assert.equal(shelterKey("forest", id, "complete", true), "shelter:forest:0:complete:lit");
  assert.equal(shelterKey("forest", id, "damaged", true), "shelter:forest:0:damaged", "a damaged roof never smokes");
  assert.equal(shelterKey("desert", id, "complete", true), "shelter:desert:0:complete", "no chimney, no smoke");
  const fires: [number, number, number][] = [[7, 10, 10]];
  assert.equal(fireBeside(fires, undefined, 11, 9), true, "Chebyshev 1 is beside");
  assert.equal(fireBeside(fires, undefined, 12, 10), false, "two tiles away is not");
  assert.equal(fireBeside(fires, [{ id: 7, fuel: 0 }], 10, 10), false, "a fire with no fuel is not burning");
  assert.equal(fireBeside([], [], 10, 10), false, "no fires, no smoke");
  assert.ok(hasChimney("coast", 1) && !hasChimney("coast", 0));
});

test("the contact sheet lists every key the world renderer can produce", () => {
  const sheet = new Set(catalogue().map((c) => c.key));
  assert.ok(sheet.has(nodeKey("forest", "tree", "t6", 8)!.key), "seed-2 tree t6");
  assert.ok(sheet.has("tree:forest:broadleaf:2"));
  const kinds = ["tree", "bush", "cactus", "scrub", "lichen", "stone", "flint", "deadfall", "driftwood", "water", "unknown"];
  for (const r of regions) {
    for (const kind of kinds) for (const units of [0, 3]) for (let i = 0; i < 400; i++) {
      const k = nodeKey(r, kind, `x${i}`, units)?.key; if (k) assert.ok(sheet.has(k), k);
    }
    for (let id = 0; id < 200; id++) {
      for (const st of ["foundation", "frame", "complete", "damaged", "ruin"] as const) for (const lit of [false, true]) assert.ok(sheet.has(shelterKey(r, id, st, lit)));
      assert.ok(sheet.has(hearthKey(r, id)));
    }
    for (const items of [{ wood: 5 }, { berries: 2, wood: 1 }, { stone: 3 }, {}] as Record<string, number>[]) for (let size = 0; size < 7; size++) for (const ruined of [false, true]) assert.ok(sheet.has(storeKey(r, items, size, ruined)));
  }
});
