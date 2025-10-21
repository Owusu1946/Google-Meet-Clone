'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface FloatingReactionProps {
  emoji: string;
  id: string;
  senderName?: string;
  onComplete: (id: string) => void;
}

const FloatingReaction = ({ emoji, id, senderName, onComplete }: FloatingReactionProps) => {
  const reactionRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

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
      });
    
    // Animate badge separately with fade out
    if (badgeRef.current && senderName) {
      tl.to(badgeRef.current, {
        opacity: 0,
        duration: 0.4,
      }, '-=2.1');
    }
    
    tl.progress(0.001); // Start slightly delayed for stagger effect

    return () => {
      tl.kill();
    };
  }, [id, onComplete]);

  return (
    <div
      ref={reactionRef}
      className="fixed pointer-events-none z-50 select-none flex flex-col items-center gap-1"
    >
      <div
        className="text-5xl"
        style={{
          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {emoji}
      </div>
      {senderName && (
        <div
          ref={badgeRef}
          className="px-2.5 py-0.5 rounded-full bg-[rgba(0,0,0,0.55)] backdrop-blur-sm text-white text-xs font-medium ring-1 ring-white/10 shadow-lg"
        >
          {senderName}
        </div>
      )}
    </div>
  );
};

export default FloatingReaction;
