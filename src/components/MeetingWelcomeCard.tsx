import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRoom } from '@/contexts/MeetingRoomContext';
import Clipboard from './Clipboard';
import Close from './icons/Close';
import PersonAdd from './icons/PersonAdd';
export default function MeetingWelcomeCard() {
  const room = useRoom();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const { access } = room;
  useEffect(() => {
    if (!access.isHost) return;
    const key = `meet-welcome:${access.meetingId}:${access.identity.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, 'seen');
    } catch {
      /* Show once per mount if private storage is unavailable. */
    }
    setOpen(true);
  }, [access.isHost, access.meetingId, access.identity.id]);
  if (!open || !access.isHost) return null;
  return (
    <aside className="meeting-welcome" aria-labelledby="meeting-welcome-title">
      <div className="meeting-welcome-heading">
        <h2 id="meeting-welcome-title">Your meeting’s ready</h2>
        <button
          aria-label="Dismiss meeting welcome"
          onClick={() => setOpen(false)}
        >
          <Close />
        </button>
      </div>
      <button
        className="primary-button meeting-add-others"
        onClick={() => room.setInvite(true)}
      >
        <PersonAdd /> Add others
      </button>
      <p>Or share this meeting link with others you want in the meeting</p>
      <Clipboard value={`${window.location.origin}/${access.meetingId}`} />
      <div className="meeting-welcome-policy">
        <span aria-hidden="true">♧</span>
        <p>
          {room.custom.locked === true
            ? 'This meeting is locked. Unlock it in Host controls to let new people join.'
            : room.custom.access === 'open'
              ? 'People with this meeting link can join without asking while the meeting is unlocked.'
              : 'People who use this meeting link must get your permission before they can join.'}
        </p>
      </div>
      <p className="meeting-welcome-identity">
        Joined as{' '}
        {user?.primaryEmailAddress?.emailAddress || access.identity.name}
      </p>
    </aside>
  );
}
