import React, { useState, useEffect, useCallback } from 'react';
import { X, Package, Users, CheckCircle, Clock, Loader2, AlertCircle, RotateCcw, Euro, User, Maximize2, Minimize2, Printer } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import OrderCard from './OrderCard';
import PaymentMethodSelector from './PaymentMethodSelector';
import { searchClienti, getRecentClienti } from '@/lib/actions/clienti-autocomplete';
import { annullaPagamentoOrdine } from '@/lib/actions/annulla-pagamento';
import { usePrinterSettings } from '@/hooks/usePrinterSettings';

interface Order {
  id: string;
  numero: number;
  tavolo?: {
    numero: string;
  } | null;
  cameriere: {
    nome: string;
  };
  righe: any[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  nomeCliente?: string | null;
  note?: string | null;
  stato: string;
  statoPagamento: string;
  dataApertura: string;
  pagamenti?: Array<{
    importo: number;
    modalita: string;
    clienteNome: string | null;
    timestamp: Date | string;
  }>;
}

interface TableGroup {
  tavoloNumero: string;
  ordinazioni: Order[];
  totaleComplessivo: number;
  totalePagatoComplessivo: number;
  rimanenteComplessivo: number;
  numeroClienti: number;
  clientiNomi: string[];
}

interface TableDetailsDrawerProps {
  isOpen: boolean;
  selectedTable: TableGroup | null;
  selectedOrder: Order | null;
  paymentMethod: 'POS' | 'CONTANTI' | 'MISTO';
  paymentMode: 'table' | 'order' | 'partial' | 'client';
  isProcessingPayment: boolean;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
  onChangePaymentMethod: (method: 'POS' | 'CONTANTI' | 'MISTO') => void;
  onChangePaymentMode: (mode: 'table' | 'order' | 'partial' | 'client') => void;
  onPayTable: (clienteNome: string, stampaScontrino?: boolean) => void;
  onPayOrder: (clienteNome: string, stampaScontrino?: boolean) => void;
  onPayPartial: (stampaScontrino?: boolean) => void;
  onPayByClient: (clienteNome: string, stampaScontrino?: boolean) => void;
  onCreateDebt: () => void;
  onTriggerParticles: (element: HTMLElement | null) => void;
  onRefreshData?: () => void; // Nuovo prop per refresh incrementale
}

export default function TableDetailsDrawer({
  isOpen,
  selectedTable,
  selectedOrder,
  paymentMethod,
  paymentMode,
  isProcessingPayment,
  onClose,
  onSelectOrder,
  onChangePaymentMethod,
  onChangePaymentMode,
  onPayTable,
  onPayOrder,
  onPayPartial,
  onPayByClient,
  onCreateDebt,
  onTriggerParticles,
  onRefreshData
}: TableDetailsDrawerProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [clienteNome, setClienteNome] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentClienti, setRecentClienti] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { settings: printerSettings, updateSettings: updatePrinterSettings } = usePrinterSettings();
  const [stampaScontrino, setStampaScontrino] = useState(true); // Default: stampa abilitata

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setClienteNome('');
      setSuggestions([]);
      setShowSuggestions(false);
      
      // Inizializza checkbox stampa con impostazioni utente
      if (printerSettings.autoprint) {
        // Se autoprint è attivo, stampa sempre
        setStampaScontrino(true);
      } else {
        // Altrimenti usa il default dell'utente
        setStampaScontrino(printerSettings.defaultEnabled);
      }
      
