"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, User, Plus, Loader2 } from "lucide-react";
import { searchClientiAutocomplete, creaCliente } from "@/lib/actions/clienti";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  nome: string;
  cognome?: string | null;
  telefono?: string;
  email?: string;
  hasDebiti?: boolean;
}

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onCustomerSelect?: (customer: Customer | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export function CustomerAutocomplete({
  value,
  onChange,
  onCustomerSelect,
  placeholder = "Nome cliente (opzionale)",
  disabled = false,
  className = "",
  autoFocus = false
}: CustomerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearchTerm = useDebounce(value, 300);

  // Cerca clienti
  const searchCustomers = useCallback(async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 1) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchClientiAutocomplete(searchTerm);
      if (result.success && result.clienti) {
        setSuggestions(result.clienti as Customer[]);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Errore ricerca clienti:", error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Effetto per la ricerca
  useEffect(() => {
    searchCustomers(debouncedSearchTerm);
  }, [debouncedSearchTerm, searchCustomers]);

  // Gestisci click esterno
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

  // Gestisci selezione cliente
  const handleSelectCustomer = (customer: Customer) => {
    const fullName = `${customer.nome}${customer.cognome ? ' ' + customer.cognome : ''}`;
    onChange(fullName);
    onCustomerSelect?.(customer);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Crea nuovo cliente
  const handleCreateCustomer = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isCreating) return;

    setIsCreating(true);
    try {
      // Dividi nome e cognome
      const parts = trimmedValue.split(' ');
      const nome = parts[0];
      const cognome = parts.slice(1).join(' ') || undefined;

      const result = await creaCliente({
        nome,
        telefono: undefined,
        email: undefined,
        note: "Cliente creato da scontrino diretto"
      });

      if (result.success && result.cliente) {
        handleSelectCustomer({
          id: result.cliente.id,
          nome: result.cliente.nome,
          cognome: result.cliente.cognome,
          telefono: result.cliente.telefono || undefined,
          email: result.cliente.email || undefined
        });
      }
    } catch (error) {
      console.error("Errore creazione cliente:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Gestisci navigazione tastiera
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectCustomer(suggestions[selectedIndex]);
        } else if (selectedIndex === suggestions.length && value.trim()) {
          handleCreateCustomer();
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Controlla se il valore corrente corrisponde a un cliente esistente
  const isNewCustomer = value.trim() && !suggestions.find(s => 
    `${s.nome}${s.cognome ? ' ' + s.cognome : ''}`.toLowerCase() === value.toLowerCase()
  );

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onCustomerSelect?.(null);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0 || value.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full px-3 py-2 pr-10 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${className}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          {!isSearching && value && <User className="w-4 h-4 text-gray-400" />}
          {!isSearching && !value && <Search className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Dropdown suggerimenti */}
      {isOpen && (value.trim() || suggestions.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 max-h-64 overflow-y-auto"
        >
          {/* Clienti esistenti */}
          {suggestions.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Clienti registrati
              </div>
              {suggestions.map((customer, index) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    selectedIndex === index ? "bg-gray-100 dark:bg-gray-700" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {customer.nome}{customer.cognome ? ` ${customer.cognome}` : ''}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 space-x-3">
                        {customer.telefono && <span>📱 {customer.telefono}</span>}
                        {customer.email && <span>📧 {customer.email}</span>}
                      </div>
                    </div>
                    {customer.hasDebiti && (
                      <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">
                        Debiti
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Opzione per creare nuovo cliente */}
          {isNewCustomer && (
            <div>
              {suggestions.length > 0 && (
                <div className="border-t dark:border-gray-700" />
              )}
              <button
                onClick={handleCreateCustomer}
                disabled={isCreating}
                className={`w-full px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  selectedIndex === suggestions.length ? "bg-gray-100 dark:bg-gray-700" : ""
                }`}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-gray-600 dark:text-gray-300">
                      Creazione cliente...
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-medium text-blue-600 dark:text-blue-400">
                        Crea nuovo cliente: "{value}"
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Clicca per registrare questo cliente
                      </div>
                    </div>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Messaggio se nessun risultato */}
          {!isNewCustomer && suggestions.length === 0 && !isSearching && (
            <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              Nessun cliente trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}