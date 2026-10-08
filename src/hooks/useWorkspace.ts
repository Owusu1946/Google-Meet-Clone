'use client';
import type { BoardInput } from '@/lib/board-input';
import {
  textEdit,
  insertedAtomIds,
  type TextMutation,
} from '@/lib/workspace-text';
import type { BoardOperation } from '@/lib/whiteboard';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import {
  workspaceObjects,
  newObject,
  objectFields,
  textSeed,
  type ObjectFields,
  type ObjectType,
  type WorkspaceMutation,
  type WorkspaceObject,
} from '@/lib/workspace';
import {
  frameDescendants,
  kanbanLayout,
  kanbanDrop,
  kanbanReorder,
  kanbanAppendRank,
  containingFrame,
  workspaceTemplate,
  type TemplateName,
} from '@/lib/workspace-layout';

type Change = {
  forward: (WorkspaceMutation | TextMutation | BoardOperation)[];
  backward: (WorkspaceMutation | TextMutation)[];
};
export default function useWorkspace() {
  const room = useRoom();
  const storedObjects = useMemo(
    () => workspaceObjects(room.board.operations),
    [room.board.operations],
  );
  const objects = useMemo(() => kanbanLayout(storedObjects), [storedObjects]);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<ObjectFields>>>(
    {},
  );
  const undoStack = useRef<Change[]>([]);
  const redoStack = useRef<Change[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const canEdit =
    room.board.available &&
    !room.board.loading &&
    (room.access.isHost || room.custom.collaboration !== false);
  const commit = useCallback(
    (change: Change) => {
      if (!canEdit || !change.forward.length) return;
      if (!room.board.sendMany(change.forward)) return;
      undoStack.current.push(change);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      setHistoryVersion((value) => value + 1);
    },
    [canEdit, room.board],
  );
  const createObjects = (items: WorkspaceObject[]) => {
    const creates: BoardOperation[] = items.map((item) => ({
      id: crypto.randomUUID(),
      actor: room.access.identity.id,
      time: new Date().toISOString(),
      kind: 'object-create',
      objectId: item.id,
      objectType: item.type,
      fields: { ...objectFields(item), text: textSeed(item.text) },
    }));
    const forward: BoardOperation[] = [...creates];
    items.forEach((item, index) =>
      forward.push(
        ...textEdit(
          item.id,
          item.text,
          [creates[index]],
          room.access.identity.id,
        ).forward,
      ),
    );
    commit({
      forward,
      backward: items.map((item) => ({
        kind: 'object-visible',
        objectId: item.id,
        visible: false,
      })),
    });
    setSelected(
      items.filter((item) => item.type !== 'connector').map((item) => item.id),
    );
  };
  const create = (
    type: ObjectType,
    x: number,
    y: number,
    fields: Partial<ObjectFields> = {},
  ) => {
    const item: WorkspaceObject = {
      ...newObject(type, x, y),
      ...fields,
      id: `${room.access.identity.id}:${crypto.randomUUID()}`,
      actor: room.access.identity.id,
      type,
      visible: true,
    };
    item.parentId = containingFrame(item, objects)?.id || item.parentId;
    if (item.type === 'card' && item.parentId) {
      const column = objects.find(
        (object) => object.id === item.parentId && object.type === 'column',
      );
      if (column) {
        if (fields.parentId) item.y = kanbanAppendRank(column, storedObjects);
        else Object.assign(item, kanbanDrop(item, storedObjects, objects));
      }
    }
    createObjects([item]);
    return item.id;
  };
  const patch = (
    id: string,
    fields: Partial<ObjectFields>,
    baseline?: BoardOperation[],
  ) => {
    const object = storedObjects.find((item) => item.id === id);
    if (!object) return;
    if (typeof fields.text === 'string' && Object.keys(fields).length === 1) {
      const change = textEdit(
        id,
        fields.text,
        baseline || room.board.operations,
        room.access.identity.id,
      );
      commit(change);
      return change.forward;
    }
    const before = Object.fromEntries(
      Object.keys(fields).map((key) => [
        key,
        object[key as keyof ObjectFields],
      ]),
    ) as Partial<ObjectFields>;
    commit({
      forward: [{ kind: 'object-patch', objectId: id, fields }],
      backward: [{ kind: 'object-patch', objectId: id, fields: before }],
    });
  };
  const remove = () => {
    const ids = new Set(
      selected.flatMap((id) =>
        frameDescendants(id, objects).map((item) => item.id),
      ),
    );
    objects
      .filter(
        (item) =>
          item.type === 'connector' &&
          (ids.has(item.from || '') || ids.has(item.to || '')),
      )
      .forEach((item) => ids.add(item.id));
    commit({
      forward: [...ids].map((objectId) => ({
        kind: 'object-visible',
        objectId,
        visible: false,
      })),
      backward: [...ids].map((objectId) => ({
        kind: 'object-visible',
        objectId,
        visible: true,
      })),
    });
    setSelected([]);
  };
  const duplicate = () => {
    const selectedIds = new Set(
      selected.flatMap((id) =>
        frameDescendants(id, objects).map((item) => item.id),
      ),
    );
    const items = objects.filter(
      (item) =>
        item.visible &&
        (selectedIds.has(item.id) ||
          (item.type === 'connector' &&
            selectedIds.has(item.from || '') &&
            selectedIds.has(item.to || ''))),
    );
    const ids = new Map(
      items.map((item) => [
        item.id,
        `${room.access.identity.id}:${crypto.randomUUID()}`,
      ]),
    );
    createObjects(
      items.map((item) => ({
        ...item,
        id: ids.get(item.id)!,
        actor: room.access.identity.id,
        x: item.x + 30,
        y: item.y + 30,
        parentId: ids.get(item.parentId || '') || null,
        from: ids.get(item.from || '') || item.from,
        to: ids.get(item.to || '') || item.to,
      })),
    );
  };
  const undo = () => {
    if (!canEdit) return;
    const change = undoStack.current.pop();
    if (!change) return;
    if (!room.board.sendMany(change.backward)) {
      undoStack.current.push(change);
      return;
    }
    redoStack.current.push(change);
    setHistoryVersion((value) => value + 1);
  };
  const redo = () => {
    if (!canEdit) return;
    const change = redoStack.current.pop();
    if (!change) return;
    const replay: BoardInput[] = [];
    change.forward.forEach((op) => {
      if (op.kind === 'text-insert' && 'id' in op) {
        const ids = insertedAtomIds(op.id, op.text);
        for (let index = 0; index < ids.length; index += 12)
          replay.push({
            kind: 'text-visible',
            objectId: op.objectId,
            atomIds: ids.slice(index, index + 12),
            visible: true,
          });
      } else
        replay.push(
          op.kind === 'object-create'
            ? { kind: 'object-visible', objectId: op.objectId, visible: true }
            : { ...op, id: crypto.randomUUID() },
        );
    });
    if (!room.board.sendMany(replay)) {
      redoStack.current.push(change);
      return;
    }
    undoStack.current.push(change);
    setHistoryVersion((value) => value + 1);
  };
  const move = (
    originals: WorkspaceObject[],
    dx: number,
    dy: number,
    finish: boolean,
  ) => {
    const positions = originals.map((item) => ({
      ...item,
      x: Math.max(-100000, Math.min(100000, item.x + dx)),
      y: Math.max(-100000, Math.min(100000, item.y + dy)),
    }));
    if (!finish) {
      setDrafts(
        Object.fromEntries(
          positions.map((item) => [item.id, { x: item.x, y: item.y }]),
        ),
      );
      return;
    }
    const moved = new Map(positions.map((item) => [item.id, item]));
    const nextObjects = objects.map((item) => moved.get(item.id) || item);
    commit({
      forward: positions.map((item) => ({
        kind: 'object-patch',
        objectId: item.id,
        fields:
          item.type === 'card' && !(item.parentId && moved.has(item.parentId))
            ? kanbanDrop(item, storedObjects, nextObjects)
            : {
                x: item.x,
                y: item.y,
                parentId:
                  item.parentId && moved.has(item.parentId)
                    ? item.parentId
                    : containingFrame(item, nextObjects)?.id || null,
              },
      })),
      backward: originals.map((item) => {
        const previous =
          storedObjects.find((object) => object.id === item.id) || item;
        return {
          kind: 'object-patch' as const,
          objectId: item.id,
          fields: { x: previous.x, y: previous.y, parentId: previous.parentId },
        };
      }),
    });
    setDrafts({});
  };
  const nudge = (dx: number, dy: number) => {
    const items = objects.filter(
      (item) => selected.includes(item.id) && item.visible,
    );
    const card =
      items.length === 1 && items[0].type === 'card' ? items[0] : undefined;
    const column =
      card &&
      objects.find(
        (item) => item.id === card.parentId && item.type === 'column',
      );
    if (card && column) {
      if (dy) {
        const reordered = kanbanReorder(card, dy, storedObjects);
        commit({
          forward: reordered.map((item) => ({
            kind: 'object-patch',
            objectId: item.id,
            fields: { y: item.y },
          })),
          backward: reordered.map((item) => ({
            kind: 'object-patch',
            objectId: item.id,
            fields: {
              y: storedObjects.find((object) => object.id === item.id)!.y,
            },
          })),
        });
      } else if (dx) {
        const columns = objects
          .filter((item) => item.visible && item.type === 'column')
          .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
        const target =
          columns[
            columns.findIndex((item) => item.id === column.id) + Math.sign(dx)
          ];
        if (target)
          move([card], target.x + 20 - card.x, target.y + 70 - card.y, true);
      }
      return;
    }
    const ids = new Set(
      selected.flatMap((id) =>
        frameDescendants(id, objects).map((item) => item.id),
      ),
    );
    move(
      objects.filter((item) => ids.has(item.id) && item.type !== 'connector'),
      dx,
      dy,
      true,
    );
  };
  // Expose history changes without making the stacks themselves React state.
  void historyVersion;
  return {
    objects,
    rendered: objects.map((item) => ({ ...item, ...drafts[item.id] })),
    selected,
    setSelected,
    canEdit,
    create,
    createObjects,
    patch,
    remove,
    duplicate,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    move,
    nudge,
    cancelMove: () => setDrafts({}),
    template: (name: TemplateName, x: number, y: number) =>
      createObjects(workspaceTemplate(name, room.access.identity.id, x, y)),
    room,
  };
}
