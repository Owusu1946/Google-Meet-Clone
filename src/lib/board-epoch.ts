import type { BoardOperation } from './whiteboard';
import { compareOperations } from './workspace';

// Canonical acknowledgement changes timestamps, but not the clear operation's
// identity. Use that identity to invalidate local interaction/history state.
export function boardEpoch(operations: BoardOperation[]) {
  let latest: BoardOperation | undefined;
  for (const operation of operations)
    if (
      operation.kind === 'clear' &&
      (!latest || compareOperations(latest, operation) < 0)
    )
      latest = operation;
  return latest?.id || null;
}
