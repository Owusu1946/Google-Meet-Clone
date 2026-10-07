import { identity } from '@/lib/server/identity';
import { failure, HttpError, json } from '@/lib/server/http';
import { membership } from '@/lib/server/stream';

export async function GET(_request: Request, context: { params: Promise<{ meetingId: string }> }) {
  try {
    const { meetingId } = await context.params;
    const { call, isHost } = await membership(meetingId, await identity(), true);
    if (!isHost) throw new HttpError(403, 'Only the host can access meeting recordings.');
    const result = await call.listRecordings();
    return json({ recordings: result.recordings });
  } catch (error) { return failure(error); }
}
