import assert from 'node:assert/strict';
import test from 'node:test';
import { groupedParticipants } from '../src/lib/participant-grid';

const participants = Array.from({ length: 11 }, (_, index) => ({
  sessionId: `session-${index}`,
  isLocalParticipant: index === 10,
}));
test('large grids retain self, count every grouped session once, and reserve the summary tile', () => {
  const { visible, hidden } = groupedParticipants(participants, 9);
  assert.equal(visible.length, 8);
  assert.equal(hidden.length, 3);
  assert.ok(visible.some((participant) => participant.isLocalParticipant));
  assert.equal(
    new Set([...visible, ...hidden].map((participant) => participant.sessionId))
      .size,
    participants.length,
  );
});
test('resize and departures recalculate overflow without stale pages', () => {
  const narrow = groupedParticipants(participants, 4);
  assert.equal(narrow.visible.length, 3);
  assert.equal(narrow.hidden.length, 8);
  const small = groupedParticipants(participants.slice(0, 4), 4);
  assert.equal(small.hidden.length, 0);
  assert.equal(small.visible.length, 4);
  assert.deepEqual(groupedParticipants([], 9), { visible: [], hidden: [] });
});
test('remote-only grids fill capacity and preserve participant ordering', () => {
  const { visible, hidden } = groupedParticipants(participants.slice(0, 10), 6);
  assert.deepEqual(
    visible.map((participant) => participant.sessionId),
    participants.slice(0, 5).map((participant) => participant.sessionId),
  );
  assert.equal(hidden.length, 5);
});
