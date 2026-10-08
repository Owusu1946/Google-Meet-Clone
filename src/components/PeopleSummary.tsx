import { useRef, useState } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import Avatar from './Avatar';

export default function PeopleSummary() {
  const room = useRoom();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const preview = room.participants.slice(0, 4);
  return (
    <div
      className="people-summary"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          trigger.current?.focus();
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        className="meeting-participant-pill"
        aria-label={`People (${room.participants.length})`}
        aria-pressed={room.panel === 'people'}
        onClick={() => {
          setOpen(false);
          room.togglePanel('people');
        }}
      >
        <span className="people-summary-avatars" aria-hidden="true">
          {preview.slice(0, 3).map((participant) => (
            <Avatar
              key={participant.sessionId}
              participant={participant}
              width={22}
            />
          ))}
        </span>
        <span>{room.participants.length}</span>
      </button>
      {open && room.panel !== 'people' && (
        <section className="people-summary-popover" aria-label="People preview">
          <h2>People</h2>
          <div className="people-summary-card">
            <strong>{room.participants.length} joined</strong>
            <p>
              {preview
                .map((participant) => participant.name || 'Participant')
                .join(', ')}
              {room.participants.length > 4 ? ' and others' : ''}
            </p>
            <div className="flex gap-2 mt-3">
              {preview.map((participant) => (
                <Avatar
                  key={participant.sessionId}
                  participant={participant}
                  width={36}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              room.setPanel('people');
            }}
          >
            View everyone in this call <span aria-hidden="true">›</span>
          </button>
        </section>
      )}
    </div>
  );
}
