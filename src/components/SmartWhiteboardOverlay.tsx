'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { type Channel as ChannelType } from 'stream-chat';
import { DefaultStreamChatGenerics } from 'stream-chat-react';

// Types for network events over Stream Chat. Namespaced to avoid collisions.
// All coordinates are in world-space (pre-transform) so pan/zoom is purely client-side.

type StrokeMode = 'pen' | 'highlighter' | 'eraser';

type Point = { x: number; y: number };

type DrawEvent = {
  type: 'wb_draw';
  strokeId: string;
  userId?: string | null;
  mode: StrokeMode;
  color: string;
  width: number;
  points: Point[]; // appended points (incremental)
};

type ClearEvent = { type: 'wb_clear'; userId?: string | null };

type CursorEvent = { type: 'wb_cursor'; userId?: string | null; x: number; y: number };

type SnapshotRequestEvent = { type: 'wb_snapshot_request'; userId?: string | null };

type SnapshotResponseEvent = { type: 'wb_snapshot_response'; dataUrl: string; userId?: string | null };

type PresentStart = { type: 'wb_present_start'; video_user_id?: string | null };

type PresentStop = { type: 'wb_present_stop'; video_user_id?: string | null };

export type WBEvent =
  | DrawEvent
  | ClearEvent
  | CursorEvent
  | SnapshotRequestEvent
  | SnapshotResponseEvent
  | PresentStart
  | PresentStop;

// In-memory stroke model
interface StrokeModel {
  id: string;
  userId?: string | null;
  mode: StrokeMode;
  color: string;
  width: number;
  points: Point[]; // world coords
}

interface SmartWhiteboardOverlayProps {
  open: boolean;
  onClose: () => void;
  chatChannel?: ChannelType<DefaultStreamChatGenerics>;
  meId?: string | null;
  isPresenter?: boolean; // presenter can force-push snapshots, optional
  allowCollaboration?: boolean; // if true, everyone can draw; otherwise only presenter
}

