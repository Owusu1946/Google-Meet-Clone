import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraftBarrier } from '../src/lib/draft-barrier';

test('save includes a debounced editor draft before inspecting its transport queue', () => {
  const barrier = createDraftBarrier();
  let pending: string | undefined = 'last keystroke';
  const queue: string[] = [];
  const unregister = barrier.register(() => {
    if (!pending) return;
    const draft = pending;
    pending = undefined;
    queue.push(draft);
    // Enqueueing asks for a save too, without emitting the draft twice.
    assert.equal(barrier.flush(), true);
  });
  assert.equal(barrier.flush(), true);
  assert.deepEqual(queue, ['last keystroke']);
  assert.equal(barrier.flush(), true);
  assert.deepEqual(queue, ['last keystroke']);
  unregister();
  pending = 'unmounted';
  barrier.flush();
  assert.deepEqual(queue, ['last keystroke']);
});

test('an unavailable editor prevents exit without discarding its draft and can retry', () => {
  const barrier = createDraftBarrier();
  let access = false;
  let pending = true;
  barrier.register(() => {
    if (!pending) return true;
    if (!access) return false;
    pending = false;
    return true;
  });
  assert.equal(barrier.flush(), false);
  assert.equal(pending, true);
  access = true;
  assert.equal(barrier.flush(), true);
  assert.equal(pending, false);
});

test('a throwing editor cannot skip other drafts or poison future retries', () => {
  const barrier = createDraftBarrier();
  let calls = 0;
  const unregister = barrier.register(() => {
    throw new Error('editor failure');
  });
  barrier.register(() => {
    calls++;
  });
  assert.equal(barrier.flush(), false);
  assert.equal(calls, 1);
  unregister();
  assert.equal(barrier.flush(), true);
  assert.equal(calls, 2);
});
