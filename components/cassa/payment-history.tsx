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
        return <CreditCard className="h-4 w-4 text-white/60" />;
      case 'CONTANTI':
        return <Euro className="h-4 w-4 text-white/60" />;
      case 'MISTO':
        return <FileText className="h-4 w-4 text-purple-400" />;
      default:
        return <Euro className="h-4 w-4" />;
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'POS':
        return 'bg-white/10/20 text-white/60 border-white/15-500/30';
      case 'CONTANTI':
        return 'bg-white/10/20 text-white/60 border-white/15-500/30';
      case 'MISTO':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[90vw] h-[90vh] max-w-6xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Storico Pagamenti</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10/20 border border-white/15-500/30 rounded-lg">
                <Euro className="h-4 w-4 text-white/60" />
                <span className="text-white/60">Contanti: €{totals.CONTANTI.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10/20 border border-white/15-500/30 rounded-lg">
                <CreditCard className="h-4 w-4 text-white/60" />
                <span className="text-white/60">POS: €{totals.POS.toFixed(2)}</span>
              </div>
              {totals.MISTO > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                  <FileText className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-400">Misto: €{totals.MISTO.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 bg-white/15/20 border border-white/20-500/30 rounded-lg">
                <span className="text-white/70 font-bold">Totale: €{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Caricamento storico pagamenti...</p>
              </div>
            </div>
          ) : payments.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">Nessun pagamento trovato</p>
                <p className="text-sm text-muted-foreground">per la data selezionata</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const isExpanded = expandedPayments.has(payment.id);
                
                return (
                  <div
                    key={payment.id}
                    className="bg-background border border-border rounded-lg overflow-hidden"
                  >
                    {/* Payment Header */}
                    <div
                      onClick={() => togglePaymentExpansion(payment.id)}
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.modalita)}
                            <span className={`px-2 py-1 text-xs rounded border ${getPaymentMethodBadge(payment.modalita)}`}>
                              {payment.modalita}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              Ordine #{payment.ordinazione.numero}
                            </span>
                            {payment.ordinazione.tavolo && (
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                                Tavolo {payment.ordinazione.tavolo.numero}
                              </span>
                            )}
                          </div>
                          
                          {payment.clienteNome && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{payment.clienteNome}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(payment.timestamp).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <span className="text-lg font-bold text-white/60">
                            €{payment.importo.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Payment Details */}
                    {isExpanded && (
                      <div className="border-t border-border p-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Operatore</label>
                            <p className="text-sm">{payment.operatore.nome}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Data e Ora</label>
                            <p className="text-sm">
                              {new Date(payment.timestamp).toLocaleString('it-IT')}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-2 block">Prodotti Pagati</label>
                          <div className="space-y-1">
                            {payment.ordinazione.righe.map((riga) => (
                              <div key={riga.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium w-8">{riga.quantita}x</span>
                                  <span className="text-sm">{riga.prodotto.nome}</span>
                                </div>
                                <span className="text-sm font-medium">
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