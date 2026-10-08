import type { BoardInput } from './board-input';
import type { BoardOperation, BoardStroke } from './whiteboard';
import {
  compareOperations,
  objectFields,
  textSeed,
  type WorkspaceObject,
  type WorkspaceMutation,
} from './workspace';
import { textEdit, insertedAtomIds, type TextMutation } from './workspace-text';

type StrokeVisibility = {
  kind: 'visibility';
  strokeId: string;
  visible: boolean;
};
export type WorkspaceChange = {
  forward: (WorkspaceMutation | TextMutation | BoardOperation)[];
  backward: (WorkspaceMutation | TextMutation | StrokeVisibility)[];
};
type ImportedStroke = Pick<BoardStroke, 'mode' | 'color' | 'width' | 'points'>;

export function workspaceCreation(
  items: WorkspaceObject[],
  actor: string,
  strokes: ImportedStroke[] = [],
): WorkspaceChange {
  const creates: BoardOperation[] = items.map((item) => ({
    id: crypto.randomUUID(),
    actor,
    time: new Date().toISOString(),
    kind: 'object-create',
    objectId: item.id,
    objectType: item.type,
    fields: { ...objectFields(item), text: textSeed(item.text) },
  }));
  const forward: BoardOperation[] = [...creates];
  const backward: WorkspaceChange['backward'] = items.map((item) => ({
    kind: 'object-visible',
    objectId: item.id,
    visible: false,
  }));
  items.forEach((item, index) =>
    forward.push(
      ...textEdit(item.id, item.text, [creates[index]], actor).forward,
    ),
  );
  for (const stroke of strokes) {
    const strokeId = `${actor}:${crypto.randomUUID()}`;
    for (let segment = 0; segment * 80 < stroke.points.length; segment++) {
      forward.push({
        id: crypto.randomUUID(),
        actor,
        time: new Date().toISOString(),
        kind: 'stroke',
        strokeId,
        segment,
        points: stroke.points.slice(segment * 80, (segment + 1) * 80),
        mode: stroke.mode,
        color: stroke.color,
        width: stroke.width,
      });
    }
    backward.push({ kind: 'visibility', strokeId, visible: false });
  }
  return { forward, backward };
}

export function workspaceRedo(change: WorkspaceChange): BoardInput[] {
  const replay: BoardInput[] = [];
  const restoredStrokes = new Set<string>();
  for (const op of change.forward) {
    if (op.kind === 'text-insert' && 'id' in op) {
      const ids = insertedAtomIds(op.id, op.text);
      for (let index = 0; index < ids.length; index += 12)
        replay.push({
          kind: 'text-visible',
          objectId: op.objectId,
          atomIds: ids.slice(index, index + 12),
          visible: true,
        });
    } else if (op.kind === 'stroke') {
      if (!restoredStrokes.has(op.strokeId)) {
        replay.push({
          kind: 'visibility',
          strokeId: op.strokeId,
          visible: true,
        });
        restoredStrokes.add(op.strokeId);
      }
    } else
      replay.push(
        op.kind === 'object-create'
          ? { kind: 'object-visible', objectId: op.objectId, visible: true }
          : { ...op, id: crypto.randomUUID() },
      );
  }
  return replay;
}

// Undo only properties still owned by this edit, including same-valued peer writes.
export function selectiveWorkspaceChange(
  change: WorkspaceChange,
  expected: BoardOperation[],
  current: BoardOperation[],
): WorkspaceChange {
  const owners = new Map<string, string>();
  const key = (id: string, field: string) => JSON.stringify([id, field]);
  for (const op of [...current].sort(compareOperations)) {
    if (op.kind === 'clear') owners.clear();
    if (op.kind === 'object-create' || op.kind === 'object-patch')
      for (const field of Object.keys(op.fields))
        owners.set(key(op.objectId, field), op.id);
  }
  const allowed = new Set<string>();
  for (const op of expected)
    if (op.kind === 'object-patch')
      for (const field of Object.keys(op.fields))
        if (owners.get(key(op.objectId, field)) === op.id)
          allowed.add(key(op.objectId, field));
  const filter = <
    T extends
      WorkspaceChange['forward'][number] | WorkspaceChange['backward'][number],
  >(
    ops: T[],
  ): T[] =>
    ops.flatMap((op) => {
      if (op.kind !== 'object-patch') return [op];
      const fields = Object.fromEntries(
        Object.entries(op.fields).filter(([field]) =>
          allowed.has(key(op.objectId, field)),
        ),
      );
      return Object.keys(fields).length ? [{ ...op, fields } as T] : [];
    });
  return { forward: filter(change.forward), backward: filter(change.backward) };
}

// A successful undo becomes the latest write for the edit immediately beneath it.
// Transfer that ownership so consecutive Undo commands can continue backwards.
export function rebaseWorkspaceHistory(
  history: WorkspaceChange[],
  undone: WorkspaceChange,
  appliedUndo: BoardOperation[],
  current: BoardOperation[],
): WorkspaceChange[] {
  const removed = new Set(
    undone.forward.flatMap((op) => ('id' in op ? [op.id] : [])),
  );
  const prior = new Map<string, string>();
  const key = (id: string, field: string) => JSON.stringify([id, field]);
  for (const op of [...current].sort(compareOperations)) {
    if (removed.has(op.id)) continue;
    if (op.kind === 'clear') prior.clear();
    if (op.kind === 'object-create' || op.kind === 'object-patch')
      for (const field of Object.keys(op.fields))
        prior.set(key(op.objectId, field), op.id);
  }
  const replacements = new Map<string, { before: string; after: string }>();
  for (const op of appliedUndo)
    if (op.kind === 'object-patch')
      for (const field of Object.keys(op.fields)) {
        const address = key(op.objectId, field);
        const before = prior.get(address);
        if (before) replacements.set(address, { before, after: op.id });
      }
  return history.map((change) => ({
    ...change,
    forward: change.forward.flatMap((op) => {
      if (op.kind !== 'object-patch' || !('id' in op)) return [op];
      return Object.entries(op.fields).map(([field, value]) => {
        const replacement = replacements.get(key(op.objectId, field));
        return {
          ...op,
          id: replacement?.before === op.id ? replacement.after : op.id,
          fields: { [field]: value },
        };
      });
    }),
  }));
}
