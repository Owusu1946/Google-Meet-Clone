'use client';
import { useState, useCallback } from 'react';
import FloatingReaction from './FloatingReaction';

interface Reaction {
  id: string;
  emoji: string;
  senderName?: string;
}

interface ReactionOverlayProps {
  reactions: Reaction[];
  onReactionComplete: (id: string) => void;
}

const ReactionOverlay = ({
  reactions,
  onReactionComplete,
}: ReactionOverlayProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {reactions.map((reaction) => (
        <FloatingReaction
          key={reaction.id}
          id={reaction.id}
          emoji={reaction.emoji}
          senderName={reaction.senderName}
          onComplete={onReactionComplete}
        />
      ))}
    </div>
  );
};

export default ReactionOverlay;

// Custom hook for managing reactions
export const useReactions = () => {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const addReaction = useCallback((emoji: string, senderName?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id, emoji, senderName }]);
  }, []);

  const removeReaction = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    reactions,
    addReaction,
    removeReaction,
  };
};
