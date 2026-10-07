import { identity } from '@/lib/server/identity';
import { assertSameOrigin, failure, json } from '@/lib/server/http';
import { membership } from '@/lib/server/stream';

export async function POST(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const { call, data } = await membership(meetingId, await identity());
    // Viewers can enable captions independently; starting the shared engine is idempotent.
    if (!data.call.captioning)
      await call.startClosedCaptions({
        language: data.call.settings.transcription.language,
      });
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
