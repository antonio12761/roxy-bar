'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PWAAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PWAAutocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  className,
  style
}: PWAAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  // Gestione focus/blur con delay per Android PWA
  const handleFocus = () => {
    // Delay per dare tempo al keyboard di aprirsi
    setTimeout(() => {
      setShowSuggestions(suggestions.length > 0);
    }, 100);
  };
  
  const handleBlur = () => {
    // Delay più lungo per permettere click su suggerimenti
    setTimeout(() => {
      setShowSuggestions(false);
    }, 300);
  };
  
  // Gestione input con fix per Android
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };
  
  // Gestione selezione suggerimento
  const handleSuggestionClick = (suggestion: string, e?: React.MouseEvent | TouchEvent) => {
    // Previeni chiusura prematura
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Aggiorna valore
    onChange(suggestion);
    
    // Chiama onSelect se fornito
    if (onSelect) {
      onSelect(suggestion);
    }
    
    // Chiudi suggerimenti
    setShowSuggestions(false);
    
    // Rimuovi focus dall'input per chiudere keyboard
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };
  
  // Gestione keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex], undefined);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };
  
  // Fix per Android PWA - aggiungi listener nativi
  useEffect(() => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    
    // Touch handler per Android
    const handleTouch = (e: TouchEvent) => {
      // Assicura che il focus funzioni
      input.focus();
      
      // Mostra suggerimenti se ci sono
      if (suggestions.length > 0) {
        setShowSuggestions(true);
      }
    };
    
    input.addEventListener('touchstart', handleTouch, { passive: true });
    
    return () => {
      input.removeEventListener('touchstart', handleTouch);
    };
  }, [suggestions]);
  
  // Gestione click su suggerimenti per Android
  useEffect(() => {
    if (!suggestionsRef.current) return;
    
    const container = suggestionsRef.current;
    
    // Handler per touch sui suggerimenti
    const handleSuggestionTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const suggestionEl = target.closest('[data-suggestion]');
      
      if (suggestionEl) {
        e.preventDefault();
        e.stopPropagation();
        
        const suggestion = suggestionEl.getAttribute('data-suggestion');
        if (suggestion) {
          handleSuggestionClick(suggestion, e);
        }
      }
    };
    
    container.addEventListener('touchend', handleSuggestionTouch, { 
      capture: true,
      passive: false 
    });
    
    return () => {
      container.removeEventListener('touchend', handleSuggestionTouch, {
        capture: true
      } as any);
    };
  }, [suggestions, onChange, onSelect]);
  
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{
          fontSize: '16px', // Previene zoom su iOS
          WebkitAppearance: 'none',
          touchAction: 'manipulation',
          ...style
        }}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          style={{
            top: '100%',
            left: 0,
            touchAction: 'manipulation'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              data-suggestion={suggestion}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                index === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
              style={{
                minHeight: '44px', // Touch target minimo
                display: 'flex',
                alignItems: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSuggestionClick(suggestion, e);
              }}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}