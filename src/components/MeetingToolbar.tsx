import { useEffect, useRef } from 'react';
import useMeetingActions from '@/hooks/useMeetingActions';
import { useRoom } from '@/contexts/MeetingRoomContext';
import useTime from '@/hooks/useTime';
import CallControlButton from './CallControlButton';
import Mic from './icons/Mic';
import MicOff from './icons/MicOff';
import Videocam from './icons/Videocam';
import VideocamOff from './icons/VideocamOff';
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
    busy,
    toggleMic,
    toggleCamera,
    setMenu,
    setLeavePrompt,
    leave,
    panel,
    togglePanel,
    unread,
  } = room;
  const { currentTime } = useTime();
  const actions = useMeetingActions();
  const toolbar = useRef<HTMLElement>(null);
  const { toolbarActionCount, setToolbarActionCount } = room;
  useEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Reserve core controls, People/Chat, gaps and meeting metadata before extras.
      setToolbarActionCount(
        width < 768
          ? 0
          : Math.max(
              0,
              Math.floor((width - 312 - (width >= 1280 ? 240 : 0)) / 48),
            ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [setToolbarActionCount]);
  const visible = actions.slice(0, toolbarActionCount);
  const overflow = actions.length > toolbarActionCount;
  return (
    <footer ref={toolbar} className="meeting-toolbar">
      <div className="meeting-toolbar-info items-center gap-3 text-sm min-w-0">
        <span>{currentTime}</span>
        <span>·</span>
        <span className="truncate">{access.meetingId}</span>
      </div>
      <div className="flex items-center justify-center gap-2 shrink-0">
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
        {visible.map((action) => (
          <CallControlButton key={action.id} {...action} />
        ))}
        {overflow && (
          <CallControlButton
            title="More options"
            icon={<MoreVert />}
            onClick={() => setMenu(true)}
          />
        )}
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
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
