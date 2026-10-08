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
  const ids = new Set([id]);
  for (let pass = 0; pass < objects.length; pass++) {
    let changed = false;
    for (const object of objects)
      if (object.parentId && ids.has(object.parentId) && !ids.has(object.id)) {
        ids.add(object.id);
        changed = true;
      }
    if (!changed) break;
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
