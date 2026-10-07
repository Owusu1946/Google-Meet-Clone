import { identity } from '@/lib/server/identity';
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readBody,
} from '@/lib/server/http';
import { chatServer, membership } from '@/lib/server/stream';
import { BOARD_TYPE } from '@/lib/meeting';
import {
  canonicalBoardOperations,
  boardBatch,
  validOperation,
  type BoardOperation,
} from '@/lib/whiteboard';

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const user = await identity();
    const { data, isHost } = await membership(meetingId, user);
    const body = await readBody(request);
    const batchRequest = Array.isArray(body.operations);
    const values = batchRequest ? (body.operations as unknown[]) : [body];
    if (!values.length || values.length > 16)
      throw new HttpError(400, 'Invalid drawing batch.');
    const operations = values.map((value) => ({
      ...(value && typeof value === 'object' ? value : {}),
      actor: user.id,
      time: new Date().toISOString(),
    }));
    if (!operations.every(validOperation))
      throw new HttpError(400, 'Invalid drawing operation.');
    if (boardBatch(operations).length !== operations.length)
      throw new HttpError(413, 'Drawing batch is too large.');
    if (operations.some((operation) => operation.kind === 'clear') && !isHost)
      throw new HttpError(403, 'Only the host can clear the board.');
    if (!isHost && data.call.custom.collaboration === false)
      throw new HttpError(
        403,
        'The host has disabled drawing for participants.',
      );
    const respond = (saved: BoardOperation[]) => {
      if (!saved.length)
        throw new HttpError(409, 'Invalid saved drawing batch.');
      return json(
        batchRequest ? { operations: saved } : { operation: saved[0] },
      );
    };
    const operation = operations[0];
    const id = `board-${operation.id}`;
    // Stable IDs make network retries idempotent; peers cannot write to this read-only channel directly.
    try {
      const existing = await chatServer().getMessage(id);
      if (
        existing.message.user?.id !== user.id ||
        existing.message.cid !== `${BOARD_TYPE}:${meetingId}`
      )
        throw new HttpError(409, 'Drawing operation already exists.');
      return respond(
        canonicalBoardOperations(
          existing.message.board_operations || existing.message.board_operation,
          user.id,
          existing.message.created_at!,
          existing.message.id,
        ),
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const code = (error as { code?: number }).code;
      if (code !== 4 && code !== 16) throw error;
    }
    const result = await chatServer()
      .channel(BOARD_TYPE, meetingId)
      .sendMessage(
        {
          id,
          user_id: user.id,
          text: '',
          ...(batchRequest
            ? { board_operations: operations }
            : { board_operation: operation }),
        },
        { skip_push: true },
      );
    return respond(
      canonicalBoardOperations(
        result.message.board_operations || result.message.board_operation,
        user.id,
        result.message.created_at!,
        result.message.id,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
