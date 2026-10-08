import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/meeting';

type PipApi = {
  requestWindow: (options: {
    width: number;
    height: number;
  }) => Promise<Window>;
};
export default function usePresenterPip(active: boolean) {
  const [pip, setPip] = useState<Window>();
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<Window | undefined>(undefined);
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const close = useCallback(() => {
    generation.current++;
    current.current?.close();
    current.current = undefined;
    if (mounted.current) setPip(undefined);
  }, []);
  useEffect(() => {
    mounted.current = true;
    setSupported('documentPictureInPicture' in window);
    return () => {
      mounted.current = false;
      close();
    };
  }, [close]);
  useEffect(() => {
    if (!active) close();
  }, [active, close]);
  const open = async () => {
    if (!activeRef.current || pending.current) return;
    if (current.current && !current.current.closed) {
      current.current.focus();
      return;
    }
    const api = (window as Window & { documentPictureInPicture?: PipApi })
      .documentPictureInPicture;
    if (!api) {
      setError(
        'Picture-in-picture is unavailable in this browser. You can keep presenting in this tab.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    const request = ++generation.current;
    let opened: Window | undefined;
    try {
      // Called directly from a user action: the browser requires transient activation.
      opened = await api.requestWindow({ width: 440, height: 620 });
      if (
        !mounted.current ||
        !activeRef.current ||
        request !== generation.current
      ) {
        opened.close();
        return;
      }
      opened.document.title = 'Meeting · Picture-in-picture';
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((style) => {
          opened!.document.head.appendChild(style.cloneNode(true));
        });
      opened.document.documentElement.style.cssText =
        'height:100%;background:#111315;color:white;';
      opened.document.body.style.cssText =
        'height:100%;margin:0;overflow:hidden;';
      current.current = opened;
      opened.addEventListener(
        'pagehide',
        () => {
          if (current.current !== opened) return;
          current.current = undefined;
          if (mounted.current) setPip(undefined);
        },
        { once: true },
      );
      setPip(opened);
    } catch (failure) {
      opened?.close();
      if (mounted.current && request === generation.current)
        setError(errorMessage(failure));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { pip, supported, busy, error, open, close };
}
