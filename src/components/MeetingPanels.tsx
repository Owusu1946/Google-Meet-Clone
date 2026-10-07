import { useRoom } from '@/contexts/MeetingRoomContext';
import { type StartClosedCaptionsRequest } from '@stream-io/video-client';
import SidePanel from './SidePanel';
import ChatPopup from './ChatPopup';
import PeoplePopup from './PeoplePopup';
import Clipboard from './Clipboard';
import RecordingsPopup from './RecordingsPopup';
import BackgroundSelector from './BackgroundSelector';
import {
  AudioInputDeviceSelector,
  AudioOutputDeviceSelector,
  VideoInputDeviceSelector,
} from './DeviceSelector';

export default function MeetingPanels() {
  const room = useRoom();
  const {
    panel,
    setPanel,
    access,
    participants,
    raisedUserIds,
    requests,
    busy,
    requestError,
    admit,
    run,
    hostAction,
    custom,
    channel,
    chatError,
    setRemoveId,
    setInvite,
  } = room;
  if (!panel) return null;
  const titles = {
    people: 'People',
    chat: 'In-call messages',
    details: 'Meeting details',
    recordings: 'Recordings',
    settings: 'Settings',
    host: 'Host controls',
  };
  return (
    <SidePanel title={titles[panel]} onClose={() => setPanel(null)}>
      {panel === 'people' && (
        <>
          <PeoplePopup
            participants={participants}
            hostId={access.hostId}
            meId={access.identity.id}
            raisedUserIds={raisedUserIds}
            requests={requests}
            isHost={access.isHost}
            onAdmit={(id) => admit(id, true)}
            onDeny={(id) => admit(id, false)}
            onMute={(id) => void run(() => hostAction('mute', { userId: id }))}
            onRemove={setRemoveId}
            busy={busy}
          />
          {requestError && (
            <p role="alert" className="p-4 text-sm text-meet-red">
              Admission queue: {requestError}
            </p>
          )}
        </>
      )}
      {panel === 'chat' && (
        <ChatPopup channel={channel} chatError={chatError} />
      )}
      {panel === 'details' && (
        <div className="p-5 space-y-5">
          <p>Hosted by {access.hostName}</p>
          <Clipboard value={`${window.location.origin}/${access.meetingId}`} />
          <p className="text-sm text-meet-gray">
            {custom.access === 'open'
              ? 'Anyone with the link can join while the meeting is unlocked.'
              : 'New participants need to be admitted by the host.'}
          </p>
          {access.isHost && (
            <button className="primary-button" onClick={() => setInvite(true)}>
              Invite people
            </button>
          )}
        </div>
      )}
      {panel === 'recordings' && (
        <RecordingsPopup meetingId={access.meetingId} />
      )}
      {panel === 'settings' && <Settings />}
      {panel === 'host' && access.isHost && (
        <div className="p-5 space-y-5 overflow-y-auto">
          <p className="text-sm text-meet-gray">
            You control who can join and collaborate. Participants can choose
            whether to show captions.
          </p>
          <label className="flex items-center justify-between gap-3 text-sm">
            Lock meeting
            <input
              type="checkbox"
              checked={custom.locked === true}
              disabled={busy}
              onChange={(event) =>
                void run(() =>
                  hostAction('settings', { locked: event.target.checked }),
                )
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Meeting access
            <select
              className="border rounded-lg p-3"
              value={custom.access === 'open' ? 'open' : 'restricted'}
              disabled={busy}
              onChange={(event) =>
                void run(() =>
                  hostAction('settings', { access: event.target.value }),
                )
              }
            >
              <option value="restricted">Host must admit new people</option>
              <option value="open">Anyone with the link can join</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Let participants draw
            <input
              type="checkbox"
              checked={custom.collaboration !== false}
              disabled={busy}
              onChange={(event) =>
                void run(() =>
                  hostAction('settings', {
                    collaboration: event.target.checked,
                  }),
                )
              }
            />
          </label>
          <button
            className="text-primary text-sm"
            onClick={() => setPanel('people')}
          >
            Review waiting participants ({requests.length})
          </button>
          <button
            className="block text-meet-red text-sm"
            onClick={() => room.setLeavePrompt(true)}
          >
            End meeting for everyone
          </button>
        </div>
      )}
    </SidePanel>
  );
}
function Settings() {
  const room = useRoom();
  const {
    layout,
    setLayout,
    showCaptions,
    toggleCaptions,
    access,
    language,
    setLanguage,
    busy,
    run,
    call,
    captions,
    setShowCaptions,
  } = room;
  return (
    <div className="overflow-y-auto p-5 space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium">Audio and video</h3>
        <AudioInputDeviceSelector />
        <AudioOutputDeviceSelector />
        <VideoInputDeviceSelector />
        <p className="text-xs text-meet-gray">
          Allow device access in your browser to see microphone and camera
          names.
        </p>
      </section>
      <BackgroundSelector />
      <section>
        <h3 className="font-medium mb-3">Layout</h3>
        <select
          aria-label="Meeting layout"
          className="border rounded-lg w-full p-3"
          value={layout}
          onChange={(event) => setLayout(event.target.value as typeof layout)}
        >
          <option value="auto">Auto (presentation and pins)</option>
          <option value="grid">Tiled</option>
          <option value="speaker">Active speaker</option>
        </select>
      </section>
      <section>
        <h3 className="font-medium mb-3">Captions</h3>
        <button
          className="text-primary text-sm"
          onClick={() => void toggleCaptions()}
        >
          {showCaptions ? 'Hide captions for me' : 'Show captions for me'}
        </button>
        {access.isHost && (
          <div className="mt-3">
            <label className="text-sm">
              Spoken language
              <select
                className="border rounded-lg w-full p-3 mt-2"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {[
                  ['en', 'English'],
                  ['auto', 'Detect automatically'],
                  ['fr', 'French'],
                  ['es', 'Spanish'],
                  ['de', 'German'],
                  ['pt', 'Portuguese'],
                ].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              className="text-primary text-sm mt-3"
              onClick={() =>
                void run(async () => {
                  if (captions.running) await call.stopClosedCaptions();
                  await call.startClosedCaptions({
                    language:
                      language as StartClosedCaptionsRequest['language'],
                  });
                  setShowCaptions(true);
                })
              }
            >
              Apply language and start captions
            </button>
            {captions.running && (
              <button
                disabled={busy}
                className="block text-meet-red text-sm mt-3"
                onClick={() => void run(() => call.stopClosedCaptions())}
              >
                Stop captions for everyone
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
