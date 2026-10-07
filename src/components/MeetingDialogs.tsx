import { useEffect } from 'react';
import useMeetingActions from '@/hooks/useMeetingActions';
import { useRoom } from '@/contexts/MeetingRoomContext';
import Dialog from './Dialog';
import AddPeoplePopup from './AddPeoplePopup';

export default function MeetingDialogs() {
  const room = useRoom();
  const actions = useMeetingActions();
  const {
    access,
    menu,
    setMenu,
    busy,
    run,
    call,
    leavePrompt,
    setLeavePrompt,
    leave,
    recordPrompt,
    setRecordPrompt,
    removeId,
    setRemoveId,
    hostAction,
    invite,
    setInvite,
  } = room;
  useEffect(() => {
    if (menu && room.toolbarActionCount >= actions.length) setMenu(false);
  }, [menu, room.toolbarActionCount, actions.length, setMenu]);
  return (
    <>
      <Dialog
        open={menu}
        onClose={() => setMenu(false)}
        title="Meeting options"
      >
        <div className="grid grid-cols-2 gap-2">
          {actions.slice(room.toolbarActionCount).map((action) => (
            <button
              key={action.id}
              className="option-button"
              disabled={action.disabled}
              aria-pressed={action.active}
              onClick={() => {
                setMenu(false);
                action.onClick();
              }}
            >
              {action.title}
            </button>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={room.reactionPicker}
        onClose={() => room.setReactionPicker(false)}
        title="Send a reaction"
      >
        <div className="flex flex-wrap gap-2">
          {['👍', '❤️', '😂', '😮', '👏', '🎉'].map((emoji) => (
            <button
              key={emoji}
              disabled={busy}
              aria-label={`Send ${emoji} reaction`}
              className="text-2xl rounded-lg p-2 hover:bg-light-gray disabled:opacity-40"
              onClick={() => {
                room.setReactionPicker(false);
                void run(() =>
                  call.sendReaction({ type: 'emoji', emoji_code: emoji }),
                );
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Dialog>
      <Dialog
        open={leavePrompt}
        onClose={() => setLeavePrompt(false)}
        title="Leave this meeting?"
      >
        {room.error && (
          <p role="alert" className="text-sm text-meet-red mb-4">
            {room.error}
          </p>
        )}
        <p className="text-sm text-meet-gray">
          Leave while others continue, or end the meeting for everyone.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            disabled={busy}
            className="primary-button"
            onClick={() => void leave(false)}
          >
            Just leave
          </button>
          <button
            disabled={busy}
            className="primary-button !bg-meet-red"
            onClick={() => void leave(true)}
          >
            End for everyone
          </button>
        </div>
      </Dialog>
      <Dialog
        open={recordPrompt}
        onClose={() => setRecordPrompt(false)}
        title="Start recording?"
      >
        {room.error && (
          <p role="alert" className="text-sm text-meet-red mb-4">
            {room.error}
          </p>
        )}
        <p className="text-sm text-meet-gray">
          Make sure everyone agrees. Participants will see a recording notice,
          and the recording will be available to you afterward.
        </p>
        <button
          className="primary-button mt-6"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await call.startRecording();
              setRecordPrompt(false);
            })
          }
        >
          Start recording
        </button>
      </Dialog>
      <Dialog
        open={!!removeId}
        onClose={() => setRemoveId('')}
        title="Remove this participant?"
      >
        {room.error && (
          <p role="alert" className="text-sm text-meet-red mb-4">
            {room.error}
          </p>
        )}
        <p className="text-sm text-meet-gray">
          They will leave the call and won’t be able to rejoin this meeting.
        </p>
        <button
          className="primary-button !bg-meet-red mt-6"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await hostAction('remove', { userId: removeId });
              setRemoveId('');
            })
          }
        >
          Remove
        </button>
      </Dialog>
      <AddPeoplePopup
        isOpen={invite}
        onClose={() => setInvite(false)}
        meetingId={access.meetingId}
      />
    </>
  );
}
