'use client';
import { MutableRefObject } from 'react';
import Popup from './Popup';
import useClickOutside from '../hooks/useClickOutside';
import {
  BackgroundOption,
  BACKGROUND_OPTIONS,
} from '../hooks/useVirtualBackground';
import Check from './icons/Check';

interface BackgroundSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBackground: (option: BackgroundOption) => void;
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

  const handleBackgroundClick = (option: BackgroundOption) => {
    onSelectBackground(option);
  };

  const renderBackgroundPreview = (option: BackgroundOption) => {
    if (option.type === 'none') {
      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
          None
        </div>
      );
    }

    if (option.type === 'blur') {
      return (
        <div className="w-full h-full relative overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800"
            style={{ filter: `blur(${option.blurAmount! / 4}px)` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
            Blur
          </div>
        </div>
      );
    }

    if (option.type === 'image' && option.imageUrl) {
      return (
        <div
          className="w-full h-full"
          style={{
            background: option.imageUrl,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      );
    }

    return null;
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
        <div className="grid grid-cols-3 gap-3">
          {BACKGROUND_OPTIONS.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <button
                key={option.id}
                onClick={() => handleBackgroundClick(option)}
                className={`relative flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-500' : ''
                }`}
                type="button"
              >
                <div className="w-full aspect-video rounded-md overflow-hidden bg-gray-700 relative">
                  {renderBackgroundPreview(option)}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-xs text-white text-center">
                  {option.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Popup>
  );
};

export default BackgroundSelector;
