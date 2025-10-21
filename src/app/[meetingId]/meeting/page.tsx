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
import { useVirtualBackground } from '@/hooks/useVirtualBackground';
import CaptionsOverlay from '@/components/CaptionsOverlay';
import useLiveCaptions from '@/hooks/useLiveCaptions';
import HandRaiseOverlay from '@/components/HandRaiseOverlay';
import BackHand from '@/components/icons/BackHand';
import useTime from '@/hooks/useTime';

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
  const [isRecordingListOpen, setIsRecordingListOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const [isBackgroundSelectorOpen, setIsBackgroundSelectorOpen] = useState(false);
  const { reactions, addReaction, removeReaction } = useReactions();
  const { selectedBackground, applyBackground } = useVirtualBackground();
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
  const isUnkownOrIdle =
    callingState === CallingState.UNKNOWN || callingState === CallingState.IDLE;

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
      const uid = e.user?.id || e.user_id;
      const me = user?.id;
      if (!uid) return;
      
      // Handle hand raise/lower events
      if (e.type === 'hand_raise') {
        console.log('Hand raise event from', uid);
        if (uid !== me) { // Skip own events (handled optimistically)
          setRaisedUserIds((prev) => {
            if (prev.includes(uid)) return prev; // Avoid duplicates
            return [...prev, uid];
          });
        }
      } else if (e.type === 'hand_lower') {
        console.log('Hand lower event from', uid);
        if (uid !== me) {
          setRaisedUserIds((prev) => prev.filter((id) => id !== uid));
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
  }, [chatChannel, user?.id, addReaction]);

  useEffect(() => {
    if (participants.length > prevParticipantsCount) {
      audioRef.current?.play();
    }
    setPrevParticipantsCount(participants.length);
    
    // Remove raised hands for users who left the call
    const currentUserIds = new Set(participants.map(p => p.userId));
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
    const me = user?.id;
    if (!me || !chatChannel) {
      console.log('Cannot toggle hand: missing user or channel');
      return;
    }
    
    const isRaised = raisedUserIds.includes(me);
    const eventType = isRaised ? 'hand_lower' : 'hand_raise';
    
    console.log('Toggling hand:', eventType, 'for user:', me);
    
    // Optimistic UI update
    setRaisedUserIds((prev) =>
      isRaised ? prev.filter((id) => id !== me) : [...prev, me]
    );
    
    try {
      await chatChannel.sendEvent({ type: eventType } as any);
      console.log('Hand event sent successfully:', eventType);
    } catch (e) {
      // Revert if send fails
      setRaisedUserIds((prev) =>
        isRaised ? [...prev, me] : prev.filter((id) => id !== me)
      );
      console.error('Failed to send hand event:', e);
    }
  };

  if (isUnkownOrIdle) return null;

  return (
    <StreamTheme className="root-theme">
      <div className="relative w-svw h-svh bg-meet-black overflow-hidden">
        {isSpeakerLayout && <SpeakerLayout />}
        {!isSpeakerLayout && <GridLayout />}
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
                onSelectBackground={applyBackground}
                selectedId={selectedBackground.id}
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
            <CallInfoButton icon={<Group />} title="People" />
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
        {captionsOn && (
          <CaptionsOverlay lines={captionLines} interimText={captionInterim} />
        )}
        <HandRaiseOverlay raisedUserIds={raisedUserIds} />
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
