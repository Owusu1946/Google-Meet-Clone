import 'server-only';
import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';
import {
  CALL_TYPE,
  CHAT_TYPE,
  BOARD_TYPE,
  REQUEST_TYPE,
  MEETING_ID_REGEX,
  MeetingIdentity,
} from '../meeting';
import { HttpError } from './http';

let singleton: StreamClient | undefined;
let chatSingleton: StreamChat | undefined;
export function stream() {
  const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!key || !secret)
    throw new HttpError(503, 'The meeting service has not been configured.');
  return (singleton ||= new StreamClient(key, secret, { timeout: 10_000 }));
}
export function chatServer() {
  stream();
  return (chatSingleton ||= new StreamChat(
    process.env.NEXT_PUBLIC_STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!,
    { timeout: 10_000, disableCache: true },
  ));
}
export function meetingCall(id: string) {
  if (!MEETING_ID_REGEX.test(id))
    throw new HttpError(400, 'Invalid meeting code.');
  return stream().video.call(CALL_TYPE, id);
}
export async function syncIdentity(user: MeetingIdentity) {
  await stream().upsertUsers([
    { id: user.id, name: user.name || 'Guest', image: user.image },
  ]);
}
export async function membership(
  id: string,
  user: MeetingIdentity,
  allowEnded = false,
) {
  const call = meetingCall(id);
  const data = await call.get();
  if (data.call.blocked_user_ids.includes(user.id))
    throw new HttpError(403, 'You have been removed from this meeting.');
  if (data.call.ended_at && !allowEnded)
    throw new HttpError(410, 'This meeting has ended.');
  const isHost = data.call.created_by.id === user.id;
  const members = await call.queryMembers({
    filter_conditions: { user_id: user.id },
    limit: 1,
  });
  if (!isHost && !members.members.length)
    throw new HttpError(403, 'Ask the host to admit you before joining.');
  return { call, data, isHost };
}
export async function requireHost(id: string, user: MeetingIdentity) {
  const access = await membership(id, user);
  if (!access.isHost) throw new HttpError(403, 'Only the host can do this.');
  return access;
}
export function requestChannel(id: string, userId: string) {
  return chatServer().channel(REQUEST_TYPE, `${id}_${userId}`);
}
export async function addMember(id: string, userId: string) {
  // Complete collaboration memberships before opening the video admission gate.
  // Roll back the exact memberships added here if any service write fails.
  const channels = [CHAT_TYPE, BOARD_TYPE].map((type) =>
    chatServer().channel(type, id),
  );
  try {
    for (const channel of channels) await channel.addMembers([userId]);
    await meetingCall(id).updateCallMembers({
      update_members: [{ user_id: userId, role: 'call_member' }],
    });
  } catch (error) {
    await Promise.allSettled(
      channels.map((channel) => channel.removeMembers([userId])),
    );
    throw error;
  }
}
