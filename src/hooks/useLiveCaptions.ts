import { useCallback, useEffect, useRef, useState } from 'react';

// Cross-browser SpeechRecognition
const getSpeechRecognition = (): typeof window extends any
  ? (typeof window & { webkitSpeechRecognition?: any })['webkitSpeechRecognition'] | any
  : any => {
  if (typeof window === 'undefined') return undefined as any;
  // @ts-ignore
  return window.SpeechRecognition || window.webkitSpeechRecognition;
};

export interface LiveCaptionsState {
  supported: boolean;
  listening: boolean;
  interimText: string;
  lines: string[]; // recent finalized lines, newest last
  start: () => void;
  stop: () => void;
  clear: () => void;
}

const MAX_LINES = 3;

const useLiveCaptions = (): LiveCaptionsState => {
  const RecognitionCtor = getSpeechRecognition();
  const [supported] = useState<boolean>(!!RecognitionCtor);
  const recognitionRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const restartTimeout = useRef<number | null>(null);

  const resetInterim = () => setInterimText('');

  const pushLine = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLines((prev) => {
      const next = [...prev, clean];
      return next.slice(Math.max(0, next.length - MAX_LINES));
    });
  };

  const setupRecognition = useCallback(() => {
    if (!supported || recognitionRef.current) return;
    const rec = new RecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator?.language || 'en-US';

    rec.onresult = (event: any) => {
      let interim = '';
      // Iterate from event.resultIndex to the end
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          pushLine(transcript);
          interim = '';
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (e: any) => {
      // Common transient errors. We'll attempt to restart on end handler
      // console.warn('SpeechRecognition error', e?.error);
    };

    rec.onend = () => {
      setListening(false);
      // Auto-restart if we didn't call stop()
      if (restartTimeout.current !== null) {
        window.clearTimeout(restartTimeout.current);
      }
      // Small delay to avoid tight loops on permission/network errors
      restartTimeout.current = window.setTimeout(() => {
        if (recognitionRef.current) {
          try {
            rec.start();
            setListening(true);
          } catch {
            // swallow
          }
        }
      }, 250);
    };

    recognitionRef.current = rec;
  }, [RecognitionCtor, supported]);

  const start = useCallback(() => {
    if (!supported) return;
    setupRecognition();
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.start();
      setListening(true);
    } catch {
      // swallow (start called while already started)
    }
  }, [setupRecognition, supported]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.onend = null; // prevent auto-restart
      rec.stop();
    } catch {
      // swallow
    }
    recognitionRef.current = null;
    setListening(false);
    resetInterim();
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    resetInterim();
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (restartTimeout.current !== null) {
        window.clearTimeout(restartTimeout.current);
        restartTimeout.current = null;
      }
    };
  }, []);

  return { supported, listening, interimText, lines, start, stop, clear };
};

export default useLiveCaptions;
