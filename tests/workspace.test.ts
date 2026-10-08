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
import {
  WORKSPACE_TEMPLATES,
  workspaceTemplate,
  containingFrame,
  frameDescendants,
} from '../src/lib/workspace-layout';
test('domain templates generate valid linked objects within service limits', () => {
  for (const name of WORKSPACE_TEMPLATES) {
    const items = workspaceTemplate(name, actor, 30, 40);
    assert.ok(items.length > 0);
    for (const item of items) {
      const { id, type, actor: owner, visible, ...fields } = item;
      assert.equal(owner, actor);
      assert.equal(visible, true);
      const op = operation({
        kind: 'object-create',
        objectId: id,
        objectType: type,
        fields,
      });
      assert.equal(validOperation(op), true, `${name}: ${type}`);
      assert.equal(boardBatch([op]).length, 1);
      if (item.from) assert.ok(items.some((node) => node.id === item.from));
      if (item.to) assert.ok(items.some((node) => node.id === item.to));
      if (item.parentId)
        assert.ok(items.some((node) => node.id === item.parentId));
    }
  }
});
test('Kanban drop targets and nested frame moves preserve membership without cycles', () => {
  const items = workspaceTemplate('Kanban', actor, 0, 0);
  const card = items.find((item) => item.type === 'card')!;
  const columns = items.filter((item) => item.type === 'column');
  assert.equal(containingFrame({ ...card, x: 340 }, items)?.id, columns[1].id);
  assert.equal(frameDescendants(columns[0].id, items).length, 2);
  assert.equal(containingFrame(columns[0], items), undefined);
  columns[0].parentId = card.id; // Corrupt cyclic input cannot make traversal loop.
  assert.equal(frameDescendants(card.id, items).length, 2);
});
