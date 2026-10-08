import type { ReactNode } from 'react';
import { hasScreenShare, ParticipantView } from '@stream-io/video-react-sdk';
import { useRoom } from '@/contexts/MeetingRoomContext';
import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';

export default function PresentationLayout({
  content,
}: {
  content?: ReactNode;
}) {
  const room = useRoom();
  const presenter = room.participants.find(hasScreenShare);
  if (!presenter && !content) return null;
  return (
    <div className="presentation-layout">
      <div
        className="presentation-screen"
        aria-label={
          content
            ? 'Shared whiteboard'
            : `${presenter?.name || 'Participant'} is presenting`
        }
      >
        {content ||
          (presenter && (
            <ParticipantView
              participant={presenter}
              trackType="screenShareTrack"
              muteAudio
              ParticipantViewUI={() => null}
            />
          ))}
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
