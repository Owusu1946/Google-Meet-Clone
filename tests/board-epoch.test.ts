import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { boardEpoch } from '../src/lib/board-epoch';
import { workspaceCreation, workspaceRedo } from '../src/lib/workspace-changes';
import { workspaceTemplate } from '../src/lib/workspace-layout';
import { workspaceObjects } from '../src/lib/workspace';
import { prepareBoardOperations } from '../src/lib/board-input';
import { boardStrokes, type BoardOperation } from '../src/lib/whiteboard';

test('clear epochs follow canonical replay order and remain stable after acknowledgement', () => {
  const first: BoardOperation = {
    id: randomUUID(),
    actor: 'guest_host',
    kind: 'clear',
    time: '2026-10-08T10:00:00.000Z',
  };
  const last = { ...first, id: randomUUID(), time: '2026-10-08T10:00:01.000Z' };
  assert.equal(boardEpoch([]), null);
  assert.equal(boardEpoch([last, first]), last.id);
  assert.equal(boardEpoch([first, last]), last.id);
  assert.equal(
    boardEpoch([
      first,
      {
        ...last,
        time: '2026-10-08T10:00:02.000Z',
        batch: 'service-message',
        order: 0,
      },
    ]),
    last.id,
  );
  const inBatch = [
    { ...first, batch: 'same-message', order: 0 },
    { ...last, time: first.time, batch: 'same-message', order: 1 },
  ];
  assert.equal(boardEpoch(inBatch.reverse()), last.id);
});

test('retired import undo/redo cannot resurrect pre-clear objects or ink', () => {
  const actor = 'guest_host';
  const change = workspaceCreation(
    workspaceTemplate('Architecture', actor, 0, 0),
    actor,
    [{ points: [{ x: 1, y: 2 }], mode: 'pen', color: '#202124', width: 3 }],
  );
  const stamp = (operations: ReturnType<typeof workspaceRedo>, time: string) =>
    prepareBoardOperations(operations, actor)!.map((op) => ({ ...op, time }));
  const clear: BoardOperation = {
    id: randomUUID(),
    actor,
    kind: 'clear',
    time: '2026-10-08T10:00:01.000Z',
  };
  const history = [
    ...stamp(change.forward, '2026-10-08T10:00:00.000Z'),
    clear,
    ...stamp(change.backward, '2026-10-08T10:00:02.000Z'),
    ...stamp(workspaceRedo(change), '2026-10-08T10:00:03.000Z'),
  ];
  assert.equal(boardEpoch(history), clear.id);
  assert.deepEqual(workspaceObjects(history), []);
  assert.deepEqual(boardStrokes(history), []);
});
