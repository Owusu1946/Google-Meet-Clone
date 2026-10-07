import { identity } from '@/lib/server/identity';
import {
  assertSameOrigin,
  failure,
  HttpError,
  json,
  readBody,
} from '@/lib/server/http';
import { requireHost } from '@/lib/server/stream';

type Context = { params: Promise<{ meetingId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { meetingId } = await context.params;
    await requireHost(meetingId, await identity());
    return json({
      emailEnabled: !!(
        process.env.RESEND_API_KEY && process.env.MEETING_EMAIL_FROM
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { meetingId } = await context.params;
    const user = await identity();
    await requireHost(meetingId, user);
    const body = await readBody(request);
    if (
      !Array.isArray(body.emails) ||
      !body.emails.length ||
      body.emails.length > 10 ||
      !body.emails.every(
        (email) =>
          typeof email === 'string' &&
          email.length < 255 &&
          /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email),
      )
    )
      throw new HttpError(400, 'Enter up to 10 valid email addresses.');
    if (!process.env.RESEND_API_KEY || !process.env.MEETING_EMAIL_FROM)
      throw new HttpError(
        503,
        'Email invitations are not configured. Use your email app or copy the meeting link.',
      );
    if (
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(body.requestId)
    )
      throw new HttpError(400, 'Invalid invitation request.');
    const link = `${new URL(request.url).origin}/${meetingId}`;
    const emails = [...new Set(body.emails as string[])];
    // Separate messages keep recipients' addresses private. The stable key prevents duplicate mail on retry.
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `meet-${meetingId}-${user.id}-${body.requestId}`,
      },
      body: JSON.stringify(
        emails.map((email) => ({
          from: process.env.MEETING_EMAIL_FROM,
          to: [email],
          subject: `${user.name} invited you to a meeting`,
          text: `${user.name} invited you to join meeting ${meetingId}.\n\nJoin: ${link}\n\nEnter your name and ask the host to admit you.`,
        })),
      ),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new HttpError(
        502,
        'Invitations could not be sent. Check email configuration or try your email app.',
      );
    return json({ sent: emails.length });
  } catch (error) {
    return failure(error);
  }
}
