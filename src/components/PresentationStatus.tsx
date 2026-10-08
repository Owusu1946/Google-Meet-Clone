import { hasScreenShare } from '@stream-io/video-react-sdk';
import { useRoom } from '@/contexts/MeetingRoomContext';
import PresentToAll from './icons/PresentToAll';
import { usePresenterWindow } from '@/contexts/PresenterPipContext';

export default function PresentationStatus() {
  const room = useRoom();
  const pip = usePresenterWindow();
  const presenter =
    (room.local && hasScreenShare(room.local) ? room.local : undefined) ||
    room.participants.find(hasScreenShare);
  if (!presenter) return null;
  return (
    <div className="presentation-status" role="status">
      <PresentToAll />
      <span title={presenter.name || 'Participant'}>
        {presenter.isLocalParticipant
          ? 'You are presenting'
          : `${presenter.name || 'Participant'} is presenting`}
      </span>
      {presenter.isLocalParticipant && (
        <>
          {pip.supported && (
            <button disabled={pip.busy} onClick={() => void pip.open()}>
              {pip.pip ? 'Picture-in-picture open' : 'Picture-in-picture'}
            </button>
          )}
          <button
            disabled={room.busy}
            onClick={() =>
              void room.run(() => room.share.screenShare.disable())
            }
          >
            Stop presenting
          </button>
        </>
      )}
      {pip.error && (
        <span className="presentation-pip-error" role="alert">
          {pip.error}
        </span>
      )}
    </div>
  );
}
