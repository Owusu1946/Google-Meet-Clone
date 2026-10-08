import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  newObject,
  workspaceObjects,
  connectorEnds,
} from '../src/lib/workspace';
import {
  validOperation,
  boardBatch,
  boardStrokes,
  canonicalBoardOperations,
  type BoardOperation,
} from '../src/lib/whiteboard';
const actor = 'guest_alice';
const objectId = `${actor}:${randomUUID()}`;
const operation = (value: Record<string, unknown>, time = 0): BoardOperation =>
  ({
    id: randomUUID(),
    actor,
    time: new Date(1791450000000 + time).toISOString(),
    ...value,
  }) as BoardOperation;
const create = operation({
  kind: 'object-create',
  objectId,
  objectType: 'card',
  fields: newObject('card', 0, 0),
});
test('concurrent geometry and text edits converge independent of delivery order', () => {
  const move = operation(
    { kind: 'object-patch', objectId, fields: { x: 420, y: 120 } },
    1,
  );
  const edit = {
    ...operation(
      { kind: 'object-patch', objectId, fields: { text: 'Reviewed by Bob' } },
      2,
    ),
    actor: 'guest_bob',
  };
  const expected = workspaceObjects([create, move, edit]);
  assert.deepEqual(workspaceObjects([edit, move, create, edit]), expected);
  assert.equal(expected[0].x, 420);
  assert.equal(expected[0].text, 'Reviewed by Bob');
  assert.equal(validOperation(edit), true);
});
test('tombstones, restore and clear affect objects without losing drawing compatibility', () => {
  const hide = operation(
    { kind: 'object-visible', objectId, visible: false },
    1,
  );
  const show = operation(
    { kind: 'object-visible', objectId, visible: true },
    2,
  );
  assert.equal(workspaceObjects([create, hide])[0].visible, false);
  assert.equal(workspaceObjects([create, hide, show])[0].visible, true);
  assert.deepEqual(
    workspaceObjects([create, operation({ kind: 'clear' }, 3)]),
    [],
  );
  assert.deepEqual(boardStrokes([create, hide, show]), []);
});
test('schema rejects oversized, unsafe and forged object edits before sync', () => {
  assert.equal(validOperation({ ...create, actor: 'imposter' }), false);
  for (const fields of [
    { x: Infinity },
    { width: -1 },
    { text: '🚀'.repeat(900) },
    { color: 'url(evil)' },
    { html: '<script>' },
    { parentId: '../secret' },
    {},
  ]) {
    assert.equal(
      validOperation(operation({ kind: 'object-patch', objectId, fields })),
      false,
    );
  }
  assert.equal(
    validOperation(
      operation({
        kind: 'object-create',
        objectId,
        objectType: 'unknown',
        fields: newObject('card', 0, 0),
      }),
    ),
    false,
  );
});
test('durable canonical batches retain ordering and live edits use the same schema', () => {
  const edit = operation({
    kind: 'object-patch',
    objectId,
    fields: { text: 'Ship it' },
  });
  const batch = boardBatch([create, edit]);
  assert.equal(batch.length, 2);
  const saved = canonicalBoardOperations(
    batch,
    actor,
    new Date(),
    'service-batch',
  );
  assert.equal(workspaceObjects(saved)[0].text, 'Ship it');
  assert.deepEqual(
    canonicalBoardOperations(batch, 'imposter', new Date(), 'bad'),
    [],
  );
});
test('connectors follow moved endpoints and disappear when an endpoint is deleted', () => {
  const secondId = `${actor}:${randomUUID()}`;
  const second = operation({
    kind: 'object-create',
    objectId: secondId,
    objectType: 'rectangle',
    fields: newObject('rectangle', 400, 0),
  });
  const line = operation({
    kind: 'object-create',
    objectId: `${actor}:${randomUUID()}`,
    objectType: 'connector',
    fields: { ...newObject('connector', 0, 0), from: objectId, to: secondId },
  });
  const objects = workspaceObjects([create, second, line]);
  const connector = objects.find((item) => item.type === 'connector')!;
  const first = objects.find((item) => item.id === objectId)!;
  assert.ok(connectorEnds(connector, objects));
  first.x = 100;
  assert.equal(connectorEnds(connector, objects)?.from.x, 210);
  first.visible = false;
  assert.equal(connectorEnds(connector, objects), null);
});
