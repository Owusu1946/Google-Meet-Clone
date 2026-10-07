import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardStrokes,
  boardBatch,
  canonicalBoardOperations,
  validOperation,
  viewToWorld,
  zoomAt,
  type BoardOperation,
} from '../src/lib/whiteboard';

const stroke = (segment = 0): BoardOperation => ({
  id: '00000000-0000-0000-0000-000000000001',
  actor: 'guest_ada',
  time: '2026-10-07T12:00:00.000Z',
  kind: 'stroke',
  strokeId: 'guest_ada:one',
  segment,
  points: [{ x: segment, y: 1 }],
  mode: 'pen',
  width: 3,
  color: '#000000',
});
test('stroke replay deduplicates echoes and orders out-of-order segments', () => {
  const one = stroke();
  const two = { ...stroke(1), id: '00000000-0000-0000-0000-000000000002' };
  const result = boardStrokes([two, one, one]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].points, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]);
});
test('shared undo/redo and clear replay identically after reload', () => {
  const hide: BoardOperation = {
    id: '00000000-0000-0000-0000-000000000003',
    actor: 'guest_ada',
    time: '2026-10-07T12:00:01.000Z',
    kind: 'visibility',
    strokeId: 'guest_ada:one',
    visible: false,
  };
  assert.equal(boardStrokes([stroke(), hide])[0].visible, false);
  assert.equal(
    boardStrokes([
      stroke(),
      hide,
      {
        ...hide,
        id: '00000000-0000-0000-0000-000000000004',
        time: '2026-10-07T12:00:02.000Z',
        visible: true,
      },
    ])[0].visible,
    true,
  );
  assert.deepEqual(
    boardStrokes([
      stroke(),
      {
        id: '00000000-0000-0000-0000-000000000005',
        actor: 'host',
        time: '2026-10-07T12:00:03.000Z',
        kind: 'clear',
      },
    ]),
    [],
  );
});
test('rejects non-finite coordinates, impersonated strokes and oversized segments', () => {
  assert.equal(validOperation({ ...stroke(), actor: 'other' }), false);
  assert.equal(
    validOperation({ ...stroke(), points: [{ x: Infinity, y: 0 }] }),
    false,
  );
  assert.equal(
    validOperation({ ...stroke(), points: Array(257).fill({ x: 1, y: 1 }) }),
    false,
  );
});
test('zoom remains anchored to the pointer through pan and scale', () => {
  const point = { x: 240, y: 100 },
    offset = { x: 10, y: -20 };
  const next = zoomAt(point, 1, 2, offset);
  assert.deepEqual(viewToWorld(point, 1, offset), viewToWorld(point, 2, next));
});

test('batches obey operation and byte limits without dropping queued operations', () => {
  const operations = Array.from({ length: 20 }, (_, index) => ({
    ...stroke(index),
    id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`,
  }));
  assert.ok(
    boardBatch(operations).length > 0 && boardBatch(operations).length <= 16,
  );
  const large = operations.map((operation) => ({
    ...operation,
    points: Array.from({ length: 80 }, () => ({ x: 99999.99, y: 99999.99 })),
  }));
  const batch = boardBatch(large);
  assert.ok(batch.length > 0 && batch.length < 16);
  assert.ok(Buffer.byteLength(JSON.stringify(batch)) < 4000);
  assert.equal(large.length, 20);
});
test('canonical batches preserve clear order even with identical service timestamps', () => {
  const clear: BoardOperation = {
    id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    actor: 'guest_ada',
    kind: 'clear',
    time: stroke().time,
  };
  const before = canonicalBoardOperations(
    [stroke(), clear],
    'guest_ada',
    stroke().time,
    'batch',
  );
  assert.deepEqual(boardStrokes([...before].reverse()), []);
  const after = canonicalBoardOperations(
    [clear, stroke()],
    'guest_ada',
    stroke().time,
    'batch',
  );
  assert.equal(boardStrokes([...after].reverse()).length, 1);
});
test('canonical service history rejects spoofed authors and corrupt batches', () => {
  assert.deepEqual(
    canonicalBoardOperations([stroke()], 'other', stroke().time, 'batch'),
    [],
  );
  assert.deepEqual(
    canonicalBoardOperations(
      [stroke(), {}],
      'guest_ada',
      stroke().time,
      'batch',
    ),
    [],
  );
  assert.deepEqual(
    canonicalBoardOperations(stroke(), 'guest_ada', 'invalid', 'batch'),
    [],
  );
  assert.equal(validOperation({ ...stroke(), order: 16 }), false);
});
