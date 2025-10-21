'use client';
import { MutableRefObject } from 'react';
import Popup from './Popup';
import useClickOutside from '../hooks/useClickOutside';

const REACTIONS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😂', label: 'Laughing' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '👏', label: 'Clapping' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '💯', label: 'Hundred' },
  { emoji: '🙌', label: 'Raise hands' },
];

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReaction: (emoji: string) => void;
}

const ReactionPicker = ({
  isOpen,
  onClose,
  onSelectReaction,
}: ReactionPickerProps) => {
  const ref = useClickOutside(() => {
    onClose();
  }, true) as MutableRefObject<HTMLDivElement>;

  const handleReactionClick = (emoji: string) => {
    onSelectReaction(emoji);
    onClose();
  };

  return (
    <Popup
      ref={ref}
      open={isOpen}
      className="left-auto right-auto bottom-[5rem] overflow-hidden !bg-container-gray shadow-[0_2px_2px_0_rgba(0,0,0,.14),0_3px_1px_-2px_rgba(0,0,0,.12),0_1px_5px_0_rgba(0,0,0,.2)]"
    >
      <div className="w-full min-w-[280px] py-2 px-2">
        <h3 className="text-sm font-medium text-white px-3 py-2 mb-1">
          Send a reaction
        </h3>
        <div className="grid grid-cols-5 gap-1">
          {REACTIONS.map(({ emoji, label }) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className="flex items-center justify-center p-3 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors cursor-pointer text-3xl select-none"
              title={label}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </Popup>
  );
};

export default ReactionPicker;
