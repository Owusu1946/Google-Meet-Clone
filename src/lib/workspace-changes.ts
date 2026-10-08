import type { BoardInput } from './board-input';
import type { BoardOperation, BoardStroke } from './whiteboard';
import {
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
