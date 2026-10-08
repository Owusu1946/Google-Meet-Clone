import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveCallOnce } from '../src/lib/leave-call';
test('ending event already left: do not leave twice', async () => {
  let calls = 0;
  await leaveCallOnce(
    {
      state: { callingState: 'left' },
      leave: async () => {
        calls++;
        throw new Error('already left');
      },
    },
    true,
  );
  assert.equal(calls, 0);
});
test('ending event races an in-flight leave: complete the exit', async () => {
  const state = { callingState: 'joined' };
  await leaveCallOnce({
    state,
    leave: async () => {
      state.callingState = 'left';
      throw new Error('already left');
    },
  });
});
test('confirmed remote end cannot be undone by local cleanup failure', async () => {
  await leaveCallOnce(
    {
      state: { callingState: 'joined' },
      leave: async () => {
        throw new Error('cleanup failed');
      },
    },
    true,
  );
});
test('ordinary leave failures remain visible and retryable', async () => {
  await assert.rejects(
    leaveCallOnce({
      state: { callingState: 'joined' },
      leave: async () => {
        throw new Error('network failed');
      },
    }),
    /network failed/,
  );
});
