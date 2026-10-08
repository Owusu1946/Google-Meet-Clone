import { hasScreenShare, ParticipantView } from '@stream-io/video-react-sdk';
import { useRoom } from '@/contexts/MeetingRoomContext';
import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';

export default function PresentationLayout() {
  const room = useRoom();
  const presenter = room.participants.find(hasScreenShare);
  if (!presenter) return null;
  return (
    <div className="presentation-layout">
      <div
        className="presentation-screen"
        aria-label={`${presenter.name || 'Participant'} is presenting`}
      >
        <ParticipantView
          participant={presenter}
          trackType="screenShareTrack"
          ParticipantViewUI={() => null}
        />
      </div>
      <div className="presentation-participants" aria-label="Participants">
        {room.participants.map((participant) => (
          <div className="presentation-participant" key={participant.sessionId}>
            <ParticipantView
              participant={participant}
              ParticipantViewUI={ParticipantViewUI}
              VideoPlaceholder={VideoPlaceholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
