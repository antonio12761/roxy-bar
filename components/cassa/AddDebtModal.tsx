"use client";

import { useState, useRef } from "react";
import { Plus, CreditCard, Calendar } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { Autocomplete } from "@/components/ui/autocomplete";
import { searchClientiAutocomplete, getOrCreateCliente } from "@/lib/actions/clienti";

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clienteId: string, clienteNome: string, importo: number, note?: string, data?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export function AddDebtModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}: AddDebtModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0]);
  const [showError, setShowError] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

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
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim() || !amount || parseFloat(amount) <= 0) {
      setShowError(true);
      return;
    }

    // Se non c'è un cliente selezionato, crealo o recuperalo automaticamente
    let customer = selectedCustomer;
    if (!customer) {
      const result = await getOrCreateCliente(customerName);
      if (result.success && result.cliente) {
        customer = result.cliente;
      }
    }

    if (customer) {
      await onSubmit(
        customer.id, 
        customer.nome,
        parseFloat(amount),
        notes.trim() || undefined,
        debtDate
      );
      
      // Reset form
      setCustomerName("");
      setSelectedCustomer(null);
      setAmount("");
      setNotes("");
      setDebtDate(new Date().toISOString().split('T')[0]);
      setShowError(false);
    }
  };

  const handleClose = () => {
    setCustomerName("");
    setSelectedCustomer(null);
    setAmount("");
    setNotes("");
    setDebtDate(new Date().toISOString().split('T')[0]);
    setShowError(false);
    onClose();
  };

  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={handleClose} 
      showCloseButton={true}
    >
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5" style={{ color: colors.text.warning }} />
        <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Aggiungi Nuovo Debito
        </h2>
      </div>
      
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
          Compila tutti i campi richiesti
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Cliente
            </label>
            <Autocomplete
              value={customerName}
              onChange={(value) => {
                const formatted = value.replace(/\b\w/g, (char) => char.toUpperCase());
                setCustomerName(formatted);
                setShowError(false);
              }}
              onSelect={(option) => {
                setSelectedCustomer(option);
                if (option) {
                  setCustomerName(option.nome);
                  // Focus automatico sul campo importo dopo selezione
                  setTimeout(() => amountInputRef.current?.focus(), 100);
                }
              }}
              onSearch={handleSearchCustomers}
              onCreate={async (nome) => {
                await handleCreateCustomer(nome);
                // Focus automatico sul campo importo dopo creazione
                setTimeout(() => amountInputRef.current?.focus(), 100);
              }}
              placeholder="Nome cliente..."
              autoFocus
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Importo (€)
            </label>
            <input
              ref={amountInputRef}
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setShowError(false);
              }}
              onKeyDown={(e) => {
                // Enter nel campo importo invia il form
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
              className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                color: colors.text.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Data
            </label>
            <div className="relative">
              <input
                type="date"
                value={debtDate}
                onChange={(e) => setDebtDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                className="w-full p-3 pr-10 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" 
                style={{ color: colors.text.muted }} 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Note (opzionale)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi eventuali note..."
              rows={3}
              className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                color: colors.text.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            />
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 p-3 rounded-lg font-bold transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              Annulla
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 p-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
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
                  Creazione in corso...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Crea Debito
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </ThemedModal>
  );
}