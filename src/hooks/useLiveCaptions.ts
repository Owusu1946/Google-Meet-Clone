import { useEffect, useState } from 'react';
import { useCall } from '@stream-io/video-react-sdk';
import type { CallClosedCaption } from '@stream-io/video-client';

export default function useLiveCaptions() {
  const call = useCall();
  const [captions, setCaptions] = useState<CallClosedCaption[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!call) return;
    const lines = call.state.closedCaptions$.subscribe(setCaptions);
    const status = call.state.captioning$.subscribe(setRunning);
    const failed = call.on('call.closed_captions_failed', () =>
      setError('Live captions are unavailable. Ask the host to restart them.'),
    );
    const started = call.on('call.closed_captions_started', () => setError(''));
    return () => {
      lines.unsubscribe();
      status.unsubscribe();
      failed();
      started();
    };
  }, [call]);
  return { captions, running, error };
}
