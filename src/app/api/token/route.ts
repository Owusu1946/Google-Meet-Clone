import { identity } from '@/lib/server/identity';
import { assertSameOrigin, failure, json, readBody, HttpError } from '@/lib/server/http';
import { membership, stream } from '@/lib/server/stream';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (typeof body.meetingId !== 'string') throw new HttpError(400, 'Meeting code is required.');
    const user = await identity();
    await membership(body.meetingId, user);
    return json({ token: stream().generateUserToken({ user_id: user.id, validity_in_seconds: 900 }) });
  } catch (error) { return failure(error); }
}
