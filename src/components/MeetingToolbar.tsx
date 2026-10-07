import { useRoom } from '@/contexts/MeetingRoomContext';
import { api } from '@/lib/meeting';
import useTime from '@/hooks/useTime';
import CallControlButton from './CallControlButton';
import Mic from './icons/Mic';
import MicOff from './icons/MicOff';
import Videocam from './icons/Videocam';
import VideocamOff from './icons/VideocamOff';
import BackHand from './icons/BackHand';
import ClosedCaptions from './icons/ClosedCaptions';
import PresentToAll from './icons/PresentToAll';
import MoreVert from './icons/MoreVert';
import CallEndFilled from './icons/CallEndFilled';
import Group from './icons/Group';
import ChatIcon from './icons/Chat';

export default function MeetingToolbar() {
  const room = useRoom();
  const {
    access,
    participants,
    mic,
    camera,
    share,
    canShare,
    busy,
    local,
    raised,
    run,
    toggleMic,
    toggleCamera,
    showCaptions,
    toggleCaptions,
    setMenu,
    setLeavePrompt,
    leave,
    panel,
    togglePanel,
    unread,
  } = room;
  const { currentTime } = useTime();
  return (
    <footer className="meeting-toolbar">
      <div className="hidden lg:flex items-center gap-3 text-sm min-w-0">
        <span>{currentTime}</span>
        <span>·</span>
        <span className="truncate">{access.meetingId}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <CallControlButton
          title={
            mic.optimisticIsMute ? 'Turn on microphone' : 'Turn off microphone'
          }
          icon={mic.optimisticIsMute ? <MicOff /> : <Mic />}
          onClick={toggleMic}
          disabled={busy}
          active={mic.optimisticIsMute}
          className={mic.optimisticIsMute ? 'toggle-button-alert' : ''}
        />
        <CallControlButton
          title={camera.optimisticIsMute ? 'Turn on camera' : 'Turn off camera'}
          icon={camera.optimisticIsMute ? <VideocamOff /> : <Videocam />}
          onClick={toggleCamera}
          disabled={busy}
          active={camera.optimisticIsMute}
          className={camera.optimisticIsMute ? 'toggle-button-alert' : ''}
        />
        <CallControlButton
          title={raised ? 'Lower hand' : 'Raise hand'}
          icon={<BackHand />}
          active={raised}
          disabled={busy || !local}
          className="hidden min-[400px]:inline-flex"
          onClick={() =>
            void run(() =>
              api(`/api/meetings/${access.meetingId}/state`, {
                method: 'POST',
                body: JSON.stringify({
                  raised: !raised,
                  sessionId: local?.sessionId,
                }),
              }),
            )
          }
        />
        <CallControlButton
          title={showCaptions ? 'Hide captions' : 'Show captions'}
          icon={<ClosedCaptions />}
          active={showCaptions}
          disabled={busy}
          onClick={() => void toggleCaptions()}
          className="hidden sm:inline-flex"
        />
        <CallControlButton
          title={share.optimisticIsMute ? 'Present now' : 'Stop presenting'}
          icon={<PresentToAll />}
          active={!share.optimisticIsMute}
          disabled={busy || !canShare}
          onClick={() => void run(() => share.screenShare.toggle())}
          className="hidden sm:inline-flex"
        />
        <CallControlButton
          title="More options"
          icon={<MoreVert />}
          onClick={() => setMenu(true)}
        />
        <CallControlButton
          title="Leave meeting"
          icon={<CallEndFilled />}
          onClick={() => (access.isHost ? setLeavePrompt(true) : void leave())}
          disabled={busy}
          className="leave-call-button"
        />
      </div>
      <div className="flex items-center gap-1">
        <CallControlButton
          title={`People (${participants.length})`}
          icon={<Group />}
          active={panel === 'people'}
          onClick={() => togglePanel('people')}
        />
        <div className="relative">
          <CallControlButton
            title="Chat with everyone"
            icon={<ChatIcon />}
            active={panel === 'chat'}
            onClick={() => togglePanel('chat')}
          />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] rounded-full px-1.5">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
