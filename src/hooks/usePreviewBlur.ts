import { useEffect, useState } from 'react';
import type { DevicePreferences } from './usePreviewMedia';
import { errorMessage } from '@/lib/meeting';
export default function usePreviewBlur(
  stream: MediaStream | undefined,
  level: DevicePreferences['blur'],
) {
  const [processed, setProcessed] = useState<MediaStream>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let failed = false;
    let processor:
      import('@stream-io/video-filters-web').VirtualBackground | undefined;
    let source: MediaStreamTrack | undefined;
    let output: MediaStreamTrack | undefined;
    const stop = () => {
      output?.stop();
      processor?.stop();
      source?.stop();
    };
    const fail = (failure: unknown) => {
      if (cancelled || failed) return;
      failed = true;
      setProcessed(undefined);
      setError(`Background blur stopped: ${errorMessage(failure)}`);
      setBusy(false);
      stop();
    };
    setProcessed(undefined);
    setError('');
    setBusy(false);
    const track = stream?.getVideoTracks()[0];
    if (!track || !level || level === 'none') return;
    setBusy(true);
    const start = async () => {
      const filters = await import('@stream-io/video-filters-web');
      if (!(await filters.isMediaPipePlatformSupported()))
        throw new Error('Background blur is unavailable on this device.');
      await filters.loadMediaPipe();
      if (cancelled) return;
      source = track.clone();
      processor = new filters.VirtualBackground(
        source,
        { backgroundFilter: 'blur', backgroundBlurLevel: level },
        {
          onError: fail,
        },
      );
      output = await processor.start();
      if (cancelled || failed) {
        stop();
        return;
      }
      setProcessed(new MediaStream([output]));
    };
    void start()
      .catch(fail)
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [stream, level]);
  return { stream: processed || stream, busy, error };
}
