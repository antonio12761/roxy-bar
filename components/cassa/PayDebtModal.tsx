"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Loader2, Calendar, Euro, User, FileText } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { pagaDebito } from "@/lib/actions/debiti";
import PaymentMethodSelector from "./PaymentMethodSelector";

interface Debt {
  id: string;
  clienteNome: string;
  importo: number;
  rimanente: number;
  dataCreazione: string;
  note?: string | null;
  numeroOrdine?: number | null;
  tavolo?: {
    numero: string;
  } | null;
}

interface PayDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  onPaymentComplete: () => void;
}

export function PayDebtModal({ 
  isOpen, 
  onClose, 
  debt, 
  onPaymentComplete 
}: PayDebtModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Reset form when debt changes
  useEffect(() => {
    if (debt) {
      setPaymentAmount(debt.rimanente.toFixed(2));
      setPaymentNote("");
      setShowError(false);
      setErrorMessage("");
    }
  }, [debt]);

  const handlePayment = async () => {
    if (!debt) return;
    
    const amount = parseFloat(paymentAmount);
    
    // Validate amount
    if (!amount || amount <= 0) {
      setShowError(true);
      setErrorMessage("Inserisci un importo valido");
      return;
    }
    
    if (amount > debt.rimanente) {
      setShowError(true);
      setErrorMessage(`L'importo non può superare €${debt.rimanente.toFixed(2)}`);
      return;
    }
    
    setIsProcessing(true);
    setShowError(false);
    
    try {
      const result = await pagaDebito(
        debt.id,
        amount,
        paymentMethod,
        paymentNote.trim() || undefined
      );

      if (result.success) {
        onPaymentComplete();
        handleClose();
        
        // Show success notification
        if (Notification.permission === "granted") {
          const isFullPayment = amount >= debt.rimanente;
          new Notification(isFullPayment ? "Debito Saldato" : "Pagamento Parziale", {
            body: `${debt.clienteNome} - €${amount.toFixed(2)} pagato`,
            icon: '/icon-192.png'
          });
        }
      } else {
        setShowError(true);
        setErrorMessage(result.error || "Errore durante il pagamento");
      }
    } catch (error) {
      console.error("Errore pagamento debito:", error);
      setShowError(true);
      setErrorMessage("Errore durante il pagamento del debito");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setPaymentAmount("");
    setPaymentNote("");
    setPaymentMethod("POS");
    setShowError(false);
    setErrorMessage("");
    onClose();
  };

  const handleQuickAmount = (percentage: number) => {
    if (!debt) return;
    const amount = (debt.rimanente * percentage) / 100;
    setPaymentAmount(amount.toFixed(2));
    setShowError(false);
  };

  if (!debt) return null;

  const isPartialPayment = parseFloat(paymentAmount) < debt.rimanente;

  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={handleClose} 
      showCloseButton={true}
    >
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5" style={{ color: colors.text.warning }} />
        <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
          Paga Debito
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
          {errorMessage}
        </div>
      )}

      <div className="space-y-4">
        {/* Cliente Info */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4" style={{ color: colors.text.muted }} />
            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
              Cliente
            </span>
          </div>
          <div className="font-semibold text-lg" style={{ color: colors.text.primary }}>
            {debt.clienteNome}
          </div>
          {debt.numeroOrdine ? (
            <div className="text-sm mt-1" style={{ color: colors.text.muted }}>
              Ordine #{debt.numeroOrdine} {debt.tavolo && `- Tavolo ${debt.tavolo.numero}`}
            </div>
          ) : (
            <div className="text-sm mt-1 font-medium" style={{ color: colors.text.accent }}>
              Debito diretto
            </div>
          )}
        </div>

        {/* Debt Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Importo Totale
            </div>
            <div className="font-semibold text-lg" style={{ color: colors.text.primary }}>
              €{debt.importo.toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Da Pagare
            </div>
            <div className="font-semibold text-lg" style={{ color: colors.text.error }}>
              €{debt.rimanente.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Date and Notes */}
        {(debt.dataCreazione || debt.note) && (
          <div className="space-y-2">
            {debt.dataCreazione && (
              <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.muted }}>
                <Calendar className="h-4 w-4" />
                <span>Creato il {new Date(debt.dataCreazione).toLocaleDateString('it-IT')}</span>
              </div>
            )}
            {debt.note && (
              <div className="flex items-start gap-2 text-sm" style={{ color: colors.text.muted }}>
                <FileText className="h-4 w-4 mt-0.5" />
                <span>{debt.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Payment Amount */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
            Importo Pagamento (€)
          </label>
          <div className="relative">
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => {
                setPaymentAmount(e.target.value);
                setShowError(false);
              }}
              placeholder="0.00"
              step="0.01"
              min="0.01"
              max={debt.rimanente}
              className="w-full p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 text-lg font-semibold"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: showError ? colors.text.error : colors.border.primary,
                color: colors.text.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              disabled={isProcessing}
            />
            <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" 
              style={{ color: colors.text.muted }} 
            />
          </div>
          
          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => handleQuickAmount(25)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.input;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => handleQuickAmount(50)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.input;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => handleQuickAmount(75)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.input;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => handleQuickAmount(100)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: colors.button.success + '20',
                color: colors.button.success,
                borderColor: colors.button.success,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.button.success + '30';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.button.success + '20';
              }}
            >
              Tutto
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
            Metodo di Pagamento
          </label>
          <PaymentMethodSelector 
            value={paymentMethod} 
            onChange={setPaymentMethod} 
          />
        </div>

        {/* Payment Note */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
            Note Pagamento (opzionale)
          </label>
          <textarea
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="Aggiungi eventuali note..."
            rows={2}
            className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 resize-none"
            style={{
              backgroundColor: colors.bg.input,
              borderColor: colors.border.primary,
              color: colors.text.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            disabled={isProcessing}
          />
        </div>

        {/* Warning for partial payment */}
        {isPartialPayment && (
          <div 
            className="p-3 rounded-lg text-sm flex items-start gap-2"
            style={{ 
              backgroundColor: colors.text.warning + '20',
              color: colors.text.warning,
              borderColor: colors.text.warning,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <span className="font-medium">Pagamento Parziale:</span>
            <span>Rimarranno €{(debt.rimanente - parseFloat(paymentAmount || "0")).toFixed(2)} da pagare</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex-1 p-3 rounded-lg font-bold transition-colors"
            style={{
              backgroundColor: colors.bg.hover,
              color: colors.text.primary,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) e.currentTarget.style.backgroundColor = colors.bg.input;
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            Annulla
          </button>
          
          <button
            type="button"
            onClick={handlePayment}
            disabled={isProcessing || !paymentAmount || parseFloat(paymentAmount) <= 0}
            className="flex-1 p-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: isProcessing ? colors.bg.hover : colors.button.primary,
              color: colors.button.primaryText,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing || !paymentAmount || parseFloat(paymentAmount) <= 0 ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isProcessing && paymentAmount && parseFloat(paymentAmount) > 0) {
                e.currentTarget.style.backgroundColor = colors.button.primaryHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) e.currentTarget.style.backgroundColor = colors.button.primary;
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Elaborazione...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                {isPartialPayment ? "Paga Parzialmente" : "Salda Debito"}
              </>
            )}
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}