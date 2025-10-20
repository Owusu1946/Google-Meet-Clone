'use client';
import { useState } from 'react';
import clsx from 'clsx';

import Close from './icons/Close';
import ContentCopy from './icons/ContentCopy';

interface MeetingLinkPopupProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  baseUrl: string;
}

const MeetingLinkPopup = ({
  isOpen,
  onClose,
  meetingId,
  baseUrl,
}: MeetingLinkPopupProps) => {
  const [copied, setCopied] = useState(false);
  const meetingLink = `${baseUrl}/${meetingId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-[90%] max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-xl font-medium text-meet-black">
            Here&apos;s your joining info
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-gray-100 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <Close />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-sm text-gray-600 mb-4">
            Send this to people you want to meet with. Be sure to save it so you
            can use it later, too.
          </p>

          {/* Meeting Link */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-sm text-meet-black flex-1 truncate font-mono">
              {meetingLink}
            </span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 hover:bg-gray-200 rounded p-2 transition-colors"
              aria-label="Copy link"
              title="Copy link"
            >
              <ContentCopy />
            </button>
          </div>

          {/* Copy confirmation */}
          {copied && (
            <p className="text-sm text-primary mt-2 animate-fade-in">
              Link copied to clipboard!
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default MeetingLinkPopup;
