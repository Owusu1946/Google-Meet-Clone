'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Header from '@/components/Header';
import MeetingPreview from '@/components/MeetingPreview';
import {
  api,
  errorMessage,
  MEETING_ID_REGEX,
  type MeetingAccess,
} from '@/lib/meeting';

export default function Lobby() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [access, setAccess] = useState<MeetingAccess>();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const valid = MEETING_ID_REGEX.test(meetingId);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await api<MeetingAccess>(
        `/api/meetings/${meetingId}/access`,
        { method: 'POST', body: '{}', signal },
      );
      if (signal?.aborted) return next;
      setError('');
      setAccess(next);
      setName((current) => current || next.identity.name);
      return next;
    },
    [meetingId],
  );
  useEffect(() => {
    if (!isLoaded || !valid) return;
    setAccess(undefined);
    const controller = new AbortController();
    setError('');
    void refresh(controller.signal).catch((failure) => {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, valid, refresh, attempt]);
  useEffect(() => {
    if (access?.status !== 'waiting') return;
    let cancelled = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await refresh(controller.signal);
        if (!cancelled && next.status === 'ready') {
          router.replace(`/${meetingId}/meeting`);
          return;
        }
      } catch (failure) {
        if (!cancelled) setError(errorMessage(failure));
      }
      if (!cancelled) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [access?.status, refresh, meetingId, router]);
  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api<MeetingAccess>(
        `/api/meetings/${meetingId}/access`,
        {
          method: 'POST',
          body: JSON.stringify({
            ask: true,
            ...(!isSignedIn ? { name: name.trim() } : {}),
          }),
        },
      );
      setAccess(next);
      if (next.status === 'ready') router.push(`/${meetingId}/meeting`);
      else setBusy(false);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };
  if (!valid)
    return (
      <>
        <Header />
        <main className="text-center py-24">
          <h1 className="text-3xl">Invalid meeting code</h1>
          <Link href="/" className="text-primary block mt-6">
            Return home
          </Link>
        </main>
      </>
    );
  const unavailable =
    access && ['denied', 'locked', 'ended'].includes(access.status);
  return (
    <div>
      <Header navItems={false} />
      <main className="lobby-layout">
        <MeetingPreview name={name || access?.identity.name || 'You'} />
        <section className="lobby-join-panel">
          <h1 className="text-3xl">
            {access?.status === 'waiting'
              ? 'Asking to join…'
              : access?.status === 'ended'
                ? 'This meeting has ended'
                : access?.status === 'locked'
                  ? 'This meeting is locked'
                  : access?.status === 'denied'
                    ? 'You can’t join this meeting'
                    : access
                      ? 'Ready to join?'
                      : 'Getting ready…'}
          </h1>
          {access && (
            <p className="text-meet-gray">
              {meetingId}
              <br />
              Hosted by {access.hostName}
            </p>
          )}
          {access?.status === 'waiting' ? (
            <p>
              The host will let you in soon. You can keep adjusting your camera
              and microphone.
            </p>
          ) : (
            !unavailable &&
            access && (
              <>
                {!isSignedIn && (
                  <input
                    maxLength={80}
                    className="border border-border-gray rounded-lg px-4 py-3 w-full max-w-xs"
                    aria-label="Your name"
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
                <p className="text-sm text-meet-gray">
                  {access.participantCount
                    ? `${access.participantCount} people are in the meeting`
                    : 'No one else is here'}
                </p>
                <button
                  onClick={() => void join()}
                  disabled={busy || (!isSignedIn && !name.trim())}
                  className="primary-button"
                >
                  {busy
                    ? 'Joining…'
                    : access.status === 'ready' || access.access === 'open'
                      ? 'Join now'
                      : 'Ask to join'}
                </button>
              </>
            )
          )}
          {access?.status === 'denied' && (
            <p>
              The host declined your request or removed you. Contact them for
              help.
            </p>
          )}
          {access?.status === 'locked' && (
            <>
              <p>The host is not accepting new participants.</p>
              <button
                className="text-primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Check again
              </button>
            </>
          )}
          {error && (
            <div role="alert">
              <p className="text-meet-red">{error}</p>
              <button
                className="mt-3 text-primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          <Link href="/" className="block text-primary text-sm">
            Return home
          </Link>
        </section>
      </main>
    </div>
  );
}
