'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type useWorkspace from '@/hooks/useWorkspace';
import {
  connectorEnds,
  OBJECT_TYPES,
  type WorkspaceObject,
  type ObjectType,
} from '@/lib/workspace';
import { frameDescendants } from '@/lib/workspace-layout';
import { type Point, viewToWorld } from '@/lib/whiteboard';

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
  tool,
  transform,
  onTool,
}: {
  workspace: Workspace;
  tool: string;
  transform: { scale: number; offset: Point };
  onTool: (tool: 'select') => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | undefined>(undefined);
  const [editing, setEditing] = useState('');
  const [text, setText] = useState('');
  const textTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const textPending = useRef<{ id: string; text: string } | undefined>(
    undefined,
  );
  const [connectFrom, setConnectFrom] = useState('');
  const [resize, setResize] = useState<{
    id: string;
    width: number;
    height: number;
  }>();
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
    if (pending) model.patch(pending.id, { text: pending.text });
    textPending.current = undefined;
  };
  const flushRef = useRef(flushText);
  flushRef.current = flushText;
  useEffect(() => () => flushRef.current(), []);
  const start = (
    event: PointerEvent,
    item: WorkspaceObject,
    resizing = false,
  ) => {
    if (event.button !== 0 || editing === item.id) return;
    event.stopPropagation();
    if (tool === 'connect') {
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
    const movingIds = new Set(
      selection.flatMap((id) =>
        frameDescendants(id, objects).map((child) => child.id),
      ),
    );
    gesture.current = {
      point: world(event),
      originals: resizing
        ? [item]
        : objects.filter(
            (child) => movingIds.has(child.id) && child.type !== 'connector',
          ),
      resize: resizing,
      last: 0,
      dx: 0,
      dy: 0,
    };
  };
  const move = (event: PointerEvent) => {
    const current = gesture.current;
    if (!current) return;
    const cursor = world(event);
    current.dx = cursor.x - current.point.x;
    current.dy = cursor.y - current.point.y;
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
    const current = gesture.current;
    if (!current) return;
    gesture.current = undefined;
    if (Math.abs(current.dx) + Math.abs(current.dy) > 0.5) {
      if (current.resize && resize)
        model.patch(resize.id, { width: resize.width, height: resize.height });
      else model.move(current.originals, current.dx, current.dy, true);
    } else model.move(current.originals, 0, 0, true);
    setResize(undefined);
  };
  return (
    <div
      ref={root}
      className="workspace-scene"
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || event.button !== 0) return;
        flushText();
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
          model.setSelected([]);
          setConnectFrom('');
        }
      }}
      onPointerMove={move}
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
          flushText();
          setEditing('');
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
          model.move(
            objects.filter((item) => model.selected.includes(item.id)),
            delta[event.key].x * amount,
            delta[event.key].y * amount,
            true,
          );
        }
      }}
    >
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
        <g
          transform={`translate(${transform.offset.x} ${transform.offset.y}) scale(${transform.scale})`}
        >
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
                      model.selected.includes(item.id) ? '#2563eb' : item.color
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
      <div
        className="workspace-world"
        style={{
          transform: `translate(${transform.offset.x}px, ${transform.offset.y}px) scale(${transform.scale})`,
        }}
      >
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
                  backgroundColor: item.color,
                  fontSize: item.fontSize,
                  pointerEvents: interactive ? 'auto' : 'none',
                }}
                onPointerDown={(event) => start(event, item)}
                onFocus={() => {
                  if (!model.selected.includes(item.id))
                    model.setSelected([item.id]);
                }}
                onDoubleClick={(event) => {
                  if (!model.canEdit || tool !== 'select') return;
                  event.stopPropagation();
                  flushText();
                  setEditing(item.id);
                  setText(item.text);
                }}
              >
                {editing === item.id ? (
                  <textarea
                    autoFocus
                    maxLength={1600}
                    aria-label={`Edit ${item.type}`}
                    value={text}
                    onPointerDown={(event) => event.stopPropagation()}
                    onBlur={() => {
                      flushText();
                      setEditing('');
                    }}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (new TextEncoder().encode(value).length > 2400) return;
                      setText(value);
                      textPending.current = { id: item.id, text: value };
                      clearTimeout(textTimer.current);
                      textTimer.current = setTimeout(flushText, 200);
                    }}
                  />
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
      {connectFrom && (
        <div className="workspace-hint" role="status">
          Choose another node to connect · Escape to cancel
        </div>
      )}
    </div>
  );
}
