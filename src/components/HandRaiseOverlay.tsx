'use client';
import React, { useMemo } from 'react';
import Avatar from './Avatar';
import BackHand from './icons/BackHand';

interface HandRaiseOverlayProps {
  raisedUserIds: string[];
}

const HandRaiseOverlay = ({ raisedUserIds }: HandRaiseOverlayProps) => {
  const uniqueIds = useMemo(
    () => Array.from(new Set(raisedUserIds)),
    [raisedUserIds]
  );

  if (uniqueIds.length === 0) return null;

  return (
    <div className="pointer-events-none select-none absolute top-4 left-4 z-30">
      <div className="flex items-center gap-2 bg-[rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-md text-white px-3 py-2 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <BackHand />
        <div className="flex -space-x-2">
          {uniqueIds.slice(0, 5).map((id) => (
            <div key={id} className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/20">
              <Avatar width={28} participant={{ userId: id } as any} />
            </div>
          ))}
        </div>
        {uniqueIds.length > 5 && (
          <div className="text-xs opacity-80 ml-1">+{uniqueIds.length - 5}</div>
        )}
      </div>
    </div>
  );
};

export default HandRaiseOverlay;
