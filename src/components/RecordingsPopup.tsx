'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/meeting';
import type { CallRecording } from '@stream-io/node-sdk';
export default function RecordingsPopup({ meetingId }: { meetingId: string }) {
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ recordings: CallRecording[] }>(
        `/api/meetings/${meetingId}/recordings`,
      );
      setRecordings(data.recordings);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [meetingId]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="p-5 space-y-4">
      <p className="text-sm text-meet-gray">
        Recordings may take a few minutes to process after recording stops. Only
        the host can access them.
      </p>
      <button
        className="text-primary text-sm"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? 'Loading…' : 'Refresh recordings'}
      </button>
      {error && (
        <p role="alert" className="text-meet-red text-sm">
          {error}
        </p>
      )}
      {!loading && !error && !recordings.length && (
        <p className="text-sm">No recordings are ready yet.</p>
      )}
      {recordings.map((recording) => (
        <a
          key={`${recording.session_id}:${recording.filename}`}
          href={recording.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-hairline-gray rounded-xl p-4"
        >
          <p className="text-primary text-sm">Play recording ↗</p>
          <p className="text-xs text-meet-gray mt-2">
            {new Date(recording.start_time).toLocaleString()}
          </p>
        </a>
      ))}
    </div>
  );
}
