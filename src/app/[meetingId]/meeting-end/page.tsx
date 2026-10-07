'use client';
import { useEffect, useState } from 'react';
import { api, type MeetingAccess } from '@/lib/meeting';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import RecordingsPopup from '@/components/RecordingsPopup';
export default function MeetingEnd() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [isHost, setIsHost] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void api<MeetingAccess>(`/api/meetings/${meetingId}/access`, {
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    })
      .then((result) => setIsHost(result.isHost))
      .catch(() => undefined);
    return () => controller.abort();
  }, [meetingId]);
  const reason = useSearchParams().get('reason');
  const title =
    reason === 'ended'
      ? 'This meeting has ended'
      : reason === 'removed'
        ? 'You were removed from the meeting'
        : reason === 'history'
          ? 'Meeting recordings'
          : reason === 'disconnected'
            ? 'You’re disconnected from the meeting'
            : 'You left the meeting';
  return (
    <div>
      <Header />
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-4 text-meet-gray">{meetingId}</p>
        <div className="flex justify-center gap-4 mt-8">
          {!['ended', 'removed', 'history'].includes(reason || '') && (
            <Link href={`/${meetingId}`} className="primary-button">
              Rejoin
            </Link>
          )}
          <Link
            href="/"
            className="primary-button !bg-light-gray !text-primary"
          >
            Return home
          </Link>
        </div>
        {isHost && (
          <section className="mt-12 text-left border rounded-2xl overflow-hidden">
            <h2 className="text-xl px-5 pt-5">Recordings</h2>
            <RecordingsPopup meetingId={meetingId} />
          </section>
        )}
      </main>
    </div>
  );
}
