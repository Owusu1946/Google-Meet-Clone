import { identity } from '@/lib/server/identity';
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readBody,
} from '@/lib/server/http';
import { membership } from '@/lib/server/stream';

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const user = await identity();
    const { call, isHost } = await membership(meetingId, user);
    const body = await readBody(request);
    if (
      typeof body.raised !== 'boolean' ||
      typeof body.sessionId !== 'string' ||
      body.sessionId.length > 100
    )
      throw new HttpError(400, 'Invalid hand state.');
    await call.updateCallMembers({
      update_members: [
        {
          user_id: user.id,
          role: isHost ? 'host' : 'call_member',
          custom: { handRaised: body.raised, handSession: body.sessionId },
        },
      ],
    });
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
