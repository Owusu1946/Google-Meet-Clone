import assert from 'node:assert/strict';
import test from 'node:test';
import { admitRequests } from '../src/lib/admission-batch';

test('bulk admission isolates failures and retries only unresolved requests', async () => {
  const seen: string[] = [];
  const result = await admitRequests(['a', 'b', 'c', 'a'], async (id) => {
    seen.push(id);
    if (id === 'b') throw new Error('Request cancelled or service unavailable');
  });
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(result, { admitted: ['a', 'c'], failed: ['b'] });
  const retry = await admitRequests(result.failed, async (id) => {
    seen.push(id);
  });
  assert.deepEqual(retry, { admitted: ['b'], failed: [] });
  assert.deepEqual(seen, ['a', 'b', 'c', 'b']);
});
test('new applicants cannot enter an already confirmed batch', async () => {
  const confirmed = ['a', 'b'];
  const result = await admitRequests(confirmed, async () => {
    confirmed.push('new-arrival');
  });
  assert.deepEqual(result.admitted, ['a', 'b']);
  assert.deepEqual(result.failed, []);
});
