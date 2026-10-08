import type { ReactNode } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import { api } from '@/lib/meeting';
import BackHand from '@/components/icons/BackHand';
import ClosedCaptions from '@/components/icons/ClosedCaptions';
import PresentToAll from '@/components/icons/PresentToAll';
import Brush from '@/components/icons/Brush';
import Mood from '@/components/icons/Mood';
import Settings from '@/components/icons/Settings';
import Info from '@/components/icons/Info';
import Apps from '@/components/icons/Apps';
import PersonAdd from '@/components/icons/PersonAdd';
import {
  RecordingsIcon,
  PresentBoardIcon,
} from '@/components/icons/MeetingActions';
import Keep from '@/components/icons/Keep';

export type MeetingAction = {
  id: string;
  title: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};
// One action model keeps toolbar and overflow permissions, labels and behavior identical.
export default function useMeetingActions(): MeetingAction[] {
  const room = useRoom();
  const { access, busy, run, share, panel, togglePanel } = room;
  const actions: MeetingAction[] = [
    {
      id: 'hand',
      title: room.raised ? 'Lower hand' : 'Raise hand',
      icon: <BackHand />,
      active: room.raised,
      disabled: busy || !room.local,
      onClick: () =>
        void run(() =>
          api(`/api/meetings/${access.meetingId}/state`, {
            method: 'POST',
            body: JSON.stringify({
              raised: !room.raised,
              sessionId: room.local?.sessionId,
            }),
          }),
        ),
    },
    {
      id: 'captions',
      title: room.showCaptions ? 'Hide captions' : 'Show captions',
      icon: <ClosedCaptions />,
      active: room.showCaptions,
      disabled: busy,
      onClick: () => void room.toggleCaptions(),
    },
    {
      id: 'share',
      title: share.optimisticIsMute ? 'Present now' : 'Stop presenting',
      icon: <PresentToAll />,
      active: !share.optimisticIsMute,
      disabled: busy || !room.canShare,
      onClick: () => void run(() => share.screenShare.toggle()),
    },
    {
      id: 'board',
      title: room.custom.boardPresenting
        ? 'Whiteboard is presenting to everyone'
        : room.whiteboard
          ? 'Close whiteboard'
          : 'Open whiteboard',
      icon: <Brush />,
      active: room.whiteboard || room.custom.boardPresenting === true,
      disabled: room.custom.boardPresenting === true,
      onClick: () => {
        if (!room.whiteboard) room.setWhiteboard(true);
        else
          void run(async () => {
            if (!(await room.board.flush()))
              throw new Error(
                'Save board edits before closing the whiteboard.',
              );
            room.setWhiteboard(false);
          });
      },
    },
    {
      id: 'reactions',
      title: 'Send a reaction',
      icon: <Mood />,
      active: room.reactionPicker,
      disabled: busy,
      onClick: () => room.setReactionPicker(true),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: <Settings />,
      active: panel === 'settings',
      onClick: () => togglePanel('settings'),
    },
    {
      id: 'details',
      title: 'Meeting details',
      icon: <Info />,
      active: panel === 'details',
      onClick: () => togglePanel('details'),
    },
    {
      id: 'layout',
      title: `Change layout (currently ${room.layout})`,
      icon: <Apps />,
      onClick: () =>
        room.setLayout((value) =>
          value === 'auto' ? 'grid' : value === 'grid' ? 'speaker' : 'auto',
        ),
    },
    {
      id: 'invite',
      title: 'Invite people',
      icon: <PersonAdd />,
      onClick: () => room.setInvite(true),
    },
  ];
  if (access.isHost)
    actions.push(
      {
        id: 'host',
        title: 'Host controls',
        icon: <Keep />,
        active: panel === 'host',
        onClick: () => togglePanel('host'),
      },
      {
        id: 'recordings',
        title: 'Recordings',
        icon: <RecordingsIcon />,
        active: panel === 'recordings',
        onClick: () => togglePanel('recordings'),
      },
      {
        id: 'record',
        title: room.recording ? 'Stop recording' : 'Start recording',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8" fill="currentColor" />
          </svg>
        ),
        active: room.recording,
        disabled: busy || !room.canRecord,
        onClick: () => {
          if (room.recording) void run(() => room.call.stopRecording());
          else room.setRecordPrompt(true);
        },
      },
      {
        id: 'present-board',
        title: room.custom.boardPresenting
          ? 'Stop presenting whiteboard'
          : 'Present whiteboard to everyone',
        icon: <PresentBoardIcon />,
        active: room.custom.boardPresenting === true,
        disabled: busy,
        onClick: () =>
          void run(async () => {
            if (!(await room.board.flush()))
              throw new Error(
                'Save board edits before changing the presentation.',
              );
            await room.hostAction('settings', {
              boardPresenting: room.custom.boardPresenting !== true,
            });
          }),
      },
    );
  return actions;
}
