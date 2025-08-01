"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  CreditCard, 
  Euro, 
  Clock, 
  User, 
  ChevronDown,
  ChevronRight,
  Calendar,
  Loader2,
  FileText
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface PaymentHistoryItem {
  id: string;
  importo: number;
  modalita: 'POS' | 'CONTANTI' | 'MISTO';
  clienteNome?: string;
  timestamp: string;
  operatore: {
    nome: string;
  };
  ordinazione: {
    id: string;
    numero: number;
    tavolo?: {
      numero: string;
    };
    righe: Array<{
      id: string;
      quantita: number;
      prezzo: number;
      prodotto: {
        nome: string;
      };
    }>;
  };
}

interface PaymentHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentHistory({ isOpen, onClose }: PaymentHistoryProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      loadPaymentHistory();
    }
  }, [isOpen, selectedDate]);

  const loadPaymentHistory = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cassa/payment-history?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error("Errore caricamento storico pagamenti:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePaymentExpansion = (paymentId: string) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'POS':
        return <CreditCard className="h-4 w-4" style={{ color: colors.text.secondary }} />;
      case 'CONTANTI':
        return <Euro className="h-4 w-4" style={{ color: colors.text.secondary }} />;
      case 'MISTO':
        return <FileText className="h-4 w-4" style={{ color: colors.text.secondary }} />;
      default:
        return <Euro className="h-4 w-4" style={{ color: colors.text.secondary }} />;
    }
  };

  const getPaymentMethodStyle = (method: string) => {
    const baseStyle = {
      backgroundColor: colors.bg.hover,
      color: colors.text.primary,
      borderColor: colors.border.primary,
      borderWidth: '1px',
      borderStyle: 'solid' as const
    };
    
    if (method === 'MISTO') {
      return {
        ...baseStyle,
        color: colors.text.success
      };
    }
    
    return baseStyle;
  };

  const getTotalsByMethod = () => {
    const totals = {
      POS: 0,
      CONTANTI: 0,
      MISTO: 0,
      total: 0
    };

    payments.forEach(payment => {
      totals[payment.modalita as keyof typeof totals] += payment.importo;
      totals.total += payment.importo;
    });

    return totals;
  };

  const totals = getTotalsByMethod();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-lg w-[90vw] h-[90vh] max-w-6xl flex flex-col" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: colors.border.primary }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>Storico Pagamenti</h2>
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
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: colors.text.secondary }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ backgroundColor: colors.bg.input, borderColor: colors.border.primary, color: colors.text.primary, borderWidth: '1px', borderStyle: 'solid' }}
              />
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.bg.hover, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                <Euro className="h-4 w-4" style={{ color: colors.text.secondary }} />
                <span style={{ color: colors.text.primary }}>Contanti: €{totals.CONTANTI.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.bg.hover, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                <CreditCard className="h-4 w-4" style={{ color: colors.text.secondary }} />
                <span style={{ color: colors.text.primary }}>POS: €{totals.POS.toFixed(2)}</span>
              </div>
              {totals.MISTO > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.bg.hover, borderColor: colors.border.success, borderWidth: '1px', borderStyle: 'solid' }}>
                  <FileText className="h-4 w-4" style={{ color: colors.text.success }} />
                  <span style={{ color: colors.text.success }}>Misto: €{totals.MISTO.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.button.primary, borderColor: colors.button.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                <span className="font-bold" style={{ color: colors.button.primaryText }}>Totale: €{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: colors.text.secondary }} />
                <p style={{ color: colors.text.secondary }}>Caricamento storico pagamenti...</p>
              </div>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
                <p className="text-lg" style={{ color: colors.text.secondary }}>Nessun pagamento trovato</p>
                <p className="text-sm" style={{ color: colors.text.muted }}>per la data selezionata</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const isExpanded = expandedPayments.has(payment.id);
                
                return (
                  <div
                    key={payment.id}
                    className="rounded-lg overflow-hidden"
                    style={{ backgroundColor: colors.bg.darker, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  >
                    {/* Payment Header */}
                    <div
                      onClick={() => togglePaymentExpansion(payment.id)}
                      className="p-4 cursor-pointer transition-colors"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" style={{ color: colors.text.secondary }} />
                          ) : (
                            <ChevronRight className="h-5 w-5" style={{ color: colors.text.secondary }} />
                          )}
                          
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.modalita)}
                            <span className="px-2 py-1 text-xs rounded" style={getPaymentMethodStyle(payment.modalita)}>
                              {payment.modalita}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.text.primary }}>
                              Ordine #{payment.ordinazione.numero}
                            </span>
                            {payment.ordinazione.tavolo && (
                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                                Tavolo {payment.ordinazione.tavolo.numero}
                              </span>
                            )}
                          </div>
                          
                          {payment.clienteNome && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" style={{ color: colors.text.secondary }} />
                              <span className="text-sm" style={{ color: colors.text.secondary }}>{payment.clienteNome}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-xs" style={{ color: colors.text.secondary }}>
                            <Clock className="h-3 w-3" />
                            {new Date(payment.timestamp).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <span className="text-lg font-bold" style={{ color: colors.text.primary }}>
                            €{payment.importo.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Details */}
                    {isExpanded && (
                      <div className="border-t p-4" style={{ borderColor: colors.border.secondary }}>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium" style={{ color: colors.text.secondary }}>Operatore</label>
                            <p className="text-sm" style={{ color: colors.text.primary }}>{payment.operatore.nome}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium" style={{ color: colors.text.secondary }}>Data e Ora</label>
                            <p className="text-sm" style={{ color: colors.text.primary }}>
                              {new Date(payment.timestamp).toLocaleString('it-IT')}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block" style={{ color: colors.text.secondary }}>Prodotti Pagati</label>
                          <div className="space-y-1">
                            {payment.ordinazione.righe.map((riga) => (
                              <div key={riga.id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: colors.bg.input }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium w-8" style={{ color: colors.text.primary }}>{riga.quantita}x</span>
                                  <span className="text-sm" style={{ color: colors.text.primary }}>{riga.prodotto.nome}</span>
                                </div>
                                <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                  €{(riga.prezzo * riga.quantita).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}