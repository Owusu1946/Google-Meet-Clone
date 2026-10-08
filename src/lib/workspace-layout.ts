import {
  newObject,
  type ObjectFields,
  type ObjectType,
  type WorkspaceObject,
} from './workspace';
export type TemplateName =
  'Kanban' | 'Brainstorm' | 'User journey' | 'Architecture' | 'Writing outline';
export const WORKSPACE_TEMPLATES: TemplateName[] = [
  'Kanban',
  'Brainstorm',
  'User journey',
  'Architecture',
  'Writing outline',
];
export function workspaceTemplate(
  name: TemplateName,
  actor: string,
  x: number,
  y: number,
): WorkspaceObject[] {
  const objects: WorkspaceObject[] = [];
  const add = (
    type: ObjectType,
    dx: number,
    dy: number,
    fields: Partial<ObjectFields> = {},
  ) => {
    const object: WorkspaceObject = {
      ...newObject(type, x + dx, y + dy),
      ...fields,
      id: `${actor}:${crypto.randomUUID()}`,
      actor,
      type,
      visible: true,
    };
    objects.push(object);
    return object;
  };
  const connect = (from: WorkspaceObject, to: WorkspaceObject, text = '') =>
    add('connector', 0, 0, {
      from: from.id,
      to: to.id,
      text,
      color: '#64748b',
    });
  if (name === 'Kanban') {
    ['To do', 'In progress', 'Done'].forEach((text, i) => {
      const column = add('column', i * 310, 0, {
        text,
        color: ['#eef2ff', '#fff7ed', '#ecfdf5'][i],
      });
      add('card', i * 310 + 20, 70, {
        text: [
          'Define the problem\nAgree on success criteria',
          'Build together\nShare progress here',
          'Celebrate a milestone',
        ][i],
        width: 240,
        height: 150,
        parentId: column.id,
      });
    });
  } else if (name === 'Brainstorm') {
    const frame = add('frame', 0, 0, {
      text: 'Ideas worth exploring',
      width: 820,
      height: 500,
    });
    [
      'What is the problem?',
      'Who is it for?',
      'What could we try?',
      'What would success look like?',
    ].forEach((text, i) =>
      add('note', 30 + (i % 2) * 380, 70 + Math.floor(i / 2) * 200, {
        text,
        width: 340,
        parentId: frame.id,
        color: ['#fff2b2', '#dbeafe', '#fce7f3', '#dcfce7'][i],
      }),
    );
  } else if (name === 'User journey') {
    const nodes = ['Discover', 'Evaluate', 'Get started', 'Return'].map(
      (text, i) => add('rectangle', i * 290, 50, { text, color: '#e0f2fe' }),
    );
    nodes.slice(1).forEach((node, i) => connect(nodes[i], node));
    nodes.forEach((node, i) =>
      add('note', i * 290, 260, {
        text: 'User needs\n\nOpportunities',
        color: '#fff2b2',
        parentId: null,
      }),
    );
  } else if (name === 'Architecture') {
    const client = add('rectangle', 0, 150, {
      text: 'Client',
      color: '#dbeafe',
    });
    const api = add('rectangle', 320, 150, {
      text: 'API / service',
      color: '#ede9fe',
    });
    const db = add('ellipse', 640, 150, { text: 'Database', color: '#dcfce7' });
    connect(client, api, 'Request');
    connect(api, db, 'Read / write');
    add('code', 320, 380, {
      text: '// Contract\nGET /resource\n→ { id, data }',
      width: 320,
      height: 180,
    });
  } else {
    const frame = add('frame', 0, 0, {
      text: 'Story / document outline',
      width: 900,
      height: 600,
    });
    ['Purpose & audience', 'Opening', 'Main argument', 'Next steps'].forEach(
      (text, i) =>
        add('text', 30 + (i % 2) * 440, 70 + Math.floor(i / 2) * 250, {
          text: text + '\n\nAdd your thoughts…',
          width: 400,
          height: 200,
          parentId: frame.id,
        }),
    );
  }
  return objects;
}
export function frameDescendants(
  id: string,
  objects: WorkspaceObject[],
): WorkspaceObject[] {
  const children = new Map<string, string[]>();
  for (const object of objects) {
    if (!object.parentId) continue;
    const siblings = children.get(object.parentId) || [];
    siblings.push(object.id);
    children.set(object.parentId, siblings);
  }
  const ids = new Set([id]);
  const queue = [id];
  for (let index = 0; index < queue.length; index++) {
    for (const child of children.get(queue[index]) || []) {
      if (ids.has(child)) continue;
      ids.add(child);
      queue.push(child);
    }
  }
  return objects.filter((object) => ids.has(object.id) && object.visible);
}
export function containingFrame(
  object: WorkspaceObject,
  objects: WorkspaceObject[],
) {
  const center = {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
  const descendants = new Set(
    frameDescendants(object.id, objects).map((item) => item.id),
  );
  return objects
    .filter(
      (item) =>
        item.visible &&
        !descendants.has(item.id) &&
        (object.type === 'card'
          ? item.type === 'column'
          : item.type === 'frame') &&
        center.x >= item.x &&
        center.x <= item.x + item.width &&
        center.y >= item.y &&
        center.y <= item.y + item.height,
    )
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
}

// Select only fully enclosed objects so dragging across a large frame does not
// accidentally select the frame and move everything inside it.
export function objectsInSelection(
  start: { x: number; y: number },
  end: { x: number; y: number },
  objects: WorkspaceObject[],
) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return objects
    .filter(
      (object) =>
        object.visible &&
        object.type !== 'connector' &&
        object.x >= left &&
        object.y >= top &&
        object.x + object.width <= right &&
        object.y + object.height <= bottom,
    )
    .map((object) => object.id);
}

