'use client';
import React, { useMemo } from 'react';
import { useCallStateHooks } from '@stream-io/video-react-sdk';
import BackHand from './icons/BackHand';

interface HandRaiseOverlayProps {
  raisedUserIds: string[];
}

const HandRaiseOverlay = ({ raisedUserIds }: HandRaiseOverlayProps) => {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  const uniqueIds = useMemo(
    () => Array.from(new Set(raisedUserIds)),
    [raisedUserIds]
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((p: any) => {
      const uid = p.userId || p.user?.id;
      const username = p.user?.custom?.username;
      const display = username || p.name || p.user?.name || uid;
      if (uid) map.set(uid, display);
    });
    return map;
  }, [participants]);

  if (uniqueIds.length === 0) return null;

  return (
    <div className="pointer-events-none select-none absolute top-4 left-4 z-30 space-y-2">
      {uniqueIds.map((id) => (
        <div
          key={id}
          className="flex items-center gap-2 bg-green-400 text-meet-black px-3 py-1.5 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.25)] animate-fade-in"
          style={{ filter: 'saturate(1.1)' }}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <BackHand />
          </div>
          <span className="text-sm font-medium whitespace-nowrap">
            {nameById.get(id) || id}
          </span>
        </div>
      ))}
    </div>
  );
};

export default HandRaiseOverlay;
