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
import { validOperation } from '@/lib/whiteboard';

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
    const operation = {
      ...body,
      actor: user.id,
      time: new Date().toISOString(),
    };
    if (!validOperation(operation))
      throw new HttpError(400, 'Invalid drawing operation.');
    if (operation.kind === 'clear' && !isHost)
      throw new HttpError(403, 'Only the host can clear the board.');
    if (!isHost && data.call.custom.collaboration === false)
      throw new HttpError(
        403,
        'The host has disabled drawing for participants.',
      );
    const id = `board-${operation.id}`;
    // Stable IDs make network retries idempotent; peers cannot write to this read-only channel directly.
    try {
      const existing = await chatServer().getMessage(id);
      if (
        existing.message.user?.id !== user.id ||
        existing.message.cid !== `${BOARD_TYPE}:${meetingId}`
      )
        throw new HttpError(409, 'Drawing operation already exists.');
      return json({
        operation: {
          ...(existing.message.board_operation as Record<string, unknown>),
          time: existing.message.created_at,
        },
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const code = (error as { code?: number }).code;
      if (code !== 4 && code !== 16) throw error;
    }
    const result = await chatServer()
      .channel(BOARD_TYPE, meetingId)
      .sendMessage(
        { id, user_id: user.id, text: '', board_operation: operation },
        { skip_push: true },
      );
    return json({
      operation: { ...operation, time: result.message.created_at },
    });
  } catch (error) {
    return failure(error);
  }
}
