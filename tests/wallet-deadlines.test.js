// Unit checks of the production deadline helpers. No HTTP service or wallet is simulated as authenticated.
// The fetch mock implements only AbortSignal cancellation; crypto/auth remains covered by HTTP regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VisitorAuthClient } from '../shared/visitor-auth-client.js';

const scope = { baseUrl: 'https://world.example', uri: 'https://world.example/', origin: 'https://world.example' };
test('provider deadline expires at the boundary and a late result cannot reverse it (virtual clock)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = new VisitorAuthClient({ ...scope, timeoutMs: 10_000 });
  let release, outcome = 'pending';
  const operation = new Promise((resolve) => { release = resolve; });
  const pending = client.deadline(operation, 60_000).then(() => { outcome = 'resolved'; }, (e) => { outcome = e.message; });
  t.mock.timers.tick(59_999); await Promise.resolve(); assert.equal(outcome, 'pending');
  t.mock.timers.tick(1); await pending; assert.match(outcome, /timed out/);
  release('late signature'); await Promise.resolve(); assert.match(outcome, /timed out/);
  assert.equal(client.timeoutMs, 10_000); assert.equal(client.session, null);
});
test('network deadline aborts the fetch signal, unwinds counters and permits retry (virtual clock)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const client = new VisitorAuthClient({ ...scope, timeoutMs: 10_000, fetchImpl: (_, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }));
  } });
  const pending = assert.rejects(client.request('config'), /timed out/);
  t.mock.timers.tick(9999); assert.equal(signal.aborted, false); assert.equal(client.pendingRequests, 1);
  t.mock.timers.tick(1); await pending; assert.equal(signal.aborted, true); assert.equal(client.pendingRequests, 0);
  client.fetch = async () => new Response('{"enabled":false,"version":1}');
  assert.deepEqual(await client.request('config'), { enabled: false, version: 1 });
  assert.equal(client.pendingRequests, 0); assert.equal(client.session, null);
});
