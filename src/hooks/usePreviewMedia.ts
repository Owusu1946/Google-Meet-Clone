import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/meeting';

export type DevicePreferences = {
  blur?: 'none' | 'low' | 'high';
  mic: boolean;
  camera: boolean;
  audioId?: string;
  videoId?: string;
  speakerId?: string;
};
export const DEFAULT_DEVICES: DevicePreferences = { mic: false, camera: false };
export function readDevicePreferences(): DevicePreferences {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem('meet-devices') || '{}',
    );
    if (!value || typeof value !== 'object') return DEFAULT_DEVICES;
    const saved = value as Record<string, unknown>;
    return {
      blur: saved.blur === 'low' || saved.blur === 'high' ? saved.blur : 'none',
      mic: saved.mic === true,
      camera: saved.camera === true,
      ...Object.fromEntries(
        ['audioId', 'videoId', 'speakerId']
          .filter(
            (key) =>
              typeof saved[key] === 'string' &&
              (saved[key] as string).length <= 512,
          )
          .map((key) => [key, saved[key]]),
      ),
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

export type DevicePermission = 'prompt' | 'granted' | 'denied' | 'unavailable';
export default function usePreviewMedia() {
  const [preferences, setPreferences] = useState(DEFAULT_DEVICES);
  const [permissions, setPermissions] = useState<{
    mic: DevicePermission;
    camera: DevicePermission;
  }>({ mic: 'prompt', camera: 'prompt' });
  const [attempt, setAttempt] = useState(0);
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
    let cancelled = false;
    const query = async (name: string): Promise<DevicePermission> => {
      try {
        return (
          await navigator.permissions.query({ name: name as PermissionName })
        ).state;
      } catch {
        return 'prompt';
      }
    };
    void Promise.all([query('microphone'), query('camera')]).then(
      ([mic, camera]) => {
        if (cancelled) return;
        setPermissions({ mic, camera });
        const saved = readDevicePreferences();
        // A stored preference is not permission to reopen a revoked browser prompt.
        setPreferences({
          ...saved,
          mic: saved.mic && mic === 'granted',
          camera: saved.camera && camera === 'granted',
        });
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
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
      const kinds: Array<'mic' | 'camera'> = [];
      if (camera) {
        kinds.push('camera');
        requests.push(
          navigator.mediaDevices.getUserMedia({
            video: videoId ? { deviceId: { exact: videoId } } : true,
          }),
        );
      }
      if (mic) {
        kinds.push('mic');
        requests.push(
          navigator.mediaDevices.getUserMedia({
            audio: audioId ? { deviceId: { exact: audioId } } : true,
          }),
        );
      }
      const results = await Promise.allSettled(requests);
      for (const [index, result] of results.entries()) {
        const kind = kinds[index];
        if (result.status === 'fulfilled') {
          result.value.getTracks().forEach((track) => next.addTrack(track));
          if (!cancelled)
            setPermissions((current) => ({ ...current, [kind]: 'granted' }));
        } else if (!cancelled) {
          const denied =
            result.reason instanceof DOMException &&
            result.reason.name === 'NotAllowedError';
          setPermissions((current) => ({
            ...current,
            [kind]: denied ? 'denied' : 'unavailable',
          }));
          setPreferences((current) => ({ ...current, [kind]: false }));
          setError(
            `${kind === 'mic' ? 'Microphone' : 'Camera'}: ${errorMessage(result.reason)}. Check browser permissions or choose another device.`,
          );
        }
      }
      if (cancelled) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      for (const track of next.getTracks()) {
        track.addEventListener(
          'ended',
          () => {
            if (cancelled) return;
            setError(
              `${track.kind === 'video' ? 'Camera' : 'Microphone'} disconnected. Choose another device or turn it back on.`,
            );
            setPreferences((current) => ({
              ...current,
              [track.kind === 'video' ? 'camera' : 'mic']: false,
            }));
          },
          { once: true },
        );
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
  }, [ready, camera, mic, videoId, audioId, attempt]);
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
  const requestDevices = (next: Partial<DevicePreferences>) => {
    change(next);
    setAttempt((value) => value + 1);
  };
  return {
    preferences,
    change,
    requestDevices,
    permissions,
    stream,
    devices,
    error,
    busy,
    ready,
  };
}
