import { useRoom } from '@/contexts/MeetingRoomContext';
import useTime from '@/hooks/useTime';
import Info from './icons/Info';
import AdmissionPopover from './AdmissionPopover';
import PeopleSummary from './PeopleSummary';
import PresentationStatus from './PresentationStatus';
export default function MeetingTopbar() {
  const room = useRoom();
  const { currentTime } = useTime();
  return (
    <header className="meeting-topbar">
      <div className="meeting-topbar-details">
        <time suppressHydrationWarning>{currentTime}</time>
        <span className="meeting-topbar-divider" />
        <span className="meeting-topbar-code" title={room.access.meetingId}>
          {room.access.meetingId}
        </span>
        <button
          aria-label="Meeting details"
          aria-pressed={room.panel === 'details'}
          onClick={() => room.togglePanel('details')}
        >
          <Info />
        </button>
      </div>
      <div className="meeting-topbar-people">
        <PresentationStatus />
        <AdmissionPopover />
        <PeopleSummary />
      </div>
    </header>
  );
}
