"use client";

import { Users, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

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
  onBack
}: CustomerNameModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [customerName, setCustomerName] = useState(initialName);
  const [customerSeats, setCustomerSeats] = useState(initialSeats);
  const [showError, setShowError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName.trim()) {
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
        <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Tavolo {tableNumber} {tableZone && `- ${tableZone}`}
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
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Nome Cliente
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  let value = e.target.value;
                  // Capitalize first letter of each word
                  value = value.replace(/\b\w/g, (char) => char.toUpperCase());
                  setCustomerName(value);
                  setShowError(false);
                }}
                placeholder="Inserisci il nome del cliente"
                className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 text-center text-lg"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                autoFocus
                required
              />
            </div>
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
          
          <button
            type="submit"
            className="w-full p-3 rounded-lg font-bold transition-colors"
            style={{
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.button.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.button.primary;
            }}
          >
            Conferma
          </button>
          
          {/* Customer suggestions as tags */}
          {suggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs mb-2" style={{ color: colors.text.muted }}>
                Clienti precedenti tavolo {tableNumber}:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 8).map((name, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setCustomerName(name);
                      setShowError(false);
                    }}
                    className="px-3 py-1 rounded-full text-sm transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: colors.bg.hover,
                      color: colors.text.primary,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.darker;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                    }}
                  >
                    {name}
                  </button>
                ))}
                {suggestions.length > 8 && (
                  <span 
                    className="px-3 py-1 text-sm" 
                    style={{ color: colors.text.muted }}
                  >
                    +{suggestions.length - 8} altri
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </ThemedModal>
  );
}