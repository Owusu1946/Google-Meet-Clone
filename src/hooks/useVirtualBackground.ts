import { useState, useEffect, useCallback } from 'react';

export type BackgroundType = 'none' | 'blur' | 'image';

export interface BackgroundOption {
  id: string;
  type: BackgroundType;
  name: string;
  thumbnail?: string;
  imageUrl?: string;
  blurAmount?: number;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: 'none', type: 'none', name: 'No effect' },
  { id: 'blur-light', type: 'blur', name: 'Slight blur', blurAmount: 5 },
  { id: 'blur-medium', type: 'blur', name: 'Blur', blurAmount: 10 },
  { id: 'blur-heavy', type: 'blur', name: 'Heavy blur', blurAmount: 20 },
  {
    id: 'gradient-1',
    type: 'image',
    name: 'Blue gradient',
    imageUrl: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'gradient-2',
    type: 'image',
    name: 'Ocean gradient',
    imageUrl: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    id: 'gradient-3',
    type: 'image',
    name: 'Sunset gradient',
    imageUrl: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
  {
    id: 'gradient-4',
    type: 'image',
    name: 'Forest gradient',
    imageUrl: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)',
  },
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

    if (selectedBackground.type === 'image' && selectedBackground.imageUrl) {
      return {
        background: selectedBackground.imageUrl,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
