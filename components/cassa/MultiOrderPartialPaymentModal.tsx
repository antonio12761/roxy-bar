import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Package, User, CreditCard, Banknote, Loader2, Printer } from 'lucide-react';
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
}

interface Order {
  id: string;
  numero: number;
  tavolo?: {
    numero: string;
  } | null;
  cameriere: {
    nome: string;
  };
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  nomeCliente?: string | null;
  dataApertura: string;
}

interface SelectedItem {
  orderId: string;
  orderNumero: number;
  itemId: string;
  prodottoNome: string;
  quantita: number;
  quantitaTotale: number;
  prezzo: number;
}

interface MultiOrderPartialPaymentModalProps {
  isOpen: boolean;
  orders: Order[];
  onClose: () => void;
  onConfirmPayment: (
    payments: Array<{
      orderId: string;
      items: Array<{
        id: string;
        quantita: number;
        prezzo: number;
      }>;
      importo: number;
    }>,
    clienteNome: string,
    modalita: 'POS' | 'CONTANTI' | 'MISTO',
    stampaScontrino?: boolean
  ) => Promise<void>;
}

export function MultiOrderPartialPaymentModal({
  isOpen,
  orders,
  onClose,
  onConfirmPayment
}: MultiOrderPartialPaymentModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { settings: printerSettings, updateSettings: updatePrinterSettings } = usePrinterSettings();
  
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [clienteNome, setClienteNome] = useState('');
  const [modalita, setModalita] = useState<'POS' | 'CONTANTI' | 'MISTO'>('POS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentClienti, setRecentClienti] = useState<string[]>([]);
  const [tavoloFilter, setTavoloFilter] = useState<string>('tutti');
  const [stampaScontrino, setStampaScontrino] = useState(true);

  // Carica clienti recenti all'apertura
  useEffect(() => {
    if (isOpen) {
      // Inizializza checkbox stampa con impostazioni utente
      if (printerSettings.autoprint) {
        setStampaScontrino(true);
      } else {
        setStampaScontrino(printerSettings.defaultEnabled);
      }
      
      getRecentClienti().then(setRecentClienti);
    }
  }, [isOpen, printerSettings]);

  // Estrai tavoli unici
  const tavoliUnici = Array.from(new Set(
    orders.map(o => o.tavolo?.numero || 'Asporto')
  )).sort();

  // Filtra ordini per tavolo
  const ordiniFiltrati = tavoloFilter === 'tutti' 
    ? orders 
    : orders.filter(o => (o.tavolo?.numero || 'Asporto') === tavoloFilter);

  // Gestione autocomplete
  const handleClienteNomeChange = useCallback(async (value: string) => {
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

  // Toggle selezione ordine
  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    const newItems = new Map(selectedItems);
    
    if (newSelected.has(orderId)) {
      // Rimuovi ordine e tutti i suoi items
      newSelected.delete(orderId);
      for (const [key, item] of newItems) {
        if (item.orderId === orderId) {
          newItems.delete(key);
        }
      }
    } else {
      // Aggiungi ordine e tutti i suoi items non pagati
      newSelected.add(orderId);
      const order = orders.find(o => o.id === orderId);
      if (order) {
        order.righe.forEach(riga => {
          if (!riga.isPagato) {
            const key = `${orderId}-${riga.id}`;
            newItems.set(key, {
              orderId,
              orderNumero: order.numero,
              itemId: riga.id,
              prodottoNome: riga.prodotto.nome,
              quantita: riga.quantita,
              quantitaTotale: riga.quantita,
              prezzo: riga.prezzo
            });
          }
        });
      }
    }
    
    setSelectedOrders(newSelected);
    setSelectedItems(newItems);
  };

  // Toggle selezione item
  const toggleItemSelection = (orderId: string, orderNumero: number, item: OrderItem) => {
    const key = `${orderId}-${item.id}`;
    const newItems = new Map(selectedItems);
    
    if (newItems.has(key)) {
      newItems.delete(key);
    } else {
      newItems.set(key, {
        orderId,
        orderNumero,
        itemId: item.id,
        prodottoNome: item.prodotto.nome,
        quantita: item.quantita,
        quantitaTotale: item.quantita,
        prezzo: item.prezzo
      });
    }
    
    setSelectedItems(newItems);
  };

  // Aggiorna quantità
  const updateQuantity = (key: string, delta: number) => {
    const newItems = new Map(selectedItems);
    const item = newItems.get(key);
    
    if (item) {
      const newQuantita = Math.max(1, Math.min(item.quantitaTotale, item.quantita + delta));
      newItems.set(key, { ...item, quantita: newQuantita });
      setSelectedItems(newItems);
    }
  };

  // Calcola totale
  const totale = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + (item.quantita * item.prezzo),
    0
  );

  // Raggruppa items per ordine per il pagamento
  const groupItemsByOrder = () => {
    const grouped = new Map<string, {
      orderId: string;
      items: Array<{ id: string; quantita: number; prezzo: number }>;
      importo: number;
    }>();
    
    for (const item of selectedItems.values()) {
      if (!grouped.has(item.orderId)) {
        grouped.set(item.orderId, {
          orderId: item.orderId,
          items: [],
          importo: 0
        });
      }
      
      const group = grouped.get(item.orderId)!;
      group.items.push({
        id: item.itemId,
        quantita: item.quantita,
        prezzo: item.prezzo
      });
      group.importo += item.quantita * item.prezzo;
    }
    
    return Array.from(grouped.values());
  };

  const handleConfirm = async () => {
    if (!clienteNome.trim() || selectedItems.size === 0) return;
    
    setIsProcessing(true);
    try {
      const payments = groupItemsByOrder();
      await onConfirmPayment(payments, clienteNome.trim(), modalita, stampaScontrino);
      onClose();
    } catch (error) {
      console.error('Errore durante il pagamento:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedOrders(new Set());
    setSelectedItems(new Map());
    setClienteNome('');
    setModalita('POS');
    setSuggestions([]);
    setShowSuggestions(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" 
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="rounded-t-2xl sm:rounded-lg w-full sm:max-w-5xl h-[95vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col" 
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b gap-2" 
          style={{ borderColor: colors.border.primary }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full">
            <h2 className="text-lg sm:text-xl font-semibold" style={{ color: colors.text.primary }}>
              Pagamento Multi-Tavolo
            </h2>
            {tavoliUnici.length > 1 && (
              <select
                value={tavoloFilter}
                onChange={(e) => setTavoloFilter(e.target.value)}
                className="px-3 py-1 rounded-lg text-sm w-full sm:w-auto"
                style={{
                  backgroundColor: colors.bg.darker,
                  color: colors.text.primary,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <option value="tutti">Tutti i tavoli</option>
                {tavoliUnici.map(tavolo => (
                  <option key={tavolo} value={tavolo}>
                    {tavolo === 'Asporto' ? 'Asporto' : `Tavolo ${tavolo}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Left: Orders List */}
          <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r overflow-y-auto p-3 sm:p-4 max-h-[30vh] sm:max-h-none" 
            style={{ borderColor: colors.border.primary }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Seleziona Ordini ({ordiniFiltrati.length})
            </h3>
            <div className="space-y-2">
              {ordiniFiltrati.map(order => (
                <div
                  key={order.id}
                  onClick={() => toggleOrderSelection(order.id)}
                  className="p-3 rounded-lg cursor-pointer transition-all"
                  style={{
                    backgroundColor: selectedOrders.has(order.id) ? colors.bg.hover : colors.bg.darker,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: selectedOrders.has(order.id) ? colors.text.primary : colors.border.secondary
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        #{order.numero}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded" 
                        style={{ 
                          backgroundColor: colors.bg.hover,
                          color: colors.text.secondary 
                        }}
                      >
                        {order.tavolo ? `Tavolo ${order.tavolo.numero}` : 'Asporto'}
                      </span>
                    </div>
                    {order.nomeCliente && (
                      <span className="text-xs" style={{ color: colors.text.muted }}>
                        {order.nomeCliente}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: colors.text.secondary }}>
                      {order.righe.filter(r => !r.isPagato).length} articoli
                    </span>
                    <span className="font-medium" style={{ color: colors.text.primary }}>
                      €{order.rimanente.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Items List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Seleziona Prodotti e Quantità
            </h3>
            
            {selectedOrders.size === 0 ? (
              <div className="text-center py-8" style={{ color: colors.text.muted }}>
                Seleziona almeno un ordine per vedere i prodotti
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(selectedOrders).map(orderId => {
                  const order = orders.find(o => o.id === orderId);
                  if (!order) return null;
                  
                  return (
                    <div key={orderId} className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm" style={{ color: colors.text.primary }}>
                          Ordine #{order.numero}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded" 
                          style={{ 
                            backgroundColor: colors.bg.hover,
                            color: colors.text.secondary 
                          }}
                        >
                          {order.tavolo ? `Tavolo ${order.tavolo.numero}` : 'Asporto'}
                        </span>
                      </div>
                      {order.righe.filter(r => !r.isPagato).map(item => {
                        const key = `${orderId}-${item.id}`;
                        const selected = selectedItems.has(key);
                        const selectedItem = selectedItems.get(key);
                        
                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg transition-all"
                            style={{
                              backgroundColor: selected ? colors.bg.hover : colors.bg.darker,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: selected ? colors.text.primary : colors.border.secondary
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div 
                                className="flex items-center gap-3 flex-1 cursor-pointer"
                                onClick={() => toggleItemSelection(orderId, order.numero, item)}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {}}
                                  className="w-4 h-4"
                                  style={{ accentColor: colors.text.primary }}
                                />
                                <div className="flex-1">
                                  <div style={{ color: colors.text.primary }}>
                                    {item.prodotto.nome}
                                  </div>
                                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                                    €{item.prezzo.toFixed(2)} × {item.quantita} = €{(item.prezzo * item.quantita).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              
                              {selected && selectedItem && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateQuantity(key, -1)}
                                    disabled={selectedItem.quantita <= 1}
                                    className="p-1 rounded transition-colors disabled:opacity-50"
                                    style={{ backgroundColor: colors.bg.card }}
                                  >
                                    <Minus className="h-4 w-4" style={{ color: colors.text.secondary }} />
                                  </button>
                                  <span className="w-12 text-center font-medium" 
                                    style={{ color: colors.text.primary }}
                                  >
                                    {selectedItem.quantita}
                                  </span>
                                  <button
                                    onClick={() => updateQuantity(key, 1)}
                                    disabled={selectedItem.quantita >= item.quantita}
                                    className="p-1 rounded transition-colors disabled:opacity-50"
                                    style={{ backgroundColor: colors.bg.card }}
                                  >
                                    <Plus className="h-4 w-4" style={{ color: colors.text.secondary }} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Summary - Hidden on mobile, shown as footer */}
          <div className="hidden sm:flex w-80 border-l p-4 flex-col" 
            style={{ borderColor: colors.border.primary }}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
              Riepilogo Pagamento
            </h3>
            
            {/* Selected Items Summary */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {Array.from(selectedItems.values()).map(item => {
                const order = orders.find(o => o.id === item.orderId);
                return (
                  <div key={`${item.orderId}-${item.itemId}`} 
                    className="p-2 rounded" 
                    style={{ backgroundColor: colors.bg.darker }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm" style={{ color: colors.text.primary }}>
                          {item.prodottoNome}
                        </div>
                        <div className="text-xs flex items-center gap-1" style={{ color: colors.text.muted }}>
                          <span>#{item.orderNumero}</span>
                          <span>•</span>
                          <span>{order?.tavolo ? `Tav. ${order.tavolo.numero}` : 'Asporto'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                          €{(item.quantita * item.prezzo).toFixed(2)}
                        </div>
                        <div className="text-xs" style={{ color: colors.text.secondary }}>
                          {item.quantita} × €{item.prezzo.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Total */}
            <div className="border-t pt-3 mb-4" style={{ borderColor: colors.border.secondary }}>
              <div className="flex justify-between text-lg font-semibold">
                <span style={{ color: colors.text.primary }}>Totale</span>
                <span style={{ color: colors.text.primary }}>€{totale.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Customer Name */}
            <div className="mb-4 relative">
              <label className="block text-sm font-medium mb-1" 
                style={{ color: colors.text.secondary }}
              >
                Nome Cliente *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                  style={{ color: colors.text.secondary }}
                />
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => handleClienteNomeChange(e.target.value)}
                  onFocus={() => {
                    if (clienteNome.length === 0 && recentClienti.length > 0) {
                      setSuggestions(recentClienti);
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  placeholder="Inserisci nome cliente..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: colors.bg.darker,
                    color: colors.text.primary,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                />
              </div>
              
              {/* Autocomplete Suggestions */}
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
            
            {/* Payment Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" 
                style={{ color: colors.text.secondary }}
              >
                Metodo di Pagamento
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalita('POS')}
                  className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: modalita === 'POS' ? colors.button.primary : colors.bg.darker,
                    color: modalita === 'POS' ? colors.button.primaryText : colors.text.secondary
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  POS
                </button>
                <button
                  onClick={() => setModalita('CONTANTI')}
                  className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: modalita === 'CONTANTI' ? colors.button.primary : colors.bg.darker,
                    color: modalita === 'CONTANTI' ? colors.button.primaryText : colors.text.secondary
                  }}
                >
                  <Banknote className="h-4 w-4" />
                  Contanti
                </button>
                <button
                  onClick={() => setModalita('MISTO')}
                  className="flex-1 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: modalita === 'MISTO' ? colors.button.primary : colors.bg.darker,
                    color: modalita === 'MISTO' ? colors.button.primaryText : colors.text.secondary
                  }}
                >
                  Misto
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
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.button.secondary || colors.bg.hover,
                  color: colors.button.secondaryText || colors.text.primary
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                disabled={!clienteNome.trim() || selectedItems.size === 0 || isProcessing}
                className="flex-1 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.button.success,
                  color: colors.button.successText
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    Paga €{totale.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Footer Summary */}
        <div className="sm:hidden border-t p-3 bg-opacity-95" 
          style={{ 
            borderColor: colors.border.primary,
            backgroundColor: colors.bg.card 
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: colors.text.secondary }}>
              Selezionati: {selectedItems.size} prodotti
            </span>
            <span className="text-lg font-bold" style={{ color: colors.text.primary }}>
              €{totale.toFixed(2)}
            </span>
          </div>
          
          {/* Cliente input mobile */}
          <div className="mb-2">
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => handleClienteSearch(e.target.value)}
              placeholder="Nome cliente *"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: colors.bg.darker,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            />
          </div>
          
          {/* Payment buttons mobile */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleClose}
              className="py-2 px-3 rounded-lg text-sm"
              style={{
                backgroundColor: colors.button.secondary || colors.bg.hover,
                color: colors.button.secondaryText || colors.text.primary
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={!clienteNome.trim() || selectedItems.size === 0 || isProcessing}
              className="py-2 px-3 rounded-lg text-sm disabled:opacity-50"
              style={{
                backgroundColor: colors.button.success,
                color: colors.button.successText
              }}
            >
              Paga €{totale.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}