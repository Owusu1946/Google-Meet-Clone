'use client';
import { useState, useCallback } from 'react';
import FloatingReaction from './FloatingReaction';

interface Reaction {
  id: string;
  emoji: string;
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

  const addReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id, emoji }]);
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
