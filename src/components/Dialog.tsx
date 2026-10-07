"use client";
import { useEffect, useId, useRef, type ReactNode } from 'react';
import Close from './icons/Close';

export default function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby={id} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="meet-dialog">
    <div className="flex items-center justify-between gap-4 mb-5"><h2 id={id} className="text-xl font-medium">{title}</h2><button aria-label={`Close ${title}`} onClick={onClose} className="rounded-full p-2 hover:bg-light-gray"><Close /></button></div>
    {open && children}
  </dialog>;
}
