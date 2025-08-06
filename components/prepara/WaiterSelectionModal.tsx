"use client";

import { useState, useEffect } from "react";
import { X, User } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { getUtentiCamerieri } from "@/lib/actions/users";

interface Waiter {
  id: string;
  nome: string;
  cognome?: string | null;
  email?: string | null;
}

interface WaiterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (waiterId: string, waiterName: string) => void;
  orderNumber?: number;
  tableNumber?: string;
}

export function WaiterSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
  tableNumber
}: WaiterSelectionModalProps) {
  console.log('[WaiterSelectionModal] Modal props:', { isOpen, orderNumber, tableNumber });
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [selectedWaiter, setSelectedWaiter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadWaiters();
    }
  }, [isOpen]);

  const loadWaiters = async () => {
    setIsLoading(true);
    try {
      const result = await getUtentiCamerieri();
      if (result.success && result.camerieri) {
        setWaiters(result.camerieri);
      }
    } catch (error) {
      console.error("Errore caricamento camerieri:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedWaiter) return;
    
    const waiter = waiters.find(w => w.id === selectedWaiter);
    if (!waiter) return;
    
    setIsSubmitting(true);
    const waiterName = waiter.cognome 
      ? `${waiter.nome} ${waiter.cognome}`
      : waiter.nome;
    
    onConfirm(selectedWaiter, waiterName);
    
    // Reset
    setSelectedWaiter("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setSelectedWaiter("");
    onClose();
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Seleziona Cameriere per Ritiro"
      size="md"
    >
      <div className="space-y-4">
        {/* Order Info */}
        {(orderNumber || tableNumber) && (
          <div 
            className="p-3 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.hover,
              borderColor: colors.border.secondary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between">
              {orderNumber && (
                <div className="text-sm" style={{ color: colors.text.secondary }}>
                  Ordine #{orderNumber}
                </div>
              )}
              {tableNumber && (
                <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                  Tavolo {tableNumber}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Waiter Selection */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.text.primary }}>
            Chi sta ritirando l'ordine?
          </label>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" 
                style={{ borderColor: colors.button.primary }}
              />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {waiters.map((waiter) => (
                <button
                  key={waiter.id}
                  onClick={() => setSelectedWaiter(waiter.id)}
                  className="w-full p-3 rounded-lg transition-all duration-200 flex items-center gap-3"
                  style={{
                    backgroundColor: selectedWaiter === waiter.id 
                      ? colors.button.primary + '20'
                      : colors.bg.hover,
                    borderColor: selectedWaiter === waiter.id 
                      ? colors.button.primary 
                      : colors.border.secondary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <div 
                    className="p-2 rounded-full"
                    style={{ 
                      backgroundColor: selectedWaiter === waiter.id 
                        ? colors.button.primary 
                        : colors.bg.darker 
                    }}
                  >
                    <User 
                      className="h-4 w-4" 
                      style={{ 
                        color: selectedWaiter === waiter.id 
                          ? colors.button.primaryText 
                          : colors.text.secondary 
                      }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium" style={{ color: colors.text.primary }}>
                      {waiter.nome} {waiter.cognome || ''}
                    </div>
                    {waiter.email && (
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        {waiter.email}
                      </div>
                    )}
                  </div>
                  {selectedWaiter === waiter.id && (
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: colors.button.primary }}
                    >
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
              
              {waiters.length === 0 && (
                <div className="text-center py-8" style={{ color: colors.text.muted }}>
                  Nessun cameriere disponibile
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: colors.bg.hover,
              color: colors.text.secondary
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          >
            Annulla
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!selectedWaiter || isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg transition-colors font-medium"
            style={{
              backgroundColor: !selectedWaiter || isSubmitting 
                ? colors.bg.hover 
                : colors.button.success,
              color: !selectedWaiter || isSubmitting 
                ? colors.text.muted 
                : colors.button.successText,
              cursor: !selectedWaiter || isSubmitting ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (selectedWaiter && !isSubmitting) {
                e.currentTarget.style.backgroundColor = colors.button.successHover;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedWaiter && !isSubmitting) {
                e.currentTarget.style.backgroundColor = colors.button.success;
              }
            }}
          >
            {isSubmitting ? 'Conferma in corso...' : 'Conferma Ritiro'}
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}