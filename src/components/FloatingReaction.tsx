'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface FloatingReactionProps {
  emoji: string;
  id: string;
  onComplete: (id: string) => void;
}

const FloatingReaction = ({ emoji, id, onComplete }: FloatingReactionProps) => {
  const reactionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!reactionRef.current) return;

    // Random horizontal position
    const startX = Math.random() * 80 + 10; // 10-90% of screen width
    const endX = startX + (Math.random() - 0.5) * 30; // Slight drift

    // Animation timeline
    const tl = gsap.timeline({
      onComplete: () => onComplete(id),
    });

    tl.fromTo(
      reactionRef.current,
      {
        left: `${startX}%`,
        bottom: '5rem',
        opacity: 0,
        scale: 0.5,
      },
      {
        bottom: '80%',
        opacity: 1,
        scale: 1,
        duration: 0.3,
        ease: 'back.out(1.7)',
      }
    )
      .to(reactionRef.current, {
        left: `${endX}%`,
        bottom: '90%',
        opacity: 0,
        scale: 0.8,
        duration: 2.5,
        ease: 'power1.inOut',
      })
      .progress(0.001); // Start slightly delayed for stagger effect

    return () => {
      tl.kill();
    };
  }, [id, onComplete]);

  return (
    <div
      ref={reactionRef}
      className="fixed pointer-events-none z-50 text-5xl select-none"
      style={{
        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {emoji}
    </div>
  );
};

export default FloatingReaction;
