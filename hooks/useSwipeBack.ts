"use client";

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SwipeBackOptions {
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeBack(options: SwipeBackOptions = {}) {
  const { threshold = 50, enabled = true } = options;
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  useEffect(() => {
    // Disabilita su login page
    if (!enabled || pathname === '/login') return;
    
    const handleTouchStart = (e: TouchEvent) => {
      // Solo se inizia dal bordo sinistro (primi 20px)
      if (e.touches[0].clientX < 20) {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const touchEndX = e.touches[0].clientX;
      const touchEndY = e.touches[0].clientY;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = Math.abs(touchEndY - touchStartY.current);
      
      // Previeni scroll verticale durante swipe orizzontale
      if (deltaX > 10 && deltaY < 50) {
        e.preventDefault();
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = Math.abs(touchEndY - touchStartY.current);
      
      // Swipe da sinistra a destra con movimento principalmente orizzontale
      if (deltaX > threshold && deltaY < 50) {
        // Vai indietro nella storia
        router.back();
      }
      
      // Reset
      touchStartX.current = null;
      touchStartY.current = null;
    };
    
    // iOS specific: aggiungi passive: false per prevenire comportamenti default
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, pathname, router, threshold]);
}