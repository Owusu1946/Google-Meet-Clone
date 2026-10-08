import { textDocument } from './workspace-text';
import type { BoardOperation } from './whiteboard';

export const OBJECT_TYPES = [
  'frame',
  'column',
  'note',
  'text',
  'code',
  'card',
  'rectangle',
  'ellipse',
  'diamond',
  'connector',
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];
export type ObjectFields = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
  parentId: string | null;
  from: string | null;
  to: string | null;
};
export type WorkspaceObject = ObjectFields & {
  id: string;
  actor: string;
  type: ObjectType;
  visible: boolean;
};
export type WorkspaceMutation =
  | {
      kind: 'object-create';
      objectId: string;
      objectType: ObjectType;
      fields: ObjectFields;
    }
  | { kind: 'object-patch'; objectId: string; fields: Partial<ObjectFields> }
  | { kind: 'object-visible'; objectId: string; visible: boolean };
const keys = new Set([
  'x',
  'y',
  'width',
  'height',
  'text',
  'color',
  'fontSize',
  'parentId',
  'from',
  'to',
]);
export function validObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,160}$/.test(value);
}
export function validFields(
  value: unknown,
  complete = false,
): value is ObjectFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  const entries = Object.entries(fields);
  if (!entries.length || (complete && entries.length !== keys.size))
    return false;
  if (new TextEncoder().encode(JSON.stringify(fields)).length > 2800)
    return false;
  return entries.every(([key, field]) => {
    if (!keys.has(key)) return false;
    if (key === 'text')
      return typeof field === 'string' && field.length <= 1600;
    if (key === 'color')
      return typeof field === 'string' && /^#[a-f0-9]{6}$/i.test(field);
    if (['parentId', 'from', 'to'].includes(key))
      return field === null || validObjectId(field);
    if (typeof field !== 'number' || !Number.isFinite(field)) return false;
    if (key === 'fontSize') return field >= 10 && field <= 72;
    if (key === 'width' || key === 'height')
      return field >= 40 && field <= 10000;
    return Math.abs(field) <= 100000;
  });
}
export function validWorkspaceMutation(
  value: WorkspaceMutation,
  actor: string,
) {
  if (!validObjectId(value.objectId)) return false;
  if (value.kind === 'object-visible')
    return typeof value.visible === 'boolean';
  if (value.kind === 'object-patch') return validFields(value.fields);
  return (
    value.kind === 'object-create' &&
    value.objectId.startsWith(`${actor}:`) &&
    OBJECT_TYPES.includes(value.objectType) &&
    validFields(value.fields, true) &&
    value.fields.parentId !== value.objectId &&
    value.fields.from !== value.objectId &&
    value.fields.to !== value.objectId
  );
}
export function compareOperations(a: BoardOperation, b: BoardOperation) {
  return (
    a.time.localeCompare(b.time) ||
    (a.batch || a.id).localeCompare(b.batch || b.id) ||
    (a.order || 0) - (b.order || 0) ||
    a.id.localeCompare(b.id)
  );
}

// Replay uses independent property updates: moving an object cannot replace its
// concurrently edited text. Deletions retain data so undo can restore it.
export function workspaceObjects(
  operations: BoardOperation[],
): WorkspaceObject[] {
  const sorted = [
    ...new Map(operations.map((op) => [op.id, op])).values(),
  ].sort(compareOperations);
  const lastClear = sorted.findLastIndex((op) => op.kind === 'clear');
  const current = sorted.slice(lastClear + 1);
  const objects = new Map<string, WorkspaceObject>();
  for (const op of current) {
    if (op.kind === 'object-create' && !objects.has(op.objectId)) {
      objects.set(op.objectId, {
        ...op.fields,
        id: op.objectId,
        actor: op.actor,
        type: op.objectType,
        visible: true,
      });
    }
  }
  for (const op of current) {
    if (op.kind !== 'object-patch' && op.kind !== 'object-visible') continue;
    const object = objects.get(op.objectId);
    if (!object) continue;
    if (op.kind === 'object-visible') object.visible = op.visible;
    else Object.assign(object, op.fields);
  }
  const documents = new Map<string, BoardOperation[]>();
  for (const operation of current) {
    if (
      'objectId' in operation &&
      (operation.kind === 'object-create' ||
        operation.kind === 'text-insert' ||
        operation.kind === 'text-visible' ||
        (operation.kind === 'object-patch' &&
          typeof operation.fields.text === 'string'))
    ) {
      const history = documents.get(operation.objectId) || [];
      history.push(operation);
      documents.set(operation.objectId, history);
    }
  }
  return [...objects.values()].map((object) => ({
    ...object,
    text: textDocument(object.id, documents.get(object.id) || []).text,
  }));
}
export function objectFields(object: WorkspaceObject): ObjectFields {
  const { x, y, width, height, text, color, fontSize, parentId, from, to } =
    object;
  return { x, y, width, height, text, color, fontSize, parentId, from, to };
}
export function newObject(
  type: ObjectType,
  x: number,
  y: number,
): ObjectFields {
  return {
    x,
    y,
    width: type === 'frame' ? 640 : type === 'column' ? 280 : 220,
    height:
      type === 'frame'
        ? 440
        : type === 'column'
          ? 600
          : type === 'text'
            ? 100
            : 160,
    text:
      type === 'column'
        ? 'New column'
        : type === 'frame'
          ? 'Untitled frame'
          : type === 'code'
            ? '// Write code here'
            : type === 'card'
              ? 'New task'
              : type === 'note'
                ? 'Your idea'
                : type === 'text'
                  ? 'Write something…'
                  : '',
    color:
      type === 'note'
        ? '#fff2b2'
        : type === 'column' || type === 'frame'
          ? '#f1f5f9'
          : '#ffffff',
    fontSize: type === 'code' ? 14 : 18,
    parentId: null,
    from: null,
    to: null,
  };
}
export function connectorEnds(
  object: WorkspaceObject,
  objects: WorkspaceObject[],
) {
  const from = objects.find((item) => item.id === object.from && item.visible);
  const to = objects.find((item) => item.id === object.to && item.visible);
  if (!from || !to || from.id === to.id) return null;
  return {
    from: { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    to: { x: to.x + to.width / 2, y: to.y + to.height / 2 },
  };
}

export function textSeed(text: string) {
  return [...text].slice(0, 400).join('');
}
