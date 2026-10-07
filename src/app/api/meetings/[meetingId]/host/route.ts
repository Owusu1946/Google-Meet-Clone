import { identity } from '@/lib/server/identity';
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readBody,
} from '@/lib/server/http';
import {
  addMember,
  chatServer,
  requestChannel,
  requireHost,
} from '@/lib/server/stream';
import { BOARD_TYPE, CHAT_TYPE, REQUEST_TYPE } from '@/lib/meeting';

type Context = { params: Promise<{ meetingId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { meetingId } = await context.params;
    await requireHost(meetingId, await identity());
    const channels = await chatServer().queryChannels(
      { type: REQUEST_TYPE, meeting_id: meetingId, status: 'waiting' },
      [{ created_at: 1 }],
      { limit: 30, state: false },
    );
    return json({
      requests: channels.map((channel) => ({
        id: channel.data?.applicant_id,
        name: channel.data?.applicant_name,
        requestedAt: channel.data?.requested_at,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const host = await identity();
    const { call, data } = await requireHost(meetingId, host);
    const body = await readBody(request);
    switch (body.action) {
      case 'admit':
      case 'deny': {
        if (
          typeof body.userId !== 'string' ||
          !/^(user_|guest_)[a-zA-Z0-9_-]{1,80}$/.test(body.userId)
        )
          throw new HttpError(400, 'Invalid participant.');
        const channel = requestChannel(meetingId, body.userId);
        const pending = await channel.query();
        if (pending.channel?.status !== 'waiting')
          throw new HttpError(409, 'This request has already been handled.');
        if (body.action === 'admit') {
          if (data.call.custom.locked)
            throw new HttpError(
              409,
              'Unlock the meeting before admitting someone.',
            );
          await addMember(meetingId, body.userId);
        }
        await channel.updatePartial({
          set: { status: body.action === 'admit' ? 'admitted' : 'denied' },
        });
        break;
      }
      case 'settings': {
        const changes: Record<string, unknown> = {};
        if (typeof body.locked === 'boolean') changes.locked = body.locked;
        if (typeof body.boardPresenting === 'boolean')
          changes.boardPresenting = body.boardPresenting;
        if (typeof body.collaboration === 'boolean')
          changes.collaboration = body.collaboration;
        if (body.access === 'open' || body.access === 'restricted')
          changes.access = body.access;
        await call.update({ custom: { ...data.call.custom, ...changes } });
        break;
      }
      case 'remove': {
        if (typeof body.userId !== 'string' || body.userId === host.id)
          throw new HttpError(400, 'Select another participant.');
        await call.blockUser({ user_id: body.userId });
        await call.updateCallMembers({ remove_members: [body.userId] });
        for (const type of [CHAT_TYPE, BOARD_TYPE])
          await chatServer()
            .channel(type, meetingId)
            .removeMembers([body.userId]);
        break;
      }
      case 'mute': {
        if (typeof body.userId !== 'string' || body.userId === host.id)
          throw new HttpError(400, 'Select another participant.');
        // Server-authenticated requests must identify the moderator explicitly;
        // unlike client tokens, the server token has no acting user identity.
        await call.muteUsers({
          user_ids: [body.userId],
          audio: true,
          muted_by_id: host.id,
        });
        break;
      }
      case 'end':
        await call.end();
        break;
      default:
        throw new HttpError(400, 'Unknown host action.');
    }
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
