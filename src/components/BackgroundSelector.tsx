'use client';
import { useState } from 'react';
import { useBackgroundFilters } from '@stream-io/video-react-sdk';
import { errorMessage } from '@/lib/meeting';
export default function BackgroundSelector() {
  const filters = useBackgroundFilters();
  const [error, setError] = useState('');
  const selected =
    filters.backgroundFilter === 'blur'
      ? filters.backgroundBlurLevel || 'high'
      : 'none';
  const apply = (value: 'none' | 'low' | 'medium' | 'high') => {
    setError('');
    try {
      if (value === 'none') filters.disableBackgroundFilter();
      else filters.applyBackgroundBlurFilter(value);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };
  return (
    <section>
      <h3 className="font-medium mb-3">Background blur</h3>
      {!filters.isSupported ? (
        <p className="text-sm text-meet-gray">
          Background blur is unavailable on this device.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {(['none', 'low', 'medium', 'high'] as const).map((value) => (
              <button
                className={`border rounded-lg p-3 text-sm ${selected === value ? 'border-primary text-primary bg-blue-50' : 'border-hairline-gray'}`}
                aria-pressed={selected === value}
                disabled={!filters.isReady || filters.isLoading}
                onClick={() => apply(value)}
                key={value}
              >
                {value === 'none'
                  ? 'No blur'
                  : `${value[0].toUpperCase() + value.slice(1)} blur`}
              </button>
            ))}
          </div>
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
