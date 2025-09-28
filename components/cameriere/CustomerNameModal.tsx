"use client";

import { Users, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { Autocomplete } from "@/components/ui/autocomplete";
import { searchClientiAutocomplete, getOrCreateCliente, getClientiRecenti } from "@/lib/actions/clienti";

interface CustomerNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, seats: number) => void;
  tableNumber: string;
  tableZone?: string;
  maxSeats: number;
  suggestions?: string[];
  initialName?: string;
  initialSeats?: number;
  onBack?: () => void;
  submitButtonText?: string;
  isSubmitting?: boolean;
}

export function CustomerNameModal({
  isOpen,
  onClose,
  onSubmit,
  tableNumber,
  tableZone,
  maxSeats,
  suggestions = [],
  initialName = "",
  initialSeats = 2,
  onBack,
  submitButtonText = "Conferma",
  isSubmitting = false
}: CustomerNameModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [customerName, setCustomerName] = useState(initialName);
  const [customerSeats, setCustomerSeats] = useState(initialSeats);
  const [showError, setShowError] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [recentCustomers, setRecentCustomers] = useState<string[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const loadRecentCustomers = async () => {
      const result = await getClientiRecenti();
      if (result.success && result.clienti) {
        setRecentCustomers(result.clienti.map(c => c.nome));
      }
    };
    
    if (isOpen) {
      loadRecentCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    // Combina i clienti del tavolo (suggestions) con i clienti recenti generali
    // Rimuovi duplicati mantenendo l'ordine: prima clienti del tavolo, poi clienti generali
    const tableCustomers = suggestions || [];
    const generalCustomers = recentCustomers.filter(name => !tableCustomers.includes(name));
    setAllSuggestions([...tableCustomers, ...generalCustomers]);
  }, [suggestions, recentCustomers]);

  const handleSearchCustomers = async (query: string) => {
    const result = await searchClientiAutocomplete(query);
    if (result.success && result.clienti) {
      return result.clienti;
    }
    return [];
  };

  const handleCreateCustomer = async (nome: string) => {
    const result = await getOrCreateCliente(nome);
    if (result.success && result.cliente) {
      setSelectedCustomer(result.cliente);
      setCustomerName(result.cliente.nome);
      // Don't auto-submit here, let handleSubmit do it
      setShowError(false);
      return result.cliente;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName.trim()) {
      if (!selectedCustomer) {
        const cliente = await handleCreateCustomer(customerName);
        if (!cliente) {
          // Failed to create customer, don't submit
          return;
        }
      }
      onSubmit(customerName, customerSeats);
      setShowError(false);
    } else {
      setShowError(true);
    }
  };

  const handleClose = () => {
    // Only allow close if name is set
    if (customerName.trim()) {
      onClose();
    } else {
      setShowError(true);
    }
  };


  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={handleClose} 
      showCloseButton={false}
      closeOnBackdropClick={false}
    >
      <div className="flex items-center gap-2 mb-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: colors.text.secondary }} />
          </button>
        )}
        <h2 className="text-xl font-bold flex-1" style={{ color: colors.text.primary }}>
          Tavolo {tableNumber} {tableZone && `- ${tableZone}`}
          {suggestions && suggestions.length > 0 && (
            <span className="ml-2 text-base font-normal" style={{ color: colors.text.secondary }}>
              • {suggestions.slice(0, 2).join(', ')}
              {suggestions.length > 2 && ` +${suggestions.length - 2}`}
            </span>
          )}
        </h2>
      </div>
      <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
        Capacità massima: {maxSeats} posti
      </p>
      
      {showError && (
        <div 
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ 
            backgroundColor: colors.text.error + '20',
            color: colors.text.error,
            borderColor: colors.text.error,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          Inserisci il nome del cliente prima di procedere
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
              Nome Cliente
            </label>
            <p className="text-xs mb-2" style={{ color: colors.text.muted }}>
              Seleziona un cliente esistente o aggiungi un nuovo nome
            </p>
            <Autocomplete
              value={customerName}
              onChange={(value) => {
                // Capitalize first letter of each word
                const formatted = value.replace(/\b\w/g, (char) => char.toUpperCase());
                setCustomerName(formatted);
                setShowError(false);
                // Se c'è già un customer selezionato con lo stesso nome, mantienilo
                if (selectedCustomer && selectedCustomer.nome === formatted) {
                  setSelectedCustomer(selectedCustomer);
                }
              }}
              onSelect={async (option) => {
                setSelectedCustomer(option);
                if (option) {
                  setCustomerName(option.nome);
                  // Don't auto-submit when selecting a customer
                  // Let the user click the submit button
                  setShowError(false);
                }
              }}
              onSearch={handleSearchCustomers}
              onCreate={async (nome: string) => {
                await handleCreateCustomer(nome);
              }}
              placeholder="Cerca o aggiungi nuovo cliente..."
              autoFocus
              required
              suggestions={allSuggestions}
            />
          </div>
          
          <div>
            <label 
              className="block text-sm font-medium mb-2 text-center"
              style={{ color: colors.text.secondary }}
            >
              Numero Posti
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setCustomerSeats(Math.max(1, customerSeats - 1))}
                className="w-12 h-12 rounded-lg font-bold text-xl transition-colors"
                style={{
                  backgroundColor: colors.bg.hover,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                -
              </button>
              <span 
                className="text-2xl font-bold w-12 text-center"
                style={{ color: colors.text.primary }}
              >
                {customerSeats}
              </span>
              <button
                type="button"
                onClick={() => setCustomerSeats(Math.min(maxSeats, customerSeats + 1))}
                className="w-12 h-12 rounded-lg font-bold text-xl transition-colors"
                style={{
                  backgroundColor: colors.bg.hover,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                +
              </button>
            </div>
          </div>
          
          {/* Mostra il pulsante solo se c'è un nome inserito manualmente */}
          {customerName.trim() && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: isSubmitting ? colors.bg.hover : colors.button.primary,
                color: colors.button.primaryText,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = colors.button.primaryHover;
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = colors.button.primary;
              }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Invio in corso...
                </>
              ) : (
                submitButtonText
              )}
            </button>
          )}
        </div>
      </form>
    </ThemedModal>
  );
}