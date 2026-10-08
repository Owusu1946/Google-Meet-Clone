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
    let processor:
      import('@stream-io/video-filters-web').VirtualBackground | undefined;
    let source: MediaStreamTrack | undefined;
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
          onError: (failure) => {
            if (!cancelled) setError(errorMessage(failure));
          },
        },
      );
      const output = await processor.start();
      if (cancelled) {
        output.stop();
        processor.stop();
        return;
      }
      setProcessed(new MediaStream([output]));
    };
    void start()
      .catch((failure) => {
        if (!cancelled) setError(errorMessage(failure));
        processor?.stop();
        source?.stop();
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      processor?.stop();
      source?.stop();
    };
  }, [stream, level]);
  return { stream: processed || stream, busy, error };
}
