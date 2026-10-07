'use client';
import Dialog from './Dialog';
import Clipboard from './Clipboard';
export default function MeetingLinkPopup({
  isOpen,
  onClose,
  meetingId,
  baseUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  baseUrl: string;
}) {
  return (
    <Dialog open={isOpen} onClose={onClose} title="Here’s your joining info">
      <p className="text-sm text-meet-gray mb-4">
        Send this link to the people you want to meet. You’ll be asked to admit
        them when they join.
      </p>
      <Clipboard value={`${baseUrl}/${meetingId}`} />
      <a className="primary-button inline-block mt-6" href={`/${meetingId}`}>
        Join this meeting
      </a>
    </Dialog>
  );
}
