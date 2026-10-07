import { identity } from '@/lib/server/identity';
import { assertSameOrigin, failure, json, readBody, HttpError } from '@/lib/server/http';
import { syncIdentity } from '@/lib/server/stream';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (typeof body.name !== 'string') throw new HttpError(400, 'Name is required.');
    const user = await identity({ createGuest: true, name: body.name });
    await syncIdentity(user);
    return json({ identity: user });
  } catch (error) { return failure(error); }
}
