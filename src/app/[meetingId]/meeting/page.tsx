'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CallingState,
  hasScreenShare,
  isPinned,
  RecordCallButton,
  StreamTheme,
  useCall,
  useCallStateHooks,
  useConnectedUser,
} from '@stream-io/video-react-sdk';
import { Channel } from 'stream-chat';
import { DefaultStreamChatGenerics, useChatContext } from 'stream-chat-react';

import CallControlButton from '@/components/CallControlButton';
import CallInfoButton from '@/components/CallInfoButton';
import CallEndFilled from '@/components/icons/CallEndFilled';
import Chat from '@/components/icons/Chat';
import ChatFilled from '@/components/icons/ChatFilled';
import ChatPopup from '@/components/ChatPopup';
import ClosedCaptions from '@/components/icons/ClosedCaptions';
import GridLayout from '@/components/GridLayout';
import Group from '@/components/icons/Group';
import Info from '@/components/icons/Info';
import Mood from '@/components/icons/Mood';
import PresentToAll from '@/components/icons/PresentToAll';
import MeetingPopup from '@/components/MeetingPopup';
import MoreVert from '@/components/icons/MoreVert';
import RecordingsPopup from '@/components/RecordingsPopup';
import SpeakerLayout from '@/components/SpeakerLayout';
import ToggleAudioButton from '@/components/ToggleAudioButton';
import ToggleVideoButton from '@/components/ToggleVideoButton';
import ReactionOverlay, { useReactions } from '@/components/ReactionOverlay';
import ReactionPicker from '@/components/ReactionPicker';
import BackgroundSelector from '@/components/BackgroundSelector';
import VisualEffects from '@/components/icons/VisualEffects';
import PeoplePopup from '@/components/PeoplePopup';
import CaptionsOverlay from '@/components/CaptionsOverlay';
import useLiveCaptions from '@/hooks/useLiveCaptions';
import BackHand from '@/components/icons/BackHand';
import useTime from '@/hooks/useTime';
import { RaisedHandsProvider } from '@/contexts/RaisedHandsContext';
import SmartWhiteboardOverlay from '@/components/SmartWhiteboardOverlay';
import Brush from '@/components/icons/Brush';

interface MeetingProps {
  params: {
    meetingId: string;
  };
}

