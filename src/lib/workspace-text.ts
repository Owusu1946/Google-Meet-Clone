import type { BoardOperation } from './whiteboard';
import { compareOperations, validObjectId } from './workspace';
export type TextMutation =
  | {
      kind: 'text-insert';
      objectId: string;
      after: string | null;
      text: string;
      clock: number;
    }
  | {
      kind: 'text-visible';
      objectId: string;
      atomIds: string[];
      visible: boolean;
    };
export type TextAtom = {
  id: string;
  character: string;
  after: string | null;
  clock: number;
  visible: boolean;
};
const atomId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,230}$/.test(value);
export function validTextMutation(value: TextMutation) {
  if (!validObjectId(value.objectId)) return false;
  if (value.kind === 'text-visible')
    return (
      typeof value.visible === 'boolean' &&
      Array.isArray(value.atomIds) &&
      value.atomIds.length > 0 &&
      value.atomIds.length <= 16 &&
      value.atomIds.every(atomId) &&
      JSON.stringify(value.atomIds).length <= 2800
    );
  return (
    value.kind === 'text-insert' &&
    (value.after === null || atomId(value.after)) &&
    typeof value.text === 'string' &&
    [...value.text].length > 0 &&
    [...value.text].length <= 64 &&
    new TextEncoder().encode(value.text).length <= 256 &&
    Number.isSafeInteger(value.clock) &&
    value.clock >= 1 &&
    value.clock <= 1_000_000_000
  );
}
export function insertedAtomIds(id: string, text: string) {
  return [...text].map((_, index) => `${id}:${index}`);
}
export function textDocument(objectId: string, operations: BoardOperation[]) {
  const ordered = [
    ...new Map(operations.map((op) => [op.id, op])).values(),
  ].sort(compareOperations);
  const clear = ordered.findLastIndex((op) => op.kind === 'clear');
  const current = ordered.slice(clear + 1);
  const creation = current.find(
    (op) => op.kind === 'object-create' && op.objectId === objectId,
  );
  let base = creation?.kind === 'object-create' ? creation.fields.text : '';
  let reset = creation;
  for (const op of current)
    if (
      op.kind === 'object-patch' &&
      op.objectId === objectId &&
      typeof op.fields.text === 'string'
    ) {
      base = op.fields.text;
      reset = op;
    }
  const atoms = new Map<string, TextAtom>();
  let after: string | null = null;
  [...base].forEach((character, index) => {
    const id = `${objectId}:seed:${index}`;
    atoms.set(id, { id, character, after, clock: 0, visible: true });
    after = id;
  });
  const visibility = new Map<string, boolean>();
  let clock = 0;
  for (const op of current) {
    if (
      (op.kind !== 'text-insert' && op.kind !== 'text-visible') ||
      op.objectId !== objectId ||
      !validTextMutation(op)
    )
      continue;
    if (
      reset &&
      reset.kind === 'object-patch' &&
      compareOperations(op, reset) <= 0
    )
      continue;
    if (op.kind === 'text-visible') {
      op.atomIds.forEach((id) => visibility.set(id, op.visible));
      continue;
    }
    clock = Math.max(clock, op.clock);
    let anchor = op.after;
    [...op.text].forEach((character, index) => {
      const id = `${op.id}:${index}`;
      if (!atoms.has(id))
        atoms.set(id, {
          id,
          character,
          after: anchor,
          clock: op.clock,
          visible: true,
        });
      anchor = id;
    });
  }
  const children = new Map<string | null, TextAtom[]>();
  for (const atom of atoms.values()) {
    const siblings = children.get(atom.after) || [];
    siblings.push(atom);
    children.set(atom.after, siblings);
  }
  for (const siblings of children.values())
    siblings.sort((a, b) => b.clock - a.clock || b.id.localeCompare(a.id));
  const result: TextAtom[] = [];
  const stack = [...(children.get(null) || [])].reverse();
  const visited = new Set<string>();
  while (stack.length) {
    const atom = stack.pop()!;
    if (visited.has(atom.id)) continue;
    visited.add(atom.id);
    result.push({ ...atom, visible: visibility.get(atom.id) ?? atom.visible });
    stack.push(...[...(children.get(atom.id) || [])].reverse());
  }
  const visible = result.filter((atom) => atom.visible);
  return {
    atoms: result,
    visible,
    text: visible.map((atom) => atom.character).join(''),
    clock,
  };
}
export function textEdit(
  objectId: string,
  text: string,
  operations: BoardOperation[],
  actor: string,
) {
  const document = textDocument(objectId, operations);
  const before = document.visible;
  const next = [...text];
  let start = 0;
  while (
    start < before.length &&
    start < next.length &&
    before[start].character === next[start]
  )
    start++;
  let suffix = 0;
  while (
    suffix < before.length - start &&
    suffix < next.length - start &&
    before[before.length - suffix - 1].character ===
      next[next.length - suffix - 1]
  )
    suffix++;
  const forward: BoardOperation[] = [];
  const backward: TextMutation[] = [];
  const deleted = before
    .slice(start, before.length - suffix)
    .map((atom) => atom.id);
  for (let index = 0; index < deleted.length; index += 12) {
    const atomIds = deleted.slice(index, index + 12);
    forward.push({
      id: crypto.randomUUID(),
      actor,
      time: new Date().toISOString(),
      kind: 'text-visible',
      objectId,
      atomIds,
      visible: false,
    });
    backward.push({ kind: 'text-visible', objectId, atomIds, visible: true });
  }
  const added = next.slice(start, next.length - suffix);
  let after = before[start - 1]?.id || null;
  for (let index = 0; index < added.length; index += 64) {
    const text = added.slice(index, index + 64).join('');
    const id = crypto.randomUUID();
    forward.push({
      id,
      actor,
      time: new Date().toISOString(),
      kind: 'text-insert',
      objectId,
      after,
      text,
      clock: document.clock + 1,
    });
    const ids = insertedAtomIds(id, text);
    for (let offset = 0; offset < ids.length; offset += 12)
      backward.push({
        kind: 'text-visible',
        objectId,
        atomIds: ids.slice(offset, offset + 12),
        visible: false,
      });
    after = ids.at(-1)!;
  }
  return { forward, backward };
}
