'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';
import { useMeeting } from '@/contexts/MeetProvider';
import { useRoom } from '@/contexts/MeetingRoomContext';
import {
  boardStrokes,
  viewToWorld,
  zoomAt,
  type BoardStroke,
  type Point,
  type StrokeMode,
} from '@/lib/whiteboard';
import Dialog from './Dialog';
import Close from './icons/Close';
import useWorkspace from '@/hooks/useWorkspace';
import WorkspaceScene from './WorkspaceScene';
import { WORKSPACE_TEMPLATES } from '@/lib/workspace-layout';
import { OBJECT_TYPES, type ObjectType } from '@/lib/workspace';

type Tool = StrokeMode | 'pan' | 'select' | 'connect' | ObjectType;
function paint(
  ctx: CanvasRenderingContext2D,
  strokes: BoardStroke[],
  scale: number,
  offset: Point,
) {
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(scale, scale);
  for (const stroke of strokes) {
    if (!stroke.visible || !stroke.points.length) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.width;
    ctx.globalAlpha = stroke.mode === 'highlighter' ? 0.35 : 1;
    ctx.globalCompositeOperation =
      stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    const [first, ...rest] = stroke.points;
    if (!rest.length) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      rest.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export default function SmartWhiteboardOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { access } = useMeeting();
  const { useCallCustomData } = useCallStateHooks();
  const custom = useCallCustomData();
  const { operations, send, loading, error, pending, retry, available } =
    useRoom().board;
  const room = useRoom();
  const canDraw =
    available && !loading && (access.isHost || custom.collaboration !== false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const workspace = useWorkspace();
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#202124');
  const [width, setWidth] = useState(3);
  const [transform, setTransform] = useState({
    scale: 1,
    offset: { x: 0, y: 0 },
  });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [draft, setDraft] = useState<BoardStroke>();
  const active = useRef<BoardStroke | undefined>(undefined);
  const segment = useRef(0);
  const sent = useRef(0);
  const lastFlush = useRef(0);
  const pan = useRef<{ point: Point; offset: Point } | undefined>(undefined);
  const [clearPrompt, setClearPrompt] = useState(false);
  const strokes = useMemo(() => boardStrokes(operations), [operations]);
  const lastOwn = [...strokes]
    .reverse()
    .find((stroke) => stroke.actor === access.identity.id && stroke.visible);
  const lastHidden = [...strokes]
    .reverse()
    .find((stroke) => stroke.actor === access.identity.id && !stroke.visible);
  const visibleStrokes = useMemo(() => {
    if (!draft) return strokes;
    return [...strokes.filter((stroke) => stroke.id !== draft.id), draft];
  }, [strokes, draft]);
  useEffect(() => {
    if (!open || !canvas.current) return;
    const element = canvas.current;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [open]);
  useEffect(() => {
    if (!open || !canvas.current) return;
    const element = canvas.current;
    const frame = requestAnimationFrame(() => {
      const ratio = window.devicePixelRatio || 1;
      element.width = Math.round(size.width * ratio);
      element.height = Math.round(size.height * ratio);
      const ctx = element.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint(ctx, visibleStrokes, transform.scale, transform.offset);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, size, visibleStrokes, transform]);
  const draftFrame = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (draftFrame.current !== undefined)
        cancelAnimationFrame(draftFrame.current);
    },
    [],
  );
  const flushDraft = useCallback(
    (finish: boolean) => {
      const stroke = active.current;
      if (!stroke) return;
      while (sent.current < stroke.points.length) {
        const points = stroke.points.slice(sent.current, sent.current + 80);
        send({
          kind: 'stroke',
          strokeId: stroke.id,
          segment: segment.current++,
          points,
          mode: stroke.mode,
          color: stroke.color,
          width: stroke.width,
        });
        sent.current += points.length;
      }
      if (finish) {
        active.current = undefined;
        setDraft(undefined);
      }
    },
    [send],
  );
  useEffect(() => () => flushDraft(true), [flushDraft]);
  useEffect(() => {
    if (!open) {
      flushDraft(true);
      pan.current = undefined;
    }
  }, [open, flushDraft]);
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => flushDraft(false), 80);
    return () => clearInterval(timer);
  }, [open, flushDraft]);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (
      active.current ||
      pan.current ||
      (event.button !== 0 && event.button !== 1)
    )
      return;
    const position = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'pan' || event.shiftKey || event.button === 1) {
      pan.current = { point: position, offset: transform.offset };
      return;
    }
    if (!canDraw || !['pen', 'highlighter', 'eraser'].includes(tool)) return;
    active.current = {
      id: `${access.identity.id}:${crypto.randomUUID()}`,
      actor: access.identity.id,
      mode: tool as StrokeMode,
      width: Math.min(
        40,
        tool === 'highlighter'
          ? width * 3
          : tool === 'eraser'
            ? width * 4
            : width,
      ),
      color,
      points: [viewToWorld(position, transform.scale, transform.offset)],
      visible: true,
    };
    sent.current = 0;
    segment.current = 0;
    lastFlush.current = performance.now();
    setDraft({ ...active.current });
    flushDraft(false);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const position = point(event);
    if (pan.current) {
      setTransform((current) => ({
        ...current,
        offset: {
          x: pan.current!.offset.x + position.x - pan.current!.point.x,
          y: pan.current!.offset.y + position.y - pan.current!.point.y,
        },
      }));
      return;
    }
    if (!active.current) return;
    const world = viewToWorld(position, transform.scale, transform.offset);
    if (active.current.points.length >= 10000) {
      flushDraft(true);
      return;
    }
    active.current.points.push({
      x: Math.round(world.x * 100) / 100,
      y: Math.round(world.y * 100) / 100,
    });
    if (draftFrame.current === undefined)
      draftFrame.current = requestAnimationFrame(() => {
        draftFrame.current = undefined;
        if (active.current)
          setDraft({ ...active.current, points: [...active.current.points] });
      });
    if (
      performance.now() - lastFlush.current > 80 ||
      active.current.points.length - sent.current >= 80
    ) {
      lastFlush.current = performance.now();
      flushDraft(false);
    }
  };
  const end = () => {
    flushDraft(true);
    pan.current = undefined;
  };
  useEffect(() => {
    const element = canvas.current?.parentElement;
    if (!open || !element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      setTransform((current) => {
        const scale = Math.max(
          0.25,
          Math.min(4, current.scale * Math.exp(-event.deltaY * 0.001)),
        );
        return {
          scale,
          offset: zoomAt(cursor, current.scale, scale, current.offset),
        };
      });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [open]);
  const exportBoard = () => {
    const points = strokes
      .filter((stroke) => stroke.visible)
      .flatMap((stroke) => stroke.points);
    const bounds = points.reduce(
      (value, point) => ({
        minX: Math.min(value.minX, point.x),
        minY: Math.min(value.minY, point.y),
        maxX: Math.max(value.maxX, point.x),
        maxY: Math.max(value.maxY, point.y),
      }),
      { minX: 0, minY: 0, maxX: 900, maxY: 600 },
    );
    const { minX, minY, maxX, maxY } = {
      minX: bounds.minX - 30,
      minY: bounds.minY - 30,
      maxX: bounds.maxX + 30,
      maxY: bounds.maxY + 30,
    };
    const factor = Math.min(1, 4096 / (maxX - minX), 4096 / (maxY - minY));
    const drawing = document.createElement('canvas');
    drawing.width = Math.ceil((maxX - minX) * factor);
    drawing.height = Math.ceil((maxY - minY) * factor);
    const ctx = drawing.getContext('2d');
    if (!ctx) return;
    paint(ctx, strokes, factor, { x: -minX * factor, y: -minY * factor });
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawing.width, drawing.height);
    drawing.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `whiteboard-${access.meetingId}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };
  if (!open) return null;
  return (
    <section className="whiteboard" aria-label="Shared whiteboard">
      <header className="p-3 flex flex-wrap gap-2 items-center bg-white border-b border-hairline-gray">
        <span className="text-sm font-medium mr-2">Whiteboard</span>
        {(
          ['select', 'pen', 'highlighter', 'eraser', 'pan', 'connect'] as const
        ).map((value) => (
          <button
            key={value}
            aria-pressed={tool === value}
            disabled={value !== 'pan' && !canDraw}
            className={`board-tool ${tool === value ? 'bg-blue-50 text-primary' : ''}`}
            onClick={() => setTool(value)}
          >
            {value === 'pan' ? 'Move' : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
        <select
          className="board-tool"
          aria-label="Add to workspace"
          value={OBJECT_TYPES.includes(tool as ObjectType) ? tool : ''}
          disabled={!canDraw}
          onChange={(event) => setTool(event.target.value as Tool)}
        >
          <option value="" disabled>
            Add object�
          </option>
          {OBJECT_TYPES.filter((value) => value !== 'connector').map(
            (value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ),
          )}
        </select>
        <select
          className="board-tool"
          aria-label="Insert workspace template"
          value=""
          disabled={!canDraw}
          onChange={(event) => {
            const name = WORKSPACE_TEMPLATES.find(
              (value) => value === event.target.value,
            );
            if (name) {
              const point = viewToWorld(
                { x: 40, y: 40 },
                transform.scale,
                transform.offset,
              );
              workspace.template(name, point.x, point.y);
              setTool('select');
            }
          }}
        >
          <option value="" disabled>
            Templates�
          </option>
          {WORKSPACE_TEMPLATES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <input
          aria-label="Drawing color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="w-8 h-8"
          disabled={!canDraw}
        />
        <label className="flex items-center gap-2 text-xs">
          Size
          <input
            aria-label="Brush size"
            type="range"
            min={1}
            max={12}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            className="w-20"
            disabled={!canDraw}
          />
        </label>
        <button
          className="board-tool"
          disabled={
            !canDraw || (tool === 'select' ? !workspace.canUndo : !lastOwn)
          }
          onClick={() =>
            tool === 'select'
              ? workspace.undo()
              : lastOwn &&
                send({
                  kind: 'visibility',
                  strokeId: lastOwn.id,
                  visible: false,
                })
          }
        >
          Undo
        </button>
        <button
          className="board-tool"
          disabled={
            !canDraw || (tool === 'select' ? !workspace.canRedo : !lastHidden)
          }
          onClick={() =>
            tool === 'select'
              ? workspace.redo()
              : lastHidden &&
                send({
                  kind: 'visibility',
                  strokeId: lastHidden.id,
                  visible: true,
                })
          }
        >
          Redo
        </button>
        {access.isHost && (
          <button className="board-tool" onClick={() => setClearPrompt(true)}>
            Clear
          </button>
        )}
        <button className="board-tool" onClick={exportBoard}>
          Export
        </button>
        <button
          className="board-tool"
          onClick={() => setTransform({ scale: 1, offset: { x: 0, y: 0 } })}
        >
          {Math.round(transform.scale * 100)}% · Reset
        </button>
        {(!custom.boardPresenting || access.isHost) && (
          <button
            disabled={room.busy}
            aria-label={
              custom.boardPresenting
                ? 'Stop presenting whiteboard for everyone'
                : 'Close whiteboard'
            }
            onClick={onClose}
            className="ml-auto p-2 rounded-full hover:bg-light-gray"
          >
            {custom.boardPresenting ? 'Stop presenting' : <Close />}
          </button>
        )}
      </header>
      {workspace.selected.length > 0 && (
        <div className="workspace-contextbar">
          <span>{workspace.selected.length} selected</span>
          <button
            className="board-tool"
            disabled={!canDraw}
            onClick={workspace.duplicate}
          >
            Duplicate
          </button>
          <button
            className="board-tool"
            disabled={!canDraw}
            onClick={workspace.remove}
          >
            Delete
          </button>
          <label>
            Fill{' '}
            <input
              aria-label="Selected object color"
              type="color"
              disabled={!canDraw}
              value={
                workspace.objects.find(
                  (item) => item.id === workspace.selected[0],
                )?.color || '#ffffff'
              }
              onChange={(event) =>
                workspace.selected.forEach((id) =>
                  workspace.patch(id, { color: event.target.value }),
                )
              }
            />
          </label>
          <label>
            Text size{' '}
            <select
              aria-label="Selected text size"
              disabled={!canDraw}
              value={
                workspace.objects.find(
                  (item) => item.id === workspace.selected[0],
                )?.fontSize || 18
              }
              onChange={(event) =>
                workspace.selected.forEach((id) =>
                  workspace.patch(id, { fontSize: Number(event.target.value) }),
                )
              }
            >
              {[12, 14, 18, 24, 32, 48, 64].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <span>Double-click to edit � Shift-click to select more</span>
        </div>
      )}
      <div className="flex-1 min-h-0 relative workspace-viewport">
        <canvas
          ref={canvas}
          className="absolute inset-0 w-full h-full touch-none"
          style={{
            cursor: tool === 'pan' ? 'grab' : canDraw ? 'crosshair' : 'default',
            pointerEvents: ['pen', 'highlighter', 'eraser', 'pan'].includes(
              tool,
            )
              ? 'auto'
              : 'none',
            zIndex: ['pen', 'highlighter', 'eraser'].includes(tool) ? 3 : 0,
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        />
        <WorkspaceScene
          workspace={workspace}
          tool={tool}
          transform={transform}
          onTool={setTool}
        />
      </div>
      <footer className="px-4 py-2 text-xs bg-light-gray flex justify-between gap-3">
        <span>
          {loading
            ? 'Loading shared board…'
            : !canDraw
              ? 'Only the host can draw'
              : 'Draw with mouse, touch, or pen. Shift-drag to move. Ctrl/⌘-scroll to zoom.'}
        </span>
        <span role="status">
          {error ? (
            <button className="text-meet-red underline" onClick={retry}>
              {error} · Retry
            </button>
          ) : pending ? (
            `Syncing ${pending} edits…`
          ) : (
            'All edits saved'
          )}
        </span>
      </footer>
      <Dialog
        open={clearPrompt}
        onClose={() => setClearPrompt(false)}
        title="Clear the shared board?"
      >
        <p>This removes everyone’s drawings from the board.</p>
        <button
          className="primary-button mt-5"
          onClick={() => {
            send({ kind: 'clear' });
            setClearPrompt(false);
          }}
        >
          Clear for everyone
        </button>
      </Dialog>
    </section>
  );
}
