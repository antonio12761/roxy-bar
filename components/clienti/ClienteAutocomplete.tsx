"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, User, Phone, Plus, AlertCircle, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { searchClientiAutocomplete, creaCliente } from "@/lib/actions/clienti";
import { toast } from "sonner";
import { useDebounceCallback } from "@/hooks/useDebounceCallback";

interface Cliente {
  id: string;
  nome: string;
  cognome?: string | null;
  telefono?: string | null;
  email?: string | null;
  tags?: string[];
  hasDebiti?: boolean;
}

interface ClienteAutocompleteProps {
  value?: Cliente | null;
  onChange: (cliente: Cliente | null) => void;
  placeholder?: string;
  disabled?: boolean;
  tavoloId?: number;
  allowCreate?: boolean;
  className?: string;
}

export default function ClienteAutocomplete({
  value,
  onChange,
  placeholder = "Cerca o aggiungi cliente...",
  disabled = false,
  tavoloId,
  allowCreate = true,
  className = ""
}: ClienteAutocompleteProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showCreateOption, setShowCreateOption] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Funzione di ricerca
  const searchFunction = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowCreateOption(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchClientiAutocomplete(query);
      if (result.success && result.clienti) {
        setSuggestions(result.clienti);
        // Mostra opzione crea nuovo se non ci sono risultati esatti
        const exactMatch = result.clienti.some(c => 
          c.nome.toLowerCase() === query.toLowerCase() ||
          `${c.nome} ${c.cognome || ''}`.toLowerCase() === query.toLowerCase()
        );
        setShowCreateOption(allowCreate && !exactMatch && query.length > 2);
      }
    } catch (error) {
      console.error("Errore ricerca clienti:", error);
    } finally {
      setIsLoading(false);
    }
  }, [allowCreate]);

  // Debounced search function
  const [debouncedSearch] = useDebounceCallback(searchFunction, { delay: 300 });

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Click outside handler
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

  const handleSelect = (cliente: Cliente) => {
    onChange(cliente);
    setSearchQuery("");
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleCreateNew = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const result = await creaCliente({
        nome: searchQuery.trim(),
      });

      if (result.success && result.data) {
        toast.success("Cliente creato con successo");
        handleSelect(result.data);
      } else {
        toast.error(result.error || "Errore nella creazione del cliente");
      }
    } catch (error) {
      toast.error("Errore nella creazione del cliente");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    const totalOptions = suggestions.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalOptions);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        } else if (showCreateOption && selectedIndex === suggestions.length) {
          handleCreateNew();
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery("");
    setSuggestions([]);
    setShowCreateOption(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input con cliente selezionato */}
      {value ? (
        <div 
          className="flex items-center justify-between px-3 py-2 rounded-lg border"
          style={{
            backgroundColor: colors.bg.input,
            borderColor: colors.border.primary,
          }}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: colors.text.accent }} />
            <span style={{ color: colors.text.primary }}>
              {value.nome} {value.cognome || ''}
            </span>
            {value.telefono && (
              <span className="text-sm" style={{ color: colors.text.muted }}>
                • {value.telefono}
              </span>
            )}
            {value.hasDebiti && (
              <AlertCircle className="h-4 w-4" style={{ color: colors.text.warning }} />
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm hover:opacity-80"
            style={{ color: colors.text.secondary }}
          >
            Cambia
          </button>
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" 
              style={{ color: colors.text.muted }} 
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
                setSelectedIndex(-1);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              className="w-full pl-10 pr-3 py-2 rounded-lg border focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                color: colors.text.primary,
              }}
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div 
                  className="animate-spin rounded-full h-4 w-4 border-b-2"
                  style={{ borderColor: colors.text.accent }}
                />
              </div>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && (suggestions.length > 0 || showCreateOption) && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 rounded-lg shadow-lg border overflow-hidden"
              style={{
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
              }}
            >
              {/* Suggerimenti */}
              {suggestions.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  {suggestions.map((cliente, index) => (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => handleSelect(cliente)}
                      className={`w-full px-3 py-2 text-left hover:opacity-90 transition-colors ${
                        selectedIndex === index ? 'ring-2 ring-inset' : ''
                      }`}
                      style={{
                        backgroundColor: selectedIndex === index ? colors.bg.hover : 'transparent',
                        outlineColor: selectedIndex === index ? colors.text.accent : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" style={{ color: colors.text.accent }} />
                          <div>
                            <div style={{ color: colors.text.primary }}>
                              {cliente.nome} {cliente.cognome || ''}
                            </div>
                            {cliente.telefono && (
                              <div className="text-xs" style={{ color: colors.text.muted }}>
                                {cliente.telefono}
                              </div>
                            )}
                          </div>
                        </div>
                        {cliente.hasDebiti && (
                          <AlertCircle className="h-4 w-4" style={{ color: colors.text.warning }} />
                        )}
                        {cliente.tags && cliente.tags.length > 0 && (
                          <div className="flex gap-1">
                            {cliente.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-xs rounded"
                                style={{
                                  backgroundColor: colors.bg.hover,
                                  color: colors.text.secondary,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Opzione crea nuovo */}
              {showCreateOption && (
                <>
                  {suggestions.length > 0 && (
                    <div className="border-t" style={{ borderColor: colors.border.primary }} />
                  )}
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={isLoading}
                    className={`w-full px-3 py-2 text-left hover:opacity-90 transition-colors flex items-center gap-2 ${
                      selectedIndex === suggestions.length ? 'ring-2 ring-inset' : ''
                    }`}
                    style={{
                      backgroundColor: selectedIndex === suggestions.length ? colors.bg.hover : 'transparent',
                      outlineColor: selectedIndex === suggestions.length ? colors.text.accent : undefined,
                    }}
                  >
                    <Plus className="h-4 w-4" style={{ color: colors.text.success }} />
                    <span style={{ color: colors.text.primary }}>
                      Crea nuovo cliente "{searchQuery}"
                    </span>
                  </button>
                </>
              )}

              {/* Nessun risultato */}
              {suggestions.length === 0 && !showCreateOption && !isLoading && (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm" style={{ color: colors.text.muted }}>
                    Nessun cliente trovato
                  </p>
                  {allowCreate && searchQuery.length <= 2 && (
                    <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                      Digita almeno 3 caratteri per creare un nuovo cliente
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}