const SmartWhiteboardOverlay = ({
  open,
  onClose,
  chatChannel,
  meId = null,
  isPresenter = false,
  allowCollaboration = true,
}: SmartWhiteboardOverlayProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // View transform
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });

  // Tools
  const [tool, setTool] = useState<StrokeMode>('pen');
  const [color, setColor] = useState('#22c55e'); // emerald-500
  const [width, setWidth] = useState(3);

  // Strokes & history
  const strokes = useRef<Map<string, StrokeModel>>(new Map());
  const drawOrder = useRef<string[]>([]);
  const undone = useRef<string[]>([]);

  // Local drawing state
  const activeStrokeId = useRef<string | null>(null);
  const isDrawing = useRef(false);

  // Remote cursors
  const cursors = useRef<Map<string, { x: number; y: number; ts: number }>>(new Map());

  // Helpers
  const devicePixelRatioSafe = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const canDraw = allowCollaboration || isPresenter;

  const worldToView = useCallback(
    (p: Point): Point => ({ x: p.x * scale + offset.x, y: p.y * scale + offset.y }),
    [scale, offset]
  );
  const viewToWorld = useCallback(
    (p: Point): Point => ({ x: (p.x - offset.x) / scale, y: (p.y - offset.y) / scale }),
    [scale, offset]
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width * devicePixelRatioSafe);
    const h = Math.floor(rect.height * devicePixelRatioSafe);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(devicePixelRatioSafe, 0, 0, devicePixelRatioSafe, 0, 0);
      redraw();
    }
  }, [devicePixelRatioSafe]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawStroke = useCallback(
    (s: StrokeModel) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || s.points.length < 1) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // tool modes
      if (s.mode === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'source-over';
      } else if (s.mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * scale; // scale line width by zoom for visual consistency

      ctx.beginPath();
      const first = worldToView(s.points[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < s.points.length; i++) {
        const p = worldToView(s.points[i]);
        const prev = worldToView(s.points[i - 1]);
        // simple smoothing via quadratic curve
        const cx = (prev.x + p.x) / 2;
        const cy = (prev.y + p.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    },
    [scale, worldToView]
  );

  const redraw = useCallback(() => {
    clearCanvas();
    const order = drawOrder.current;
    const map = strokes.current;
    for (let i = 0; i < order.length; i++) {
      const s = map.get(order[i]);
      if (s) drawStroke(s);
    }
  }, [clearCanvas, drawStroke]);

  useEffect(() => {
    if (!open) return;
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, resizeCanvas]);

  // Wheel zoom/pan
  useEffect(() => {
    if (!open) return;
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = Math.exp(delta * 0.0015);
        const rect = el.getBoundingClientRect();
        const mouse: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const before = viewToWorld(mouse);
        setScale((s) => Math.min(4, Math.max(0.25, s * factor)));
        // Recenter so the zoom focuses around cursor
        requestAnimationFrame(() => {
          const after = viewToWorld(mouse);
          setOffset((o) => ({ x: o.x + (after.x - before.x) * scale, y: o.y + (after.y - before.y) * scale }));
          redraw();
        });
        return;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as any);
  }, [open, viewToWorld, scale, redraw]);

  // Pointer interactions
  const pointerToWorld = useCallback(
    (ev: PointerEvent): Point => {
      const el = overlayRef.current;
      const rect = el?.getBoundingClientRect();
      const view: Point = { x: ev.clientX - (rect?.left || 0), y: ev.clientY - (rect?.top || 0) };
      return viewToWorld(view);
    },
    [viewToWorld]
  );

  const beginStroke = useCallback(
    (pt: Point) => {
      const id = `${meId || 'anon'}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
      const s: StrokeModel = { id, userId: meId, mode: tool, color, width, points: [pt] };
      strokes.current.set(id, s);
      drawOrder.current.push(id);
      undone.current = [];
      activeStrokeId.current = id;
      isDrawing.current = true;
      drawStroke(s);
      if (chatChannel) {
        const payload: DrawEvent = {
          type: 'wb_draw',
          strokeId: id,
          userId: meId,
          mode: tool,
          color,
          width,
          points: [pt],
        };
        chatChannel.sendEvent(payload as any).catch(() => void 0);
      }
    },
    [chatChannel, color, drawStroke, meId, tool, width]
  );

  const appendPoint = useCallback(
    (pt: Point) => {
      const id = activeStrokeId.current;
      if (!id) return;
      const s = strokes.current.get(id);
      if (!s) return;
      s.points.push(pt);
      drawStroke(s);
      if (chatChannel) {
        const payload: DrawEvent = {
          type: 'wb_draw',
          strokeId: id,
          userId: meId,
          mode: s.mode,
          color: s.color,
          width: s.width,
          points: [pt],
        };
        chatChannel.sendEvent(payload as any).catch(() => void 0);
      }
    },
    [chatChannel, drawStroke, meId]
  );

  const endStroke = useCallback(() => {
    activeStrokeId.current = null;
    isDrawing.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = overlayRef.current;
    if (!el) return;

    const onPointerDown = (ev: PointerEvent) => {
      if (!canDraw) return;
      if (ev.button === 1 || (ev.button === 0 && ev.shiftKey)) {
        // middle-click or Shift+drag pans
        panning.current = true;
        panStart.current = { x: ev.clientX, y: ev.clientY };
        panOffsetStart.current = { ...offset };
        return;
      }
      if (ev.button !== 0) return;
      (ev.target as Element).setPointerCapture(ev.pointerId);
      const pt = pointerToWorld(ev);
      beginStroke(pt);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (panning.current) {
        const dx = ev.clientX - panStart.current.x;
        const dy = ev.clientY - panStart.current.y;
        setOffset({ x: panOffsetStart.current.x + dx, y: panOffsetStart.current.y + dy });
        redraw();
        return;
      }
      if (!isDrawing.current) return;
      appendPoint(pointerToWorld(ev));
    };

    const onPointerUp = () => {
      if (panning.current) {
        panning.current = false;
        return;
      }
      endStroke();
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [open, canDraw, offset, redraw, appendPoint, beginStroke, endStroke, pointerToWorld]);

  // Network receive
  useEffect(() => {
    if (!open || !chatChannel) return;
    const handler = (e: any) => {
      const evt = e as WBEvent;
      if (evt.type === 'wb_draw') {
        const d = evt as DrawEvent;
        let s = strokes.current.get(d.strokeId);
        if (!s) {
          s = { id: d.strokeId, userId: d.userId, mode: d.mode, color: d.color, width: d.width, points: [] };
          strokes.current.set(d.strokeId, s);
          drawOrder.current.push(d.strokeId);
        }
        s.points.push(...d.points);
        drawStroke(s);
      } else if (evt.type === 'wb_clear') {
        strokes.current.clear();
        drawOrder.current = [];
        undone.current = [];
        redraw();
      } else if (evt.type === 'wb_snapshot_request') {
        if (!canvasRef.current) return;
        try {
          const url = canvasRef.current.toDataURL('image/png');
          const payload: SnapshotResponseEvent = { type: 'wb_snapshot_response', dataUrl: url, userId: meId };
          chatChannel.sendEvent(payload as any);
        } catch {}
      } else if (evt.type === 'wb_snapshot_response') {
        // no-op by default; parent could listen on chatChannel externally
      }
    };
    chatChannel.on(handler);
    return () => chatChannel.off(handler);
  }, [open, chatChannel, drawStroke, meId, redraw]);

  // Controls
  const clearBoard = () => {
    strokes.current.clear();
    drawOrder.current = [];
    undone.current = [];
    redraw();
    chatChannel?.sendEvent({ type: 'wb_clear', userId: meId } as any).catch(() => void 0);
  };

  const undo = () => {
    const id = drawOrder.current.pop();
    if (!id) return;
    undone.current.push(id);
    redraw();
  };

  const redo = () => {
    const id = undone.current.pop();
    if (!id) return;
    drawOrder.current.push(id);
    redraw();
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
  };

  // Simple in-file icons to avoid external deps
  const IconBrush = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 16c.55 0 1 .45 1 1 0 2.21-1.79 4-4 4-.55 0-1-.45-1-1 0-2.21 1.79-4 4-4zm13.71-12.29a.996.996 0 0 0-1.41 0l-7.34 7.34c-.2.2-.33.45-.38.73l-.3 1.52c-.06.33.22.61.55.55l1.52-.3c.28-.05.53-.18.73-.38l7.34-7.34c.39-.39.39-1.02-.01-1.41z"/></svg>
  );
  const IconHighlighter = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 16l5-5 5 5-5 5H3v-5zm13.5-13c-.28 0-.5.22-.5.5v5l1-1 1 1v-5c0-.28-.22-.5-.5-.5h-1z"/></svg>
  );
  const IconEraser = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.24 3.56a3 3 0 0 1 4.24 4.24l-9.19 9.19H7.05l-4.24-4.24 9.43-9.19zM3.53 14.12l3.54 3.54H2v-2h1.53z"/></svg>
  );
  const IconUndo = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6H6v2h6a8 8 0 0 0 0-16z"/></svg>);
  const IconRedo = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6a6 6 0 0 0 6 6h6v2h-6a8 8 0 0 1 0-16z"/></svg>);
  const IconClear = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 2H8l1-2z"/></svg>);
  const IconDownload = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zm7-18l-5 5h3v6h4V7h3l-5-5z"/></svg>);
  const IconClose = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>);

  if (!open) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Board */}
      <div ref={overlayRef} className="absolute inset-6 rounded-xl bg-white shadow-xl overflow-hidden select-none">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Toolbar */}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-[rgba(32,33,36,0.75)] text-white rounded-full p-2 backdrop-blur-md">
          <button
            className={clsx('w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10', tool === 'pen' && 'bg-white/10')}
            title="Pen"
            onClick={() => setTool('pen')}
          >
            <IconBrush />
          </button>
          <button
            className={clsx('w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10', tool === 'highlighter' && 'bg-white/10')}
            title="Highlighter"
            onClick={() => setTool('highlighter')}
          >
            <IconHighlighter />
          </button>
          <button
            className={clsx('w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10', tool === 'eraser' && 'bg-white/10')}
            title="Eraser"
            onClick={() => setTool('eraser')}
          >
            <IconEraser />
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-9 h-9 rounded-full overflow-hidden cursor-pointer border border-white/10 bg-white/10"
            title="Color"
          />
          <input
            type="range"
            min={1}
            max={16}
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value))}
            className="w-28 accent-white"
            title="Size"
          />

          <div className="w-px h-6 bg-white/20 mx-1" />
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10" onClick={undo} title="Undo">
            <IconUndo />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10" onClick={redo} title="Redo">
            <IconRedo />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10" onClick={clearBoard} title="Clear">
            <IconClear />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10" onClick={exportPNG} title="Export PNG">
            <IconDownload />
          </button>
        </div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/10 bg-[rgba(32,33,36,0.75)]"
          title="Close whiteboard"
        >
          <IconClose />
        </button>

        {/* Hint */}
        <div className="absolute bottom-3 left-3 text-[11px] text-black/60 bg-white/80 rounded-full px-3 py-1">
          Shift+Drag or Middle-click to Pan · Ctrl+Wheel to Zoom
        </div>
      </div>
    </div>
  );
};

export default SmartWhiteboardOverlay;
