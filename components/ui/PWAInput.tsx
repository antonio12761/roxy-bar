'use client';

import React, { useRef, useEffect, InputHTMLAttributes } from 'react';

interface PWAInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onPWAChange?: (value: string | boolean) => void;
}

// Wrapper per input che garantisce funzionino su Android PWA
export function PWAInput({ onChange, onPWAChange, type = 'text', ...props }: PWAInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    
    // Handler per change event
    const handleChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const value = type === 'checkbox' || type === 'radio' 
        ? target.checked 
        : target.value;
      
      // Chiama il callback PWA
      if (onPWAChange) {
        onPWAChange(value);
      }
      
      // Chiama anche onChange originale se esiste
      if (onChange) {
        onChange(e as any);
      }
    };
    
    // Handler per click su checkbox/radio
    const handleClick = (e: Event) => {
      if (type === 'checkbox' || type === 'radio') {
        // Forza il toggle per checkbox
        const target = e.target as HTMLInputElement;
        
        // Su Android PWA a volte il checked non si aggiorna
        setTimeout(() => {
          target.checked = !target.checked;
          
          // Trigger change event
          const changeEvent = new Event('change', { bubbles: true });
          target.dispatchEvent(changeEvent);
        }, 10);
      }
    };
    
    // Aggiungi listener nativi
    input.addEventListener('change', handleChange, { capture: false });
    input.addEventListener('input', handleChange, { capture: false });
    
    if (type === 'checkbox' || type === 'radio') {
      input.addEventListener('touchend', handleClick, { capture: false, passive: false });
    }
    
    // Per autocomplete, previeni blur troppo veloce
    if (props.list || props.autoComplete !== 'off') {
      input.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { capture: true, passive: false });
    }
    
    return () => {
      input.removeEventListener('change', handleChange);
      input.removeEventListener('input', handleChange);
      if (type === 'checkbox' || type === 'radio') {
        input.removeEventListener('touchend', handleClick);
      }
    };
  }, [onChange, onPWAChange, type, props.list, props.autoComplete]);
  
  return (
    <input
      ref={inputRef}
      type={type}
      style={{
        WebkitAppearance: 'none',
        touchAction: 'manipulation',
        fontSize: '16px', // Previene zoom su iOS
        ...props.style
      }}
      {...props}
    />
  );
}

// Wrapper per checkbox specifico
export function PWACheckbox({ checked, onChange, ...props }: Omit<PWAInputProps, 'type'>) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [internalChecked, setInternalChecked] = React.useState(checked);
  
  useEffect(() => {
    setInternalChecked(checked);
  }, [checked]);
  
  useEffect(() => {
    if (!checkboxRef.current) return;
    
    const checkbox = checkboxRef.current;
    
    // Handler specifico per Android PWA
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle interno
      const newChecked = !internalChecked;
      setInternalChecked(newChecked);
      
      // Aggiorna il DOM
      checkbox.checked = newChecked;
      
      // Chiama onChange
      if (onChange) {
        const syntheticEvent = {
          target: { 
            checked: newChecked,
            type: 'checkbox',
            value: checkbox.value
          },
          currentTarget: checkbox,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as any;
        
        onChange(syntheticEvent);
      }
    };
    
    checkbox.addEventListener('touchend', handleTouch, { capture: true, passive: false });
    
    return () => {
      checkbox.removeEventListener('touchend', handleTouch, { capture: true } as any);
    };
  }, [internalChecked, onChange]);
  
  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={internalChecked}
      style={{
        WebkitAppearance: 'checkbox',
        appearance: 'checkbox',
        width: '20px',
        height: '20px',
        cursor: 'pointer',
        touchAction: 'manipulation',
        ...props.style
      }}
      {...props}
    />
  );
}