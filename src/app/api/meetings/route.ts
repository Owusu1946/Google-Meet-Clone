import { randomInt } from 'node:crypto';
import { identity } from '@/lib/server/identity';
import { assertSameOrigin, failure, HttpError, json, readBody } from '@/lib/server/http';
import { chatServer, meetingCall, stream, syncIdentity } from '@/lib/server/stream';
import { BOARD_TYPE, CHAT_TYPE } from '@/lib/meeting';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await identity();
    if (user.guest) throw new HttpError(401, 'Sign in to create a meeting.');
    const body = await readBody(request);
    const access = body.access === 'open' ? 'open' : 'restricted';
    const word = (length: number) => Array.from({ length }, () => 'abcdefghijklmnopqrstuvwxyz'[randomInt(26)]).join('');
    const meetingId = `${word(3)}-${word(4)}-${word(3)}`;
    await syncIdentity(user);
    await meetingCall(meetingId).getOrCreate({ data: {
      created_by_id: user.id, members: [{ user_id: user.id, role: 'host' }],
      custom: { access, locked: false, collaboration: true },
    } });
    for (const type of [CHAT_TYPE, BOARD_TYPE]) await chatServer().channel(type, meetingId, { created_by_id: user.id, members: [user.id] }).create();
    return json({ meetingId });
  } catch (error) { return failure(error); }
}

export async function GET() {
  try {
    const user = await identity();
    const response = await stream().video.queryCalls({ filter_conditions: { type: 'meet', members: { $in: [user.id] } }, sort: [{ field: 'created_at', direction: -1 }], limit: 20 });
    return json({ meetings: response.calls.map(({ call }) => ({ id: call.id, host: call.created_by.name, createdAt: call.created_at, ended: !!call.ended_at, isHost: call.created_by.id === user.id })) });
  } catch (error) { return failure(error); }
}
