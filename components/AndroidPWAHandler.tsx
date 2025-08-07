'use client';

import { useEffect, useRef } from 'react';

export function AndroidPWAHandler() {
  const clickQueueRef = useRef<Array<{ element: HTMLElement; timestamp: number }>>([]);
  
  useEffect(() => {
    // Detecta se siamo in PWA su Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  window.matchMedia('(display-mode: fullscreen)').matches ||
                  (window.navigator as any).standalone === true;
    
    if (!isAndroid || !isPWA) {
      console.log('Not Android PWA, skipping handler');
      return;
    }
    
    console.log('Android PWA detected, installing click handlers');
    
    // Handler per touchstart - cattura l'intenzione di click
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // NON intercettare eventi su input, checkbox, select, textarea
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'OPTION' ||
        target.tagName === 'LABEL' ||
        (target as HTMLInputElement).type === 'checkbox' ||
        (target as HTMLInputElement).type === 'radio' ||
        target.closest('input') !== null ||
        target.closest('textarea') !== null ||
        target.closest('select') !== null;
      
      if (isFormElement) {
        return; // Lascia gestire nativamente
      }
      
      // Trova l'elemento cliccabile
      let clickable = target;
      let depth = 0;
      
      while (clickable && depth < 10) {
        const hasClickHandler = 
          clickable.onclick !== null ||
          clickable.hasAttribute('onClick') ||
          clickable.tagName === 'BUTTON' ||
          clickable.tagName === 'A' ||
          clickable.getAttribute('role') === 'button' ||
          clickable.classList.contains('cursor-pointer') ||
          clickable.classList.contains('clickable') ||
          (clickable.style && clickable.style.cursor === 'pointer');
        
        if (hasClickHandler) {
          // Aggiungi feedback visivo
          clickable.style.opacity = '0.7';
          clickable.setAttribute('data-touch-active', 'true');
          
          // Salva riferimento per touchend
          clickQueueRef.current.push({
            element: clickable,
            timestamp: Date.now()
          });
          
          // Pulisci vecchi riferimenti (più di 1 secondo)
          clickQueueRef.current = clickQueueRef.current.filter(
            item => Date.now() - item.timestamp < 1000
          );
          
          break;
        }
        
        clickable = clickable.parentElement as HTMLElement;
        depth++;
      }
    };
    
    // Handler per touchend - esegue il click
    const handleTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // NON intercettare eventi su input, checkbox, select, textarea
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'OPTION' ||
        target.tagName === 'LABEL' ||
        (target as HTMLInputElement).type === 'checkbox' ||
        (target as HTMLInputElement).type === 'radio' ||
        target.closest('input') !== null ||
        target.closest('textarea') !== null ||
        target.closest('select') !== null;
      
      if (isFormElement) {
        // Lascia che gli elementi form gestiscano i loro eventi nativamente
        console.log('Android PWA: Skipping form element', target.tagName, (target as HTMLInputElement).type || '');
        return;
      }
      
      // Trova l'elemento cliccabile
      let clickable = target;
      let depth = 0;
      let foundClickable: HTMLElement | null = null;
      
      while (clickable && depth < 10) {
        // Controlla se questo elemento è nella queue
        const queueItem = clickQueueRef.current.find(item => item.element === clickable);
        
        if (queueItem) {
          foundClickable = clickable;
          
          // Rimuovi dalla queue
          clickQueueRef.current = clickQueueRef.current.filter(item => item.element !== clickable);
          
          // Rimuovi feedback visivo
          setTimeout(() => {
            clickable.style.opacity = '';
            clickable.removeAttribute('data-touch-active');
          }, 100);
          
          break;
        }
        
        clickable = clickable.parentElement as HTMLElement;
        depth++;
      }
      
      // Se abbiamo trovato un elemento cliccabile, simula il click
      if (foundClickable) {
        // Previeni eventi multipli SOLO per elementi non-form
        e.preventDefault();
        e.stopPropagation();
        
        // Usa un piccolo delay per evitare conflitti con altri handler
        requestAnimationFrame(() => {
          // Crea e dispatcha un vero click event
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
          
          foundClickable!.dispatchEvent(clickEvent);
          
          // Log per debug
          console.log('Android PWA: Simulated click on', foundClickable!.tagName, foundClickable!.className);
        });
      }
    };
    
    // Handler per touchcancel - pulisce lo stato
    const handleTouchCancel = () => {
      // Rimuovi tutti i feedback visivi
      document.querySelectorAll('[data-touch-active]').forEach(el => {
        (el as HTMLElement).style.opacity = '';
        el.removeAttribute('data-touch-active');
      });
      
      // Pulisci la queue
      clickQueueRef.current = [];
    };
    
    // Aggiungi listener globali con capture phase
    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    document.addEventListener('touchcancel', handleTouchCancel, { capture: true, passive: true });
    
    // Fix aggiuntivo per elementi con onClick React che potrebbero non funzionare
    const fixReactOnClick = () => {
      // Trova tutti gli elementi con data-onclick o altri attributi React
      const reactElements = document.querySelectorAll('[onClick], button, [role="button"], .cursor-pointer');
      
      reactElements.forEach(element => {
        const el = element as HTMLElement;
        
        // Se non ha già un listener nativo, aggiungine uno
        if (!el.hasAttribute('data-native-listener')) {
          el.setAttribute('data-native-listener', 'true');
          
          // Aggiungi listener nativo che triggera l'evento React
          el.addEventListener('click', function(e) {
            // Il click event nativo dovrebbe triggerare React onClick
            console.log('Native click helper triggered for', el.tagName);
          }, { capture: false });
        }
      });
    };
    
    // Esegui il fix iniziale
    fixReactOnClick();
    
    // Ri-esegui il fix quando il DOM cambia (per elementi aggiunti dinamicamente)
    const observer = new MutationObserver(() => {
      fixReactOnClick();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true } as any);
      document.removeEventListener('touchend', handleTouchEnd, { capture: true } as any);
      document.removeEventListener('touchcancel', handleTouchCancel, { capture: true } as any);
      observer.disconnect();
      
      // Rimuovi tutti i feedback visivi
      document.querySelectorAll('[data-touch-active]').forEach(el => {
        (el as HTMLElement).style.opacity = '';
        el.removeAttribute('data-touch-active');
      });
    };
  }, []);
  
  return null;
}