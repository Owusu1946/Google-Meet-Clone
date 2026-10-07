'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  CallingState,
  hasScreenShare,
  isPinned,
  OwnCapability,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { useMeeting } from './MeetProvider';
import { api, errorMessage, type JoinRequest } from '@/lib/meeting';
import {
  readDevicePreferences,
  saveDevicePreferences,
} from '@/hooks/usePreviewMedia';
import useWhiteboard from '@/hooks/useWhiteboard';
import useLiveCaptions from '@/hooks/useLiveCaptions';
import { useReactions } from '@/components/ReactionOverlay';

export type Panel =
  'people' | 'chat' | 'details' | 'recordings' | 'settings' | 'host' | null;
function useRoomState() {
  const call = useCall()!;
  const router = useRouter();
  const meeting = useMeeting();
  const { access, channel } = meeting;
  const {
    useParticipants,
    useMicrophoneState,
    useCameraState,
    useScreenShareState,
    useCallCallingState,
    useCallMembers,
    useCallCustomData,
    useCallEndedAt,
    useIsCallRecordingInProgress,
    useHasPermissions,
  } = useCallStateHooks();
  const participants = useParticipants();
  const members = useCallMembers();
  const custom = useCallCustomData();
  const endedAt = useCallEndedAt();
  const state = useCallCallingState();
  const mic = useMicrophoneState();
  const camera = useCameraState();
  const share = useScreenShareState();
  const recording = useIsCallRecordingInProgress();
  const canRecord = useHasPermissions(OwnCapability.START_RECORD_CALL);
  const canShare = useHasPermissions(OwnCapability.SCREENSHARE);
  const captions = useLiveCaptions();
  const board = useWhiteboard();
  const [showCaptions, setShowCaptions] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [toolbarActionCount, setToolbarActionCount] = useState(0);
  const [reactionPicker, setReactionPicker] = useState(false);
  const [menu, setMenu] = useState(false);
  const [whiteboard, setWhiteboard] = useState(false);
  useEffect(() => {
    if (custom.boardPresenting === true) setWhiteboard(true);
  }, [custom.boardPresenting]);
  const [invite, setInvite] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [recordPrompt, setRecordPrompt] = useState(false);
  const [removeId, setRemoveId] = useState('');
  const [layout, setLayout] = useState<'auto' | 'grid' | 'speaker'>('auto');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [requestError, setRequestError] = useState('');
  const [unread, setUnread] = useState(0);
  const reactions = useReactions();
  const { addReaction } = reactions;
  const leaving = useRef(false);
  const seenReactions = useRef(new Set<string>());
  const local = participants.find(
    (participant) => participant.isLocalParticipant,
  );
  const raisedUserIds = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.custom.handRaised &&
            participants.some(
              (participant) =>
                participant.userId === member.user_id &&
                participant.sessionId === member.custom.handSession,
            ),
        )
        .map((member) => member.user_id),
    [members, participants],
  );
  const raised = raisedUserIds.includes(access.identity.id);
  const spotlight =
    layout === 'speaker' ||
    (layout === 'auto' &&
      participants.some(
        (participant) => hasScreenShare(participant) || isPinned(participant),
      ));
  const run = useCallback(async (task: () => Promise<unknown>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (failure) {
      setError(errorMessage(failure));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  const hostAction = useCallback(
    (action: string, values: Record<string, unknown> = {}) =>
      api(`/api/meetings/${access.meetingId}/host`, {
        method: 'POST',
        body: JSON.stringify({ action, ...values }),
      }),
    [access.meetingId],
  );
  const toggleMic = useCallback(
    () =>
      void run(async () => {
        await mic.microphone.toggle();
        saveDevicePreferences({
          ...readDevicePreferences(),
          mic: mic.microphone.state.status === 'enabled',
        });
      }),
    [mic.microphone, run],
  );
  const toggleCamera = useCallback(
    () =>
      void run(async () => {
        await camera.camera.toggle();
        saveDevicePreferences({
          ...readDevicePreferences(),
          camera: camera.camera.state.status === 'enabled',
        });
      }),
    [camera.camera, run],
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        (event.target as HTMLElement)?.closest(
          'input, textarea, select, [contenteditable=true]',
        )
      )
        return;
      if (event.key.toLowerCase() === 'd') {
        event.preventDefault();
        toggleMic();
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        toggleCamera();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [toggleMic, toggleCamera]);
  useEffect(() => {
    if (!access.isHost) return;
    let cancelled = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await api<{ requests: JoinRequest[] }>(
          `/api/meetings/${access.meetingId}/host`,
          { signal: controller.signal },
        );
        if (!cancelled) {
          setRequests(result.requests);
          setRequestError('');
        }
      } catch (failure) {
        if (!cancelled) setRequestError(errorMessage(failure));
      }
      if (!cancelled) timer = setTimeout(refresh, 4000);
    };
    void refresh();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [access.isHost, access.meetingId]);
  useEffect(() => {
    const unsubscribe = call.on('call.reaction_new', (event) => {
      const id = `${event.reaction.user.id}:${event.created_at}:${event.reaction.emoji_code}`;
      if (seenReactions.current.has(id) || !event.reaction.emoji_code) return;
      if (seenReactions.current.size > 200) seenReactions.current.clear();
      seenReactions.current.add(id);
      addReaction(
        event.reaction.emoji_code,
        event.reaction.user.id === access.identity.id
          ? 'You'
          : event.reaction.user.name || 'Participant',
      );
    });
    const kicked = call.on('call.kicked_user', (event) => {
      if (event.user.id !== access.identity.id) return;
      leaving.current = true;
      void call
        .leave()
        .catch(() => undefined)
        .finally(() =>
          router.replace(`/${access.meetingId}/meeting-end?reason=removed`),
        );
    });
    const failed = call.on('call.recording_failed', () =>
      setError('Recording failed. Check recording availability and try again.'),
    );
    return () => {
      unsubscribe();
      kicked();
      failed();
    };
  }, [call, access.identity.id, access.meetingId, router, addReaction]);
  useEffect(() => {
    if (!channel) return;
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => setUnread(panel === 'chat' ? 0 : channel.countUnread());
    const markRead = () => {
      clearTimeout(readTimer);
      if (panel === 'chat' && document.visibilityState === 'visible')
        readTimer = setTimeout(() => {
          void channel.markRead().catch(() => undefined);
        }, 250);
    };
    sync();
    markRead();
    const subscription = channel.on((event) => {
      if (
        [
          'message.new',
          'message.deleted',
          'message.read',
          'notification.mark_read',
          'channel.updated',
        ].includes(event.type)
      )
        sync();
      if (event.type === 'message.new') markRead();
    });
    document.addEventListener('visibilitychange', markRead);
    return () => {
      subscription.unsubscribe();
      clearTimeout(readTimer);
      document.removeEventListener('visibilitychange', markRead);
    };
  }, [channel, panel]);
  useEffect(() => {
    if (leaving.current) return;
    if (endedAt || state === CallingState.LEFT) {
      leaving.current = true;
      router.replace(
        `/${access.meetingId}/meeting-end?reason=${endedAt ? 'ended' : 'disconnected'}`,
      );
    }
  }, [endedAt, state, access.meetingId, router]);
  const leave = async (end = false) => {
    if (busy) return;
    leaving.current = true;
    const success = await run(async () => {
      if (!(await board.flush()))
        throw new Error(
          'Your board edits are not saved yet. Retry syncing before leaving.',
        );
      if (end) await hostAction('end');
      if (local?.sessionId)
        await api(`/api/meetings/${access.meetingId}/state`, {
          method: 'POST',
          body: JSON.stringify({ raised: false, sessionId: local.sessionId }),
        }).catch(() => undefined);
      await call.leave();
      router.replace(
        `/${access.meetingId}/meeting-end?reason=${end ? 'ended' : 'left'}`,
      );
    });
    if (!success) leaving.current = false;
  };
  const toggleCaptions = async () => {
    if (showCaptions) {
      setShowCaptions(false);
      return;
    }
    if (
      !captions.running &&
      !(await run(() =>
        api(`/api/meetings/${access.meetingId}/captions`, {
          method: 'POST',
          body: '{}',
        }),
      ))
    )
      return;
    setShowCaptions(true);
  };
  const admit = (id: string, allowed: boolean) =>
    void run(async () => {
      await hostAction(allowed ? 'admit' : 'deny', { userId: id });
      setRequests((current) => current.filter((request) => request.id !== id));
    });
  const togglePanel = (value: Exclude<Panel, null>) =>
    setPanel((current) => (current === value ? null : value));
  return {
    ...meeting,
    call,
    participants,
    custom,
    state,
    mic,
    camera,
    share,
    recording,
    canRecord,
    canShare,
    board,
    captions,
    showCaptions,
    setShowCaptions,
    panel,
    setPanel,
    menu,
    setMenu,
    toolbarActionCount,
    setToolbarActionCount,
    reactionPicker,
    setReactionPicker,
    whiteboard,
    setWhiteboard,
    invite,
    setInvite,
    leavePrompt,
    setLeavePrompt,
    recordPrompt,
    setRecordPrompt,
    removeId,
    setRemoveId,
    layout,
    setLayout,
    language,
    setLanguage,
    error,
    setError,
    busy,
    requests,
    requestError,
    unread,
    reactions,
    local,
    raisedUserIds,
    raised,
    spotlight,
    run,
    hostAction,
    toggleMic,
    toggleCamera,
    leave,
    toggleCaptions,
    admit,
    togglePanel,
  };
}
const RoomContext = createContext<ReturnType<typeof useRoomState> | null>(null);
export function MeetingRoomProvider({ children }: { children: ReactNode }) {
  const state = useRoomState();
  return <RoomContext.Provider value={state}>{children}</RoomContext.Provider>;
}
export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('Meeting room is unavailable.');
  return context;
}
