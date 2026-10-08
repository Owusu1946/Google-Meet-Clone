'use client';
import { useState } from 'react';
import BlurChoices from './BlurChoices';
import {
  readDevicePreferences,
  saveDevicePreferences,
} from '@/hooks/usePreviewMedia';
import { useBackgroundFilters } from '@stream-io/video-react-sdk';
import { errorMessage } from '@/lib/meeting';
export default function BackgroundSelector() {
  const filters = useBackgroundFilters();
  const [error, setError] = useState('');
  const selected =
    filters.backgroundFilter === 'blur'
      ? filters.backgroundBlurLevel || 'high'
      : 'none';
  const apply = (value: 'none' | 'low' | 'high') => {
    setError('');
    try {
      if (value === 'none') filters.disableBackgroundFilter();
      else filters.applyBackgroundBlurFilter(value);
      saveDevicePreferences({ ...readDevicePreferences(), blur: value });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };
  return (
    <section>
      {!filters.isSupported ? (
        <p className="text-sm text-meet-gray">
          Background blur is unavailable on this device.
        </p>
      ) : (
        <>
          <BlurChoices
            value={
              selected === 'medium'
                ? 'low'
                : (selected as 'none' | 'low' | 'high')
            }
            onChange={apply}
            disabled={!filters.isReady || filters.isLoading}
          />
          {!filters.isReady && (
            <p className="text-sm text-meet-gray mt-3">
              Preparing visual effects…
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-meet-red mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
