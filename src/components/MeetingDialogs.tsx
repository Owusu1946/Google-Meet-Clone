import { useRoom } from '@/contexts/MeetingRoomContext';
import Dialog from './Dialog';
import AddPeoplePopup from './AddPeoplePopup';
import { api } from '@/lib/meeting';

export default function MeetingDialogs() {
  const room = useRoom();
  const {
    access,
    menu,
    setMenu,
    setPanel,
    whiteboard,
    setWhiteboard,
    showCaptions,
    toggleCaptions,
    canShare,
    share,
    busy,
    run,
    recording,
    canRecord,
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
  return (
    <>
      <Dialog
        open={menu}
        onClose={() => setMenu(false)}
        title="Meeting options"
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['details', 'Meeting details'],
              ['people', 'People'],
              ['chat', 'Chat'],
              ['settings', 'Settings'],
            ] as const
          ).map(([id, label]) => (
            <button
              className="option-button"
              key={id}
              onClick={() => {
                setPanel(id);
                setMenu(false);
              }}
            >
              {label}
            </button>
          ))}
          <button
            className="option-button"
            onClick={() => {
              setWhiteboard((value) => !value);
              setMenu(false);
            }}
          >
            {whiteboard ? 'Close whiteboard' : 'Open whiteboard'}
          </button>
          <button
            className="option-button"
            onClick={() => {
              setMenu(false);
              void toggleCaptions();
            }}
          >
            {showCaptions ? 'Hide captions' : 'Show captions'}
          </button>
          <button
            className="option-button"
            disabled={busy || !room.local}
            onClick={() => {
              setMenu(false);
              void run(() =>
                api(`/api/meetings/${access.meetingId}/state`, {
                  method: 'POST',
                  body: JSON.stringify({
                    raised: !room.raised,
                    sessionId: room.local?.sessionId,
                  }),
                }),
              );
            }}
          >
            {room.raised ? 'Lower hand' : 'Raise hand'}
          </button>
          <button
            className="option-button"
            disabled={!canShare || busy}
            onClick={() => {
              setMenu(false);
              void run(() => share.screenShare.toggle());
            }}
          >
            {share.optimisticIsMute ? 'Present now' : 'Stop presenting'}
          </button>
          {access.isHost && (
            <>
              <button
                className="option-button"
                onClick={() => {
                  setPanel('host');
                  setMenu(false);
                }}
              >
                Host controls
              </button>
              <button
                className="option-button"
                onClick={() => {
                  setPanel('recordings');
                  setMenu(false);
                }}
              >
                Recordings
              </button>
              <button
                disabled={!canRecord || busy}
                className="option-button"
                onClick={() => {
                  setMenu(false);
                  if (recording) void run(() => call.stopRecording());
                  else setRecordPrompt(true);
                }}
              >
                {recording ? 'Stop recording' : 'Start recording'}
              </button>
            </>
          )}
        </div>
        <h3 className="text-sm font-medium mt-6 mb-3">Send a reaction</h3>
        <div className="flex flex-wrap gap-2">
          {['👍', '❤️', '😂', '😮', '👏', '🎉'].map((emoji) => (
            <button
              key={emoji}
              aria-label={`Send ${emoji} reaction`}
              className="text-2xl rounded-lg p-2 hover:bg-light-gray"
              onClick={() => {
                setMenu(false);
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
