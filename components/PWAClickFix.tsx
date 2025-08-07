'use client';

import { useEffect } from 'react';

export function PWAClickFix() {
  useEffect(() => {
    // Fix per Android PWA - forza l'esecuzione dei click handler
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Cerca un elemento cliccabile nella catena dei parent (fino a 5 livelli)
      let clickableElement: HTMLElement | null = target;
      let depth = 0;
      
      while (clickableElement && depth < 5) {
        // Verifica se l'elemento ha un onClick handler o è un button/link
        const isClickable = 
          clickableElement.onclick !== null ||
          clickableElement.hasAttribute('onClick') ||
          clickableElement.tagName === 'BUTTON' ||
          clickableElement.tagName === 'A' ||
          clickableElement.getAttribute('role') === 'button' ||
          clickableElement.classList.contains('cursor-pointer') ||
          (clickableElement.style && clickableElement.style.cursor === 'pointer');
        
        if (isClickable) {
          // Previeni il comportamento default del touch
          e.preventDefault();
          e.stopPropagation();
          
          // Simula un click event
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            detail: 1,
            screenX: e.changedTouches[0].screenX,
            screenY: e.changedTouches[0].screenY,
            clientX: e.changedTouches[0].clientX,
            clientY: e.changedTouches[0].clientY,
          });
          
          // Dispatch del click event con un piccolo delay per evitare conflitti
          setTimeout(() => {
            clickableElement?.dispatchEvent(clickEvent);
          }, 10);
          
          return;
        }
        
        clickableElement = clickableElement.parentElement;
        depth++;
      }
    };
    
    // Aggiungi listener solo su dispositivi touch in modalità PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.matchMedia('(display-mode: fullscreen)').matches ||
                  (window.navigator as any).standalone === true;
    
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isPWA && isTouchDevice) {
      // Usa capture phase per intercettare prima di altri handler
      document.addEventListener('touchend', handleTouchEnd, { 
        capture: true,
        passive: false 
      });
      
      // Aggiungi anche un fix per il touchstart per feedback visivo immediato
      document.addEventListener('touchstart', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('cursor-pointer') || 
            target.style.cursor === 'pointer' ||
            target.tagName === 'BUTTON') {
          target.style.opacity = '0.8';
          setTimeout(() => {
            target.style.opacity = '';
          }, 200);
        }
      }, { passive: true });
      
      return () => {
        document.removeEventListener('touchend', handleTouchEnd, { capture: true } as any);
      };
    }
  }, []);
  
  return null;
}