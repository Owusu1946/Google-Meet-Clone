import {
  hasAudio,
  hasVideo,
  type StreamVideoParticipant,
} from '@stream-io/video-react-sdk';
import Avatar from './Avatar';
import type { JoinRequest } from '@/lib/meeting';
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
  const ordered = [...participants].sort((a, b) =>
    a.userId === hostId
      ? -1
      : b.userId === hostId
        ? 1
        : (a.name || a.userId).localeCompare(b.name || b.userId),
  );
  return (
    <div className="p-5 overflow-y-auto space-y-6">
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
        <h3 className="text-sm font-medium mb-4">
          In the meeting ({participants.length})
        </h3>
        <ul className="space-y-5">
          {ordered.map((participant) => (
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
      </section>
    </div>
  );
}
