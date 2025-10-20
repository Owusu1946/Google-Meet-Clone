'use client';
import { MutableRefObject, ReactNode } from 'react';
import clsx from 'clsx';

import useClickOutside from '../hooks/useClickOutside';

interface DropdownOption {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface NewMeetingDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options: DropdownOption[];
}

const NewMeetingDropdown = ({
  isOpen,
  onClose,
  options,
}: NewMeetingDropdownProps) => {
  const domNode = useClickOutside(() => {
    onClose();
  }) as MutableRefObject<HTMLDivElement>;

  if (!isOpen) return null;

  return (
    <div
      ref={domNode}
      className={clsx(
        'absolute z-50 mt-2 w-72 bg-white rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.2)] py-2 animate-fade-in'
      )}
    >
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => {
            option.onClick();
            onClose();
          }}
          className="w-full flex items-center px-6 py-3 hover:bg-gray-100 transition-colors text-left"
        >
          <span className="mr-4 text-meet-gray [&_svg]:w-6 [&_svg]:h-6">
            {option.icon}
          </span>
          <span className="text-sm text-meet-black font-medium">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default NewMeetingDropdown;