export function movableSelection(ids: string[], objects: WorkspaceObject[]) {
  const selected = new Set(
    ids.flatMap((id) =>
      frameDescendants(id, objects).map((object) => object.id),
    ),
  );
  return objects.filter(
    (object) =>
      object.visible && object.type !== 'connector' && selected.has(object.id),
  );
}

// Card y-values retain ordering intent. Actual positions are derived for every
// client, so concurrent drops cannot leave cards overlapping in a column.
export function kanbanLayout(objects: WorkspaceObject[]) {
  const laidOut = new Map<string, WorkspaceObject>();
  for (const column of objects) {
    if (!column.visible || column.type !== 'column') continue;
    const cards = objects
      .filter(
        (item) =>
          item.visible && item.type === 'card' && item.parentId === column.id,
      )
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    let y = column.y + 70;
    for (const card of cards) {
      laidOut.set(card.id, {
        ...card,
        x: column.x + 20,
        y,
        width: Math.max(40, column.width - 40),
      });
      y += card.height + 16;
    }
    laidOut.set(column.id, {
      ...column,
      height: Math.max(column.height, Math.min(10000, y - column.y + 4)),
    });
  }
  return objects.map((object) => laidOut.get(object.id) || object);
}

export function kanbanDrop(
  card: WorkspaceObject,
  raw: WorkspaceObject[],
  displayed: WorkspaceObject[],
) {
  const column = containingFrame(card, displayed);
  if (!column || column.type !== 'column')
    return { x: card.x, y: card.y, parentId: null };
  const cards = displayed
    .filter(
      (item) =>
        item.visible &&
        item.type === 'card' &&
        item.parentId === column.id &&
        item.id !== card.id,
    )
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const index = cards.findIndex(
    (item) => card.y + card.height / 2 < item.y + item.height / 2,
  );
  const insertion = index < 0 ? cards.length : index;
  const ranks = new Map(raw.map((item) => [item.id, item.y]));
  const before =
    insertion > 0 ? ranks.get(cards[insertion - 1].id)! : undefined;
  const after =
    insertion < cards.length ? ranks.get(cards[insertion].id)! : undefined;
  const rank =
    before === undefined
      ? after === undefined
        ? column.y + 70
        : after - 176
      : after === undefined
        ? before + 176
        : before + (after - before) / 2;
  return {
    x: column.x + 20,
    y: Math.max(-100000, Math.min(100000, rank)),
    parentId: column.id,
  };
}

export function kanbanReorder(
  card: WorkspaceObject,
  direction: number,
  raw: WorkspaceObject[],
) {
  const cards = raw
    .filter(
      (item) =>
        item.visible && item.type === 'card' && item.parentId === card.parentId,
    )
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const index = cards.findIndex((item) => item.id === card.id);
  const target = index + Math.sign(direction);
  if (index < 0 || target < 0 || target >= cards.length) return [];
  [cards[index], cards[target]] = [cards[target], cards[index]];
  // Normalize ranks on explicit keyboard reorder, including simultaneous drops
  // with equal ranks, rather than relying on an unrepresentable midpoint.
  return cards.map((item, position) => ({
    id: item.id,
    y: position * (100000 / Math.max(1, cards.length)),
  }));
}

export function kanbanAppendRank(
  column: WorkspaceObject,
  objects: WorkspaceObject[],
) {
  const ranks = objects
    .filter(
      (item) =>
        item.visible && item.type === 'card' && item.parentId === column.id,
    )
    .map((item) => item.y);
  return Math.max(
    -100000,
    Math.min(100000, ranks.length ? Math.max(...ranks) + 1 : column.y + 70),
  );
}
