import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Euro, Check, CreditCard, Banknote, Coins, Plus, Minus, User, Maximize2, Minimize2, Printer } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { searchClienti, getRecentClienti } from '@/lib/actions/clienti-autocomplete';
import { usePrinterSettings } from '@/hooks/usePrinterSettings';

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
  configurazione?: {
    selezioni?: any[];
  };
}

interface Order {
  id: string;
  numero: number;
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  pagamenti?: any[];
}

interface SelectedItem {
  id: string;
  quantita: number;
  prezzo: number;
}

interface SimplePartialPaymentModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirmPayment: (selectedItems: SelectedItem[], clienteNome: string, modalita: 'POS' | 'CONTANTI' | 'MISTO', stampaScontrino?: boolean) => Promise<void>;
}

export function SimplePartialPaymentModal({
  isOpen,
  order,
  onClose,
  onConfirmPayment
}: SimplePartialPaymentModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { settings: printerSettings, updateSettings: updatePrinterSettings } = usePrinterSettings();
  
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [clienteNome, setClienteNome] = useState('');
  const [modalitaPagamento, setModalitaPagamento] = useState<'POS' | 'CONTANTI' | 'MISTO'>('POS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentClienti, setRecentClienti] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stampaScontrino, setStampaScontrino] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    if (isOpen && order) {
      // Reset state when modal opens
      setSelectedItems(new Map());
      setClienteNome('');
      setModalitaPagamento('POS');
      
      // Inizializza checkbox stampa con impostazioni utente
      if (printerSettings.autoprint) {
        setStampaScontrino(true);
      } else {
        setStampaScontrino(printerSettings.defaultEnabled);
      }
      setSuggestions([]);
      setShowSuggestions(false);
      
      // Carica clienti recenti
      getRecentClienti().then(setRecentClienti);
    }
  }, [isOpen, order, printerSettings]);

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

  const handleSelectSuggestion = useCallback((suggestion: string) => {
    isSelectingRef.current = true;
    setClienteNome(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    // Rimuovi il focus dall'input per chiudere la tastiera
    if (inputRef.current) {
      inputRef.current.blur();
    }
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 100);
  }, []);

  if (!isOpen || !order) return null;

  // Calcola le quantità già pagate per ogni riga dai pagamenti
  const calculatePaidQuantities = () => {
    const paidQuantities: Record<string, number> = {};
    
    if (order.pagamenti && Array.isArray(order.pagamenti) && order.pagamenti.length > 0) {
      // Per ora, siccome il sistema non traccia le quantità parziali correttamente,
      // calcoliamo le quantità pagate basandoci sull'importo pagato
      const totalePagato = order.totalePagato || 0;
      const totaleOrdine = order.totale;
      
      // Se c'è solo un tipo di prodotto, calcoliamo le quantità pagate
      const prodottiUnici = new Set(order.righe.map(r => r.prodotto.nome));
      if (prodottiUnici.size === 1 && order.righe.length === 1) {
        const riga = order.righe[0];
        const prezzoUnitario = riga.prezzo;
        const quantitaPagata = Math.floor(totalePagato / prezzoUnitario);
        
        
        if (quantitaPagata > 0) {
          paidQuantities[riga.id] = quantitaPagata;
        }
      }
    }
    
    return paidQuantities;
  };
  
  const paidQuantitiesMap = calculatePaidQuantities();

  // USA I DATI REALI DAL DATABASE - dopo lo split le righe pagate hanno isPagato = true
  const righeNonPagate = order.righe.filter(r => !r.isPagato);
  const righePagate = order.righe.filter(r => r.isPagato);
  
  // Per le righe non pagate, mantieni tutti i dati originali
  const righeConQuantitaRimanenti = order.righe.map(riga => {
    return {
      ...riga,
      quantitaPagata: riga.isPagato ? riga.quantita : 0,
      quantitaRimanente: riga.isPagato ? 0 : riga.quantita,
      isCompletamentePagato: riga.isPagato
    };
  });
  
  // Raggruppa prodotti per nome e configurazione usando i dati reali dal database
  const prodottiRaggruppati = order.righe.reduce((acc, item) => {
    // Per miscelati, crea una chiave unica che include la configurazione
    const configKey = item.configurazione?.selezioni 
      ? JSON.stringify(item.configurazione.selezioni)
      : '';
    const key = item.prodotto.nome + configKey;
    
    if (!acc[key]) {
      acc[key] = {
        nome: item.prodotto.nome,
        prezzo: item.prezzo,
        configurazione: item.configurazione,
        nonPagati: [],
        pagati: [],
        quantitaTotale: 0,
        quantitaPagataTotale: 0,
        quantitaRimanenteTotale: 0
      };
    }
    
    // Aggiungi alla quantità totale
    acc[key].quantitaTotale += item.quantita;
    
    // USA isPagato dal database per determinare se è pagato
    if (item.isPagato) {
      acc[key].quantitaPagataTotale += item.quantita;
      acc[key].pagati.push({
        ...item,
        pagatoDa: item.pagatoDa || 'Cliente'
      });
    } else {
      acc[key].quantitaRimanenteTotale += item.quantita;
      acc[key].nonPagati.push(item);
    }
    
    return acc;
  }, {} as Record<string, { 
    nome: string; 
    prezzo: number; 
    configurazione?: {
      selezioni?: any[];
    };
    nonPagati: any[]; 
    pagati: any[];
    quantitaTotale: number;
    quantitaPagataTotale: number;
    quantitaRimanenteTotale: number;
  }>);
  
  // Calcola totale selezionato
  const totaleSelezionato = Array.from(selectedItems.entries()).reduce((sum, [itemId, quantity]) => {
    const item = righeNonPagate.find(r => r.id === itemId);
    return sum + (item ? item.prezzo * quantity : 0);
  }, 0);

  const handleQuantityChange = (itemId: string, maxQuantity: number, delta: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      const currentQuantity = newMap.get(itemId) || 0;
      const newQuantity = Math.max(0, Math.min(maxQuantity, currentQuantity + delta));
      
      if (newQuantity === 0) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, newQuantity);
      }
      
      return newMap;
    });
  };
  
  const handleToggleItem = (itemId: string, maxQuantity: number) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(itemId)) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, maxQuantity);
      }
      return newMap;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === righeNonPagate.length) {
      setSelectedItems(new Map());
    } else {
      const newMap = new Map();
      righeNonPagate.forEach(r => newMap.set(r.id, r.quantita));
      setSelectedItems(newMap);
    }
  };

  const handleConfirm = async () => {
    if (selectedItems.size === 0) {
      alert('Seleziona almeno un articolo da pagare');
      return;
    }

    if (!clienteNome.trim()) {
      alert('Inserisci il nome del cliente');
      return;
    }

    setIsProcessing(true);
    try {
      // Converti la Map in array di SelectedItem
      const itemsToPayForUnique: SelectedItem[] = [];
      selectedItems.forEach((quantita, id) => {
        const item = righeNonPagate.find(r => r.id === id);
        if (item) {
          itemsToPayForUnique.push({ id, quantita, prezzo: item.prezzo });
        }
      });
      
      await onConfirmPayment(itemsToPayForUnique, clienteNome, modalitaPagamento, stampaScontrino);
      // Chiudi il modal dopo il pagamento
      onClose();
    } catch (error) {
      console.error('Errore durante il pagamento:', error);
      alert('Errore durante il pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${isFullscreen ? '' : 'items-end sm:items-center'} justify-center ${isFullscreen ? '' : 'sm:p-4'}`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className={`${isFullscreen ? 'w-full h-full' : 'rounded-t-2xl sm:rounded-lg w-full sm:max-w-3xl max-h-[80vh] sm:max-h-[85vh]'} overflow-hidden`}
        style={{
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b"
          style={{ borderColor: colors.border.primary }}
        >
          <div className="flex-1 mr-2">
            <span className="text-xs uppercase tracking-wider mb-1 block" style={{ color: colors.text.muted }}>
              MODAL PAGAMENTO PARZIALE
            </span>
            <h2 className="text-lg sm:text-xl font-semibold" style={{ color: colors.text.primary }}>
              Pagamento Parziale - Ordine #{order.numero}
            </h2>
            <p className="text-xs sm:text-sm mt-1" style={{ color: colors.text.secondary }}>
              Seleziona gli articoli da pagare
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-opacity-10"
              style={{ backgroundColor: 'transparent' }}
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
              className="p-1.5 sm:p-2 rounded-lg transition-colors hover:bg-opacity-10"
              style={{ backgroundColor: 'transparent' }}
            >
              <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
            </button>
          </div>
        </div>

        <div className={`p-4 sm:p-6 overflow-y-auto ${isFullscreen ? 'max-h-[calc(100vh-200px)]' : 'max-h-[calc(80vh-180px)] sm:max-h-[calc(85vh-200px)]'}`}>
          {/* Riepilogo ordine */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
            <span className="text-xs uppercase tracking-wider block mb-2" style={{ color: colors.text.muted }}>
              CARD RIEPILOGO ORDINE
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-base sm:text-lg font-semibold" style={{ color: colors.text.primary }}>
                Riepilogo Ordine #{order.numero}
              </h3>
              <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full inline-block" 
                style={{ 
                  backgroundColor: colors.button.warning + '20',
                  color: colors.button.warning
                }}
              >
                Pagamento Parziale
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span style={{ color: colors.text.secondary }}>Totale ordine:</span>
                <span style={{ color: colors.text.primary, fontWeight: 'bold' }}>€{order.totale.toFixed(2)}</span>
              </div>
              {order.totalePagato > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: colors.text.secondary }}>Già pagato:</span>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>-€{order.totalePagato.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2" style={{ borderColor: colors.border.secondary }}>
                <span style={{ color: colors.text.primary }}>Rimanente da pagare:</span>
                <span style={{ color: colors.text.primary, fontSize: '1.25rem', fontWeight: 'bold' }}>
                  €{order.rimanente.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Selezione articoli */}
          <div className="space-y-4">
            {/* Select All Button */}
            <div className="flex justify-between items-center pb-2 border-b"
              style={{ borderColor: colors.border.primary }}
            >
              <h3 className="font-medium" style={{ color: colors.text.primary }}>
                Articoli disponibili
              </h3>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 text-sm rounded-lg transition-colors"
                style={{
                  backgroundColor: selectedItems.size === righeNonPagate.length 
                    ? colors.button.primary 
                    : colors.bg.hover,
                  color: selectedItems.size === righeNonPagate.length 
                    ? colors.button.primaryText 
                    : colors.text.primary
                }}
              >
                {selectedItems.size === righeNonPagate.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
              </button>
            </div>

            {/* Sezione prodotti pagati */}
            {Object.values(prodottiRaggruppati).some(g => g.quantitaPagataTotale > 0 && g.quantitaRimanenteTotale === 0) && (
              <div className="mb-6">
                <span className="text-xs uppercase tracking-wider block mb-1" style={{ color: colors.text.muted }}>
                  SEZIONE ARTICOLI GIÀ PAGATI
                </span>
                <h3 className="font-medium mb-3" style={{ color: colors.text.secondary }}>
                  Articoli già pagati
                </h3>
                <div className="space-y-2">
                  {Object.values(prodottiRaggruppati).map(gruppo => {
                    if (gruppo.quantitaRimanenteTotale > 0 || gruppo.quantitaPagataTotale === 0) return null;
                    
                    return (
                      <div key={`${gruppo.nome}-pagato`} className="p-3 rounded-lg border flex items-center justify-between"
                        style={{
                          borderColor: colors.border.secondary,
                          backgroundColor: colors.bg.hover + '50'
                        }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.text.primary }}>
                              {gruppo.nome}
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full font-medium"
                              style={{
                                backgroundColor: colors.button.success + '20',
                                color: colors.button.success
                              }}
                            >
                              PAGATO
                            </span>
                          </div>
                          <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                            {gruppo.quantitaPagataTotale}x • €{gruppo.prezzo.toFixed(2)} cad.
                          </p>
                          {/* Mostra ingredienti per miscelati già pagati */}
                          {gruppo.configurazione?.selezioni && (
                            <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                              🍸 {gruppo.configurazione.selezioni.map((sel: any, idx: number) => (
                                <span key={idx}>
                                  {idx > 0 && ' • '}
                                  {sel.bottiglie.map((b: any) => b.nome).join(', ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="font-medium" style={{ color: colors.text.secondary, textDecoration: 'line-through' }}>
                          €{(gruppo.quantitaPagataTotale * gruppo.prezzo).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Lista articoli raggruppati */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider block mb-2" style={{ color: colors.text.muted }}>
                SEZIONE ARTICOLI DA PAGARE
              </span>
              {righeNonPagate.length === 0 ? (
                <div className="text-center py-8" style={{ color: colors.text.secondary }}>
                  Tutti gli articoli sono già stati pagati
                </div>
              ) : (
                Object.values(prodottiRaggruppati).map((gruppo) => {
                  // Se non ci sono articoli non pagati per questo prodotto, non mostrarlo
                  if (gruppo.quantitaRimanenteTotale === 0) return null;
                  
                  // Raggruppa i pagati per cliente
                  const pagatiPerCliente = gruppo.pagati.reduce((acc, item) => {
                    const cliente = item.pagatoDa || 'Cliente';
                    if (!acc[cliente]) {
                      acc[cliente] = 0;
                    }
                    acc[cliente] += item.quantita;
                    return acc;
                  }, {} as Record<string, number>);
                  
                  return (
                    <div key={gruppo.nome} className="p-3 rounded-lg border"
                      style={{
                        borderColor: colors.border.primary,
                        backgroundColor: colors.bg.card
                      }}
                    >
                      {/* Nome prodotto e totali - PIÙ COMPATTO */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-base" style={{ color: colors.text.primary }}>
                                {gruppo.nome}
                              </h4>
                              <span className="text-xs" style={{ color: colors.text.secondary }}>
                                €{gruppo.prezzo.toFixed(2)}
                              </span>
                            </div>
                            {/* Mostra ingredienti per miscelati */}
                            {gruppo.configurazione?.selezioni && (
                              <div className="mt-1 text-xs" style={{ color: colors.text.muted }}>
                                🍸 {gruppo.configurazione.selezioni.map((sel: any, idx: number) => (
                                  <span key={idx}>
                                    {idx > 0 && ' • '}
                                    {sel.bottiglie.map((b: any) => b.nome).join(', ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold" style={{ color: colors.text.primary }}>
                              {gruppo.quantitaTotale}x
                            </span>
                            {gruppo.quantitaPagataTotale > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full" 
                                style={{ 
                                  backgroundColor: colors.button.success + '20',
                                  color: colors.button.success
                                }}>
                                {gruppo.quantitaPagataTotale} pagati
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Sezione articoli pagati - PIÙ COMPATTA */}
                        {gruppo.quantitaPagataTotale > 0 && (
                          <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: colors.bg.dark + '30' }}>
                            <div className="text-xs font-medium mb-1" style={{ color: colors.text.secondary }}>
                              Già pagati
                            </div>
                            <div className="space-y-1">
                              {order.pagamenti?.map((pagamento: any, idx: number) => {
                                // Calcola quanti articoli sono stati pagati in questo pagamento
                                const importoPagamento = pagamento.importo;
                                const quantitaPagataStimata = Math.floor(importoPagamento / gruppo.prezzo);
                                
                                if (quantitaPagataStimata > 0 && importoPagamento >= gruppo.prezzo) {
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1">
                                        <span style={{ color: colors.text.primary }}>
                                          {quantitaPagataStimata}x
                                        </span>
                                        <span className="px-1.5 py-0.5 text-xs rounded font-medium"
                                          style={{
                                            backgroundColor: colors.button.success + '20',
                                            color: colors.button.success
                                          }}
                                        >
                                          PAGATO
                                        </span>
                                        <span style={{ color: colors.text.secondary }}>
                                          {pagamento.clienteNome || 'Cliente'}
                                        </span>
                                      </div>
                                      <span style={{ color: colors.text.muted, textDecoration: 'line-through' }}>
                                        €{(quantitaPagataStimata * gruppo.prezzo).toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mostra items non pagati selezionabili - PIÙ COMPATTO */}
                      {gruppo.nonPagati.map((item) => {
                        const selectedQuantity = selectedItems.get(item.id) || 0;
                        const isSelected = selectedQuantity > 0;
                        
                        return (
                          <div key={item.id} 
                            className="flex items-center justify-between p-2 rounded transition-all"
                            style={{
                              backgroundColor: isSelected ? colors.bg.hover : 'transparent',
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: isSelected ? colors.button.primary : 'transparent'
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {/* Checkbox più piccolo */}
                              <div 
                                onClick={() => handleToggleItem(item.id, item.quantita)}
                                className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer"
                                style={{
                                  borderColor: isSelected ? colors.button.primary : colors.border.primary,
                                  backgroundColor: isSelected ? colors.button.primary : 'transparent'
                                }}
                              >
                                {isSelected && (
                                  <Check className="h-2.5 w-2.5" style={{ color: colors.button.primaryText }} />
                                )}
                              </div>
                              
                              <span className="text-sm" style={{ color: colors.text.primary }}>
                                {item.quantita}x da pagare
                              </span>
                            </div>
                            
                            {/* Quantity controls - PIÙ COMPATTI */}
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(item.id, item.quantita, -1);
                                    }}
                                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                    style={{
                                      backgroundColor: colors.button.secondary || colors.bg.hover,
                                      color: colors.text.primary
                                    }}
                                    disabled={selectedQuantity <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  
                                  <span className="min-w-[30px] text-center text-sm font-medium" 
                                    style={{ color: colors.text.primary }}
                                  >
                                    {selectedQuantity}
                                  </span>
                                  
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuantityChange(item.id, item.quantita, 1);
                                    }}
                                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                    style={{
                                      backgroundColor: colors.button.secondary || colors.bg.hover,
                                      color: colors.text.primary
                                    }}
                                    disabled={selectedQuantity >= item.quantita}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              
                              <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                €{((selectedQuantity || item.quantita) * item.prezzo).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Nome Cliente con Autocomplete */}
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
                    ref={inputRef}
                    type="text"
                    value={clienteNome}
                    onChange={(e) => {
                      if (!isSelectingRef.current) {
                        handleClienteSearch(e.target.value);
                      }
                    }}
                    onFocus={() => {
                      if (clienteNome.length === 0 && recentClienti.length > 0) {
                        setSuggestions(recentClienti);
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={(e) => {
                      // Solo se non stiamo selezionando un suggerimento
                      if (!isSelectingRef.current) {
                        const relatedTarget = e.relatedTarget as HTMLElement;
                        if (!relatedTarget || !relatedTarget.closest('.suggestion-item')) {
                          // Ritarda la chiusura per permettere il click sui suggerimenti
                          setTimeout(() => {
                            if (!isSelectingRef.current) {
                              setShowSuggestions(false);
                            }
                          }, 400);
                        }
                      }
                    }}
                    placeholder="Inserisci o seleziona il nome del cliente"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    style={{
                      borderColor: colors.border.primary,
                      backgroundColor: colors.bg.card,
                      color: colors.text.primary,
                      fontSize: '16px',
                      WebkitUserSelect: 'text',
                      userSelect: 'text',
                      pointerEvents: 'auto',
                      touchAction: 'auto'
                    }}
                  />
                </div>
                
                {/* Suggerimenti Autocomplete */}
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
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectSuggestion(suggestion);
                          }}
                          className="suggestion-item px-3 py-3 cursor-pointer hover:bg-opacity-10 transition-colors flex items-center gap-2"
                          style={{
                            backgroundColor: 'transparent',
                            color: colors.text.primary,
                            minHeight: '44px',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            touchAction: 'manipulation'
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

            {/* Modalità Pagamento */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Modalità di Pagamento
              </label>
              <div className="grid grid-cols-3 gap-1 sm:gap-2">
                <button
                  onClick={() => setModalitaPagamento('POS')}
                  className="p-2 sm:p-3 rounded-lg border transition-all flex flex-col items-center gap-1"
                  style={{
                    borderColor: modalitaPagamento === 'POS' ? colors.button.primary : colors.border.primary,
                    backgroundColor: modalitaPagamento === 'POS' ? colors.button.primary : colors.bg.card,
                    color: modalitaPagamento === 'POS' ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium">POS</span>
                </button>
                
                <button
                  onClick={() => setModalitaPagamento('CONTANTI')}
                  className="p-2 sm:p-3 rounded-lg border transition-all flex flex-col items-center gap-1"
                  style={{
                    borderColor: modalitaPagamento === 'CONTANTI' ? colors.button.primary : colors.border.primary,
                    backgroundColor: modalitaPagamento === 'CONTANTI' ? colors.button.primary : colors.bg.card,
                    color: modalitaPagamento === 'CONTANTI' ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium">CONTANTI</span>
                </button>
                
                <button
                  onClick={() => setModalitaPagamento('MISTO')}
                  className="p-2 sm:p-3 rounded-lg border transition-all flex flex-col items-center gap-1"
                  style={{
                    borderColor: modalitaPagamento === 'MISTO' ? colors.button.primary : colors.border.primary,
                    backgroundColor: modalitaPagamento === 'MISTO' ? colors.button.primary : colors.bg.card,
                    color: modalitaPagamento === 'MISTO' ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium">MISTO</span>
                </button>
              </div>
            </div>

            {/* Opzione Stampa Scontrino */}
            {printerSettings.showConfirmDialog && !printerSettings.autoprint && (
              <div className="mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stampaScontrino}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setStampaScontrino(isChecked);
                      // Salva la preferenza dell'utente
                      updatePrinterSettings({ defaultEnabled: isChecked });
                    }}
                    className="w-5 h-5 rounded border-2 transition-colors"
                    style={{
                      accentColor: colors.button.primary,
                      borderColor: colors.border.primary,
                      WebkitAppearance: 'checkbox',
                      appearance: 'checkbox',
                      cursor: 'pointer',
                      pointerEvents: 'auto'
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
                className="mt-4 p-3 rounded-lg border flex items-center gap-2"
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
          </div>
        </div>

        {/* Footer con riepilogo e azioni */}
        <div className="p-4 sm:p-6 border-t" style={{ borderColor: colors.border.primary }}>
          <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4">
            {/* Riepilogo */}
            <div className="space-y-1">
              <div className="flex items-center gap-4">
                <span className="text-sm" style={{ color: colors.text.secondary }}>
                  Articoli selezionati: {selectedItems.size}/{righeNonPagate.length}
                </span>
                {selectedItems.size > 0 && (
                  <>
                    <span className="text-sm" style={{ color: colors.text.secondary }}>
                      Quantità: {Array.from(selectedItems.values()).reduce((sum, q) => sum + q, 0)}
                    </span>
                    <span className="text-sm" style={{ color: colors.text.secondary }}>
                      Cliente: {clienteNome || '---'}
                    </span>
                  </>
                )}
              </div>
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <Euro className="h-5 w-5" style={{ color: colors.text.primary }} />
                  <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    {totaleSelezionato.toFixed(2)}
                  </span>
                  <span className="text-sm" style={{ color: colors.text.secondary }}>
                    da pagare
                  </span>
                </div>
              )}
            </div>

            {/* Bottoni azione */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg border font-medium transition-colors text-sm sm:text-base"
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
                disabled={selectedItems.size === 0 || !clienteNome.trim() || isProcessing}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                style={{
                  backgroundColor: colors.button.success || colors.button.primary,
                  color: colors.button.successText || colors.button.primaryText
                }}
              >
                {isProcessing ? 'Elaborazione...' : `Paga €${totaleSelezionato.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}