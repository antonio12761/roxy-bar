"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, UserPlus, Search } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface AutocompleteOption {
  id: string;
  nome: string;
  telefono?: string;
  email?: string;
}

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption | null) => void;
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  onCreate?: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
  disabled?: boolean;
  suggestions?: string[];
}

export function Autocomplete({
  value,
  onChange,
  onSelect,
  onSearch,
  onCreate,
  placeholder = "Cerca o aggiungi nuovo...",
  className,
  autoFocus = false,
  required = false,
  disabled = false,
  suggestions = []
}: AutocompleteProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<AutocompleteOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchCacheRef = useRef<Map<string, AutocompleteOption[]>>(new Map());

  const handleSearch = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.length < 1) {
      setOptions([]);
      setIsOpen(false);
      setSelectedOption(null);
      onSelect(null);
      return;
    }

    // Controlla la cache prima
    const cachedResults = searchCacheRef.current.get(query.toLowerCase());
    if (cachedResults) {
      setOptions(cachedResults);
      const exactMatch = cachedResults.find(opt => 
        opt.nome.toLowerCase() === query.toLowerCase()
      );
      
      if (exactMatch) {
        setSelectedOption(exactMatch);
        onSelect(exactMatch);
        onChange(exactMatch.nome);
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
      setIsLoading(false);
      return;
    }
    
    // Mostra subito che sta caricando per dare feedback immediato
    setIsLoading(true);
    setIsOpen(true); // Apri subito il dropdown per feedback immediato
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await onSearch(query);
        // Salva nella cache
        searchCacheRef.current.set(query.toLowerCase(), results);
        // Mantieni solo le ultime 20 ricerche nella cache
        if (searchCacheRef.current.size > 20) {
          const firstKey = searchCacheRef.current.keys().next().value;
          if (firstKey !== undefined) {
            searchCacheRef.current.delete(firstKey);
          }
        }
        setOptions(results);
        
        // Auto-selezione immediata se c'è un match esatto (case-insensitive)
        const exactMatch = results.find(opt => 
          opt.nome.toLowerCase() === query.toLowerCase()
        );
        
        if (exactMatch) {
          // Selezione automatica immediata senza conferma
          setSelectedOption(exactMatch);
          onSelect(exactMatch);
          onChange(exactMatch.nome);
          setIsOpen(false);
        } else {
          setIsOpen(results.length > 0 || (!!onCreate && query.length > 0));
        }
      } catch (error) {
        console.error("Errore nella ricerca:", error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 100); // Debounce ridotto a 100ms per risposta più veloce
  }, [onSearch, onCreate, onSelect]);

  useEffect(() => {
    handleSearch(value);
  }, [value, handleSearch]);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedOption(null);
    onSelect(null);
    setHighlightedIndex(-1);
  };

  const handleSelectOption = (option: AutocompleteOption) => {
    onChange(option.nome);
    setSelectedOption(option);
    onSelect(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateNew = async () => {
    if (onCreate && value.trim()) {
      await onCreate(value.trim());
      setIsOpen(false);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < options.length - 1 ? prev + 1 : (onCreate ? options.length : 0)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : (onCreate ? -1 : options.length - 1)
      );
    } else if (e.key === "Tab" && options.length > 0) {
      // Tab seleziona automaticamente il primo risultato
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelectOption(options[highlightedIndex]);
      } else if (options.length === 1) {
        // Se c'è solo un'opzione, selezionala automaticamente
        handleSelectOption(options[0]);
      } else if (options.length > 0) {
        handleSelectOption(options[0]);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      
      // Se c'è già un'opzione selezionata, procedi direttamente
      if (selectedOption) {
        setIsOpen(false);
        const form = inputRef.current?.closest('form');
        if (form) {
          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(submitEvent);
        }
        return;
      }
      
      // Auto-selezione se c'è solo un'opzione
      if (options.length === 1) {
        handleSelectOption(options[0]);
      } else if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelectOption(options[highlightedIndex]);
      } else if (highlightedIndex === options.length && onCreate) {
        await handleCreateNew();
      } else if (onCreate && value.trim()) {
        // Se non ci sono match, crea nuovo cliente direttamente
        await handleCreateNew();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const isNewCustomer = value.trim() && !options.some(opt => 
    opt.nome.toLowerCase() === value.toLowerCase()
  );

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length > 0 && handleSearch(value)}
          placeholder={placeholder}
          className={cn(
            "w-full p-3 pr-10 rounded-lg focus:outline-none focus:ring-2 text-lg transition-all duration-150",
            selectedOption && "ring-2 shadow-sm",
            className
          )}
          style={{
            backgroundColor: colors.bg.input,
            borderColor: selectedOption ? colors.button.success : colors.border.primary,
            color: colors.text.primary,
            borderWidth: selectedOption ? '2px' : '1px',
            borderStyle: 'solid',
            outlineColor: selectedOption ? colors.button.success : undefined
          }}
          autoFocus={autoFocus}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"
              style={{ color: colors.text.muted }}
            />
          )}
          {selectedOption && (
            <Check className="h-5 w-5" style={{ color: colors.button.success }} />
          )}
          {!isLoading && !selectedOption && value && (
            <Search className="h-4 w-4" style={{ color: colors.text.muted }} />
          )}
        </div>
      </div>

      {isOpen && (options.length > 0 || (onCreate && isNewCustomer)) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg shadow-lg border"
          style={{
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary
          }}
        >
          {/* Suggerimento veloce solo se ci sono più opzioni */}
          {!isMobile && options.length > 1 && !selectedOption && (
            <div 
              className="px-3 py-1.5 text-xs border-b"
              style={{ 
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.secondary,
                color: colors.text.muted
              }}
            >
              Tab/↓↑ naviga • Enter conferma
            </div>
          )}
          <div style={{ maxHeight: isMobile ? '40vh' : '250px', overflowY: 'auto' }}>
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectOption(option)}
              className={cn(
                "w-full text-left px-3 transition-all duration-150",
                isMobile ? "py-3" : "py-2",
                highlightedIndex === index && "bg-opacity-10"
              )}
              style={{
                backgroundColor: highlightedIndex === index ? colors.bg.hover : 'transparent',
                color: colors.text.primary,
                transform: highlightedIndex === index ? 'scale(1.02)' : 'scale(1)'
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={cn("font-medium", isMobile && "text-base")}>{option.nome}</div>
                  {option.telefono && (
                    <div className="text-sm" style={{ color: colors.text.muted }}>
                      {option.telefono}
                    </div>
                  )}
                </div>
                {isMobile && (
                  <div className="text-sm font-medium px-2" style={{ color: colors.text.accent }}>
                    Tocca
                  </div>
                )}
              </div>
            </button>
          ))}
          
          {onCreate && isNewCustomer && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={cn(
                "w-full text-left px-3 transition-colors border-t flex items-center gap-2",
                isMobile ? "py-3" : "py-2",
                highlightedIndex === options.length && "bg-opacity-10"
              )}
              style={{
                backgroundColor: highlightedIndex === options.length ? colors.bg.hover : 'transparent',
                borderColor: colors.border.primary,
                color: colors.text.accent
              }}
              onMouseEnter={() => setHighlightedIndex(options.length)}
            >
              <UserPlus className="h-4 w-4" />
              <span className={cn("font-medium", isMobile && "text-base")}>Aggiungi nuovo cliente: "{value}"</span>
            </button>
          )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && !isOpen && !value && (
        <div className="mt-3">
          <p className={cn("mb-2", isMobile ? "text-sm font-medium" : "text-xs")} 
             style={{ color: colors.text.muted }}>
            Clienti recenti:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, isMobile ? 3 : 5).map((name, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onChange(name);
                  handleSearch(name);
                }}
                className={cn(
                  "rounded-full transition-all duration-200",
                  isMobile 
                    ? "px-4 py-2.5 text-base font-medium" 
                    : "px-3 py-1 text-sm hover:scale-105"
                )}
                style={{
                  backgroundColor: colors.bg.hover,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: isMobile ? '2px' : '1px',
                  borderStyle: 'solid'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}