import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type GuestSession = { id: string; name: string; expires: number };
export function signGuest(session: GuestSession, secret: string): string {
  const body = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function readGuest(value: string | undefined, secret: string, now = Date.now()): GuestSession | null {
  if (!value) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString()) as GuestSession;
    return /^guest_[a-f0-9-]{36}$/.test(session.id) && typeof session.name === 'string' && session.name.length <= 80 && Number.isFinite(session.expires) && session.expires > now ? session : null;
  } catch { return null; }
}
export function newGuest(): GuestSession {
  return { id: `guest_${randomUUID()}`, name: '', expires: Date.now() + 24 * 60 * 60 * 1000 };
}
