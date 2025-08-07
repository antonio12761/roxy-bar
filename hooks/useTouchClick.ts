'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook per gestire click su Android PWA
 * Risolve il problema dei click che non funzionano in standalone mode
 */
export function useTouchClick(onClick?: () => void) {
  const touchStartRef = useRef<boolean>(false);
  const touchTimeRef = useRef<number>(0);

  const handleTouchStart = useCallback(() => {
    touchStartRef.current = true;
    touchTimeRef.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current && onClick) {
      const touchDuration = Date.now() - touchTimeRef.current;
      
      // Se il touch è stato breve (< 200ms), consideralo un click
      if (touchDuration < 200) {
        e.preventDefault();
        onClick();
      }
    }
    touchStartRef.current = false;
  }, [onClick]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Previeni doppi eventi su alcuni dispositivi
    if (!touchStartRef.current && onClick) {
      onClick();
    }
  }, [onClick]);

  return {
    onClick: handleClick,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    style: { cursor: 'pointer' }
  };
}