import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Audio, ParticipantView } from '@stream-io/video-react-sdk';
import { useRoom } from '@/contexts/MeetingRoomContext';
import { groupedParticipants } from '@/lib/participant-grid';
import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';
import Avatar from './Avatar';

export default function GridLayout() {
  const room = useRoom();
  const container = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(9);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCapacity(width < 600 ? 4 : width < 960 || height < 430 ? 6 : 9);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const { visible, hidden } = groupedParticipants(room.participants, capacity);
  const tiles = visible.length + (hidden.length ? 1 : 0);
  return (
    <div
      ref={container}
      className="grouped-participant-grid"
      style={{ '--grid-columns': tiles <= 4 ? 2 : 3 } as CSSProperties}
    >
      {visible.map((participant) => (
        <div className="grouped-participant-tile" key={participant.sessionId}>
          <ParticipantView
            participant={participant}
            muteAudio
            ParticipantViewUI={ParticipantViewUI}
            VideoPlaceholder={VideoPlaceholder}
          />
        </div>
      ))}
      {hidden.length > 0 && (
        <button
          className="grouped-others-tile"
          onClick={() => room.setPanel('people')}
          aria-label={`View ${hidden.length} other ${hidden.length === 1 ? 'participant' : 'participants'} in People`}
        >
          <span className="grouped-others-avatars" aria-hidden="true">
            {hidden.slice(0, 2).map((participant) => (
              <Avatar
                key={participant.sessionId}
                participant={participant}
                width={64}
              />
            ))}
          </span>
          <span>
            {hidden.length} {hidden.length === 1 ? 'other' : 'others'}
          </span>
        </button>
      )}
      {/* Audio remains mounted for every remote session, including grouped tiles. */}
      {room.participants
        .filter((participant) => !participant.isLocalParticipant)
        .map((participant) => (
          <Audio key={participant.sessionId} participant={participant} />
        ))}
    </div>
  );
}
