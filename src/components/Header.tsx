'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SignInButton, UserButton } from '@clerk/nextjs';
import Dialog from './Dialog';
import Videocam from './icons/Videocam';
import useTime from '@/hooks/useTime';

export default function Header({ navItems = true }: { navItems?: boolean }) {
  const { currentDateTime } = useTime();
  const [help, setHelp] = useState(false);
  return (
    <header className="px-5 py-4 flex justify-between items-center gap-4">
      <Link
        href="/"
        className="flex items-center gap-2 text-2xl text-meet-gray"
      >
        <Videocam width={36} height={36} color="#1a73e8" />
        <span>
          Meet <span className="text-sm">Clone</span>
        </span>
      </Link>
      <div className="flex items-center gap-5">
        {navItems && (
          <>
            <time
              suppressHydrationWarning
              className="hidden md:block text-meet-gray"
            >
              {currentDateTime}
            </time>
            <button
              className="text-sm text-primary"
              onClick={() => setHelp(true)}
            >
              Help
            </button>
          </>
        )}
        <UserButton
          fallback={
            <SignInButton mode="modal">
              <button className="text-primary text-sm">Sign in</button>
            </SignInButton>
          }
        />
      </div>
      <Dialog open={help} onClose={() => setHelp(false)} title="Meeting help">
        <div className="space-y-4 text-sm leading-6">
          <p>
            Create a meeting after signing in, then copy its link. Guests can
            enter their name and ask the host to join.
          </p>
          <p>
            Use the microphone and camera controls to enable devices. Allow
            access in your browser when prompted. Device selection is available
            in meeting settings.
          </p>
          <p>
            During a meeting, use the bottom controls for captions, whiteboard,
            reactions, recordings, and settings. On smaller screens, additional
            controls are in More options. The host can admit people and manage
            access from Host controls.
          </p>
          <p>
            Keyboard shortcuts: Ctrl/⌘ + D toggles your microphone, Ctrl/⌘ + E
            toggles your camera, and Escape closes the current panel.
          </p>
        </div>
      </Dialog>
    </header>
  );
}
