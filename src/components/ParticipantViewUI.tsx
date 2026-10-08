import {
  DefaultScreenShareOverlay,
  hasAudio,
  isPinned,
  useParticipantViewContext,
} from '@stream-io/video-react-sdk';
import { useRoom } from '@/contexts/MeetingRoomContext';
import MicOffFilled from './icons/MicOffFilled';
import Keep from './icons/Keep';
import KeepOffFilled from './icons/KeepOffFilled';
import { useRaisedHands } from '@/contexts/RaisedHandsContext';
export const speechRingClassName = 'speech-ring';
export const menuOverlayClassName = 'menu-overlay';
export default function ParticipantViewUI() {
  const { participant, trackType } = useParticipantViewContext();
  const room = useRoom();
  const { raisedUserIds } = useRaisedHands();
  const pinned = isPinned(participant);
  const audio = hasAudio(participant);
  const name = participant.isLocalParticipant
    ? 'You'
    : participant.name || 'Participant';
  const togglePin = () => {
    if (participant.pin && !participant.pin.isLocalPin) {
      if (room.access.isHost)
        void room.run(() =>
          room.call.unpinForEveryone({
            user_id: participant.userId,
            session_id: participant.sessionId,
          }),
        );
      else room.setError('The host pinned this participant.');
    } else if (pinned) room.call.unpin(participant.sessionId);
    else room.call.pin(participant.sessionId);
  };
  return (
    <>
      {participant.isLocalParticipant && trackType === 'screenShareTrack' && (
        <DefaultScreenShareOverlay />
      )}
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl ${speechRingClassName} ${participant.isSpeaking && audio ? 'ring-4 ring-inset ring-light-blue' : ''}`}
      />
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {!audio && (
          <span
            aria-label={`${name} is muted`}
            className="p-1 rounded-full bg-black/50"
          >
            <MicOffFilled width={18} height={18} />
          </span>
        )}
        <button
          aria-label={`${pinned ? 'Unpin' : 'Pin'} ${name}`}
          aria-pressed={pinned}
          onClick={togglePin}
          className="participant-pin p-2 rounded-full bg-black/30 text-white hover:bg-black/60"
        >
          {pinned ? <KeepOffFilled /> : <Keep />}
        </button>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 pointer-events-none text-white text-sm">
        {raisedUserIds.includes(participant.userId) && (
          <span
            className="px-2 py-1 rounded-full bg-green-300 text-meet-black"
            aria-label={`${name} raised their hand`}
          >
            ✋
          </span>
        )}
        <span className="truncate px-2 py-1 font-medium participant-name">
          {name}
          {trackType === 'screenShareTrack' ? ' · presenting' : ''}
        </span>
      </div>
    </>
  );
}
