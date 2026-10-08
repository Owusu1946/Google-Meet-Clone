import { useState } from 'react';
import { useRoom } from '@/contexts/MeetingRoomContext';
import { admitRequests } from '@/lib/admission-batch';
import type { JoinRequest } from '@/lib/meeting';
import Dialog from './Dialog';

export default function AdmitAllButton() {
  const room = useRoom();
  const [selected, setSelected] = useState<JoinRequest[]>();
  const [error, setError] = useState('');
  if (!room.access.isHost) return null;
  const confirm = () =>
    void room.run(async () => {
      if (!selected?.length) return;
      const result = await admitRequests(
        selected.map((request) => request.id),
        (id) => room.resolveJoinRequest(id, true),
      );
      if (!result.failed.length) {
        setSelected(undefined);
        setError('');
      } else {
        setSelected((current) =>
          current?.filter((request) => result.failed.includes(request.id)),
        );
        setError(
          `${result.admitted.length} admitted. ${result.failed.length} could not be admitted. They may have left, already been handled, or the meeting may be locked. Retry checks each request again.`,
        );
      }
    });
  return (
    <>
      <button
        className="admit-all-button"
        disabled={room.busy || !room.requests.length}
        onClick={() => {
          setError('');
          setSelected([...room.requests]);
        }}
      >
        Admit all
      </button>
      <Dialog
        title="Admit all?"
        open={!!selected?.length}
        onClose={() => {
          if (!room.busy) setSelected(undefined);
        }}
        className="admit-all-dialog"
      >
        <p>
          Admit these {selected?.length}{' '}
          {selected?.length === 1 ? 'person' : 'people'} to the meeting?
        </p>
        <ul className="admit-all-names">
          {selected?.map((request) => (
            <li key={request.id}>
              <span aria-hidden="true">{request.name[0]?.toUpperCase()}</span>
              {request.name}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-meet-red text-sm">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-4 mt-5">
          <button disabled={room.busy} onClick={() => setSelected(undefined)}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={room.busy}
            onClick={confirm}
          >
            {room.busy ? 'Admitting…' : error ? 'Retry remaining' : 'Admit all'}
          </button>
        </div>
      </Dialog>
    </>
  );
}
