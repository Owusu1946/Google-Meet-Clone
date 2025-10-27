import { useState, useEffect, useCallback } from 'react';

export type BackgroundType = 'none' | 'blur';

export interface BackgroundOption {
  id: string;
  type: BackgroundType;
  name: string;
  thumbnail?: string;
  blurAmount?: number;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'none', type: 'none', name: 'No effect' },
  { id: 'blur-light', type: 'blur', name: 'Slight blur', blurAmount: 6 },
  { id: 'blur-medium', type: 'blur', name: 'Portrait blur', blurAmount: 12 },
  { id: 'blur-heavy', type: 'blur', name: 'Heavy blur', blurAmount: 20 },
];

export const useVirtualBackground = () => {
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundOption>(BACKGROUND_OPTIONS[0]);
  const [isProcessing, setIsProcessing] = useState(false);

  const applyBackground = useCallback((option: BackgroundOption) => {
    setIsProcessing(true);
    // Simulate processing time
    setTimeout(() => {
      setSelectedBackground(option);
      setIsProcessing(false);
    }, 300);
  }, []);

  const getBackgroundStyles = useCallback(() => {
    if (selectedBackground.type === 'none') {
      return {};
    }

    if (selectedBackground.type === 'blur') {
      return {
        filter: `blur(${selectedBackground.blurAmount}px)`,
      };
    }

    return {};
  }, [selectedBackground]);

  return {
    selectedBackground,
    applyBackground,
    getBackgroundStyles,
    isProcessing,
    availableBackgrounds: BACKGROUND_OPTIONS,
  };
};
