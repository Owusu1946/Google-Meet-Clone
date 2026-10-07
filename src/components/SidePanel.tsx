'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Close from './icons/Close';

export default function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prior?.focus();
  }, []);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="meeting-panel"
    >
      <header className="p-5 flex items-center justify-between border-b border-hairline-gray">
        <h2 className="text-xl">{title}</h2>
        <button
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="p-2 rounded-full hover:bg-light-gray"
        >
          <Close />
        </button>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </aside>
  );
}