      // Carica clienti recenti
      getRecentClienti().then(setRecentClienti);
    }
  }, [isOpen, printerSettings]);

  // Gestione ricerca clienti con debounce
  const handleClienteSearch = useCallback(async (value: string) => {
    setClienteNome(value);
    
    if (value.length >= 2) {
      const results = await searchClienti(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } else if (value.length === 0 && recentClienti.length > 0) {
      setSuggestions(recentClienti);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [recentClienti]);

  const handleSelectSuggestion = (suggestion: string) => {
    setClienteNome(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCancelPayment = async () => {
    if (!selectedOrder) return;
    
    setCancellingPayment(true);
    try {
      const result = await annullaPagamentoOrdine(selectedOrder.id, cancelMotivo || undefined);
      
      if (result.success) {
        // Success notification
        if (Notification.permission === "granted") {
          new Notification("Pagamento Annullato", {
            body: `Ordine #${selectedOrder.numero} riportato a non pagato`,
            icon: '/icon-192.png'
          });
        }
        
        // Close dialog and refresh incrementally
        setShowCancelConfirm(false);
        setCancelMotivo("");
        
        // Usa refresh incrementale se disponibile, altrimenti reload
        if (onRefreshData) {
          await onRefreshData();
          onClose(); // Chiudi il drawer dopo il refresh
        } else {
          // Fallback al reload se non c'è il metodo di refresh
          window.location.reload();
        }
      } else {
        alert(`Errore: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore annullamento pagamento:', error);
      alert('Errore durante l\'annullamento del pagamento');
    } finally {
      setCancellingPayment(false);
    }
  };

  if (!isOpen || !selectedTable) return null;

  return (
    <div className={`fixed inset-0 z-50 flex ${isFullscreen ? '' : 'items-end sm:items-center'} justify-center ${isFullscreen ? '' : 'sm:p-4'}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className={`${isFullscreen ? 'w-full h-full' : 'rounded-t-2xl sm:rounded-lg w-full sm:max-w-4xl max-h-[85vh] sm:max-h-[90vh]'} overflow-hidden`} 
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b" 
          style={{ 
            borderColor: colors.border.primary,
            background: `linear-gradient(to right, ${colors.bg.card}, ${colors.bg.hover})`
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: colors.text.muted }}>
                MODAL DETTAGLI TAVOLO
              </span>
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                {selectedTable.tavoloNumero === 'Asporto' ? (
                  <>
                    <div className="p-1.5 sm:p-2 rounded-lg" style={{ backgroundColor: colors.button.primary + '20' }}>
                      <Package className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: colors.button.primary }} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text.primary }}>
                      Ordini Asporto
                    </h2>
                  </>
                ) : (
                  <>
                    <div className="p-1.5 sm:p-2 rounded-lg" style={{ backgroundColor: colors.button.primary + '20' }}>
                      <Users className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: colors.button.primary }} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text.primary }}>
                      Tavolo {selectedTable.tavoloNumero}
                    </h2>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm" style={{ color: colors.text.secondary }}>
                <span className="flex items-center gap-1">
                  <span className="font-semibold">{selectedTable.ordinazioni?.length || 0}</span> ordinazioni
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-semibold">{selectedTable.numeroClienti || 0}</span> clienti
                </span>
                {selectedTable.totalePagatoComplessivo > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ 
                      backgroundColor: selectedTable.rimanenteComplessivo === 0 
                        ? colors.button.success + '20' 
                        : colors.button.warning + '20',
                      color: selectedTable.rimanenteComplessivo === 0 
                        ? colors.button.success 
                        : colors.button.warning
                    }}
                  >
                    {selectedTable.rimanenteComplessivo === 0 ? 'Completamente pagato' : 'Parzialmente pagato'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg transition-all"
                style={{ 
                  backgroundColor: colors.bg.hover
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.button.primary + '20';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.color = colors.button.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.color = colors.text.secondary;
                }}
                title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-5 w-5" style={{ color: colors.text.secondary }} />
                ) : (
                  <Maximize2 className="h-5 w-5" style={{ color: colors.text.secondary }} />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-all hover:rotate-90"
                style={{ 
                  backgroundColor: colors.bg.hover,
                  transform: 'rotate(0deg)',
                  transitionDuration: '200ms'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.button.danger + '20';
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.color = colors.button.danger;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                  const svg = e.currentTarget.querySelector('svg');
                  if (svg) svg.style.color = colors.text.secondary;
                }}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>
          </div>
        </div>

        <div className={`p-4 sm:p-6 overflow-y-auto ${isFullscreen ? 'max-h-[calc(100vh-140px)]' : 'max-h-[calc(85vh-100px)] sm:max-h-[calc(90vh-120px)]'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Orders List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider block" style={{ color: colors.text.muted }}>
                    SEZIONE LISTA ORDINI
                  </span>
                  <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                    Ordinazioni
                  </h3>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => onChangePaymentMode('table')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                    style={{ 
                      backgroundColor: paymentMode === 'table' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'table' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Tavolo completo
                  </button>
                  <button
                    onClick={() => onChangePaymentMode('client')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                    style={{ 
                      backgroundColor: paymentMode === 'client' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'client' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Per cliente
                  </button>
                  <button
                    onClick={() => onChangePaymentMode('order')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                    style={{ 
                      backgroundColor: paymentMode === 'order' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'order' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Singolo ordine
                  </button>
                  <button
                    onClick={() => onChangePaymentMode('partial')}
                    className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                    style={{ 
                      backgroundColor: paymentMode === 'partial' ? colors.button.primary : colors.bg.hover,
                      color: paymentMode === 'partial' ? colors.button.primaryText : colors.text.primary
                    }}
                  >
                    Ordini parziali
                  </button>
                </div>
              </div>
              
              {paymentMode === 'client' ? (
                // Raggruppa ordini per cliente
                <div className="space-y-4">
                  {(() => {
                    const ordersByClient = new Map<string, Order[]>();
                    selectedTable.ordinazioni.forEach(order => {
                      const clientName = order.nomeCliente || 'Cliente generico';
                      if (!ordersByClient.has(clientName)) {
                        ordersByClient.set(clientName, []);
                      }
                      ordersByClient.get(clientName)!.push(order);
                    });
                    
                    return Array.from(ordersByClient.entries()).map(([clientName, clientOrders]) => {
                      const totaleCliente = clientOrders.reduce((sum, o) => sum + o.rimanente, 0);
                      const isSelected = selectedOrder && clientOrders.some(o => o.id === selectedOrder.id);
                      
                      return (
                        <div 
                          key={clientName}
                          className="border rounded-lg p-3 cursor-pointer transition-all"
                          style={{
                            borderColor: isSelected ? colors.text.primary : colors.border.secondary,
                            backgroundColor: isSelected ? colors.bg.hover : colors.bg.darker
                          }}
                          onClick={() => {
                            // Seleziona il primo ordine del cliente per tracking
                            onSelectOrder(clientOrders[0]);
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" style={{ color: colors.text.secondary }} />
                              <span className="font-medium" style={{ color: colors.text.primary }}>
                                {clientName}
                              </span>
                            </div>
                            <span className="font-bold" style={{ color: colors.text.primary }}>
                              €{totaleCliente.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-sm" style={{ color: colors.text.secondary }}>
                            {clientOrders.length} ordini:
                          </div>
                          <div className="space-y-1 mt-1">
                            {clientOrders.map(order => (
                              <div key={order.id} className="flex justify-between text-sm">
                                <span style={{ color: colors.text.muted }}>#{order.numero}</span>
                                <span style={{ color: order.rimanente > 0 ? colors.text.secondary : colors.text.success }}>
                                  €{order.rimanente.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                (selectedTable.ordinazioni || []).map((order: Order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onClick={() => (paymentMode === 'order' || paymentMode === 'partial') ? onSelectOrder(order) : null}
                    isSelectable={paymentMode === 'order' || paymentMode === 'partial'}
                  />
                ))
              )}
            </div>

            {/* Payment Panel */}
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider block" style={{ color: colors.text.muted }}>
                  SEZIONE PAGAMENTO
                </span>
                <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Riepilogo Pagamento
                </h3>
              </div>
              
              <div className="rounded-lg p-4 space-y-4" 
                style={{ 
                  backgroundColor: colors.bg.hover, 
                  borderColor: colors.border.primary, 
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
              >
                {/* Payment Summary */}
                <div className="space-y-3">
                  {paymentMode === 'client' && selectedOrder ? (
                    // Modalità Per Cliente - mostra tutti gli ordini del cliente
                    (() => {
                      const clientName = selectedOrder.nomeCliente || 'Cliente generico';
                      const clientOrders = selectedTable.ordinazioni.filter(
                        o => (o.nomeCliente || 'Cliente generico') === clientName
                      );
                      const totaleCliente = clientOrders.reduce((sum, o) => sum + o.totale, 0);
                      const pagatoCliente = clientOrders.reduce((sum, o) => sum + o.totalePagato, 0);
                      const rimanenteCliente = clientOrders.reduce((sum, o) => sum + o.rimanente, 0);
                      
                      return (
                        <>
                          <div className="mb-2 font-medium" style={{ color: colors.text.primary }}>
                            Ordini di {clientName}:
                          </div>
                          {clientOrders.map(order => (
                            <div key={order.id} className="text-sm pl-2">
                              <div className="flex justify-between">
                                <span style={{ color: colors.text.secondary }}>Ordine #{order.numero}:</span>
                                <span style={{ color: colors.text.primary }}>€{order.rimanente.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-between border-t pt-2" 
                            style={{ borderColor: colors.border.secondary }}
                          >
                            <span style={{ color: colors.text.secondary }}>Totale ordini:</span>
                            <span style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                              €{totaleCliente.toFixed(2)}
                            </span>
                          </div>
                          {pagatoCliente > 0 && (
                            <div className="flex justify-between">
                              <span style={{ color: colors.text.secondary }}>Già pagato:</span>
                              <span style={{ color: 'green', fontWeight: 'bold' }}>-€{pagatoCliente.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-2" 
                            style={{ borderColor: colors.border.secondary }}
                          >
                            <span style={{ color: colors.text.primary }}>Rimanente da pagare:</span>
                            <span style={{ color: colors.text.primary, fontSize: '1.25rem', fontWeight: 'bold' }}>
                              €{rimanenteCliente.toFixed(2)}
                            </span>
                          </div>
                        </>
                      );
                    })()
                  ) : paymentMode === 'table' ? (
                    <>
                      <div className="flex justify-between">
                        <span style={{ color: colors.text.secondary }}>Totale tavolo:</span>
                        <span style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                          €{(selectedTable.totaleComplessivo || 0).toFixed(2)}
                        </span>
                      </div>
                      {selectedTable.totalePagatoComplessivo > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.secondary }}>Già pagato:</span>
                          <span style={{ color: 'green', fontWeight: 'bold' }}>-€{(selectedTable.totalePagatoComplessivo || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2" 
                        style={{ borderColor: colors.border.secondary }}
                      >
                        <span style={{ color: colors.text.primary }}>Rimanente da pagare:</span>
                        <span style={{ color: colors.text.primary, fontSize: '1.25rem', fontWeight: 'bold' }}>
                          €{(selectedTable.rimanenteComplessivo || 0).toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : selectedOrder ? (
                    <>
                      <div className="flex justify-between">
                        <span style={{ color: colors.text.secondary }}>
                          Totale ordine #{selectedOrder.numero}:
                        </span>
                        <span style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                          €{selectedOrder.totale.toFixed(2)}
                        </span>
                      </div>
                      {selectedOrder.totalePagato > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.secondary }}>Già pagato:</span>
                          <span style={{ color: 'green', fontWeight: 'bold' }}>-€{selectedOrder.totalePagato.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2" 
                        style={{ borderColor: colors.border.secondary }}
                      >
                        <span style={{ color: colors.text.primary }}>Rimanente da pagare:</span>
                        <span style={{ color: colors.text.primary, fontSize: '1.25rem', fontWeight: 'bold' }}>
                          €{selectedOrder.rimanente.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4" style={{ color: colors.text.secondary }}>
                      Seleziona un'ordinazione per vedere i dettagli
                    </div>
                  )}
                </div>

                {/* Sezione Prodotti Pagati */}
                {selectedOrder && selectedOrder.pagamenti && selectedOrder.pagamenti.length > 0 && (
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.bg.dark + '30' }}>
                    <h4 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                      Articoli già pagati
                    </h4>
                    <div className="space-y-2">
                      {selectedOrder.pagamenti.map((pagamento, idx) => {
                        // Stima prodotti pagati basandosi sull'importo
                        const prodottiStimati = [];
                        let importoRimanente = pagamento.importo;
                        
                        // Ordina le righe per prezzo decrescente per stimare meglio
                        const righeOrdinate = [...selectedOrder.righe].sort((a, b) => b.prezzo - a.prezzo);
                        
                        for (const riga of righeOrdinate) {
                          const prezzoUnitario = riga.prezzo;
                          const quantitaPossibile = Math.floor(importoRimanente / prezzoUnitario);
                          
                          if (quantitaPossibile > 0) {
                            const quantitaPagata = Math.min(quantitaPossibile, riga.quantita);
                            prodottiStimati.push({
                              nome: riga.prodotto.nome,
                              quantita: quantitaPagata,
                              prezzo: prezzoUnitario
                            });
                            importoRimanente -= quantitaPagata * prezzoUnitario;
                            
                            if (importoRimanente < 0.01) break;
                          }
                        }
                        
                        if (prodottiStimati.length > 0) {
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 rounded"
                              style={{ backgroundColor: colors.bg.hover + '50' }}
                            >
                              <div className="flex items-center gap-2">
                                <span style={{ color: colors.text.primary }}>
                                  {prodottiStimati.map(p => `${p.quantita}x ${p.nome}`).join(', ')}
                                </span>
                                <span className="px-2 py-0.5 text-xs rounded-full font-medium"
                                  style={{
                                    backgroundColor: colors.button.success + '20',
                                    color: colors.button.success
                                  }}
                                >
                                  PAGATO
                                </span>
                                <span className="text-sm" style={{ color: colors.text.secondary }}>
                                  • {pagamento.clienteNome || 'Cliente'}
                                </span>
                              </div>
                              <span style={{ color: colors.text.muted, textDecoration: 'line-through' }}>
                                €{pagamento.importo.toFixed(2)}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                {(paymentMode === 'table' || paymentMode === 'client' || selectedOrder) && (
                  <>
                    <PaymentMethodSelector 
                      value={paymentMethod} 
                      onChange={onChangePaymentMethod} 
                    />

                    {/* Nome Cliente per pagamento completo - STESSO STILE DEL MODAL PARZIALE */}
                    {(paymentMode === 'table' || paymentMode === 'order' || paymentMode === 'client') && (
                      <div className="pt-4 border-t relative" style={{ borderColor: colors.border.primary }}>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                          Nome Cliente *
                        </label>
                        <div className="relative">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                              style={{ color: colors.text.secondary }}
                            />
                            <input
                              type="text"
                              value={clienteNome}
                              onChange={(e) => handleClienteSearch(e.target.value)}
                              onFocus={() => {
                                if (clienteNome.length === 0 && recentClienti.length > 0) {
                                  setSuggestions(recentClienti);
                                  setShowSuggestions(true);
                                }
                              }}
                              onBlur={() => {
                                // Ritarda la chiusura per permettere il click sui suggerimenti
                                setTimeout(() => setShowSuggestions(false), 200);
                              }}
                              placeholder="Inserisci o seleziona il nome del cliente"
                              className="w-full pl-10 pr-4 py-2 rounded-lg border"
                              style={{
                                borderColor: colors.border.primary,
                                backgroundColor: colors.bg.card,
                                color: colors.text.primary
                              }}
                            />
                          </div>
                          
                          {/* Suggerimenti Autocomplete - STESSO STILE DEL MODAL PARZIALE */}
                          {showSuggestions && suggestions.length > 0 && (
                            <div 
                              className="absolute z-10 w-full mt-1 rounded-lg shadow-lg border overflow-hidden"
                              style={{
                                backgroundColor: colors.bg.card,
                                borderColor: colors.border.primary
                              }}
                            >
                              <div className="max-h-48 overflow-y-auto">
                                {clienteNome.length === 0 && (
                                  <div className="px-3 py-1 text-xs font-medium" 
                                    style={{ 
                                      backgroundColor: colors.bg.hover,
                                      color: colors.text.secondary 
                                    }}
                                  >
                                    Clienti recenti
                                  </div>
                                )}
                                {suggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    className="px-3 py-2 cursor-pointer hover:bg-opacity-10 transition-colors flex items-center gap-2"
                                    style={{
                                      backgroundColor: 'transparent',
                                      color: colors.text.primary
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    <User className="h-3 w-3" style={{ color: colors.text.secondary }} />
                                    <span>{suggestion}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Opzione Stampa Scontrino - Mostra solo se non è autoprint */}
                    {printerSettings.showConfirmDialog && !printerSettings.autoprint && (
                      <div className="px-4 py-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stampaScontrino}
                            onChange={(e) => {
                              setStampaScontrino(e.target.checked);
                              // Salva la preferenza dell'utente
                              updatePrinterSettings({ defaultEnabled: e.target.checked });
                            }}
                            className="w-4 h-4 rounded border-2 transition-colors"
                            style={{
                              accentColor: colors.button.primary,
                              borderColor: colors.border.primary
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Printer className="h-4 w-4" style={{ color: colors.text.secondary }} />
                            <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                              Stampa scontrino automaticamente
                            </span>
                          </div>
                        </label>
                        <p className="text-xs mt-1 ml-7" style={{ color: colors.text.muted }}>
                          Stampa su Netum NT-1809 via Bluetooth
                        </p>
                      </div>
                    )}
                    
                    {/* Messaggio autoprint attivo */}
                    {printerSettings.autoprint && (
                      <div 
                        className="px-4 py-3 mx-4 rounded-lg border flex items-center gap-2"
                        style={{ 
                          backgroundColor: (colors.status?.success || '#10b981') + '10',
                          borderColor: (colors.status?.success || '#10b981') + '30'
                        }}
                      >
                        <Printer className="h-4 w-4" style={{ color: colors.status?.success || '#10b981' }} />
                        <span className="text-sm" style={{ color: colors.status?.success || '#10b981' }}>
                          Stampa automatica sempre attiva
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => {
                          // Per pagamenti completi, richiedi il nome cliente
                          if ((paymentMode === 'table' || paymentMode === 'order' || paymentMode === 'client') && !clienteNome.trim()) {
                            alert('Inserisci il nome del cliente');
                            return;
                          }
                          
                          if (paymentMode === 'table') {
                            onPayTable(clienteNome, stampaScontrino);
                          } else if (paymentMode === 'client') {
                            onPayByClient(clienteNome, stampaScontrino);
                          } else if (paymentMode === 'partial') {
                            onPayPartial(stampaScontrino);
                          } else {
                            onPayOrder(clienteNome, stampaScontrino);
                          }
                          onTriggerParticles(e.currentTarget);
                        }}
                        disabled={isProcessingPayment || ((paymentMode === 'table' || paymentMode === 'order' || paymentMode === 'client') && !clienteNome.trim())}
                        className="flex-1 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        style={{ 
                          backgroundColor: colors.button.success || colors.button.primary,
                          color: colors.button.successText || colors.button.primaryText,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => !isProcessingPayment && (
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                        )}
                        onMouseLeave={(e) => !isProcessingPayment && (
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                        )}
                      >
                        {isProcessingPayment ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircle className="h-5 w-5" />
                        )}
                        {isProcessingPayment 
                          ? 'Elaborazione...' 
                          : paymentMode === 'table' 
                            ? 'Paga tutto il tavolo'
                            : paymentMode === 'client'
                            ? 'Paga ordini del cliente'
                            : paymentMode === 'partial'
                            ? 'Gestisci pagamenti parziali' 
                            : 'Paga ordinazione'
                        }
                      </button>
                      
                      {/* Cancel Payment Button - Only show for paid orders */}
                      {selectedOrder && (selectedOrder.stato === 'PAGATO' || selectedOrder.statoPagamento === 'COMPLETAMENTE_PAGATO') && (
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          className="px-4 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                          style={{ 
                            backgroundColor: colors.button.danger || '#ef4444',
                            color: colors.button.dangerText || '#ffffff'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.dangerHover || '#dc2626'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.danger || '#ef4444'}
                        >
                          <RotateCcw className="h-5 w-5" />
                          Annulla Pagamento
                        </button>
                      )}
                      
                      <button
                        onClick={onCreateDebt}
                        disabled={isProcessingPayment || (!selectedOrder && (paymentMode === 'order' || paymentMode === 'partial' || paymentMode === 'client'))}
                        className="flex-1 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        style={{ 
                          backgroundColor: 'transparent',
                          color: colors.button.warning || colors.text.primary,
                          borderColor: colors.button.warning || colors.border.primary,
                          borderWidth: '2px',
                          borderStyle: 'solid',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                        onMouseEnter={(e) => !isProcessingPayment && (
                          e.currentTarget.style.backgroundColor = (colors.button.warning || colors.button.primary) + '10',
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                        )}
                        onMouseLeave={(e) => !isProcessingPayment && (
                          e.currentTarget.style.backgroundColor = 'transparent',
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'
                        )}
                      >
                        <Clock className="h-5 w-5" />
                        Fai debito
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cancel Payment Confirmation Modal */}
      {showCancelConfirm && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          <div className="rounded-lg max-w-md w-full p-6" 
            style={{ 
              backgroundColor: colors.bg.card, 
              borderColor: colors.border.primary, 
              borderWidth: '1px', 
              borderStyle: 'solid' 
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6" style={{ color: colors.text.warning || '#f59e0b' }} />
              <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                Conferma Annullamento Pagamento
              </h3>
            </div>
            
            <p className="mb-4" style={{ color: colors.text.secondary }}>
              Stai per annullare il pagamento dell'ordine #{selectedOrder.numero}.
              L'ordine tornerà allo stato "CONSEGNATO" e potrà essere pagato nuovamente.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Motivo annullamento (opzionale)
              </label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Es: Errore di pagamento, cliente ha cambiato metodo..."
                className="w-full px-3 py-2 rounded-lg"
                rows={3}
                style={{ 
                  backgroundColor: colors.bg.darker,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setCancelMotivo("");
                }}
                disabled={cancellingPayment}
                className="flex-1 py-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: colors.button.secondary || colors.bg.hover,
                  color: colors.button.secondaryText || colors.text.primary
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleCancelPayment}
                disabled={cancellingPayment}
                className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: colors.button.danger || '#ef4444',
                  color: colors.button.dangerText || '#ffffff'
                }}
              >
                {cancellingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Annullamento...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Conferma Annullamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}