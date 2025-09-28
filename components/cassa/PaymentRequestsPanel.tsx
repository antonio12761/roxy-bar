import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CreditCard, 
  Euro, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Smartphone,
  Building2,
  Coins,
  ChevronRight,
  Loader2,
  Receipt,
  Printer
} from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/lib/toast";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { 
  getRichiestePagamentoPendenti, 
  accettaRichiestaPagamento, 
  rifiutaRichiestaPagamento 
} from "@/lib/actions/richieste-pagamento";
import { generaScontrino } from "@/lib/actions/cassa";
import { printerService } from "@/lib/bluetooth/printer-service";

interface PaymentRequest {
  id: string;
  ordinazioneId?: string | null;
  tavoloNumero: string;
  totale: number;
  clienteNome?: string | null;
  cameriereNome: string;
  modalitaPagamento: string;
  timestampCreazione: Date;
  stato: string;
}

interface PaymentRequestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestProcessed?: () => void;
}

export default function PaymentRequestsPanel({ 
  isOpen, 
  onClose,
  onRequestProcessed 
}: PaymentRequestsPanelProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [stampaScontrino, setStampaScontrino] = useState(true);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // Carica richieste reali dal database
  useEffect(() => {
    if (isOpen) {
      loadRequests();
      // Ricarica ogni 5 secondi
      const interval = setInterval(loadRequests, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadRequests = async () => {
    try {
      const result = await getRichiestePagamentoPendenti();
      if (result.success && result.richieste) {
        setRequests(result.richieste as PaymentRequest[]);
      }
    } catch (error) {
      console.error('Errore caricamento richieste:', error);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CONTANTI':
        return Euro;
      case 'POS':
        return CreditCard;
      case 'BANCOMAT':
        return Building2;
      case 'SATISPAY':
        return Smartphone;
      case 'MISTO':
        return Coins;
      default:
        return CreditCard;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'CONTANTI':
        return '#22c55e';
      case 'POS':
        return '#3b82f6';
      case 'BANCOMAT':
        return '#06b6d4';
      case 'SATISPAY':
        return '#f97316';
      case 'MISTO':
        return '#a855f7';
      default:
        return colors.text.secondary;
    }
  };

  const handleAcceptRequest = async (request: PaymentRequest) => {
    setProcessingId(request.id);
    
    try {
      // Verifica che ci sia un ordine associato
      if (!request.ordinazioneId) {
        toast.error('Nessun ordine associato alla richiesta');
        setProcessingId(null);
        return;
      }

      // PRIMA processa il pagamento (usa creaPagamento per pagare tutto l'ordine)
      const paymentResult = await creaPagamento(
        request.ordinazioneId,
        request.modalitaPagamento as any,
        request.totale,
        request.clienteNome || 'Cliente'
      );

      if (!paymentResult.success) {
        toast.error('Errore nel processamento del pagamento: ' + (paymentResult.error || 'Errore sconosciuto'));
        setProcessingId(null);
        return;
      }

      // Pagamento riuscito, ora marca la richiesta come completata
      toast.success(`Pagamento di €${request.totale.toFixed(2)} completato!`);
      
      // Aggiorna lo stato della richiesta nel database
      const acceptResult = await accettaRichiestaPagamento(request.id);
      if (!acceptResult.success) {
        console.error('Errore aggiornamento stato richiesta:', acceptResult.error);
        // Non blocchiamo, il pagamento è già andato a buon fine
      }
      
      // Genera e stampa scontrino se abilitato
      if (stampaScontrino) {
            try {
              toast.info('Generazione scontrino in corso...');
              
              // Genera scontrino
              const scontrinoResult = await generaScontrino(
                request.ordinazioneId,
                request.clienteNome || 'Cliente',
                request.modalitaPagamento as any
              );
              
              if (scontrinoResult.success) {
                // Stampa con stampante Bluetooth se disponibile
                const printerSettings = await printerService.getSettings();
                if (printerSettings.autoprint && printerSettings.connectedDevice) {
                  const printResult = await printerService.printReceipt(scontrinoResult.data);
                  if (printResult.success) {
                    toast.success('Scontrino stampato con successo!');
                  } else {
                    toast.warning('Scontrino generato ma non stampato: ' + printResult.error);
                  }
                } else {
                  toast.success('Scontrino generato e salvato in coda');
                }
              } else {
                toast.warning('Pagamento completato ma scontrino non generato');
            }
          } catch (error) {
            console.error('Errore generazione scontrino:', error);
            toast.warning('Pagamento completato ma errore nella stampa scontrino');
          }
        }
      
      // Ricarica le richieste
      await loadRequests();
      
      // Notifica il componente padre
      if (onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore durante il pagamento');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptAll = async () => {
    if (requests.length === 0) return;
    
    setIsProcessingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const request of requests) {
        try {
          // Verifica che ci sia un ordine associato
          if (!request.ordinazioneId) {
            console.error('Nessun ordine associato alla richiesta:', request.id);
            errorCount++;
            continue;
          }

          // PRIMA processa il pagamento
          const result = await creaPagamento(
            request.ordinazioneId,
            request.modalitaPagamento as any,
            request.totale,
            request.clienteNome || 'Cliente'
          );

          if (result.success) {
            successCount++;
            
            // Marca la richiesta come completata
            await accettaRichiestaPagamento(request.id);
              
              // Genera scontrino se abilitato
              if (stampaScontrino) {
                try {
                  const scontrinoResult = await generaScontrino(
                    request.ordinazioneId,
                    request.clienteNome || 'Cliente',
                    request.modalitaPagamento as any
                  );
                  
                  if (scontrinoResult.success) {
                    const printerSettings = await printerService.getSettings();
                    if (printerSettings.autoprint && printerSettings.connectedDevice) {
                      await printerService.printReceipt(scontrinoResult.data);
                    }
                }
              } catch (error) {
                console.error('Errore stampa scontrino:', error);
              }
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Errore elaborazione richiesta:', error);
          errorCount++;
        }
      }
      
      // Mostra risultato
      if (successCount > 0 && errorCount === 0) {
        toast.success(`Tutte le ${successCount} richieste sono state elaborate con successo!`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount} richieste elaborate, ${errorCount} errori`);
      } else {
        toast.error(`Errore nell'elaborazione delle richieste`);
      }
      
      // Ricarica le richieste
      await loadRequests();
      
      // Notifica il componente padre
      if (onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (error) {
      console.error('Errore elaborazione multipla:', error);
      toast.error('Errore durante l\'elaborazione delle richieste');
    } finally {
      setIsProcessingAll(false);
    }
  };

  const handleRejectRequest = async (request: PaymentRequest) => {
    try {
      const result = await rifiutaRichiestaPagamento(request.id);
      
      if (result.success) {
        toast.info(`Richiesta di pagamento rifiutata`);
        // Ricarica le richieste
        await loadRequests();
      } else {
        toast.error(result.error || 'Errore rifiuto richiesta');
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore durante il rifiuto');
    }
  };

  const getTimeAgo = (timestamp: Date | string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diff < 60) return 'Adesso';
    if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
    return `${Math.floor(diff / 86400)} giorni fa`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-20 px-4">
      <div 
        className="absolute inset-0 bg-black/30" 
        onClick={onClose}
      />
      
      <div 
        className="relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: colors.bg.card }}
      >
        {/* Header */}
        <div 
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: colors.border.primary }}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="h-5 w-5" style={{ color: colors.text.primary }} />
              {requests.length > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: colors.text.error }}
                />
              )}
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: colors.text.primary }}>
                Richieste di Pagamento
              </h3>
              <p className="text-xs" style={{ color: colors.text.muted }}>
                {requests.length} in attesa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <XCircle className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        {/* Content */}
        <div 
          className="max-h-[70vh] overflow-y-auto"
          style={{ backgroundColor: colors.bg.main }}
        >
          {requests.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" style={{ color: colors.text.muted }} />
              <p style={{ color: colors.text.muted }}>
                Nessuna richiesta di pagamento in attesa
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ divideColor: colors.border.secondary }}>
              {requests.map((request) => {
                const Icon = getPaymentMethodIcon(request.modalitaPagamento);
                const methodColor = getPaymentMethodColor(request.modalitaPagamento);
                const isExpanded = expandedRequest === request.id;
                
                return (
                  <div 
                    key={request.id}
                    className="p-4 transition-colors"
                    style={{ 
                      backgroundColor: isExpanded ? colors.bg.darker : 'transparent',
                      opacity: processingId === request.id ? 0.7 : 1
                    }}
                  >
                    {/* Request Header */}
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold" style={{ color: colors.text.primary }}>
                            {request.tavoloNumero === 'ASPORTO' ? 'Asporto' : `Tavolo ${request.tavoloNumero}`}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: methodColor + '20',
                              color: methodColor
                            }}>
                            {request.modalitaPagamento}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm" style={{ color: colors.text.muted }}>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{request.clienteNome || 'Cliente'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{getTimeAgo(request.timestampCreazione)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xl font-bold" style={{ color: colors.accent }}>
                          €{request.totale.toFixed(2)}
                        </div>
                        <div className="text-xs" style={{ color: colors.text.muted }}>
                          da {request.cameriereNome}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border.secondary}` }}>
                        <div className="space-y-3">
                          {/* Payment Method Details */}
                          <div className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ backgroundColor: methodColor + '10' }}>
                            <Icon className="h-5 w-5" style={{ color: methodColor }} />
                            <div className="flex-1">
                              <div className="font-medium" style={{ color: colors.text.primary }}>
                                Pagamento {request.modalitaPagamento}
                              </div>
                              <div className="text-xs" style={{ color: colors.text.muted }}>
                                {request.modalitaPagamento === 'CONTANTI' && 'Il cliente pagherà in contanti'}
                                {request.modalitaPagamento === 'POS' && 'Il cliente userà la carta'}
                                {request.modalitaPagamento === 'BANCOMAT' && 'Il cliente userà il Bancomat'}
                                {request.modalitaPagamento === 'SATISPAY' && 'Il cliente userà Satispay'}
                                {request.modalitaPagamento === 'MISTO' && 'Pagamento misto contanti + carta'}
                              </div>
                            </div>
                          </div>

                          {/* Opzione stampa scontrino */}
                          <div className="flex items-center gap-2 p-2 rounded-lg mb-3"
                            style={{ backgroundColor: colors.bg.darker }}>
                            <input
                              type="checkbox"
                              id={`print-${request.id}`}
                              checked={stampaScontrino}
                              onChange={(e) => setStampaScontrino(e.target.checked)}
                              className="w-4 h-4 rounded"
                              style={{ accentColor: colors.accent }}
                            />
                            <label htmlFor={`print-${request.id}`} className="text-sm flex items-center gap-2 cursor-pointer"
                              style={{ color: colors.text.primary }}>
                              <Receipt className="h-4 w-4" />
                              Stampa scontrino dopo il pagamento
                            </label>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRejectRequest(request)}
                              disabled={processingId === request.id}
                              className="flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              style={{
                                backgroundColor: colors.bg.darker,
                                color: colors.text.secondary
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                              Rifiuta
                            </button>
                            <button
                              onClick={() => handleAcceptRequest(request)}
                              disabled={processingId === request.id}
                              className="flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                              style={{
                                backgroundColor: colors.text.success,
                                color: 'white'
                              }}
                            >
                              {processingId === request.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Elaborazione...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Accetta e Paga
                                </>
                              )}
                            </button>
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

        {/* Footer with Quick Actions */}
        {requests.length > 0 && (
          <div 
            className="p-4 border-t"
            style={{ 
              borderColor: colors.border.primary,
              backgroundColor: colors.bg.card
            }}
          >
            <div className="space-y-3">
              {/* Checkbox stampa per tutte */}
              <div className="flex items-center gap-2 p-2 rounded-lg"
                style={{ backgroundColor: colors.bg.darker }}>
                <input
                  type="checkbox"
                  id="print-all"
                  checked={stampaScontrino}
                  onChange={(e) => setStampaScontrino(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: colors.accent }}
                />
                <label htmlFor="print-all" className="text-sm flex items-center gap-2 cursor-pointer"
                  style={{ color: colors.text.primary }}>
                  <Printer className="h-4 w-4" />
                  Stampa scontrini per tutti i pagamenti
                </label>
              </div>
              
              <button
                onClick={handleAcceptAll}
                disabled={isProcessingAll}
                className="w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.button.primaryText,
                  opacity: isProcessingAll ? 0.5 : 1,
                  cursor: isProcessingAll ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Elaborazione {requests.length} richieste...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Accetta e Paga Tutte ({requests.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}