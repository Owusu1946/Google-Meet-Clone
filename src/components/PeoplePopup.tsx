import {
  hasAudio,
  hasVideo,
  hasScreenShare,
  type StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import Avatar from './Avatar';
import type { JoinRequest } from '@/lib/meeting';
import { useState } from 'react';
export default function PeoplePopup({
  participants,
  hostId,
  meId,
  raisedUserIds,
  requests,
  isHost,
  onAdmit,
  onDeny,
  onMute,
  onRemove,
  busy,
}: {
  participants: StreamVideoParticipant[];
  hostId: string;
  meId: string;
  raisedUserIds: string[];
  requests: JoinRequest[];
  isHost: boolean;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onMute: (id: string) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const [search, setSearch] = useState('');
  const ordered = [...participants].sort((a, b) =>
    a.userId === hostId
      ? -1
      : b.userId === hostId
        ? 1
        : (a.name || a.userId).localeCompare(b.name || b.userId),
  );
  return (
    <div className="people-panel-content p-5 overflow-y-auto space-y-6">
      <label className="people-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          aria-label="Search for people"
          placeholder="Search for people"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {isHost && requests.length > 0 && (
        <section>
          <h3 className="text-sm font-medium mb-3">
            Waiting to join ({requests.length})
          </h3>
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl bg-blue-50 p-3 mb-2">
              <p className="font-medium text-sm">{request.name}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <button
                  disabled={busy}
                  className="text-primary"
                  onClick={() => onAdmit(request.id)}
                >
                  Admit
                </button>
                <button
                  disabled={busy}
                  className="text-meet-red"
                  onClick={() => onDeny(request.id)}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      <section>
        <h3 className="people-section-label">In the meeting</h3>
        <details className="people-contributors" open>
          <summary>
            Contributors <span>{participants.length}</span>
          </summary>
          <ul className="space-y-5">
            {ordered
              .filter((participant) =>
                (participant.name || participant.userId)
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              )
              .map((participant) => (
                <li key={participant.sessionId}>
                  <div className="flex gap-3 items-center">
                    <Avatar participant={participant} width={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {participant.name || participant.userId}
                        {participant.userId === meId ? ' (You)' : ''}
                      </p>
                      <p className="text-xs text-meet-gray mt-1">
                        {participant.userId === hostId ? 'Host · ' : ''}
                        {hasScreenShare(participant) ? 'Presenting · ' : ''}
                        {hasAudio(participant) ? 'Mic on' : 'Mic off'} ·{' '}
                        {hasVideo(participant) ? 'Camera on' : 'Camera off'}
                      </p>
                    </div>
                    {raisedUserIds.includes(participant.userId) && (
                      <span aria-label="Hand raised">✋</span>
                    )}
                    {participant.isSpeaking && (
                      <span className="text-xs text-primary">Speaking</span>
                    )}
                  </div>
                  {isHost && participant.userId !== meId && (
                    <div className="ml-12 mt-2 text-xs flex gap-4">
                      <button
                        disabled={busy || !hasAudio(participant)}
                        onClick={() => onMute(participant.userId)}
                        className="text-primary"
                      >
                        Mute
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onRemove(participant.userId)}
                        className="text-meet-red"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
          {!ordered.some((participant) =>
            (participant.name || participant.userId)
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
          ) && (
            <p role="status" className="p-4 text-sm">
              No people match your search.
            </p>
          )}
        </details>
      </section>
    </div>
  );
}
