import {
  workspaceObjects,
  connectorEnds,
  objectFields,
  textSeed,
  validFields,
  OBJECT_TYPES,
  type WorkspaceObject,
  type ObjectType,
  type ObjectFields,
} from './workspace';
import {
  boardStrokes,
  type BoardOperation,
  type BoardStroke,
} from './whiteboard';
import { kanbanLayout } from './workspace-layout';

export function captureWorkspace(source: {
  flushDrafts: () => boolean;
  getOperations: () => BoardOperation[];
}) {
  if (!source.flushDrafts())
    throw new Error(
      'Your latest changes could not be saved. Try exporting again.',
    );
  const operations = source.getOperations();
  const objects = workspaceObjects(operations);
  return {
    objects,
    layout: kanbanLayout(objects),
    strokes: boardStrokes(operations),
  };
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
export function workspaceBounds(
  objects: WorkspaceObject[],
  strokes: BoardStroke[],
) {
  const points = objects
    .filter((item) => item.visible && item.type !== 'connector')
    .flatMap((item) => [
      { x: item.x, y: item.y },
      { x: item.x + item.width, y: item.y + item.height },
    ])
    .concat(
      strokes.filter((item) => item.visible).flatMap((item) => item.points),
    );
  if (!points.length) return { x: 0, y: 0, width: 900, height: 600 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX - 40,
    y: minY - 40,
    width: maxX - minX + 80,
    height: maxY - minY + 80,
  };
}
function textSvg(item: WorkspaceObject) {
  const limit = Math.max(
    4,
    Math.floor((item.width - 32) / (item.fontSize * 0.6)),
  );
  const lines = item.text
    .split('\n')
    .flatMap((line) => line.match(new RegExp(`.{1,${limit}}`, 'gu')) || ['']);
  const maxLines = Math.floor((item.height - 24) / (item.fontSize * 1.35));
  return `<text fill="#1e293b" font-size="${item.fontSize}" font-family="${item.type === 'code' ? 'monospace' : 'sans-serif'}">${lines
    .slice(0, maxLines)
    .map(
      (line, i) =>
        `<tspan x="${item.x + 16}" y="${item.y + 24 + i * item.fontSize * 1.35}">${escape(line)}</tspan>`,
    )
    .join('')}</text>`;
}
export function workspaceSvg(
  objects: WorkspaceObject[],
  strokes: BoardStroke[],
) {
  const bounds = workspaceBounds(objects, strokes);
  const visible = objects.filter((item) => item.visible);
  const shape = (item: WorkspaceObject) => {
    const { x, y, width, height } = item;
    const fill = escape(item.color);
    if (item.type === 'text') return textSvg(item);
    const figure =
      item.type === 'ellipse'
        ? `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="#94a3b8"/>`
        : item.type === 'diamond'
          ? `<polygon points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}" fill="${fill}" stroke="#94a3b8"/>`
          : `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${item.type === 'note' ? 2 : 12}" fill="${fill}" stroke="#94a3b8"/>`;
    return figure + textSvg(item);
  };
  const containers = visible
    .filter((item) => item.type === 'frame' || item.type === 'column')
    .map(shape)
    .join('');
  const connections = visible
    .filter((item) => item.type === 'connector')
    .map((item) => {
      const ends = connectorEnds(item, visible);
      if (!ends) return '';
      return `<line x1="${ends.from.x}" y1="${ends.from.y}" x2="${ends.to.x}" y2="${ends.to.y}" stroke="${escape(item.color)}" stroke-width="2" marker-end="url(#arrow)"/>`;
    })
    .join('');
  const nodes = visible
    .filter((item) => !['frame', 'column', 'connector'].includes(item.type))
    .map(shape)
    .join('');
  let ink = '';
  let masks = '';
  for (const [index, stroke] of strokes
    .filter((item) => item.visible && item.points.length)
    .entries()) {
    const path =
      stroke.points.length === 1
        ? `<circle cx="${stroke.points[0].x}" cy="${stroke.points[0].y}" r="${stroke.width / 2}" fill="${stroke.mode === 'eraser' ? 'black' : stroke.color}"/>`
        : `<polyline points="${stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="${stroke.mode === 'eraser' ? 'black' : stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.mode === 'highlighter' ? 0.35 : 1}"/>`;
    if (stroke.mode === 'eraser') {
      masks += `<mask id="erase-${index}" maskUnits="userSpaceOnUse" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="white"/>${path}</mask>`;
      ink = `<g mask="url(#erase-${index})">${ink}</g>`;
    } else ink += path;
  }
  const scale = Math.min(1, 4096 / Math.max(bounds.width, bounds.height));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width * scale)}" height="${Math.ceil(bounds.height * scale)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"><defs><marker id="arrow" markerWidth="10" markerHeight="6" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3z" fill="#64748b"/></marker>${masks}</defs><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="white"/>${containers}${connections}${nodes}${ink}</svg>`;
}
export function workspaceSnapshot(
  objects: WorkspaceObject[],
  strokes: BoardStroke[],
) {
  return JSON.stringify({
    version: 2,
    objects: objects
      .filter((item) => item.visible)
      .map((item) => ({
        id: item.id,
        type: item.type,
        fields: { ...objectFields(item), text: textSeed(item.text) },
        content: item.text,
      })),
    strokes: strokes
      .filter((item) => item.visible)
      .map(({ mode, color, width, points }) => ({
        mode,
        color,
        width,
        points,
      })),
  });
}
export function parseWorkspaceSnapshot(
  input: string,
  actor: string,
): {
  objects: WorkspaceObject[];
  strokes: Omit<BoardStroke, 'id' | 'actor' | 'visible'>[];
} {
  if (new TextEncoder().encode(input).length > 2_000_000)
    throw new Error('Workspace files must be under 2 MB.');
  const value = JSON.parse(input);
  if (
    !value ||
    ![1, 2].includes(value.version) ||
    !Array.isArray(value.objects) ||
    !Array.isArray(value.strokes) ||
    value.objects.length > 500 ||
    value.strokes.length > 500
  )
    throw new Error('Invalid workspace file.');
  const ids = new Map<string, string>();
  for (const item of value.objects) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      ids.has(item.id) ||
      !OBJECT_TYPES.includes(item.type) ||
      !validFields(item.fields, true) ||
      (item.content !== undefined &&
        (typeof item.content !== 'string' || item.content.length > 100000))
    )
      throw new Error('Invalid workspace object.');
    ids.set(item.id, `${actor}:${crypto.randomUUID()}`);
  }
  let points = 0;
  for (const stroke of value.strokes) {
    if (
      !stroke ||
      !['pen', 'highlighter', 'eraser'].includes(stroke.mode) ||
      !/^#[a-f0-9]{6}$/i.test(stroke.color) ||
      !Number.isFinite(stroke.width) ||
      stroke.width < 1 ||
      stroke.width > 40 ||
      !Array.isArray(stroke.points) ||
      stroke.points.length > 10000 ||
      !stroke.points.every(
        (point: { x: number; y: number }) =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          Math.abs(point.x) <= 100000 &&
          Math.abs(point.y) <= 100000,
      )
    )
      throw new Error('Invalid workspace drawing.');
    points += stroke.points.length;
  }
  if (points > 100000)
    throw new Error('Workspace contains too many drawing points.');
  return {
    objects: value.objects.map(
      (item: {
        id: string;
        type: ObjectType;
        fields: ObjectFields;
        content?: string;
      }) => ({
        ...item.fields,
        text: item.content ?? item.fields.text,
        id: ids.get(item.id)!,
        actor,
        type: item.type,
        visible: true,
        parentId: ids.get(item.fields.parentId || '') || null,
        from: ids.get(item.fields.from || '') || null,
        to: ids.get(item.fields.to || '') || null,
      }),
    ),
    strokes: value.strokes,
  };
}
