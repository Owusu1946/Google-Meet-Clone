import { ParticipantView, useCallStateHooks } from '@stream-io/video-react-sdk';
import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';
export default function FocusLayout() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const local = participants.find(
    (participant) => participant.isLocalParticipant,
  );
  const main =
    participants.find((participant) => !participant.isLocalParticipant) ||
    local;
  if (!main)
    return (
      <div className="grid place-items-center h-full" role="status">
        Connecting to your meeting…
      </div>
    );
  return (
    <div className="meet-focus-layout">
      <div className="meet-focus-main">
        <ParticipantView
          participant={main}
          ParticipantViewUI={ParticipantViewUI}
          VideoPlaceholder={VideoPlaceholder}
        />
      </div>
      {local && main.sessionId !== local.sessionId && (
        <div className="meet-self-preview">
          <ParticipantView
            participant={local}
            ParticipantViewUI={ParticipantViewUI}
            VideoPlaceholder={VideoPlaceholder}
          />
        </div>
      )}
    </div>
  );
}
