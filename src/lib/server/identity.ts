import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { MeetingIdentity } from '../meeting';
import { newGuest, readGuest, signGuest } from './guest-session';
import { HttpError } from './http';

const COOKIE = 'meet_guest';
export async function identity(options: { createGuest?: boolean; name?: string } = {}): Promise<MeetingIdentity> {
  const user = await currentUser();
  if (user) return { id: user.id, name: user.fullName || user.username || 'Participant', image: user.imageUrl, guest: false };
  const secret = process.env.GUEST_SESSION_SECRET || process.env.STREAM_API_SECRET;
  if (!secret) throw new HttpError(503, 'The meeting service has not been configured.');
  const jar = await cookies();
  let guest = readGuest(jar.get(COOKIE)?.value, secret);
  if (!guest && options.createGuest) guest = newGuest();
  if (!guest) throw new HttpError(401, 'Return to the lobby to join this meeting.');
  if (options.name !== undefined) {
    const name = options.name.trim();
    if (!name || name.length > 80) throw new HttpError(400, 'Enter a name between 1 and 80 characters.');
    guest.name = name;
  }
  if (options.createGuest || options.name !== undefined) jar.set(COOKIE, signGuest(guest, secret), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.max(0, Math.floor((guest.expires - Date.now()) / 1000)) });
  return { id: guest.id, name: guest.name, guest: true };
}
