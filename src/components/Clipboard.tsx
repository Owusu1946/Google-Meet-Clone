'use client';
import { useState } from 'react';
import ContentCopy from './icons/ContentCopy';
export default function Clipboard({ value }: { value: string }) {
  const [message, setMessage] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Link copied');
    } catch {
      setMessage('Could not copy. Select the link and copy it manually.');
    }
  };
  return (
    <div>
      <div className="flex items-center rounded-lg bg-light-gray border border-hairline-gray">
        <input
          aria-label="Meeting link"
          readOnly
          value={value}
          onFocus={(event) => event.target.select()}
          className="min-w-0 w-full bg-transparent px-3 py-3 text-sm"
        />
        <button
          aria-label="Copy meeting link"
          onClick={() => void copy()}
          className="p-3 hover:bg-hairline-gray rounded-r-lg"
        >
          <ContentCopy />
        </button>
      </div>
      <p className="text-xs mt-2 text-primary" role="status">
        {message}
      </p>
    </div>
  );
}
