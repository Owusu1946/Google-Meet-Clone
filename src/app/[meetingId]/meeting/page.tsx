'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CallingState,
  hasScreenShare,
  StreamTheme,
} from '@stream-io/video-react-sdk';
import MeetProvider from '@/contexts/MeetProvider';
import { MeetingRoomProvider, useRoom } from '@/contexts/MeetingRoomContext';
import { RaisedHandsProvider } from '@/contexts/RaisedHandsContext';
import GridLayout from '@/components/GridLayout';
import FocusLayout from '@/components/FocusLayout';
import MeetingTopbar from '@/components/MeetingTopbar';
import MeetingWelcomeCard from '@/components/MeetingWelcomeCard';
import SpeakerLayout from '@/components/SpeakerLayout';
import CaptionsOverlay from '@/components/CaptionsOverlay';
import SmartWhiteboardOverlay from '@/components/SmartWhiteboardOverlay';
import ReactionOverlay from '@/components/ReactionOverlay';
import MeetingToolbar from '@/components/MeetingToolbar';
import MeetingPanels from '@/components/MeetingPanels';
import MeetingDialogs from '@/components/MeetingDialogs';
import PresentationLayout from '@/components/PresentationLayout';
import PresentingIcon from '@/components/icons/PresentToAll';
import {
  PresenterPipProvider,
  usePresenterWindow,
} from '@/contexts/PresenterPipContext';

export default function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  return (
    <MeetProvider meetingId={meetingId}>
      <MeetingRoomProvider>
        <PresenterPipProvider>
          <MeetingRoom />
        </PresenterPipProvider>
      </MeetingRoomProvider>
    </MeetProvider>
  );
}
function MeetingRoom() {
  const room = useRoom();
  const pip = usePresenterWindow();
  const {
    panel,
    spotlight,
    raisedUserIds,
    whiteboard,
    setWhiteboard,
    showCaptions,
    captions,
    state,
    recording,
    error,
    setError,
    reactions,
  } = room;
  useEffect(() => {
    if (room.mediaError)
      setError(
        `Some devices could not be enabled: ${room.mediaError}. Check permissions or change devices in Settings.`,
      );
  }, [room.mediaError, setError]);
  return (
    <StreamTheme className="root-theme">
      <div id="meeting-root" className="meeting-shell">
        <MeetingTopbar />
        <main className={`meeting-content ${panel ? 'has-panel' : ''}`}>
          <div className="meeting-stage">
            <RaisedHandsProvider value={{ raisedUserIds }}>
              {pip.pip ? (
                <div className="presenter-pip-placeholder">
                  <PresentingIcon />
                  <h2>Picture-in-picture is open while you’re presenting</h2>
                  <p>
                    See the people in your call while you share your screen.
                  </p>
                  <button onClick={pip.close}>Bring the call back here</button>
                </div>
              ) : room.participants.some(hasScreenShare) ? (
                <PresentationLayout />
              ) : spotlight ? (
                <SpeakerLayout />
              ) : room.layout === 'auto' && room.participants.length <= 2 ? (
                <FocusLayout />
              ) : (
                <GridLayout />
              )}
            </RaisedHandsProvider>
            {room.custom.boardPresenting === true && !whiteboard && (
              <button
                className="admission-banner"
                onClick={() => setWhiteboard(true)}
              >
                The host is presenting the whiteboard · Open
              </button>
            )}
            <SmartWhiteboardOverlay
              open={whiteboard}
              onClose={() => setWhiteboard(false)}
            />
            {showCaptions && <CaptionsOverlay {...captions} />}
            {[
              CallingState.RECONNECTING,
              CallingState.MIGRATING,
              CallingState.OFFLINE,
            ].includes(state) && (
              <div role="status" className="connection-banner">
                Connection interrupted. Reconnecting…
              </div>
            )}
            {state === CallingState.RECONNECTING_FAILED && (
              <div role="alert" className="connection-banner">
                Could not reconnect.{' '}
                <button
                  className="underline"
                  onClick={() => window.location.reload()}
                >
                  Rejoin meeting
                </button>
              </div>
            )}
            {recording && (
              <div className="recording-banner" role="status">
                <span className="w-2 h-2 bg-meet-red rounded-full" />
                This meeting is being recorded
              </div>
            )}
          </div>
          <MeetingPanels />
          <MeetingWelcomeCard />
        </main>
        <MeetingToolbar />
        {error && (
          <div className="meeting-error" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        <MeetingDialogs />
        <ReactionOverlay
          reactions={reactions.reactions}
          onReactionComplete={reactions.removeReaction}
        />
      </div>
    </StreamTheme>
  );
}
