import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  hasScreenShare,
  ParticipantView,
  StreamTheme,
} from '@stream-io/video-react-sdk';
import { useRoom } from './MeetingRoomContext';
import { RaisedHandsProvider } from './RaisedHandsContext';
import usePresenterPip from '@/hooks/usePresenterPip';
import ParticipantViewUI from '@/components/ParticipantViewUI';
import VideoPlaceholder from '@/components/VideoPlaceholder';
import Mic from '@/components/icons/Mic';
import MicOff from '@/components/icons/MicOff';
import Videocam from '@/components/icons/Videocam';
import VideocamOff from '@/components/icons/VideocamOff';
import PresentToAll from '@/components/icons/PresentToAll';
import CallEndFilled from '@/components/icons/CallEndFilled';

const PresenterPipContext = createContext<ReturnType<
  typeof usePresenterPip
> | null>(null);
export function usePresenterWindow() {
  const value = useContext(PresenterPipContext);
  if (!value) throw new Error('Presenter window provider is missing.');
  return value;
}
export function PresenterPipProvider({ children }: { children: ReactNode }) {
  const room = useRoom();
  const active = !!room.local && hasScreenShare(room.local);
  const pip = usePresenterPip(active);
  const returnToCall = () => {
    pip.close();
    window.focus();
  };
  return (
    <PresenterPipContext.Provider value={pip}>
      {children}
      {pip.pip &&
        createPortal(
          <StreamTheme className="root-theme presenter-pip-theme">
            <RaisedHandsProvider value={{ raisedUserIds: room.raisedUserIds }}>
              <div className="presenter-pip">
                <header>
                  <PresentToAll />
                  <span>You are presenting</span>
                  <button onClick={returnToCall}>Back to call</button>
                </header>
                <div className="presenter-pip-participants">
                  {room.participants.map((participant) => (
                    <div key={participant.sessionId}>
                      <ParticipantView
                        participant={participant}
                        ParticipantViewUI={ParticipantViewUI}
                        VideoPlaceholder={VideoPlaceholder}
                      />
                    </div>
                  ))}
                </div>
                <div className="presenter-pip-controls">
                  <button
                    aria-label={
                      room.mic.optimisticIsMute
                        ? 'Turn on microphone'
                        : 'Turn off microphone'
                    }
                    aria-pressed={!room.mic.optimisticIsMute}
                    disabled={room.busy}
                    onClick={room.toggleMic}
                  >
                    {room.mic.optimisticIsMute ? <MicOff /> : <Mic />}
                  </button>
                  <button
                    aria-label={
                      room.camera.optimisticIsMute
                        ? 'Turn on camera'
                        : 'Turn off camera'
                    }
                    aria-pressed={!room.camera.optimisticIsMute}
                    disabled={room.busy}
                    onClick={room.toggleCamera}
                  >
                    {room.camera.optimisticIsMute ? (
                      <VideocamOff />
                    ) : (
                      <Videocam />
                    )}
                  </button>
                  <button
                    aria-label="Stop presenting"
                    disabled={room.busy}
                    onClick={() =>
                      void room.run(() => room.share.screenShare.disable())
                    }
                  >
                    <PresentToAll />
                  </button>
                  <button
                    className="presenter-pip-leave"
                    aria-label="Leave meeting"
                    disabled={room.busy}
                    onClick={() => {
                      returnToCall();
                      if (room.access.isHost) room.setLeavePrompt(true);
                      else void room.leave();
                    }}
                  >
                    <CallEndFilled />
                  </button>
                </div>
                {room.error && (
                  <p className="presenter-pip-error" role="alert">
                    {room.error}
                  </p>
                )}
              </div>
            </RaisedHandsProvider>
          </StreamTheme>,
          pip.pip.document.body,
        )}
    </PresenterPipContext.Provider>
  );
}
