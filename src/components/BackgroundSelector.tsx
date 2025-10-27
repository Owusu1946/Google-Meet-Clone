'use client';
import { MutableRefObject, useMemo, useState } from 'react';
import Popup from './Popup';
import useClickOutside from '../hooks/useClickOutside';
import { useBackgroundFilters } from '@stream-io/video-react-sdk';
import Check from './icons/Check';

interface BackgroundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  // Legacy props (ignored)
  onSelectBackground?: any;
  selectedId?: string;
}

const BackgroundSelector = ({
  isOpen,
  onClose,
  onSelectBackground,
  selectedId,
}: BackgroundSelectorProps) => {
  const ref = useClickOutside(() => {
    onClose();
  }, true) as MutableRefObject<HTMLDivElement>;

  const {
    isSupported,
    isReady,
    disableBackgroundFilter,
    applyBackgroundBlurFilter,
  } = useBackgroundFilters();

  const [selected, setSelected] = useState<'none' | 'low' | 'medium' | 'high'>('none');

  const options = useMemo(
    () => [
      { id: 'none', label: 'None' },
      { id: 'low', label: 'Low blur' },
      { id: 'medium', label: 'Medium blur' },
      { id: 'high', label: 'High blur' },
    ] as const,
    []
  );

  const apply = async (id: 'none' | 'low' | 'medium' | 'high') => {
    if (!isSupported || !isReady) return;
    try {
      if (id === 'none') {
        await disableBackgroundFilter();
      } else {
        await applyBackgroundBlurFilter(id);
      }
      setSelected(id);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Popup
      ref={ref}
      open={isOpen}
      className="left-auto right-2 bottom-[5rem] overflow-hidden !bg-container-gray shadow-[0_2px_2px_0_rgba(0,0,0,.14),0_3px_1px_-2px_rgba(0,0,0,.12),0_1px_5px_0_rgba(0,0,0,.2)]"
    >
      <div className="w-full min-w-[320px] max-w-[400px] py-3 px-4">
        <h3 className="text-sm font-medium text-white px-1 py-2 mb-2">
          Visual effects
        </h3>
        {!isSupported && (
          <div className="text-sm text-white/70 px-1 py-2">Background blur is not supported on this device.</div>
        )}
        {isSupported && (
          <div className="grid grid-cols-2 gap-3">
            {options.map((opt) => {
              const isActive = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => apply(opt.id)}
                  disabled={!isReady}
                  className={`relative flex items-center justify-between p-3 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 transition-colors ${
                    isActive ? 'ring-2 ring-blue-500' : ''
                  }`}
                  type="button"
                  title={opt.label}
                >
                  <span>{opt.label}</span>
                  {isActive && (
                    <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Popup>
  );
};

export default BackgroundSelector;
