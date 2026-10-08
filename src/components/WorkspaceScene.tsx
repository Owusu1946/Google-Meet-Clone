'use client';
import { indentCode } from '@/lib/code-indent';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type useWorkspace from '@/hooks/useWorkspace';
import {
  connectorEnds,
  OBJECT_TYPES,
  type WorkspaceObject,
  type ObjectType,
} from '@/lib/workspace';
import { textDocument } from '@/lib/workspace-text';
import { peerColor } from '@/lib/workspace-presence';
import { movableSelection, objectsInSelection } from '@/lib/workspace-layout';
import { type BoardOperation, type Point, viewToWorld } from '@/lib/whiteboard';

type Workspace = ReturnType<typeof useWorkspace>;
type Gesture = {
  point: Point;
  originals: WorkspaceObject[];
  resize?: boolean;
  last: number;
  dx: number;
  dy: number;
};
export default function WorkspaceScene({
  workspace: model,
  editRequest,
  tool,
  transform,
  onTool,
}: {
  workspace: Workspace;
  editRequest?: { id: string; revision: number };
  tool: string;
  transform: { scale: number; offset: Point };
  onTool: (tool: 'select') => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | undefined>(undefined);
  const [editing, setEditing] = useState('');
  const selectionDrag = useRef<
    | {
        start: Point;
        end: Point;
        previous: string[];
      }
    | undefined
  >(undefined);
  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    end: Point;
  }>();
  const [text, setText] = useState('');
  const textTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const textPending = useRef<
    { id: string; text: string; operations: BoardOperation[] } | undefined
  >(undefined);
  const [connectFrom, setConnectFrom] = useState('');
  const [resize, setResize] = useState<{
    id: string;
    width: number;
    height: number;
  }>();
  const cursor = useRef<Point | null>(null);
  const presenceAt = useRef(0);
  const announceRef = useRef(() => {});
  announceRef.current = () =>
    model.room.board.announce({
      point: cursor.current,
      selected: model.selected.slice(0, 30),
      editing: editing || null,
    });
  const announce = model.room.board.announce;
  useEffect(() => {
    const timer = setInterval(() => {
      if (cursor.current) announceRef.current();
    }, 2000);
    return () => {
      clearInterval(timer);
      announce({ point: null, selected: [], editing: null });
    };
  }, [announce]);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  useEffect(() => {
    const track = (event: globalThis.PointerEvent) => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        if (cursor.current) {
          cursor.current = null;
          announceRef.current();
        }
        return;
      }
      cursor.current = viewToWorld(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        transformRef.current.scale,
        transformRef.current.offset,
      );
      if (performance.now() - presenceAt.current > 80) {
        presenceAt.current = performance.now();
        announceRef.current();
      }
    };
    window.addEventListener('pointermove', track);
    return () => window.removeEventListener('pointermove', track);
  }, []);
  const objects = model.rendered.filter((item) => item.visible);
  const interactive =
    tool === 'select' ||
    tool === 'connect' ||
    OBJECT_TYPES.includes(tool as ObjectType);
  const world = (event: PointerEvent) => {
    const rect = root.current!.getBoundingClientRect();
    return viewToWorld(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      transform.scale,
      transform.offset,
    );
  };
  const flushText = () => {
    clearTimeout(textTimer.current);
    const pending = textPending.current;
    if (pending) {
      if (!model.canEdit) return false;
      // Clear before enqueuing: send() can request a nested draft flush.
      textPending.current = undefined;
      const changed =
        model.patch(pending.id, { text: pending.text }, pending.operations) ||
        [];
      const merged = [...model.room.board.operations, ...changed];
      textBaseline.current = merged;
      setText(textDocument(pending.id, merged).text);
    }
    return true;
  };
  const textBaseline = useRef<BoardOperation[]>(model.room.board.operations);
  const editTarget = useRef({ objects, canEdit: model.canEdit });
  editTarget.current = { objects, canEdit: model.canEdit };
  useEffect(() => {
    if (!editRequest || !editTarget.current.canEdit) return;
    const item = editTarget.current.objects.find(
      (object) => object.id === editRequest.id,
    );
    if (!item) return;
    if (!flushRef.current()) return;
    setEditing(item.id);
    setText(item.text);
  }, [editRequest]);

  const sharedText = objects.find((item) => item.id === editing)?.text;
  const interactionEpoch = useRef(model.epoch);
  useEffect(() => {
    if (interactionEpoch.current !== model.epoch) {
      interactionEpoch.current = model.epoch;
      selectionDrag.current = undefined;
      setSelectionBox(undefined);
      setConnectFrom('');
    } else if (
      connectFrom &&
      !model.objects.some((item) => item.id === connectFrom && item.visible)
    ) {
      setConnectFrom('');
    }
    if (editing && sharedText === undefined) {
      clearTimeout(textTimer.current);
      textPending.current = undefined;
      setEditing('');
      setText('');
    }
    const current = gesture.current;
    if (
      current &&
      current.originals.some(
        (original) =>
          !model.objects.some(
            (item) => item.id === original.id && item.visible,
          ),
      )
    ) {
      gesture.current = undefined;
      setResize(undefined);
      model.cancelMove();
    }
  }, [editing, sharedText, connectFrom, model]);

  useEffect(() => {
    if (editing && sharedText !== undefined && !textPending.current) {
      setText(sharedText);
      textBaseline.current = model.room.board.operations;
    }
  }, [editing, sharedText, model.room.board.operations]);
  const flushRef = useRef(flushText);
  flushRef.current = flushText;
  const registerDraft = model.room.board.registerDraft;
  useEffect(() => {
    const unregister = registerDraft(() => flushRef.current());
    return () => {
      flushRef.current();
      unregister();
    };
  }, [registerDraft]);
  const connectNode = (item: WorkspaceObject) => {
    if (!model.canEdit || item.type === 'connector') return;
    if (connectFrom && connectFrom !== item.id) {
      model.create('connector', 0, 0, {
        from: connectFrom,
        to: item.id,
        color: '#475569',
      });
      setConnectFrom('');
      onTool('select');
    } else setConnectFrom(item.id);
  };
  const start = (
    event: PointerEvent,
    item: WorkspaceObject,
    resizing = false,
  ) => {
    if (event.button !== 0 || editing === item.id) return;
    event.stopPropagation();
    if (
      OBJECT_TYPES.includes(tool as ObjectType) &&
      tool !== 'connector' &&
      model.canEdit
    ) {
      const point = world(event);
      model.create(tool as ObjectType, point.x, point.y);
      onTool('select');
      return;
    }
    if (tool === 'connect') {
      connectNode(item);
      return;
    }
    if (tool !== 'select') return;
    const selection = event.shiftKey
      ? [...new Set([...model.selected, item.id])]
      : model.selected.includes(item.id)
        ? model.selected
        : [item.id];
    model.setSelected(selection);
    if (!model.canEdit) return;
    root.current!.setPointerCapture(event.pointerId);
    gesture.current = {
      point: world(event),
      originals: resizing ? [item] : movableSelection(selection, objects),
      resize: resizing,
      last: 0,
      dx: 0,
      dy: 0,
    };
  };
  const move = (event: PointerEvent) => {
    cursor.current = world(event);
    if (performance.now() - presenceAt.current > 80) {
      presenceAt.current = performance.now();
      announceRef.current();
    }
    const selecting = selectionDrag.current;
    if (selecting) {
      selecting.end = world(event);
      setSelectionBox({ start: selecting.start, end: selecting.end });
      model.setSelected([
        ...new Set([
          ...selecting.previous,
          ...objectsInSelection(selecting.start, selecting.end, objects),
        ]),
      ]);
      return;
    }
    const current = gesture.current;
    if (!current) return;
    const cursorPoint = world(event);
    current.dx = cursorPoint.x - current.point.x;
    current.dy = cursorPoint.y - current.point.y;
    if (current.resize) {
      const item = current.originals[0];
      setResize({
        id: item.id,
        width: Math.max(80, Math.min(10000, item.width + current.dx)),
        height: Math.max(60, Math.min(10000, item.height + current.dy)),
      });
    } else model.move(current.originals, current.dx, current.dy, false);
    if (performance.now() - current.last > 80) {
      current.last = performance.now();
      current.originals.forEach((item) =>
        model.room.board.previewChange({
          kind: 'object-patch',
          objectId: item.id,
          fields: current.resize
            ? {
                width: Math.max(80, Math.min(10000, item.width + current.dx)),
                height: Math.max(60, Math.min(10000, item.height + current.dy)),
              }
            : {
                x: Math.max(-100000, Math.min(100000, item.x + current.dx)),
                y: Math.max(-100000, Math.min(100000, item.y + current.dy)),
              },
        }),
      );
    }
  };
  const finish = () => {
    selectionDrag.current = undefined;
    setSelectionBox(undefined);
    const current = gesture.current;
    if (!current) return;
    gesture.current = undefined;
    if (Math.abs(current.dx) + Math.abs(current.dy) > 0.5) {
      if (current.resize) {
        const original = current.originals[0];
        model.patch(original.id, {
          width: Math.max(80, Math.min(10000, original.width + current.dx)),
          height: Math.max(60, Math.min(10000, original.height + current.dy)),
        });
      } else model.move(current.originals, current.dx, current.dy, true);
    } else model.cancelMove();
    setResize(undefined);
  };
  const renderEditor = (item: WorkspaceObject) => (
    <textarea
      style={
        item.type === 'connector'
          ? { width: '100%', height: '100%', resize: 'none', outline: 'none' }
          : undefined
      }
      autoFocus
      readOnly={!model.canEdit}
      maxLength={32000}
      aria-label={`Edit ${item.type}`}
      title={
        item.type === 'code'
          ? 'Tab to indent, Shift+Tab to outdent, Escape to save and exit'
          : 'Escape to save and exit'
      }
      value={text}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (flushText()) {
            setEditing('');
            root.current?.focus();
          }
        }
        if (event.key !== 'Tab' || item.type !== 'code' || !model.canEdit)
          return;
        event.preventDefault();
        event.stopPropagation();
        const editor = event.currentTarget;
        const next = indentCode(
          editor.value,
          editor.selectionStart,
          editor.selectionEnd,
          event.shiftKey,
        );
        if (next.text.length > 32000) return;
        setText(next.text);
        textPending.current = {
          id: item.id,
          text: next.text,
          operations: textPending.current?.operations || textBaseline.current,
        };
        clearTimeout(textTimer.current);
        textTimer.current = setTimeout(() => flushRef.current(), 200);
        requestAnimationFrame(() => {
          if (editor.isConnected)
            editor.setSelectionRange(next.start, next.end);
        });
      }}
      onBlur={() => {
        if (flushText()) setEditing('');
      }}
      onChange={(event) => {
        const value = event.target.value;
        if (value.length > 32000) return;
        setText(value);
        textPending.current = {
          id: item.id,
          text: value,
          operations: textPending.current?.operations || textBaseline.current,
        };
        clearTimeout(textTimer.current);
        textTimer.current = setTimeout(() => flushRef.current(), 200);
      }}
    />
  );
  const editedConnector = objects.find(
    (item) => item.id === editing && item.type === 'connector',
  );
  const editedEnds = editedConnector
    ? connectorEnds(editedConnector, objects)
    : null;
  return (
    <div
      ref={root}
      className="workspace-scene"
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || event.button !== 0) return;
        if (!flushText()) return;
        setEditing('');
        if (
          OBJECT_TYPES.includes(tool as ObjectType) &&
          tool !== 'connector' &&
          model.canEdit
        ) {
          const point = world(event);
          model.create(tool as ObjectType, point.x, point.y);
          onTool('select');
        } else {
          if (tool === 'select') {
            const point = world(event);
            selectionDrag.current = {
              start: point,
              end: point,
              previous: event.shiftKey ? model.selected : [],
            };
            setSelectionBox({ start: point, end: point });
            root.current!.setPointerCapture(event.pointerId);
          }
          if (!event.shiftKey) model.setSelected([]);
          setConnectFrom('');
        }
      }}
      onPointerMove={move}
      onPointerLeave={() => {
        if (!gesture.current) {
          cursor.current = null;
          announceRef.current();
        }
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      tabIndex={interactive ? 0 : -1}
      aria-label="Workspace canvas"
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            'textarea,input,select,[contenteditable=true]',
          )
        )
          return;
        if (event.key === 'Escape') {
          if (!flushText()) return;
          setEditing('');
          selectionDrag.current = undefined;
          setSelectionBox(undefined);
          model.setSelected([]);
          setConnectFrom('');
          onTool('select');
        }
        if (!model.canEdit) return;
        const modifier = event.ctrlKey || event.metaKey;
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          model.remove();
        }
        if (modifier && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          model.setSelected(
            objects
              .filter((item) => item.type !== 'connector')
              .map((item) => item.id),
          );
        }
        if (modifier && event.key.toLowerCase() === 'd') {
          event.preventDefault();
          model.duplicate();
        }
        if (modifier && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) model.redo();
          else model.undo();
        }
        if (modifier && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          model.redo();
        }
        const delta: Record<string, Point> = {
          ArrowLeft: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          ArrowUp: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
        };
        if (delta[event.key]) {
          event.preventDefault();
          const amount = event.shiftKey ? 10 : 1;
          model.nudge(delta[event.key].x * amount, delta[event.key].y * amount);
        }
      }}
    >
      <div
        className="workspace-world"
        style={{
          transform: `translate(${transform.offset.x}px, ${transform.offset.y}px) scale(${transform.scale})`,
        }}
      >
        {selectionBox && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 10,
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.end.x - selectionBox.start.x),
              height: Math.abs(selectionBox.end.y - selectionBox.start.y),
              border: `${1 / transform.scale}px solid #1a73e8`,
              background: '#1a73e81a',
            }}
          />
        )}
        {editedConnector && editedEnds && (
          <div
            className="workspace-connector-editor"
            style={{
              position: 'absolute',
              zIndex: 20,
              left: (editedEnds.from.x + editedEnds.to.x) / 2 - 140,
              top: (editedEnds.from.y + editedEnds.to.y) / 2 - 50,
              width: 280,
              height: 100,
              background: 'white',
              border: '2px solid #2563eb',
              borderRadius: 8,
              padding: 8,
              pointerEvents: 'auto',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {renderEditor(editedConnector)}
          </div>
        )}
        <svg className="workspace-connections" aria-label="Connections">
          <defs>
            <marker
              id="workspace-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
            </marker>
          </defs>
          <g>
            {objects
              .filter((item) => item.type === 'connector')
              .map((item) => {
                const ends = connectorEnds(item, objects);
                if (!ends) return null;
                const midX = (ends.from.x + ends.to.x) / 2;
                const path = `M${ends.from.x},${ends.from.y} C${midX},${ends.from.y} ${midX},${ends.to.y} ${ends.to.x},${ends.to.y}`;
                return (
                  <g
                    key={item.id}
                    role="button"
                    tabIndex={interactive && tool === 'select' ? 0 : -1}
                    aria-label={`Connection from ${objects.find((node) => node.id === item.from)?.text || 'Untitled node'} to ${objects.find((node) => node.id === item.to)?.text || 'Untitled node'}`}
                    aria-pressed={model.selected.includes(item.id)}
                    onFocus={(event) => {
                      if (event.currentTarget.matches(':focus-visible'))
                        model.setSelected([item.id]);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'F2' && model.canEdit) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!flushText()) return;
                        setEditing(item.id);
                        setText(item.text);
                        return;
                      }
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        model.setSelected([item.id]);
                      }
                    }}
                    onDoubleClick={(event) => {
                      if (!model.canEdit || tool !== 'select') return;
                      event.stopPropagation();
                      if (!flushText()) return;
                      setEditing(item.id);
                      setText(item.text);
                    }}
                    onPointerDown={(event) => start(event, item)}
                    className={
                      model.selected.includes(item.id) ? 'is-selected' : ''
                    }
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="18"
                      pointerEvents={tool === 'select' ? 'stroke' : 'none'}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={
                        model.selected.includes(item.id)
                          ? '#2563eb'
                          : item.color
                      }
                      strokeWidth="2"
                      markerEnd="url(#workspace-arrow)"
                      pointerEvents="none"
                    />
                    {item.text && (
                      <text
                        x={midX}
                        y={(ends.from.y + ends.to.y) / 2 - 10}
                        textAnchor="middle"
                        fontSize="13"
                        fill="#475569"
                      >
                        {item.text}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        </svg>
        {[...objects]
          .sort(
            (a, b) =>
              Number(b.type === 'frame' || b.type === 'column') -
              Number(a.type === 'frame' || a.type === 'column'),
          )
          .filter((item) => item.type !== 'connector')
          .map((item) => {
            const chosen = model.selected.includes(item.id);
            const dimensions = resize?.id === item.id ? resize : item;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={interactive ? 0 : -1}
                aria-label={`${item.type}: ${item.text || 'Untitled'}`}
                aria-pressed={chosen}
                className={`workspace-object object-${item.type} ${chosen ? 'selected' : ''} ${connectFrom === item.id ? 'connect-source' : ''}`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: dimensions.width,
                  height: dimensions.height,
                  backgroundColor:
                    item.type === 'diamond' ? 'transparent' : item.color,
                  zIndex:
                    item.type === 'frame' || item.type === 'column' ? 0 : 2,
                  fontSize: item.fontSize,
                  pointerEvents: interactive ? 'auto' : 'none',
                }}
                onPointerDown={(event) => start(event, item)}
                onFocus={(event) => {
                  if (
                    event.currentTarget.matches(':focus-visible') &&
                    !model.selected.includes(item.id)
                  )
                    model.setSelected([item.id]);
                }}
                onKeyDown={(event) => {
                  if (
                    tool === 'connect' &&
                    (event.key === 'Enter' || event.key === ' ') &&
                    event.target === event.currentTarget
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    connectNode(item);
                    return;
                  }
                  if (
                    (event.key === 'Enter' || event.key === 'F2') &&
                    model.canEdit &&
                    tool === 'select' &&
                    event.target === event.currentTarget
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!flushText()) return;
                    setEditing(item.id);
                    setText(item.text);
                  }
                }}
                onDoubleClick={(event) => {
                  if (!model.canEdit || tool !== 'select') return;
                  event.stopPropagation();
                  if (!flushText()) return;
                  setEditing(item.id);
                  setText(item.text);
                }}
              >
                {item.type === 'diamond' && (
                  <svg
                    className="workspace-diamond"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polygon
                      points="50,1 99,50 50,99 1,50"
                      fill={item.color}
                      stroke="#94a3b8"
                    />
                  </svg>
                )}
                {editing === item.id ? (
                  renderEditor(item)
                ) : (
                  <span className="workspace-object-text">{item.text}</span>
                )}
                {(item.type === 'frame' || item.type === 'column') && (
                  <span className="workspace-container-label">
                    {item.type === 'column'
                      ? `${objects.filter((child) => child.parentId === item.id).length} cards`
                      : 'Frame'}
                  </span>
                )}
                {chosen && model.canEdit && tool === 'select' && (
                  <button
                    className="workspace-resize"
                    aria-label="Resize selected object"
                    onPointerDown={(event) => start(event, item, true)}
                  />
                )}
              </div>
            );
          })}
      </div>
      {model.room.board.peers.map((peer) => {
        const color = peerColor(peer.userId);
        const point = peer.point;
        return (
          <div
            key={peer.userId}
            className="workspace-peer-layer"
            aria-hidden="true"
          >
            {peer.selected.map((id) => {
              const item = objects.find((object) => object.id === id);
              if (!item || item.type === 'connector') return null;
              return (
                <div
                  key={id}
                  className="workspace-peer-selection"
                  style={{
                    left: item.x * transform.scale + transform.offset.x - 3,
                    top: item.y * transform.scale + transform.offset.y - 3,
                    width: item.width * transform.scale + 6,
                    height: item.height * transform.scale + 6,
                    borderColor: color,
                  }}
                >
                  <span style={{ background: color }}>
                    {peer.name}
                    {peer.editing === id ? ' · writing' : ''}
                  </span>
                </div>
              );
            })}
            {point && (
              <div
                className="workspace-peer-cursor"
                style={{
                  left: point.x * transform.scale + transform.offset.x,
                  top: point.y * transform.scale + transform.offset.y,
                  color,
                }}
              >
                <svg width="16" height="22" viewBox="0 0 16 22">
                  <path
                    d="M1 1v18l5-5 4 7 3-2-4-7h6Z"
                    fill="currentColor"
                    stroke="white"
                  />
                </svg>
                <span style={{ background: color }}>{peer.name}</span>
              </div>
            )}
          </div>
        );
      })}
      {connectFrom && (
        <div className="workspace-hint" role="status">
          Choose another node and click or press Enter to connect · Escape to
          cancel
        </div>
      )}
    </div>
  );
}
