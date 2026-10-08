import type { Point } from './whiteboard';
import { validObjectId } from './workspace';
export type WorkspacePresence = {
  point: Point | null;
  selected: string[];
  editing: string | null;
};
export type WorkspacePeer = WorkspacePresence & {
  userId: string;
  name: string;
  seen: number;
};
export function validPresence(value: unknown): value is WorkspacePresence {
  if (!value || typeof value !== 'object') return false;
  const presence = value as WorkspacePresence;
  return (
    (presence.point === null ||
      (!!presence.point &&
        Number.isFinite(presence.point.x) &&
        Number.isFinite(presence.point.y) &&
        Math.abs(presence.point.x) <= 100000 &&
        Math.abs(presence.point.y) <= 100000)) &&
    Array.isArray(presence.selected) &&
    presence.selected.length <= 30 &&
    presence.selected.every(validObjectId) &&
    (presence.editing === null || validObjectId(presence.editing))
  );
}
export function peerColor(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ['#7c3aed', '#0284c7', '#db2777', '#059669', '#ea580c'][
    Math.abs(hash) % 5
  ];
}
