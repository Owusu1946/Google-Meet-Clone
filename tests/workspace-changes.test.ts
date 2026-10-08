import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  rebaseWorkspaceHistory,
  selectiveWorkspaceChange,
  workspaceCreation,
  workspaceRedo,
} from '../src/lib/workspace-changes';
import {
  prepareBoardOperations,
  type BoardInput,
} from '../src/lib/board-input';
import { workspaceTemplate } from '../src/lib/workspace-layout';
import { workspaceObjects } from '../src/lib/workspace';
import { boardStrokes, type BoardOperation } from '../src/lib/whiteboard';

test('one undo/redo reverses a mixed workspace import without affecting existing work', () => {
  const actor = 'guest_importer';
  let phase = 0;
  const stamp = (inputs: BoardInput[]): BoardOperation[] =>
    prepareBoardOperations(inputs, actor)!.map((op) => ({
      ...op,
      time: new Date(1791450000000 + phase++).toISOString(),
    }));
  const existingObjects = workspaceTemplate('Brainstorm', actor, -2000, 0);
  const existing = stamp(workspaceCreation(existingObjects, actor).forward);
  const existingInk = stamp([
    {
      kind: 'stroke',
      strokeId: `${actor}:${randomUUID()}`,
      segment: 0,
      points: [{ x: -20, y: -30 }],
      mode: 'pen',
      color: '#202124',
      width: 3,
    },
  ]);
  const imported = workspaceTemplate('Architecture', actor, 0, 0);
  imported.find((item) => item.type === 'code')!.text =
    '// Unicode contract 😀\n'.repeat(100);
  const ink = [
    {
      points: Array.from({ length: 161 }, (_, index) => ({
        x: index,
        y: index / 2,
      })),
      mode: 'highlighter' as const,
      color: '#abcdef',
      width: 8,
    },
  ];
  const change = workspaceCreation(imported, actor, ink);
  const history = [...existing, ...existingInk, ...stamp(change.forward)];
  const beforeUndo = workspaceObjects(history).filter(
    (object) => object.visible,
  );
  const inkBeforeUndo = boardStrokes(history).filter(
    (stroke) => stroke.visible,
  );
  assert.equal(inkBeforeUndo.length, 2);
  assert.equal(
    inkBeforeUndo.find((stroke) => stroke.color === '#abcdef')!.points.length,
    161,
  );
  const undone = [...history, ...stamp(change.backward)];
  assert.deepEqual(
    workspaceObjects(undone).filter((object) => object.visible),
    workspaceObjects(existing),
  );
  assert.deepEqual(
    boardStrokes(undone).filter((stroke) => stroke.visible),
    boardStrokes(existingInk),
  );
  const redo = workspaceRedo(change);
  assert.equal(
    redo.filter((op) => op.kind === 'visibility').length,
    1,
    'Restore the stroke once, not once per segment.',
  );
  const redone = [...undone, ...stamp(redo)];
  assert.deepEqual(
    workspaceObjects(redone).filter((object) => object.visible),
    beforeUndo,
  );
  assert.deepEqual(
    boardStrokes(redone).filter((stroke) => stroke.visible),
    inkBeforeUndo,
  );
  const undoneAgain = [...redone, ...stamp(change.backward)];
  assert.equal(
    boardStrokes(undoneAgain).filter((stroke) => stroke.visible).length,
    1,
  );
});

test('drawing-only imports have a reversible workspace change', () => {
  const actor = 'guest_importer';
  const change = workspaceCreation([], actor, [
    { points: [{ x: 1, y: 2 }], mode: 'pen', color: '#000000', width: 2 },
  ]);
  assert.equal(change.forward.length, 1);
  assert.equal(change.backward.length, 1);
  assert.equal(change.backward[0].kind, 'visibility');
  assert.ok(prepareBoardOperations(change.forward, actor));
  assert.ok(prepareBoardOperations(change.backward, actor));
});

test('selective object undo and redo preserve later peer property writes', () => {
  const make = (
    fields: Record<string, number>,
    time: number,
    actor = 'alice',
  ) => ({
    id: randomUUID(),
    actor,
    time: new Date(time).toISOString(),
    kind: 'object-patch' as const,
    objectId: 'alice:object',
    fields,
  });
  const own = make({ x: 100, y: 100 }, 1);
  const peer = make({ x: 100 }, 2, 'bob');
  const change = {
    forward: [own],
    backward: [
      {
        kind: 'object-patch' as const,
        objectId: own.objectId,
        fields: { x: 0, y: 0 },
      },
    ],
  };
  const undo = selectiveWorkspaceChange(change, [own], [peer, own]);
  assert.deepEqual(undo.backward, [
    { kind: 'object-patch', objectId: own.objectId, fields: { y: 0 } },
  ]);
  const appliedUndo = make({ y: 0 }, 3);
  assert.deepEqual(
    selectiveWorkspaceChange(undo, [appliedUndo], [own, peer, appliedUndo])
      .forward[0],
    { ...own, fields: { y: 100 } },
  );
  const laterPeer = make({ y: 0 }, 4, 'bob');
  assert.deepEqual(
    selectiveWorkspaceChange(
      undo,
      [appliedUndo],
      [laterPeer, own, appliedUndo, peer],
    ),
    { forward: [], backward: [] },
  );
  assert.deepEqual(
    selectiveWorkspaceChange(
      change,
      [own],
      [
        own,
        {
          id: randomUUID(),
          actor: 'bob',
          time: new Date(5).toISOString(),
          kind: 'clear',
        },
      ],
    ),
    { forward: [], backward: [] },
  );
});

test('consecutive undo transfers ownership per property without claiming peer writes', () => {
  const make = (
    fields: Record<string, number>,
    time: number,
    actor = 'alice',
  ): BoardOperation => ({
    id: randomUUID(),
    actor,
    time: new Date(time).toISOString(),
    kind: 'object-patch',
    objectId: 'alice:object',
    fields,
  });
  const first = make({ x: 10, y: 10 }, 1);
  const peer = make({ x: 15 }, 2, 'bob');
  const second = make({ x: 20, y: 20 }, 3);
  const inverse = make({ x: 15, y: 10 }, 4);
  const earlier = {
    forward: [first],
    backward: [
      {
        kind: 'object-patch' as const,
        objectId: 'alice:object',
        fields: { x: 0, y: 0 },
      },
    ],
  };
  const current = [first, peer, second];
  const [rebased] = rebaseWorkspaceHistory(
    [earlier],
    { forward: [second], backward: [] },
    [inverse],
    current,
  );
  const next = selectiveWorkspaceChange(
    rebased,
    rebased.forward as BoardOperation[],
    [...current, inverse],
  );
  assert.deepEqual(next.backward, [
    { kind: 'object-patch', objectId: 'alice:object', fields: { y: 0 } },
  ]);
  const redoEarlier = make({ y: 10 }, 6);
  const undoEarlier = make({ y: 0 }, 5);
  const [redoLater] = rebaseWorkspaceHistory(
    [{ forward: [inverse], backward: [] }],
    { forward: [undoEarlier], backward: [] },
    [redoEarlier],
    [...current, inverse, undoEarlier],
  );
  assert.deepEqual(
    selectiveWorkspaceChange(
      { forward: [second], backward: [] },
      redoLater.forward as BoardOperation[],
      [...current, inverse, undoEarlier, redoEarlier],
    ).forward,
    [second],
  );
});
