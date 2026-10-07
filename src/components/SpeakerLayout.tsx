import {
  hasScreenShare,
  isPinned,
  ParticipantView,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';
export default function SpeakerLayout() {
  const { useParticipants, useDominantSpeaker } = useCallStateHooks();
  const participants = useParticipants();
  const dominant = useDominantSpeaker();
  const spotlight =
    participants.find(hasScreenShare) ||
    participants.find(isPinned) ||
    dominant ||
    participants[0];
  const others = participants.filter(
    (participant) => participant.sessionId !== spotlight?.sessionId,
  );
  if (!spotlight)
    return (
      <div className="grid place-items-center h-full text-white">
        Waiting for participants…
      </div>
    );
  return (
    <div className="speaker-layout">
      <div className="speaker-spotlight">
        <ParticipantView
          participant={spotlight}
          trackType={
            hasScreenShare(spotlight) ? 'screenShareTrack' : 'videoTrack'
          }
          ParticipantViewUI={ParticipantViewUI}
          VideoPlaceholder={VideoPlaceholder}
        />
      </div>
      <div className="speaker-strip">
        {others.map((participant) => (
          <div key={participant.sessionId} className="speaker-tile">
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
