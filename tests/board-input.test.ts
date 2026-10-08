import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prepareBoardOperations } from '../src/lib/board-input';
import { newObject, workspaceObjects } from '../src/lib/workspace';
import { textEdit } from '../src/lib/workspace-text';
import {
  boardBatch,
  validOperation,
  type BoardOperation,
} from '../src/lib/whiteboard';

test('a long Unicode edit survives bulk enqueue, transport splitting and pending recovery', () => {
  const actor = 'guest_writer';
  const objectId = `${actor}:${randomUUID()}`;
  const create: BoardOperation = {
    id: randomUUID(),
    actor,
    time: new Date().toISOString(),
    kind: 'object-create',
    objectId,
    objectType: 'text',
    fields: { ...newObject('text', 0, 0), text: '' },
  };
  const expected = 'A shared thought 😀\n'.repeat(1000);
  const edit = textEdit(objectId, expected, [create], actor);
  const prepared = prepareBoardOperations([create, ...edit.forward], actor)!;
  assert.equal(prepared.length, edit.forward.length + 1);
  assert.deepEqual(
    prepared.map((operation) => operation.id),
    [create, ...edit.forward].map((operation) => operation.id),
  );
  // The stored pending queue must retain the complete logical edit, independent
  // of how many bounded requests are needed to send it.
  const recovered: BoardOperation[] = JSON.parse(JSON.stringify(prepared));
  assert.ok(recovered.every(validOperation));
  const delivered: BoardOperation[] = [];
  while (recovered.length) {
    const batch = boardBatch(recovered);
    assert.ok(batch.length > 0 && batch.length <= 16);
    delivered.push(...batch);
    recovered.splice(0, batch.length);
  }
  assert.equal(workspaceObjects(delivered)[0].text, expected);
});

test('bulk validation rejects a corrupt edit as a whole and cannot forge the sender', () => {
  const actor = 'guest_writer';
  const valid = {
    kind: 'object-create',
    objectId: `${actor}:${randomUUID()}`,
    objectType: 'note',
    fields: newObject('note', 0, 0),
  };
  assert.equal(
    prepareBoardOperations([valid, { kind: 'unknown' }], actor),
    null,
  );
  assert.equal(
    prepareBoardOperations(
      [{ ...valid, objectId: 'guest_other:forged', actor: 'guest_other' }],
      actor,
    ),
    null,
  );
  const id = randomUUID();
  assert.equal(
    prepareBoardOperations(
      [
        { ...valid, id },
        { ...valid, id },
      ],
      actor,
    ),
    null,
  );
  assert.deepEqual(prepareBoardOperations([], actor), []);
});
