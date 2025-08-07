'use client';

import React, { useRef, useEffect, ReactNode } from 'react';

interface PWAButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onPWAClick?: () => void;
}

// Wrapper component per bottoni che garantisce funzionino su Android PWA
export function PWAButton({ children, onClick, onPWAClick, className, style, ...props }: PWAButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (!buttonRef.current) return;
    
    const button = buttonRef.current;
    const handleClick = onPWAClick || onClick;
    
    if (!handleClick) return;
    
    // Aggiungi un listener nativo per Android PWA
    const nativeClickHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Chiama il handler
      if (typeof handleClick === 'function') {
        handleClick(e as any);
      }
    };
    
    // Usa sia click che touchend per massima compatibilità
    button.addEventListener('click', nativeClickHandler, { capture: true });
    button.addEventListener('touchend', nativeClickHandler, { capture: true, passive: false });
    
    return () => {
      button.removeEventListener('click', nativeClickHandler, { capture: true } as any);
      button.removeEventListener('touchend', nativeClickHandler, { capture: true } as any);
    };
  }, [onClick, onPWAClick]);
  
  return (
    <button
      ref={buttonRef}
      className={className}
      style={{
        ...style,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation'
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// Wrapper per div cliccabili
interface PWAClickableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onPWAClick?: () => void;
}

export function PWAClickable({ children, onClick, onPWAClick, className, style, ...props }: PWAClickableProps) {
  const divRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!divRef.current) return;
    
    const div = divRef.current;
    const handleClick = onPWAClick || onClick;
    
    if (!handleClick) return;
    
    // Aggiungi listener nativi
    const nativeClickHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (typeof handleClick === 'function') {
        handleClick(e as any);
      }
    };
    
    div.addEventListener('click', nativeClickHandler, { capture: true });
    div.addEventListener('touchend', nativeClickHandler, { capture: true, passive: false });
    
    return () => {
      div.removeEventListener('click', nativeClickHandler, { capture: true } as any);
      div.removeEventListener('touchend', nativeClickHandler, { capture: true } as any);
    };
  }, [onClick, onPWAClick]);
  
  return (
    <div
      ref={divRef}
      className={className}
      style={{
        ...style,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation'
      }}
      role="button"
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
}