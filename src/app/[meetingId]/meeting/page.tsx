'use client';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { CallingState, StreamTheme } from '@stream-io/video-react-sdk';
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

export default function MeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  return (
    <MeetProvider meetingId={meetingId}>
      <MeetingRoomProvider>
        <MeetingRoom />
      </MeetingRoomProvider>
    </MeetProvider>
  );
}
function MeetingRoom() {
  const room = useRoom();
  const {
    panel,
    setPanel,
    spotlight,
    raisedUserIds,
    whiteboard,
    setWhiteboard,
    showCaptions,
    captions,
    state,
    recording,
    requests,
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
  const previous = useRef(room.participants.length);
  const joinAudio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (room.participants.length > previous.current)
      void joinAudio.current?.play().catch(() => undefined);
    previous.current = room.participants.length;
  }, [room.participants.length]);
  return (
    <StreamTheme className="root-theme">
      <div id="meeting-root" className="meeting-shell">
        <MeetingTopbar />
        <main className={`meeting-content ${panel ? 'has-panel' : ''}`}>
          <div className="meeting-stage">
            <RaisedHandsProvider value={{ raisedUserIds }}>
              {spotlight ? (
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
            {requests.length > 0 && panel !== 'people' && (
              <button
                className="admission-banner"
                onClick={() => setPanel('people')}
              >
                {requests.length}{' '}
                {requests.length === 1 ? 'person is' : 'people are'} waiting to
                join · Review
              </button>
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
        <audio
          ref={joinAudio}
          src="https://www.gstatic.com/meet/sounds/join_call_6a6a67d6bcc7a4e373ed40fdeff3930a.ogg"
        />
      </div>
    </StreamTheme>
  );
}
