import React, { useState, useEffect } from 'react';
import { X, User, Euro, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
}

interface Order {
  id: string;
  numero: number;
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
}

interface PartialPayment {
  id: string;
  clienteNome: string;
  importo: number;
  modalita: 'POS' | 'CONTANTI' | 'MISTO';
  righeSelezionate: string[];
}

interface PartialPaymentModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirmPayments: (payments: PartialPayment[]) => Promise<void>;
}

export function PartialPaymentModal({
  isOpen,
  order,
  onClose,
  onConfirmPayments
}: PartialPaymentModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [payments, setPayments] = useState<PartialPayment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'items' | 'free'>('free'); // Modalità: selezione articoli o importo libero
  const [currentPayment, setCurrentPayment] = useState<PartialPayment>({
    id: '',
    clienteNome: '',
    importo: 0,
    modalita: 'POS',
    righeSelezionate: []
  });

  useEffect(() => {
    if (isOpen && order) {
      // Reset state when modal opens
      setPayments([]);
      setPaymentMode('free');
      setCurrentPayment({
        id: Date.now().toString(),
        clienteNome: '',
        importo: 0,
        modalita: 'POS',
        righeSelezionate: []
      });
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const righeNonPagate = order.righe.filter(r => !r.isPagato);
  const totaleRimanente = order.rimanente;
  const totalePagamentiInseriti = payments.reduce((sum, p) => sum + p.importo, 0);
  const importoAncoraMancare = totaleRimanente - totalePagamentiInseriti;

  const handleAddPayment = () => {
    if (!currentPayment.clienteNome.trim()) {
      alert('Inserire il nome del cliente');
      return;
    }
    
    // Calcola l'importo effettivo basato sulla modalità
    let importoEffettivo = currentPayment.importo;
    if (paymentMode === 'items' && currentPayment.righeSelezionate.length > 0) {
      importoEffettivo = righeNonPagate
        .filter(r => currentPayment.righeSelezionate.includes(r.id))
        .reduce((sum, r) => sum + (r.quantita * r.prezzo), 0);
    }
    
    if (importoEffettivo <= 0) {
      alert(paymentMode === 'items' ? 'Seleziona almeno un articolo' : 'Inserire un importo valido');
      return;
    }
    if (importoEffettivo > importoAncoraMancare) {
      alert('L\'importo supera il totale rimanente');
      return;
    }

    setPayments([...payments, { 
      ...currentPayment, 
      importo: importoEffettivo 
    }]);
    setCurrentPayment({
      id: Date.now().toString(),
      clienteNome: '',
      importo: 0,
      modalita: 'POS',
      righeSelezionate: []
    });
  };

  const handleRemovePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleSelectItem = (itemId: string) => {
    const item = righeNonPagate.find(r => r.id === itemId);
    if (!item) return;

    const isSelected = currentPayment.righeSelezionate.includes(itemId);
    const itemTotal = item.prezzo * item.quantita;

    if (isSelected) {
      setCurrentPayment({
        ...currentPayment,
        righeSelezionate: currentPayment.righeSelezionate.filter(id => id !== itemId),
        importo: Math.max(0, currentPayment.importo - itemTotal)
      });
    } else {
      // Check if item is already assigned to another payment
      const alreadyAssigned = payments.some(p => p.righeSelezionate.includes(itemId));
      if (alreadyAssigned) {
        alert('Questo articolo è già stato assegnato a un altro pagamento');
        return;
      }

      setCurrentPayment({
        ...currentPayment,
        righeSelezionate: [...currentPayment.righeSelezionate, itemId],
        importo: currentPayment.importo + itemTotal
      });
    }
  };

  const handleConfirm = async () => {
    if (payments.length === 0) {
      alert('Aggiungi almeno un pagamento');
      return;
    }

    const totaleInserito = payments.reduce((sum, p) => sum + p.importo, 0);
    if (Math.abs(totaleInserito - totaleRimanente) > 0.01) {
      const confirm = window.confirm(
        `Il totale dei pagamenti (€${totaleInserito.toFixed(2)}) non corrisponde al totale rimanente (€${totaleRimanente.toFixed(2)}). Vuoi continuare comunque?`
      );
      if (!confirm) return;
    }

    setIsProcessing(true);
    try {
      await onConfirmPayments(payments);
      onClose();
    } catch (error) {
      console.error('Errore durante il pagamento:', error);
      alert('Errore durante il pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: colors.border.primary }}
        >
          <div>
            <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
              Pagamento Parziale - Ordine #{order.numero}
            </h2>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              Totale rimanente: €{totaleRimanente.toFixed(2)}
            </p>
          </div>
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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Items or Summary */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Modalità Pagamento
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentMode('free')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: paymentMode === 'free' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'free' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Importo Libero
                  </button>
                  <button
                    onClick={() => setPaymentMode('items')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors"
                    style={{
                      backgroundColor: paymentMode === 'items' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'items' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Seleziona Articoli
                  </button>
                </div>
              </div>
              
              {paymentMode === 'items' ? (
                <div className="space-y-2">
                  <p className="text-sm mb-2" style={{ color: colors.text.secondary }}>
                    Seleziona gli articoli che questo cliente sta pagando:
                  </p>
                  {righeNonPagate.map((item) => {
                    const isSelected = currentPayment.righeSelezionate.includes(item.id);
                    const isAssigned = payments.some(p => p.righeSelezionate.includes(item.id));
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isAssigned && paymentMode === 'items' && handleSelectItem(item.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isAssigned ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        style={{
                          borderColor: isSelected ? colors.button.primary : colors.border.primary,
                          backgroundColor: isSelected ? colors.bg.hover : colors.bg.card
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium" style={{ color: colors.text.primary }}>
                              {item.prodotto.nome}
                            </p>
                            <p className="text-sm" style={{ color: colors.text.secondary }}>
                              Quantità: {item.quantita} × €{item.prezzo.toFixed(2)}
                              {isAssigned && ' (già assegnato)'}
                            </p>
                          </div>
                          <p className="font-semibold" style={{ color: colors.text.primary }}>
                            €{(item.quantita * item.prezzo).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                  <h4 className="font-medium mb-3" style={{ color: colors.text.primary }}>
                    Riepilogo Ordine
                  </h4>
                  <div className="space-y-2">
                    {righeNonPagate.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span style={{ color: colors.text.secondary }}>
                          {item.prodotto.nome} x{item.quantita}
                        </span>
                        <span style={{ color: colors.text.primary }}>
                          €{(item.quantita * item.prezzo).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-medium"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <span style={{ color: colors.text.primary }}>Totale da pagare:</span>
                      <span style={{ color: colors.text.primary }}>€{totaleRimanente.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Payment Form */}
            <div>
              <h3 className="text-lg font-medium mb-4" style={{ color: colors.text.primary }}>
                Inserisci pagamento
              </h3>
              
              {/* Current Payment Form */}
              <div className="p-4 rounded-lg border mb-4"
                style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.hover }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                      Nome Cliente
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                        style={{ color: colors.text.secondary }}
                      />
                      <input
                        type="text"
                        value={currentPayment.clienteNome}
                        onChange={(e) => setCurrentPayment({ ...currentPayment, clienteNome: e.target.value })}
                        placeholder="Inserisci nome cliente"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border"
                        style={{
                          borderColor: colors.border.primary,
                          backgroundColor: colors.bg.card,
                          color: colors.text.primary
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                      Importo
                    </label>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                        style={{ color: colors.text.secondary }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={paymentMode === 'items' && currentPayment.righeSelezionate.length > 0 
                          ? righeNonPagate
                              .filter(r => currentPayment.righeSelezionate.includes(r.id))
                              .reduce((sum, r) => sum + (r.quantita * r.prezzo), 0)
                          : currentPayment.importo
                        }
                        onChange={(e) => {
                          if (paymentMode === 'free') {
                            setCurrentPayment({ ...currentPayment, importo: parseFloat(e.target.value) || 0 });
                          }
                        }}
                        readOnly={paymentMode === 'items' && currentPayment.righeSelezionate.length > 0}
                        placeholder={paymentMode === 'items' ? "Seleziona articoli" : "0.00"}
                        className="w-full pl-10 pr-3 py-2 rounded-lg border"
                        style={{
                          borderColor: colors.border.primary,
                          backgroundColor: paymentMode === 'items' && currentPayment.righeSelezionate.length > 0 
                            ? colors.bg.hover 
                            : colors.bg.card,
                          color: colors.text.primary
                        }}
                      />
                    </div>
                    {paymentMode === 'items' && currentPayment.righeSelezionate.length > 0 && (
                      <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                        Totale articoli selezionati: €{
                          righeNonPagate
                            .filter(r => currentPayment.righeSelezionate.includes(r.id))
                            .reduce((sum, r) => sum + (r.quantita * r.prezzo), 0)
                            .toFixed(2)
                        }
                      </p>
                    )}
                    {paymentMode === 'free' && (
                      <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                        Inserisci l'importo che questo cliente sta pagando
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                      Modalità Pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['POS', 'CONTANTI', 'MISTO'] as const).map((modalita) => (
                        <button
                          key={modalita}
                          onClick={() => setCurrentPayment({ ...currentPayment, modalita })}
                          className="px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                          style={{
                            borderColor: currentPayment.modalita === modalita ? colors.button.primary : colors.border.primary,
                            backgroundColor: currentPayment.modalita === modalita ? colors.button.primary : colors.bg.card,
                            color: currentPayment.modalita === modalita ? colors.button.primaryText : colors.text.primary
                          }}
                        >
                          {modalita}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddPayment}
                    disabled={!currentPayment.clienteNome || currentPayment.importo <= 0}
                    className="w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: colors.button.primary,
                      color: colors.button.primaryText,
                      opacity: !currentPayment.clienteNome || currentPayment.importo <= 0 ? 0.5 : 1
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi Pagamento
                  </button>
                </div>
              </div>

              {/* Payments List */}
              {payments.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-2" style={{ color: colors.text.primary }}>
                    Pagamenti inseriti
                  </h4>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-3 rounded-lg border flex justify-between items-center"
                        style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.hover }}
                      >
                        <div>
                          <p className="font-medium" style={{ color: colors.text.primary }}>
                            {payment.clienteNome}
                          </p>
                          <p className="text-sm" style={{ color: colors.text.secondary }}>
                            €{payment.importo.toFixed(2)} - {payment.modalita}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemovePayment(payment.id)}
                          className="p-1 rounded hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {payments.length > 0 && (
                <div className="mt-4 p-4 rounded-lg border"
                  style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.hover }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span style={{ color: colors.text.secondary }}>Totale rimanente:</span>
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        €{totaleRimanente.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: colors.text.secondary }}>Totale pagamenti:</span>
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        €{totalePagamentiInseriti.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <span className="font-medium" style={{ color: colors.text.secondary }}>
                        Ancora da pagare:
                      </span>
                      <span className="font-bold" style={{ 
                        color: importoAncoraMancare > 0 ? (colors.status?.pending || colors.text.primary) : (colors.status?.success || colors.button.success) 
                      }}>
                        €{Math.max(0, importoAncoraMancare).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between items-center"
          style={{ borderColor: colors.border.primary }}
        >
          {importoAncoraMancare > 0 && payments.length > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" style={{ color: colors.status?.warning || colors.text.primary }} />
              <span className="text-sm" style={{ color: colors.status?.warning || colors.text.primary }}>
                Manca ancora €{importoAncoraMancare.toFixed(2)} per completare il pagamento
              </span>
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border font-medium transition-colors"
              style={{
                borderColor: colors.border.primary,
                backgroundColor: colors.bg.card,
                color: colors.text.primary
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={payments.length === 0 || isProcessing}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText,
                opacity: payments.length === 0 || isProcessing ? 0.5 : 1
              }}
            >
              {isProcessing ? 'Elaborazione...' : 'Conferma Pagamenti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}