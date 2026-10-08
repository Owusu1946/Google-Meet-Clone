import { unlockMeetingSounds } from './meeting-sounds';
export const CALL_TYPE = 'meet';
export const CHAT_TYPE = 'meet-chat';
export const BOARD_TYPE = 'meet-board';
export const REQUEST_TYPE = 'meet-requests';
export const MEETING_ID_REGEX = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function parseMeetingCode(input: string): string | null {
  const trimmed = input.trim();
  const code = trimmed.toLowerCase();
  if (MEETING_ID_REGEX.test(code)) return code;
  try {
    const url = new URL(
      trimmed.includes('://') ? trimmed : `https://${trimmed}`,
    );
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const candidate = parts[0]?.toLowerCase();
    return candidate &&
      MEETING_ID_REGEX.test(candidate) &&
      (parts.length === 1 || (parts.length === 2 && parts[1] === 'meeting'))
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export type MeetingIdentity = {
  id: string;
  name: string;
  image?: string;
  guest: boolean;
};
export type AccessStatus =
  'ready' | 'request' | 'waiting' | 'denied' | 'locked' | 'ended';
export type MeetingAccess = {
  status: AccessStatus;
  meetingId: string;
  hostName: string;
  hostId: string;
  isHost: boolean;
  locked: boolean;
  access: 'restricted' | 'open';
  identity: MeetingIdentity;
  participantCount: number;
  token?: string;
};
export type JoinRequest = { id: string; name: string; requestedAt: string };

let guestTab: string | undefined;
function guestTabId() {
  if (typeof window === 'undefined') return undefined;
  if (guestTab) return guestTab;
  // New tabs (including duplicated tabs) must not inherit an admitted identity.
  // A reload keeps this tab's identity so an admitted guest can reconnect.
  const reload = performance
    .getEntriesByType('navigation')
    .some((entry) => (entry as PerformanceNavigationTiming).type === 'reload');
  try {
    guestTab =
      (reload && sessionStorage.getItem('meet-guest-tab')) ||
      crypto.randomUUID();
    sessionStorage.setItem('meet-guest-tab', guestTab);
  } catch {
    guestTab = crypto.randomUUID();
  }
  return guestTab;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.userActivation?.isActive)
    unlockMeetingSounds();
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
    headers: {
      'Content-Type': 'application/json',
      ...(guestTabId() ? { 'X-Meet-Guest-Tab': guestTabId()! } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || 'The request failed. Please try again.');
  return data as T;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}
