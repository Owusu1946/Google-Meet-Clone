import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/meeting';

export type DevicePreferences = {
  mic: boolean;
  camera: boolean;
  audioId?: string;
  videoId?: string;
  speakerId?: string;
};
export const DEFAULT_DEVICES: DevicePreferences = { mic: false, camera: false };
export function readDevicePreferences(): DevicePreferences {
  try {
    return {
      ...DEFAULT_DEVICES,
      ...JSON.parse(localStorage.getItem('meet-devices') || '{}'),
    };
  } catch {
    return DEFAULT_DEVICES;
  }
}
export function saveDevicePreferences(preferences: DevicePreferences) {
  try {
    localStorage.setItem('meet-devices', JSON.stringify(preferences));
  } catch {
    /* Private browsing may disable storage. */
  }
}

export default function usePreviewMedia() {
  const [preferences, setPreferences] = useState(DEFAULT_DEVICES);
  const [ready, setReady] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ready) saveDevicePreferences(preferences);
  }, [preferences, ready]);
  const { camera, mic, videoId, audioId } = preferences;
  const active = useRef<MediaStream | undefined>(undefined);
  useEffect(() => {
    setPreferences(readDevicePreferences());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const stop = () => {
      active.current?.getTracks().forEach((track) => track.stop());
      active.current = undefined;
    };
    stop();
    setStream(undefined);
    setError('');
    const start = async () => {
      if (!navigator.mediaDevices)
        throw new Error(
          'Camera and microphone require a secure HTTPS connection.',
        );
      setBusy(true);
      // Request independently so a denied camera does not prevent microphone use (and vice versa).
      const next = new MediaStream();
      const requests: Array<Promise<MediaStream>> = [];
      if (camera)
        requests.push(
          navigator.mediaDevices.getUserMedia({
            video: videoId ? { deviceId: { exact: videoId } } : true,
          }),
        );
      if (mic)
        requests.push(
          navigator.mediaDevices.getUserMedia({
            audio: audioId ? { deviceId: { exact: audioId } } : true,
          }),
        );
      const results = await Promise.allSettled(requests);
      for (const result of results) {
        if (result.status === 'fulfilled')
          result.value.getTracks().forEach((track) => next.addTrack(track));
        else if (!cancelled)
          setError(
            `${errorMessage(result.reason)}. Check browser permissions or choose another device.`,
          );
      }
      if (cancelled) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      active.current = next;
      setStream(next);
      setBusy(false);
      setDevices(await navigator.mediaDevices.enumerateDevices());
    };
    void start().catch((failure) => {
      if (!cancelled) {
        setError(errorMessage(failure));
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [ready, camera, mic, videoId, audioId]);
  useEffect(() => {
    if (!navigator.mediaDevices) return;
    const update = () =>
      void navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => undefined);
    navigator.mediaDevices.addEventListener('devicechange', update);
    return () =>
      navigator.mediaDevices.removeEventListener('devicechange', update);
  }, []);
  const change = useCallback(
    (next: Partial<DevicePreferences>) =>
      setPreferences((current) => ({ ...current, ...next })),
    [],
  );
  return { preferences, change, stream, devices, error, busy };
}
