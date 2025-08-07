'use client';

import { useEffect } from 'react';

export function AndroidPWAFix() {
  useEffect(() => {
    // Rileva se siamo in PWA standalone mode su Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://');

    if (isAndroid && isStandalone) {
      console.log('Android PWA detected - applying click fixes');

      // Fix globale per tutti i click events
      const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        // Se l'elemento ha onClick ma non si sta triggando, forza il click
        if (target && target.onclick && !e.defaultPrevented) {
          // Il click dovrebbe già funzionare, ma questo è un fallback
        }
      };

      // Aggiungi listener per touchend che simula click se necessario
      const handleGlobalTouchEnd = (e: TouchEvent) => {
        const target = e.target as HTMLElement;
        
        // Previeni doppi eventi
        if (e.cancelable) {
          e.preventDefault();
        }

        // Simula click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: e.changedTouches[0].clientX,
          clientY: e.changedTouches[0].clientY
        });

        // Dispatch click event
        setTimeout(() => {
          target.dispatchEvent(clickEvent);
        }, 0);
      };

      // Aggiungi listener solo per elementi con onClick o role="button"
      document.addEventListener('touchend', (e) => {
        const target = e.target as HTMLElement;
        const isClickable = target.matches('button, a, [role="button"], [onclick], .cursor-pointer, .clickable, [class*="onClick"]');
        
        if (isClickable) {
          handleGlobalTouchEnd(e);
        }
      }, { passive: false });

      // Aggiungi cursor pointer a tutti gli elementi cliccabili
      const style = document.createElement('style');
      style.textContent = `
        button, a, [role="button"], [onclick], .cursor-pointer, .clickable {
          cursor: pointer !important;
          -webkit-tap-highlight-color: transparent !important;
        }
      `;
      document.head.appendChild(style);

      // Cleanup
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  return null;
}