const Meeting = ({ params }: MeetingProps) => {
  const { meetingId } = params;
  const audioRef = useRef<HTMLAudioElement>(null);
  const router = useRouter();
  const call = useCall();
  const user = useConnectedUser();
  const { currentTime } = useTime();
  const { client: chatClient } = useChatContext();
  const { useCallCallingState, useParticipants, useScreenShareState } =
    useCallStateHooks();
  const participants = useParticipants();
  const { screenShare } = useScreenShareState();
  const callingState = useCallCallingState();

  const [chatChannel, setChatChannel] =
    useState<Channel<DefaultStreamChatGenerics>>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isRecordingListOpen, setIsRecordingListOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isBackgroundSelectorOpen, setIsBackgroundSelectorOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const wbChangeSource = useRef<'local' | 'remote' | null>(null);
  const { reactions, addReaction, removeReaction } = useReactions();
  const [raisedUserIds, setRaisedUserIds] = useState<string[]>([]);
  const {
    supported: captionsSupported,
    listening: captionsOn,
    lines: captionLines,
    interimText: captionInterim,
    start: startCaptions,
    stop: stopCaptions,
    clear: clearCaptions,
  } = useLiveCaptions();
  const [participantInSpotlight, _] = participants;
  const [prevParticipantsCount, setPrevParticipantsCount] = useState(0);
  const isCreator = call?.state.createdBy?.id === user?.id;
  // Prefer Stream's local participant userId as a universal ID (works for guests too)
  const meId = useMemo(
    () => call?.state.localParticipant?.userId || user?.id,
    [call?.state.localParticipant?.userId, user?.id]
  );
  const isUnkownOrIdle =
    callingState === CallingState.UNKNOWN || callingState === CallingState.IDLE;

  // Sort participants: host first, then alphabetically by display name
  const sortedParticipants = useMemo(() => {
    const hostId = call?.state.createdBy?.id;
    const list = [...participants];
    return list.sort((a: any, b: any) => {
      const aId = (a as any).userId || (a as any).user?.id;
      const bId = (b as any).userId || (b as any).user?.id;
      if (hostId && aId === hostId && bId !== hostId) return -1;
      if (hostId && bId === hostId && aId !== hostId) return 1;
      const aName = ((a as any).name || (a as any).user?.name || aId || '').toString().toLowerCase();
      const bName = ((b as any).name || (b as any).user?.name || bId || '').toString().toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [participants, call?.state.createdBy?.id]);

  useEffect(() => {
    const startup = async () => {
      if (isUnkownOrIdle) {
        router.push(`/${meetingId}`);
      } else if (chatClient) {
        const uid = user?.id || chatClient.user?.id;
        // Create/get the shared channel for this meeting (no members filter to allow all users)
        const channel = chatClient.channel('messaging', meetingId);
        try {
          // Watch creates the channel if it doesn't exist and subscribes to events
          await channel.watch();
          console.log('Channel watched successfully for meeting:', meetingId);
        } catch (e) {
          console.error('Failed to watch channel:', e);
        }
        // Ensure current user is added as a member
        if (uid) {
          try {
            await channel.addMembers([uid]);
            console.log('User added to channel:', uid);
          } catch (e) {
            // Likely already a member, which is fine
            console.log('User already in channel or permission denied:', uid);
          }
        }
        setChatChannel(channel);
      }
    };
    startup();
  }, [router, meetingId, isUnkownOrIdle, chatClient, user?.id]);

  // Subscribe to hand raise/lower and reaction events on chat channel
  useEffect(() => {
    if (!chatChannel) return;
    const handler = (e: any) => {
      const uidChat =
        e.user?.id ||
        e.user_id ||
        e.sender?.id ||
        e.sender_id ||
        e.created_by?.id ||
        e.created_by_id;
      const uidVideo = e.video_user_id; // our canonical user id for tiles
      const me = meId;
      if (!uidChat && !uidVideo) {
        console.warn('[hand] Received event without usable ids', e);
        return;
      }
      console.log('[hand] Event received', {
        type: e.type,
        uidChat,
        uidVideo,
        me,
      });

      const canonicalId = uidVideo || uidChat;

      // Handle hand raise/lower events
      if (e.type === 'hand_raise') {
        if (canonicalId !== me) { // Skip own events (handled optimistically)
          setRaisedUserIds((prev) => {
            if (prev.includes(canonicalId)) return prev; // Avoid duplicates
            console.log('[hand] Adding raised user', canonicalId, 'prev=', prev);
            return [...prev, canonicalId];
          });
        }
      } else if (e.type === 'hand_lower') {
        if (canonicalId !== me) {
          console.log('[hand] Removing raised user', canonicalId);
          setRaisedUserIds((prev) => prev.filter((id) => id !== canonicalId));
        }
      } else if (e.type === 'wb_present_start') {
        // Remote user opened the whiteboard; open locally
        if (!isWhiteboardOpen) {
          console.log('[whiteboard] Remote present start by', canonicalId);
          wbChangeSource.current = 'remote';
          setIsWhiteboardOpen(true);
        }
      } else if (e.type === 'wb_present_stop') {
        // Remote user closed the whiteboard; close locally if open
        if (isWhiteboardOpen) {
          console.log('[whiteboard] Remote present stop by', canonicalId);
          wbChangeSource.current = 'remote';
          setIsWhiteboardOpen(false);
        }
      } else if (e.type === 'reaction_sent' && e.emoji) {
        // Handle reaction events from other users
        const senderName = e.sender_name || e.user?.name || 'Someone';
        console.log('Reaction event:', e.emoji, 'from', senderName);
        addReaction(e.emoji, senderName);
      }
    };
    chatChannel.on(handler);
    return () => {
      chatChannel.off(handler);
    };
  }, [chatChannel, user?.id, addReaction, isWhiteboardOpen, meId]);

  useEffect(() => {
    if (participants.length > prevParticipantsCount) {
      audioRef.current?.play();
    }
    setPrevParticipantsCount(participants.length);

    // Remove raised hands for users who left the call
    const currentUserIds = new Set(
      participants.map((p: any) => p.userId || p.user?.id).filter(Boolean)
    );
    setRaisedUserIds((prev) => prev.filter((id) => currentUserIds.has(id)));
  }, [participants.length, prevParticipantsCount, participants]);

  const isSpeakerLayout = useMemo(() => {
    if (participantInSpotlight) {
      return (
        hasScreenShare(participantInSpotlight) ||
        isPinned(participantInSpotlight)
      );
    }
    return false;
  }, [participantInSpotlight]);

  const leaveCall = async () => {
    await call?.leave();
    router.push(`/${meetingId}/meeting-end`);
  };

  const toggleScreenShare = async () => {
    try {
      await screenShare.toggle();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleChatPopup = () => {
    setIsChatOpen((prev) => !prev);
  };

  const toggleRecordingsList = () => {
    setIsRecordingListOpen((prev) => !prev);
  };

  const toggleReactionPicker = () => {
    setIsReactionPickerOpen((prev) => !prev);
  };

  const toggleWhiteboard = () => {
    wbChangeSource.current = 'local';
    setIsWhiteboardOpen((prev) => !prev);
  };

  const handleSendReaction = async (emoji: string) => {
    // Add locally with 'You' as sender name (optimistic update)
    addReaction(emoji, 'You');
    
    // Broadcast to other participants with sender name
    if (chatChannel && user) {
      try {
        await chatChannel.sendEvent({ 
          type: 'reaction_sent',
          emoji: emoji,
          sender_name: user.name || user.id
        } as any);
        console.log('Reaction broadcast:', emoji, 'from', user.name);
      } catch (e) {
        console.error('Failed to broadcast reaction:', e);
      }
    }
  };

  const toggleBackgroundSelector = () => {
    setIsBackgroundSelectorOpen((prev) => !prev);
  };

  const toggleCaptions = () => {
    if (!captionsOn) {
      startCaptions();
    } else {
      stopCaptions();
      clearCaptions();
    }
  };

  const toggleHandRaise = async () => {
    const me = meId;
    if (!me || !chatChannel) return;
    const isRaised = raisedUserIds.includes(me);
    const eventType = isRaised ? 'hand_lower' : 'hand_raise';
    
    console.log('[hand] Toggling', { eventType, video_user_id: me, chat_user_id: chatClient?.user?.id });
    
    // Optimistic UI update
    setRaisedUserIds((prev) =>
      isRaised ? prev.filter((id) => id !== me) : [...prev, me]
    );
    
    try {
      await chatChannel.sendEvent({
        type: eventType,
        user_id: chatClient?.user?.id,
        video_user_id: me,
      } as any);
      console.log('[hand] Event sent ok');
    } catch (e) {
      // Revert if send fails
      setRaisedUserIds((prev) =>
        isRaised ? [...prev, me] : prev.filter((id) => id !== me)
      );
      console.error('[hand] Failed to send event', e);
    }
  };

  if (isUnkownOrIdle) return null;

  return (
    <StreamTheme className="root-theme">
      <div id="meeting-root" className="relative w-svw h-svh bg-meet-black overflow-hidden transition-[padding] duration-300 ease-out">
        <RaisedHandsProvider value={{ raisedUserIds }}>
          {isSpeakerLayout && <SpeakerLayout />}
          {!isSpeakerLayout && <GridLayout />}
        </RaisedHandsProvider>
        <div className="absolute left-0 bottom-0 right-0 w-full h-20 bg-meet-black text-white text-center flex items-center justify-between">
          {/* Meeting ID */}
          <div className="hidden sm:flex grow shrink basis-1/4 items-center text-start justify-start ml-3 truncate max-w-full">
            <div className="flex items-center overflow-hidden mx-3 h-20 gap-3 select-none">
              <span className="font-medium">{currentTime}</span>
              <span>{'|'}</span>
              <span className="font-medium truncate">{meetingId}</span>
            </div>
          </div>
          {/* Meeting Controls */}
          <div className="relative flex grow shrink basis-1/4 items-center justify-center px-1.5 gap-3 ml-0">
            <ToggleAudioButton />
            <ToggleVideoButton />
            <CallControlButton
              onClick={toggleHandRaise}
              icon={<BackHand />}
              title={raisedUserIds.includes(user?.id || '') ? 'Lower hand' : 'Raise hand'}
              active={raisedUserIds.includes(user?.id || '')}
            />
            <div className="hidden sm:block relative">
              <CallControlButton
                onClick={toggleBackgroundSelector}
                icon={<VisualEffects />}
                title={'Apply visual effects'}
              />
              <BackgroundSelector
                isOpen={isBackgroundSelectorOpen}
                onClose={() => setIsBackgroundSelectorOpen(false)}
              />
            </div>
            <CallControlButton
              onClick={toggleCaptions}
              icon={<ClosedCaptions />}
              title={captionsOn ? 'Turn off captions' : 'Turn on captions'}
              active={captionsOn}
              alert={!captionsSupported}
              className="hidden sm:inline-flex"
            />
            <div className="hidden sm:block relative">
              <CallControlButton
                onClick={toggleReactionPicker}
                icon={<Mood />}
                title={'Send a reaction'}
              />
              <ReactionPicker
                isOpen={isReactionPickerOpen}
                onClose={() => setIsReactionPickerOpen(false)}
                onSelectReaction={handleSendReaction}
              />
            </div>
            <CallControlButton
              onClick={toggleScreenShare}
              icon={<PresentToAll />}
              title={'Present now'}
            />
            <RecordCallButton />
            <CallControlButton
              onClick={toggleWhiteboard}
              icon={<Brush />}
              title={isWhiteboardOpen ? 'Close whiteboard' : 'Open whiteboard'}
              active={isWhiteboardOpen}
            />
            <div className="hidden sm:block relative">
              <CallControlButton
                onClick={toggleRecordingsList}
                icon={<MoreVert />}
                title={'View recording list'}
              />
              <RecordingsPopup
                isOpen={isRecordingListOpen}
                onClose={() => setIsRecordingListOpen(false)}
              />
            </div>
            <CallControlButton
              onClick={leaveCall}
              icon={<CallEndFilled />}
              title={'Leave call'}
              className="leave-call-button"
            />
          </div>
          {/* Meeting Info */}
          <div className="hidden sm:flex grow shrink basis-1/4 items-center justify-end mr-3">
            <CallInfoButton icon={<Info />} title="Meeting details" />
            <CallInfoButton
              icon={
                <div className="relative">
                  <Group />
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-meet-blue text-white text-[10px] leading-[18px] text-center">
                    {participants.length}
                  </span>
                </div>
              }
              title="People"
              active={isPeopleOpen}
              onClick={() => setIsPeopleOpen((prev) => !prev)}
            />
            <CallInfoButton
              onClick={toggleChatPopup}
              icon={
                isChatOpen ? <ChatFilled color="var(--icon-blue)" /> : <Chat />
              }
              title="Chat with everyone"
            />
          </div>
        </div>
        <ChatPopup
          channel={chatChannel!}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
        <PeoplePopup
          isOpen={isPeopleOpen}
          onClose={() => setIsPeopleOpen(false)}
          participants={sortedParticipants as any}
          hostId={call?.state.createdBy?.id}
          raisedUserIds={raisedUserIds}
        />
        <SmartWhiteboardOverlay
          open={isWhiteboardOpen}
          onClose={() => setIsWhiteboardOpen(false)}
          chatChannel={chatChannel}
          meId={meId || user?.id}
          isPresenter={isCreator}
          allowCollaboration
        />
        {captionsOn && (
          <CaptionsOverlay lines={captionLines} interimText={captionInterim} />
        )}
        <ReactionOverlay
          reactions={reactions}
          onReactionComplete={removeReaction}
        />
        {isCreator && <MeetingPopup />}
        <audio
          ref={audioRef}
          src="https://www.gstatic.com/meet/sounds/join_call_6a6a67d6bcc7a4e373ed40fdeff3930a.ogg"
        />
      </div>
    </StreamTheme>
  );
};

export default Meeting;
