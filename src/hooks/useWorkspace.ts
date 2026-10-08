'use client';
import { prepareBoardOperations } from '@/lib/board-input';
import { boardEpoch } from '@/lib/board-epoch';
import {
  selectiveWorkspaceChange,
  workspaceCreation,
  workspaceRedo,
  type WorkspaceChange,
} from '@/lib/workspace-changes';
import { textEdit } from '@/lib/workspace-text';
import type { BoardOperation, BoardStroke } from '@/lib/whiteboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import {
  workspaceObjects,
  newObject,
  type ObjectFields,
  type ObjectType,
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
  const undoStack = useRef<WorkspaceChange[]>([]);
  const redoStack = useRef<
    { change: WorkspaceChange; appliedUndo: BoardOperation[] }[]
  >([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const epoch = useMemo(
    () => boardEpoch(room.board.operations),
    [room.board.operations],
  );
  const historyEpoch = useRef(epoch);
  useEffect(() => {
    if (historyEpoch.current === epoch) return;
    historyEpoch.current = epoch;
    undoStack.current = [];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
    setSelected([]);
    setDrafts({});
  }, [epoch]);
  useEffect(() => {
    const visible = new Set(
      storedObjects.filter((item) => item.visible).map((item) => item.id),
    );
    setSelected((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
    setDrafts((current) => {
      const entries = Object.entries(current).filter(([id]) => visible.has(id));
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries);
    });
  }, [storedObjects]);

  const canEdit =
    room.board.available &&
    !room.board.loading &&
    (room.access.isHost || room.custom.collaboration !== false);
  const commit = useCallback(
    (change: WorkspaceChange) => {
      if (!canEdit || !change.forward.length) return false;
      const forward = prepareBoardOperations(
        change.forward,
        room.access.identity.id,
      );
      if (!forward || !room.board.sendMany(forward)) return false;
      if (historyEpoch.current !== epoch) {
        historyEpoch.current = epoch;
        undoStack.current = [];
        redoStack.current = [];
      }
      undoStack.current.push({ ...change, forward });
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      setHistoryVersion((value) => value + 1);
      return true;
    },
    [canEdit, room.board, room.access.identity.id, epoch],
  );
  const createObjects = (
    items: WorkspaceObject[],
    strokes: Pick<BoardStroke, 'mode' | 'color' | 'width' | 'points'>[] = [],
  ) => {
    if (!commit(workspaceCreation(items, room.access.identity.id, strokes)))
      return false;
    setSelected(
      items.filter((item) => item.type !== 'connector').map((item) => item.id),
    );
    return true;
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
    if (!canEdit || historyEpoch.current !== epoch) return;
    const change = undoStack.current.pop();
    if (!change) return;
    const trimmed = selectiveWorkspaceChange(
      change,
      change.forward as BoardOperation[],
      room.board.getOperations(),
    );
    const appliedUndo = prepareBoardOperations(
      trimmed.backward,
      room.access.identity.id,
    );
    if (!appliedUndo || !room.board.sendMany(appliedUndo)) {
      undoStack.current.push(change);
      return;
    }
    if (appliedUndo.length)
      redoStack.current.push({ change: trimmed, appliedUndo });
    setHistoryVersion((value) => value + 1);
  };
  const redo = () => {
    if (!canEdit || historyEpoch.current !== epoch) return;
    const entry = redoStack.current.pop();
    if (!entry) return;
    const change = selectiveWorkspaceChange(
      entry.change,
      entry.appliedUndo,
      room.board.getOperations(),
    );
    const replay = prepareBoardOperations(
      workspaceRedo(change),
      room.access.identity.id,
    );
    if (!replay || !room.board.sendMany(replay)) {
      redoStack.current.push(entry);
      return;
    }
    if (replay.length) undoStack.current.push({ ...change, forward: replay });
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
    epoch,
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
