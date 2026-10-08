import { useEffect, useRef, useState } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import PersonAdd from './icons/PersonAdd';
export default function AdmissionPopover() {
  const room = useRoom();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!room.requests.length) setOpen(false);
  }, [room.requests.length]);
  useEffect(() => {
    if (!open) return;
    container.current
      ?.querySelector<HTMLElement>('.admission-popover button')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  if (!room.access.isHost || !room.requests.length) return null;
  return (
    <div ref={container} className="admission-control">
      <button
        ref={trigger}
        className="admission-trigger"
        aria-expanded={open}
        aria-controls="admission-popover"
        onClick={() => setOpen((value) => !value)}
      >
        <PersonAdd />
        <span>
          Admit {room.requests.length}{' '}
          {room.requests.length === 1 ? 'guest' : 'guests'}
        </span>
      </button>
      {open && (
        <section
          id="admission-popover"
          className="admission-popover"
          aria-label="Waiting to join"
        >
          <div className="admission-popover-heading">
            <h2>Waiting to join</h2>
            <span>Visible to hosts</span>
          </div>
          <div className="admission-request-list">
            {room.requests.slice(0, 5).map((request) => (
              <div key={request.id} className="admission-request">
                <div className="admission-person">
                  <span className="admission-avatar">
                    {request.name[0]?.toUpperCase() || '?'}
                  </span>
                  <div>
                    <strong>{request.name}</strong>
                    <p>Wants to join this meeting</p>
                  </div>
                </div>
                <div className="admission-request-actions">
                  <button
                    disabled={room.busy}
                    aria-label={`Admit ${request.name}`}
                    onClick={() => room.admit(request.id, true)}
                  >
                    Admit
                  </button>
                  <button
                    disabled={room.busy}
                    aria-label={`Deny ${request.name}`}
                    onClick={() => room.admit(request.id, false)}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
          {room.requestError && <p role="alert">{room.requestError}</p>}
          <button
            className="admission-view-all"
            onClick={() => {
              setOpen(false);
              room.setPanel('people');
            }}
          >
            View all ({room.requests.length}) <span aria-hidden="true">›</span>
          </button>
        </section>
      )}
    </div>
  );
}
