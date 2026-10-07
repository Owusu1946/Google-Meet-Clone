'use client';
import { useEffect, useRef, useState } from 'react';
import Dialog from './Dialog';
import Clipboard from './Clipboard';
import { api, errorMessage } from '@/lib/meeting';
export default function AddPeoplePopup({
  isOpen,
  onClose,
  meetingId,
}: {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
}) {
  const [text, setText] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const requestId = useRef('');
  useEffect(() => {
    if (!isOpen) return;
    requestId.current = crypto.randomUUID();
    setStatus('');
    const controller = new AbortController();
    void api<{ emailEnabled: boolean }>(`/api/meetings/${meetingId}/invites`, {
      signal: controller.signal,
    })
      .then((result) => setEnabled(result.emailEnabled))
      .catch(() => setEnabled(false));
    return () => controller.abort();
  }, [isOpen, meetingId]);
  const emails = [...new Set(text.split(/[,;\s]+/).filter(Boolean))];
  const valid =
    emails.length > 0 &&
    emails.length <= 10 &&
    emails.every((email) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email));
  const link =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/${meetingId}`;
  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await api<{ sent: number }>(
        `/api/meetings/${meetingId}/invites`,
        {
          method: 'POST',
          body: JSON.stringify({ emails, requestId: requestId.current }),
        },
      );
      setStatus(
        `Sent ${result.sent} invitation${result.sent === 1 ? '' : 's'}.`,
      );
      requestId.current = crypto.randomUUID();
      setText('');
    } catch (failure) {
      setStatus(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={isOpen} onClose={onClose} title="Invite people">
      <p className="text-sm text-meet-gray mb-4">
        Share the link or invite up to 10 people by email. New participants
        still follow your meeting admission settings.
      </p>
      <Clipboard value={link} />
      <label className="block text-sm mt-5">
        Email addresses
        <textarea
          className="w-full border rounded-xl p-3 mt-2"
          disabled={busy}
          rows={3}
          placeholder="ada@example.com, kojo@example.com"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            requestId.current = crypto.randomUUID();
          }}
        />
      </label>
      {enabled ? (
        <button
          className="primary-button mt-4"
          disabled={!valid || busy}
          onClick={() => void send()}
        >
          {busy ? 'Sending…' : 'Send invitations'}
        </button>
      ) : (
        <a
          aria-disabled={!valid}
          className={`primary-button inline-block mt-4 ${valid ? '' : 'opacity-40 pointer-events-none'}`}
          href={`mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent('Meeting invitation')}&body=${encodeURIComponent(`Join our meeting: ${link}`)}`}
        >
          Open email app
        </a>
      )}
      <p role="status" className="text-sm mt-4">
        {status}
      </p>
    </Dialog>
  );
}
