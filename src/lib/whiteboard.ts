export type Point = { x: number; y: number };
export type StrokeMode = 'pen' | 'highlighter' | 'eraser';
export type BoardOperation = {
  id: string;
  actor: string;
  time: string;
  batch?: string;
  order?: number;
} & (
  | {
      kind: 'stroke';
      strokeId: string;
      segment: number;
      points: Point[];
      mode: StrokeMode;
      color: string;
      width: number;
    }
  | { kind: 'visibility'; strokeId: string; visible: boolean }
  | { kind: 'clear' }
);
export type BoardStroke = {
  id: string;
  actor: string;
  mode: StrokeMode;
  color: string;
  width: number;
  points: Point[];
  visible: boolean;
};

export function validOperation(input: unknown): input is BoardOperation {
  if (!input || typeof input !== 'object') return false;
  const operation = input as BoardOperation;
  if (
    typeof operation.id !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(operation.id) ||
    typeof operation.actor !== 'string' ||
    typeof operation.time !== 'string' ||
    !Number.isFinite(Date.parse(operation.time)) ||
    (operation.batch !== undefined &&
      (typeof operation.batch !== 'string' || operation.batch.length > 100)) ||
    (operation.order !== undefined &&
      (!Number.isInteger(operation.order) ||
        operation.order < 0 ||
        operation.order >= 16))
  )
    return false;
  if (operation.kind === 'clear') return true;
  if (
    typeof operation.strokeId !== 'string' ||
    operation.strokeId.length > 160 ||
    !operation.strokeId.startsWith(`${operation.actor}:`)
  )
    return false;
  if (operation.kind === 'visibility')
    return typeof operation.visible === 'boolean';
  return (
    operation.kind === 'stroke' &&
    Number.isInteger(operation.segment) &&
    operation.segment >= 0 &&
    operation.segment < 1000 &&
    ['pen', 'highlighter', 'eraser'].includes(operation.mode) &&
    /^#[a-f0-9]{6}$/i.test(operation.color) &&
    Number.isFinite(operation.width) &&
    operation.width >= 1 &&
    operation.width <= 40 &&
    Array.isArray(operation.points) &&
    operation.points.length > 0 &&
    operation.points.length <= 256 &&
    operation.points.every(
      (point) =>
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Math.abs(point.x) <= 100_000 &&
        Math.abs(point.y) <= 100_000,
    )
  );
}

export function boardStrokes(operations: BoardOperation[]): BoardStroke[] {
  const strokes = new Map<
    string,
    BoardStroke & { segments: Map<number, Point[]> }
  >();
  const visible = new Map<string, boolean>();
  const seen = new Set<string>();
  // Service timestamps establish shared order; IDs provide a deterministic tie break.
  const ordered = [...operations].sort(
    (a, b) =>
      a.time.localeCompare(b.time) ||
      (a.batch || a.id).localeCompare(b.batch || b.id) ||
      (a.order || 0) - (b.order || 0) ||
      a.id.localeCompare(b.id),
  );
  for (const operation of ordered) {
    if (seen.has(operation.id) || !validOperation(operation)) continue;
    seen.add(operation.id);
    if (operation.kind === 'clear') {
      strokes.clear();
      visible.clear();
      continue;
    }
    if (operation.kind === 'visibility') {
      visible.set(operation.strokeId, operation.visible);
      continue;
    }
    let stroke = strokes.get(operation.strokeId);
    if (!stroke) {
      stroke = {
        id: operation.strokeId,
        actor: operation.actor,
        mode: operation.mode,
        color: operation.color,
        width: operation.width,
        points: [],
        visible: true,
        segments: new Map(),
      };
      strokes.set(stroke.id, stroke);
    }
    if (!stroke.segments.has(operation.segment))
      stroke.segments.set(operation.segment, operation.points);
  }
  return [...strokes.values()].map((stroke) => ({
    ...stroke,
    visible: visible.get(stroke.id) ?? true,
    points: [...stroke.segments.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, points]) => points),
  }));
}

// Bound each durable request and service message, including serialization overhead.
export function boardBatch(operations: BoardOperation[]): BoardOperation[] {
  const batch: BoardOperation[] = [];
  let bytes = 64;
  for (const operation of operations.slice(0, 16)) {
    const size = new TextEncoder().encode(JSON.stringify(operation)).length + 1;
    if (bytes + size > 24_000) break;
    batch.push(operation);
    bytes += size;
  }
  return batch;
}

export function canonicalBoardOperations(
  value: unknown,
  actor: string,
  time: string | Date,
  batch: string,
): BoardOperation[] {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.length > 16 || !values.every(validOperation))
    return [];
  if (!values.every((operation) => operation.actor === actor)) return [];
  const timestamp = new Date(time);
  if (!Number.isFinite(timestamp.getTime())) return [];
  return values.map((operation, order) => ({
    ...operation,
    time: timestamp.toISOString(),
    batch,
    order,
  }));
}

export function viewToWorld(point: Point, scale: number, offset: Point): Point {
  return { x: (point.x - offset.x) / scale, y: (point.y - offset.y) / scale };
}
export function zoomAt(
  point: Point,
  oldScale: number,
  newScale: number,
  offset: Point,
): Point {
  const world = viewToWorld(point, oldScale, offset);
  return { x: point.x - world.x * newScale, y: point.y - world.y * newScale };
}
