import { useEffect, useRef } from 'react';
export default function useClickOutside(handler: () => void, shallow = false) {
  const domNode = useRef<HTMLElement>(null);
  const latestHandler = useRef(handler);
  latestHandler.current = handler;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const element = domNode.current;
      const target = event.target;
      if (!element || !(target instanceof Node)) return;
      if (!element.contains(target) && (!shallow || !element.parentElement?.contains(target))) latestHandler.current();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [shallow]);
  return domNode;
}
