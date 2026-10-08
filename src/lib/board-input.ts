import { validOperation, type BoardOperation } from './whiteboard';

export type BoardInput = Record<string, unknown> | BoardOperation;

// Validate the whole logical edit before exposing any of it locally. Transport
// still splits edits into the existing bounded, idempotent service batches.
export function prepareBoardOperations(inputs: BoardInput[], actor: string) {
  const operations = inputs.map((input) => ({
    ...input,
    id: typeof input.id === 'string' ? input.id : crypto.randomUUID(),
    actor,
    time: new Date().toISOString(),
  }));
  if (!operations.every(validOperation)) return null;
  if (
    new Set(operations.map((operation) => operation.id)).size !==
    operations.length
  )
    return null;
  return operations;
}
