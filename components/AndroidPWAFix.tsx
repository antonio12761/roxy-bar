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

      // Fix più aggressivo per Android PWA
      document.addEventListener('touchend', (e) => {
        const target = e.target as HTMLElement;
        
        // Controlla se l'elemento o un suo parent ha onClick
        let clickableElement = target;
        let maxDepth = 5; // Cerca fino a 5 livelli di parent
        
        while (clickableElement && maxDepth > 0) {
          const hasOnClick = clickableElement.onclick || 
                            clickableElement.hasAttribute('onclick') ||
                            clickableElement.matches('button, a, [role="button"], .cursor-pointer, .clickable') ||
                            (clickableElement.className && clickableElement.className.toString().includes('onClick')) ||
                            (clickableElement.className && clickableElement.className.toString().includes('cursor-pointer'));
          
          if (hasOnClick) {
            // Previeni doppi eventi
            if (e.cancelable) {
              e.preventDefault();
            }
            
            // Trigger click con un piccolo delay
            setTimeout(() => {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY
              });
              clickableElement.dispatchEvent(clickEvent);
            }, 10);
            
            break;
          }
          
          clickableElement = clickableElement.parentElement as HTMLElement;
          maxDepth--;
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