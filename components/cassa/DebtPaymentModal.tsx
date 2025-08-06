import React, { useState } from 'react';
import { X, CreditCard, Loader2 } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { pagaDebito } from "@/lib/actions/debiti";
import PaymentMethodSelector from './PaymentMethodSelector';

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: {
    id: string;
    clienteNome: string;
    numeroOrdine: number;
    rimanente: number;
    tavolo?: {
      numero: string;
    };
  } | null;
  onPaymentComplete: () => void;
}

export default function DebtPaymentModal({ 
  isOpen, 
  onClose, 
  debt, 
  onPaymentComplete 
}: DebtPaymentModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!debt) return;
    
    setIsProcessing(true);
    try {
      const result = await pagaDebito(
        debt.id,
        debt.rimanente,
        paymentMethod,
        `Pagamento completo debito`
      );

      if (result.success) {
        onPaymentComplete();
        onClose();
      } else {
        alert(result.error || "Errore pagamento debito");
      }
    } catch (error) {
      console.error("Errore pagamento debito:", error);
      alert("Errore durante il pagamento del debito");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !debt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="rounded-lg max-w-md w-full" 
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
      >
        <div className="flex items-center justify-between p-6 border-b" 
          style={{ borderColor: colors.border.primary }}
        >
          <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            Paga Debito
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-6">
            <div>
              <div className="text-sm" style={{ color: colors.text.secondary }}>Cliente</div>
              <div className="font-medium" style={{ color: colors.text.primary }}>
                {debt.clienteNome}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: colors.text.secondary }}>Ordine</div>
              <div className="font-medium" style={{ color: colors.text.primary }}>
                #{debt.numeroOrdine} {debt.tavolo && `- Tavolo ${debt.tavolo.numero}`}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: colors.text.secondary }}>
                Importo da pagare
              </div>
              <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                €{debt.rimanente.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <PaymentMethodSelector 
              value={paymentMethod} 
              onChange={setPaymentMethod} 
            />
          </div>

          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ 
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Paga €{debt.rimanente.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}