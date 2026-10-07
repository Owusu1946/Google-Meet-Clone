'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignInButton, useUser } from '@clerk/nextjs';
import Header from '@/components/Header';
import NewMeetingDropdown from '@/components/NewMeetingDropdown';
import MeetingLinkPopup from '@/components/MeetingLinkPopup';
import { api, errorMessage, parseMeetingCode } from '@/lib/meeting';
import Videocall from '@/components/icons/Videocall';
import LinkIcon from '@/components/icons/Link';
import Add from '@/components/icons/Add';

type RecentMeeting = {
  id: string;
  host: string;
  createdAt: string;
  ended: boolean;
  isHost: boolean;
};
export default function Home() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const [link, setLink] = useState('');
  const [recent, setRecent] = useState<RecentMeeting[]>([]);
  useEffect(() => {
    if (!isLoaded) return;
    const abort = new AbortController();
    void api<{ meetings: RecentMeeting[] }>('/api/meetings', {
      signal: abort.signal,
    })
      .then((data) => setRecent(data.meetings))
      .catch(() => undefined);
    return () => abort.abort();
  }, [isLoaded, isSignedIn]);
  const create = async (later: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { meetingId } = await api<{ meetingId: string }>('/api/meetings', {
        method: 'POST',
        body: '{}',
      });
      if (later) {
        setLink(meetingId);
        setBusy(false);
      } else router.push(`/${meetingId}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };
  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const id = parseMeetingCode(code);
    if (!id) {
      setError(
        'Enter a meeting code such as abc-defg-hij, or paste a meeting link.',
      );
      return;
    }
    router.push(`/${id}`);
  };
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <section>
            <h1 className="text-4xl sm:text-5xl leading-tight text-meet-black">
              Video calls and meetings for everyone
            </h1>
            <p className="mt-6 text-lg text-meet-gray max-w-md">
              Connect with your team. Share ideas, draw together, and follow
              every speaker with live captions.
            </p>
            <div className="mt-8 flex flex-wrap gap-5 items-center">
              {isSignedIn ? (
                <div className="relative">
                  <button
                    disabled={busy}
                    onClick={() => setMenu((value) => !value)}
                    className="primary-button flex items-center gap-2"
                  >
                    <Videocall />
                    {busy ? 'Creating…' : 'New meeting'}
                  </button>
                  <NewMeetingDropdown
                    isOpen={menu}
                    onClose={closeMenu}
                    options={[
                      {
                        icon: <LinkIcon />,
                        label: 'Create a meeting for later',
                        onClick: () => void create(true),
                      },
                      {
                        icon: <Add />,
                        label: 'Start an instant meeting',
                        onClick: () => void create(false),
                      },
                    ]}
                  />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="primary-button">
                    Sign in to create a meeting
                  </button>
                </SignInButton>
              )}
              <form onSubmit={join} className="flex gap-2">
                <input
                  className="rounded-lg border border-border-gray px-4 py-3 w-52"
                  aria-label="Meeting code or link"
                  placeholder="Enter a code or link"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <button
                  className="text-primary font-medium px-3 disabled:opacity-40"
                  disabled={!code.trim() || busy}
                >
                  Join
                </button>
              </form>
            </div>
            {error && (
              <p role="alert" className="mt-5 text-meet-red">
                {error}
              </p>
            )}
          </section>
          <section className="text-center">
            <div className="mx-auto w-60 h-60 rounded-full bg-blue-50 grid place-items-center text-primary [&_svg]:w-28 [&_svg]:h-28 [&_svg]:fill-primary">
              <Videocall />
            </div>
            <h2 className="mt-8 text-2xl">Get a link you can share</h2>
            <p className="mt-3 text-meet-gray max-w-sm mx-auto">
              Create a meeting, share its link, and admit people when you’re
              ready.
            </p>
          </section>
        </div>
        {recent.length > 0 && (
          <section className="mt-16 border-t border-hairline-gray pt-8">
            <h2 className="text-xl mb-4">Recent meetings</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border border-hairline-gray rounded-xl p-4"
                >
                  <p className="font-medium">{meeting.id}</p>
                  <p className="text-sm text-meet-gray mt-1">
                    {meeting.host || 'Meeting'} ·{' '}
                    {new Date(meeting.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-5 mt-4">
                    {!meeting.ended && (
                      <Link
                        className="text-primary text-sm"
                        href={`/${meeting.id}`}
                      >
                        Join meeting
                      </Link>
                    )}
                    {meeting.isHost && (
                      <Link
                        className="text-primary text-sm"
                        href={`/${meeting.id}/meeting-end?reason=history`}
                      >
                        Recordings
                      </Link>
                    )}
                    {meeting.ended && (
                      <span className="text-sm text-meet-gray">Ended</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <MeetingLinkPopup
          isOpen={!!link}
          onClose={() => setLink('')}
          meetingId={link}
          baseUrl={typeof window === 'undefined' ? '' : window.location.origin}
        />
      </main>
    </div>
  );
}
