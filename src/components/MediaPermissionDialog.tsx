import { useEffect, useState } from 'react';
import Image from 'next/image';
import Dialog from './Dialog';
import Mic from './icons/Mic';
import Videocam from './icons/Videocam';
export type PermissionTarget = 'mic' | 'camera' | 'both';
export default function MediaPermissionDialog({
  target,
  onClose,
  onAllow,
  busy,
}: {
  target?: PermissionTarget;
  onClose: () => void;
  onAllow: (target: PermissionTarget) => void;
  busy: boolean;
}) {
  const [alternatives, setAlternatives] = useState(false);
  useEffect(() => setAlternatives(false), [target]);
  const device = target === 'mic' ? 'microphone' : 'camera';
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Microphone and camera access"
      className="permission-dialog"
    >
      <Image
        src="/permission-flow.svg"
        width={530}
        height={292}
        alt="Two people connecting with a camera and microphone"
        className="permission-illustration"
      />
      <h2>
        {target === 'both'
          ? 'Do you want people to see and hear you in the meeting?'
          : target === 'mic'
            ? 'Do you want people to hear you in the meeting?'
            : 'Do you want people to see you in the meeting?'}
      </h2>
      <p>
        You can still turn off your{' '}
        {target === 'both' ? 'microphone and camera' : device} anytime in the
        meeting.
      </p>
      <div className="permission-actions">
        <button
          disabled={busy}
          className="primary-button permission-primary"
          onClick={() => target && onAllow(target)}
        >
          {target === 'mic' ? <Mic /> : <Videocam />} Use{' '}
          {target === 'both' ? 'microphone and camera' : device}
        </button>
        {target === 'both' ? (
          <>
            <button
              className="permission-expand"
              aria-label="Choose microphone or camera separately"
              aria-expanded={alternatives}
              onClick={() => setAlternatives((value) => !value)}
            >
              ⌄
            </button>
            {alternatives && (
              <div className="permission-alternatives">
                <button disabled={busy} onClick={() => onAllow('mic')}>
                  Use microphone only
                </button>
                <button disabled={busy} onClick={() => onAllow('camera')}>
                  Use camera only
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            disabled={busy}
            className="permission-secondary"
            onClick={() => onAllow('both')}
          >
            <Videocam /> Use microphone and camera
          </button>
        )}
      </div>
      <small>
        Your browser will ask for access next. You can also close this and join
        with devices off.
      </small>
    </Dialog>
  );
}
