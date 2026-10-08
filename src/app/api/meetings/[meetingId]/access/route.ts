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
  meetingCall,
  requestChannel,
  stream,
  syncIdentity,
} from '@/lib/server/stream';
import { AccessStatus } from '@/lib/meeting';

type Context = { params: Promise<{ meetingId: string }> };
async function access(
  meetingId: string,
  ask: boolean,
  name?: string,
  cancel = false,
) {
  const user = await identity({ createGuest: true, name });
  const call = meetingCall(meetingId);
  const { call: data } = await call.get();
  const isHost = data.created_by.id === user.id;
  const locked = data.custom.locked === true;
  const policy = data.custom.access === 'open' ? 'open' : 'restricted';
  let status: AccessStatus = 'request';
  const member = await call.queryMembers({
    filter_conditions: { user_id: user.id },
    limit: 1,
  });
  if (cancel && !isHost) {
    const channel = requestChannel(meetingId, user.id);
    if ((await streamRequestState(channel.id!)) === 'waiting')
      await channel.updatePartial({ set: { status: 'cancelled' } });
  }
  if (data.ended_at) status = 'ended';
  else if (data.blocked_user_ids.includes(user.id)) status = 'denied';
  else if (isHost || member.members.length) status = 'ready';
  else if (locked) status = 'locked';
  else {
    const channel = requestChannel(meetingId, user.id);
    if (ask) {
      if (!user.name)
        throw new HttpError(400, 'Enter your name before asking to join.');
      await syncIdentity(user);
      if (policy === 'open') {
        await addMember(meetingId, user.id);
        status = 'ready';
      } else {
        const result = await chatServer()
          .channel('meet-requests', channel.id!, {
            created_by_id: data.created_by.id,
            members: [data.created_by.id],
            meeting_id: meetingId,
            applicant_id: user.id,
            applicant_name: user.name,
            status: 'waiting',
            requested_at: new Date().toISOString(),
          })
          .create();
        if (result.channel?.status === 'cancelled')
          await channel.updatePartial({
            set: {
              status: 'waiting',
              applicant_name: user.name,
              requested_at: new Date().toISOString(),
            },
          });
        status = result.channel?.status === 'denied' ? 'denied' : 'waiting';
      }
    } else {
      const requests = await streamRequestState(channel.id!);
      if (requests === 'waiting' || requests === 'denied') status = requests;
    }
  }
  if (status === 'ready') await syncIdentity(user);
  return {
    status,
    meetingId,
    hostName: data.created_by.name || 'Host',
    hostId: data.created_by.id,
    isHost,
    locked,
    access: policy,
    identity: user,
    participantCount: data.session?.participants.length || 0,
    ...(status === 'ready'
      ? {
          token: stream().generateUserToken({
            user_id: user.id,
            validity_in_seconds: 900,
          }),
        }
      : {}),
  };
}
async function streamRequestState(id: string) {
  const { chatServer } = await import('@/lib/server/stream');
  const response = await chatServer().queryChannels(
    { type: 'meet-requests', id },
    [],
    { limit: 1, state: false },
  );
  return response[0]?.data?.status;
}
// POST also establishes an HttpOnly guest session; read-only polling uses the same identity.
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const body = await readBody(request);
    return json(
      await access(
        meetingId,
        body.ask === true,
        typeof body.name === 'string' ? body.name : undefined,
        body.cancel === true,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
