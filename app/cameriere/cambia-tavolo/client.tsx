"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowLeftRight, MapPin, Users, Clock, ChevronRight, Search, Merge, Check, X, Info, ArrowRight, CheckCircle, AlertCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useCameriere } from "@/contexts/cameriere-context";
import { 
  getTavoliLiberi, 
  getOrderDetailsForTable, 
  spostaOrdiniSelezionati,
  spostaProdottiSelezionati,
  cambiaOrdineTavolo 
} from "@/lib/actions/cambio-tavolo";
import { toast } from "@/lib/toast";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";
import { StatoTavolo } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface Table {
  id: number;
  numero: string;
  stato: StatoTavolo;
  zona: string;
  hasActiveOrders: boolean;
}

interface OrderDetail {
  id: string;
  tavolo: { numero: string };
  totale: Decimal;
  dataApertura: Date;
  stato: string;
  User: { nome: string };
  RigaOrdinazione: Array<{
    id: string;
    quantita: number;
    prezzo: Decimal;
    ordinazioneId: string;
    Prodotto: {
      id: number;
      nome: string;
      categoria: string;
      prezzo: Decimal;
    };
  }>;
}

interface SelectedProduct {
  rigaId: string;
  ordinazioneId: string;
  prodottoId: number;
  nome: string;
  quantita: number;
  quantitaSelezionata: number;
  prezzo: number;
}

interface CambiaTavoloPageProps {
  userId?: string;
}

export default function CambiaTavoloClient({ userId }: CambiaTavoloPageProps) {
  const [sourceTable, setSourceTable] = useState<string>("");
  const [destinationTable, setDestinationTable] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [sourceOrders, setSourceOrders] = useState<OrderDetail[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [searchSource, setSearchSource] = useState("");
  const [searchDest, setSearchDest] = useState("");
  const [operationType, setOperationType] = useState<'move' | 'merge' | 'products'>('move');
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOperation, setLastOperation] = useState<{ type: string; from: string; to: string; count: number } | null>(null);
  
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { setIsConnected } = useCameriere();

  // SSE for real-time updates
  const { isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-cambia-tavolo",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      if (notification.type === "table:updated" || notification.type === "order:updated") {
        loadAvailableTables();
        if (sourceTable) {
          loadSourceOrders(sourceTable);
        }
      }
    }
  });

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  useEffect(() => {
    loadAvailableTables();
  }, []);

  useEffect(() => {
    if (sourceTable) {
      loadSourceOrders(sourceTable);
      setSelectedProducts([]);
      setExpandedOrders([]);
    } else {
      setSourceOrders([]);
      setSelectedProducts([]);
      setExpandedOrders([]);
    }
  }, [sourceTable]);

  const loadAvailableTables = async () => {
    try {
      const tables = await getTavoliLiberi();
      setAvailableTables(tables);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast.error("Errore nel caricamento dei tavoli");
    }
  };

  const loadSourceOrders = async (tableNumber: string) => {
    setIsLoading(true);
    try {
      const orders = await getOrderDetailsForTable(tableNumber);
      console.log("Orders loaded:", orders);
      setSourceOrders(orders as any);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Errore nel caricamento degli ordini");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleProductSelection = (product: any, orderId: string, quantita: number) => {
    const existingIndex = selectedProducts.findIndex(
      p => p.rigaId === product.id
    );

    if (existingIndex >= 0) {
      // Se già selezionato, rimuovi
      setSelectedProducts(prev => prev.filter(p => p.rigaId !== product.id));
    } else {
      // Aggiungi nuovo prodotto selezionato
      setSelectedProducts(prev => [...prev, {
        rigaId: product.id,
        ordinazioneId: orderId,
        prodottoId: product.Prodotto.id,
        nome: product.Prodotto.nome,
        quantita: product.quantita,
        quantitaSelezionata: product.quantita, // Default: tutta la quantità
        prezzo: Number(product.prezzo)
      }]);
    }
  };

  const updateSelectedQuantity = (rigaId: string, newQuantity: number) => {
    setSelectedProducts(prev =>
      prev.map(p =>
        p.rigaId === rigaId
          ? { ...p, quantitaSelezionata: Math.min(newQuantity, p.quantita) }
          : p
      )
    );
  };

  const selectAllProductsFromOrder = (orderId: string) => {
    const order = sourceOrders.find(o => o.id === orderId);
    if (!order) return;

    const orderProducts = order.RigaOrdinazione.map(r => ({
      rigaId: r.id,
      ordinazioneId: orderId,
      prodottoId: r.Prodotto.id,
      nome: r.Prodotto.nome,
      quantita: r.quantita,
      quantitaSelezionata: r.quantita,
      prezzo: Number(r.prezzo)
    }));

    // Rimuovi eventuali prodotti già selezionati di questo ordine
    const otherProducts = selectedProducts.filter(p => p.ordinazioneId !== orderId);
    setSelectedProducts([...otherProducts, ...orderProducts]);
  };

  const deselectAllProductsFromOrder = (orderId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.ordinazioneId !== orderId));
  };

  const handleOperation = async () => {
    if (!sourceTable || !destinationTable) {
      toast.error("Seleziona sia il tavolo di origine che quello di destinazione");
      return;
    }

    if (sourceTable === destinationTable) {
      toast.error("I tavoli di origine e destinazione devono essere diversi");
      return;
    }

    if (sourceOrders.length === 0) {
      toast.error("Nessun ordine attivo sul tavolo di origine");
      return;
    }

    setIsChanging(true);
    try {
      let result: any;
      
      if (operationType === 'products' && selectedProducts.length > 0) {
        // Sposta prodotti selezionati
        if (!userId) {
          toast.error("Utente non autenticato");
          return;
        }
        
        const prodotti = selectedProducts.map(p => ({
          rigaId: p.rigaId,
          ordinazioneId: p.ordinazioneId,
          quantita: p.quantitaSelezionata,
          prodottoId: p.prodottoId,
          prezzo: p.prezzo
        }));
        
        result = await spostaProdottiSelezionati(
          sourceTable,
          destinationTable,
          prodotti,
          userId
        );
        
        if (result.success) {
          setLastOperation({
            type: 'products',
            from: sourceTable,
            to: destinationTable,
            count: selectedProducts.length
          });
        }
      } else if (operationType === 'move' || operationType === 'merge') {
        // Sposta o fondi ordini completi
        const orderIds = sourceOrders.map(o => o.id);
        result = await spostaOrdiniSelezionati(
          sourceTable,
          destinationTable,
          orderIds,
          operationType === 'merge'
        );
        
        if (result.success) {
          setLastOperation({
            type: operationType,
            from: sourceTable,
            to: destinationTable,
            count: orderIds.length
          });
        }
      }
      
      if (result?.success) {
        setShowSuccess(true);
        const action = operationType === 'merge' ? 'fusi' : operationType === 'products' ? 'prodotti spostati' : 'spostati';
        toast.success(`✅ Operazione completata con successo!`);
        
        // Reset state after animation
        setTimeout(() => {
          setSourceTable("");
          setDestinationTable("");
          setSourceOrders([]);
          setSelectedProducts([]);
          setExpandedOrders([]);
          setShowSuccess(false);
          loadAvailableTables();
        }, 2000);
      } else {
        toast.error(result?.error || "Errore durante l'operazione");
      }
    } catch (error) {
      console.error("Error in operation:", error);
      toast.error("Errore durante l'operazione");
    } finally {
      setIsChanging(false);
    }
  };

  const filteredSourceTables = availableTables.filter(table => 
    table.numero.toLowerCase().includes(searchSource.toLowerCase()) ||
    table.zona.toLowerCase().includes(searchSource.toLowerCase())
  );

  const filteredDestTables = availableTables.filter(table => 
    table.numero.toLowerCase().includes(searchDest.toLowerCase()) ||
    table.zona.toLowerCase().includes(searchDest.toLowerCase())
  );

  const getSelectedTotal = () => {
    return selectedProducts.reduce((sum, p) => sum + (p.prezzo * p.quantitaSelezionata), 0);
  };

  // Check if operation can proceed
  const canProceed = sourceTable && destinationTable && !isLoading && sourceOrders.length > 0 && 
    (operationType !== 'products' || selectedProducts.length > 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cameriere" 
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Cambia / Fondi Tavolo
            </h1>
          </div>
          <ConnectionStatusIndicator connectionHealth={connectionHealth} />
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Success Overlay */}
        {showSuccess && lastOperation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl p-8 text-center animate-bounce-in max-w-md">
              <CheckCircle className="h-20 w-20 mx-auto mb-4" style={{ color: '#10b981' }} />
              <h2 className="text-2xl font-bold mb-2" style={{ color: colors.text.primary }}>
                Operazione Completata!
              </h2>
              <p className="text-lg" style={{ color: colors.text.secondary }}>
                {lastOperation.type === 'products' 
                  ? `${lastOperation.count} prodotti spostati con successo`
                  : `${lastOperation.count} ordini ${lastOperation.type === 'merge' ? 'fusi' : 'spostati'} con successo`
                }
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: colors.bg.card }}>
                  Tavolo {lastOperation.from}
                </div>
                <ArrowRight className="h-5 w-5" style={{ color: colors.accent }} />
                <div className="px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: colors.accent, color: colors.button.primaryText }}>
                  Tavolo {lastOperation.to}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Operation Type Selector */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.muted }}>
            1. Scegli il tipo di operazione
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setOperationType('move')}
              className={`flex-1 p-4 rounded-lg font-medium transition-all transform ${
                operationType === 'move' ? 'scale-105 shadow-lg' : 'hover:scale-102'
              }`}
              style={{
                backgroundColor: operationType === 'move' ? colors.accent : colors.bg.card,
                color: operationType === 'move' ? colors.button.primaryText : colors.text.primary,
                borderColor: operationType === 'move' ? colors.accent : colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <ArrowLeftRight className="h-6 w-6 mx-auto mb-2" />
              <div className="text-base">Sposta Ordini</div>
              <div className="text-xs mt-1 opacity-80">
                Trasferisci ordini completi
              </div>
            </button>
            <button
              onClick={() => setOperationType('products')}
              className={`flex-1 p-4 rounded-lg font-medium transition-all transform ${
                operationType === 'products' ? 'scale-105 shadow-lg' : 'hover:scale-102'
              }`}
              style={{
                backgroundColor: operationType === 'products' ? colors.accent : colors.bg.card,
                color: operationType === 'products' ? colors.button.primaryText : colors.text.primary,
                borderColor: operationType === 'products' ? colors.accent : colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <Package className="h-6 w-6 mx-auto mb-2" />
              <div className="text-base">Sposta Prodotti</div>
              <div className="text-xs mt-1 opacity-80">
                Seleziona singoli prodotti
              </div>
            </button>
            <button
              onClick={() => setOperationType('merge')}
              className={`flex-1 p-4 rounded-lg font-medium transition-all transform ${
                operationType === 'merge' ? 'scale-105 shadow-lg' : 'hover:scale-102'
              }`}
              style={{
                backgroundColor: operationType === 'merge' ? colors.accent : colors.bg.card,
                color: operationType === 'merge' ? colors.button.primaryText : colors.text.primary,
                borderColor: operationType === 'merge' ? colors.accent : colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}
            >
              <Merge className="h-6 w-6 mx-auto mb-2" />
              <div className="text-base">Fondi Tavoli</div>
              <div className="text-xs mt-1 opacity-80">
                Unisci tutti gli ordini
              </div>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 p-4 rounded-lg flex items-start gap-3" style={{ 
          backgroundColor: operationType === 'merge' ? '#fef3c7' : operationType === 'products' ? '#e0e7ff' : '#dbeafe',
          borderColor: operationType === 'merge' ? '#f59e0b' : operationType === 'products' ? '#6366f1' : '#3b82f6',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <Info className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ 
            color: operationType === 'merge' ? '#f59e0b' : operationType === 'products' ? '#6366f1' : '#3b82f6' 
          }} />
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
              {operationType === 'merge' ? 'Fusione Tavoli' : operationType === 'products' ? 'Spostamento Prodotti' : 'Spostamento Ordini'}
            </p>
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              {operationType === 'move' 
                ? "Sposta ordini completi da un tavolo all'altro. Il tavolo di origine verrà liberato se non rimangono ordini."
                : operationType === 'products'
                  ? "Seleziona singoli prodotti da spostare. Verrà creato un nuovo ordine 'CONSEGNATO' sul tavolo di destinazione, pronto per il pagamento."
                  : "Tutti gli ordini del tavolo di origine verranno uniti a quelli del tavolo di destinazione. Il tavolo di origine verrà liberato."}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Source Table Selection */}
          <div>
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2" style={{ color: colors.text.primary }}>
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">2</span>
              Seleziona Tavolo di Origine
            </h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
              <input
                type="text"
                placeholder="Cerca tavolo occupato..."
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>

            {/* Table List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredSourceTables.filter(t => t.stato === 'OCCUPATO' && t.hasActiveOrders).length === 0 ? (
                <div className="text-center py-8" style={{ color: colors.text.muted }}>
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Nessun tavolo con ordini da spostare</p>
                  <p className="text-xs mt-2">Solo i tavoli con ordini non ancora pagati possono essere selezionati</p>
                </div>
              ) : (
                filteredSourceTables.map((table) => {
                  const isDisabled = table.stato !== 'OCCUPATO' || !table.hasActiveOrders;
                  const disabledReason = table.stato !== 'OCCUPATO' 
                    ? 'Tavolo libero' 
                    : !table.hasActiveOrders 
                      ? 'Nessun ordine attivo'
                      : '';
                  
                  return (
                    <button
                      key={table.id}
                      onClick={() => !isDisabled && setSourceTable(table.numero)}
                      disabled={isDisabled}
                      className={`w-full p-3 rounded-lg transition-all text-left ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-102'
                      } ${sourceTable === table.numero ? 'ring-2 shadow-md' : ''}`}
                      style={{
                        backgroundColor: sourceTable === table.numero ? colors.accent : isDisabled ? colors.bg.darker : colors.bg.card,
                        borderColor: sourceTable === table.numero ? colors.accent : colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        color: sourceTable === table.numero ? colors.button.primaryText : isDisabled ? colors.text.muted : colors.text.primary,
                        outlineColor: colors.accent
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {sourceTable === table.numero && <Check className="h-4 w-4" />}
                          {isDisabled && <X className="h-4 w-4" style={{ color: colors.text.muted }} />}
                          {!isDisabled && <MapPin className="h-4 w-4" />}
                          <span className="font-medium">Tavolo {table.numero}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm block" style={{ 
                            color: sourceTable === table.numero ? colors.button.primaryText : colors.text.muted 
                          }}>
                            {table.zona}
                          </span>
                          {isDisabled && (
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {disabledReason}
                            </span>
                          )}
                          {!isDisabled && table.stato === 'OCCUPATO' && (
                            <span className="text-xs" style={{ 
                              color: sourceTable === table.numero ? colors.button.primaryText : '#10b981' 
                            }}>
                              ✓ Ordini attivi
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Source Table Orders/Products */}
            {sourceTable && sourceOrders.length > 0 && (
              <div className="mt-4 p-4 rounded-lg animate-fade-in" style={{ 
                backgroundColor: colors.bg.darker,
                borderColor: colors.accent,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2" style={{ color: colors.text.primary }}>
                    <CheckCircle className="h-4 w-4" style={{ color: '#10b981' }} />
                    {sourceOrders.length} ordini attivi
                  </h4>
                </div>

                {operationType === 'products' ? (
                  // Modalità selezione prodotti
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sourceOrders.map((order) => {
                      const orderProducts = selectedProducts.filter(p => p.ordinazioneId === order.id);
                      const isExpanded = expandedOrders.includes(order.id);
                      
                      return (
                        <div key={order.id} className="border rounded-lg" style={{ borderColor: colors.border.secondary }}>
                          <button
                            onClick={() => toggleOrderExpanded(order.id)}
                            className="w-full p-2 flex items-center justify-between hover:bg-opacity-10"
                            style={{ backgroundColor: colors.bg.card }}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                Ordine #{order.id.slice(-6)} - {order.stato}
                              </span>
                              <span className="text-xs" style={{ color: colors.text.muted }}>
                                {order.User.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {orderProducts.length > 0 && (
                                <span className="text-xs px-2 py-1 rounded" style={{ 
                                  backgroundColor: colors.accent + '20',
                                  color: colors.accent 
                                }}>
                                  {orderProducts.length} selezionati
                                </span>
                              )}
                              <span className="text-sm font-bold" style={{ color: colors.accent }}>
                                €{Number(order.totale).toFixed(2)}
                              </span>
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="p-2 border-t" style={{ borderColor: colors.border.secondary }}>
                              <div className="flex justify-between mb-2">
                                <button
                                  onClick={() => {
                                    if (orderProducts.length === order.RigaOrdinazione.length) {
                                      deselectAllProductsFromOrder(order.id);
                                    } else {
                                      selectAllProductsFromOrder(order.id);
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{
                                    backgroundColor: colors.accent,
                                    color: colors.button.primaryText
                                  }}
                                >
                                  {orderProducts.length === order.RigaOrdinazione.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                                </button>
                              </div>
                              
                              {order.RigaOrdinazione.map((riga) => {
                                const isSelected = selectedProducts.some(p => p.rigaId === riga.id);
                                const selectedProduct = selectedProducts.find(p => p.rigaId === riga.id);
                                
                                return (
                                  <div 
                                    key={riga.id}
                                    className="flex items-center justify-between p-2 rounded mb-1 cursor-pointer"
                                    style={{ 
                                      backgroundColor: isSelected ? colors.accent + '20' : 'transparent',
                                      borderColor: isSelected ? colors.accent : 'transparent',
                                      borderWidth: '1px',
                                      borderStyle: 'solid'
                                    }}
                                    onClick={() => handleProductSelection(riga, order.id, riga.quantita)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isSelected ? (
                                        <CheckCircle className="h-4 w-4" style={{ color: colors.accent }} />
                                      ) : (
                                        <div className="h-4 w-4 rounded-full border" style={{ borderColor: colors.border.primary }} />
                                      )}
                                      <span className="text-sm" style={{ color: colors.text.primary }}>
                                        {riga.quantita}x {riga.Prodotto.nome}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isSelected && (
                                        <input
                                          type="number"
                                          min="1"
                                          max={riga.quantita}
                                          value={selectedProduct?.quantitaSelezionata || riga.quantita}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => updateSelectedQuantity(riga.id, parseInt(e.target.value) || 1)}
                                          className="w-16 px-2 py-1 text-xs rounded"
                                          style={{
                                            backgroundColor: colors.bg.input,
                                            color: colors.text.primary,
                                            borderColor: colors.border.primary,
                                            borderWidth: '1px',
                                            borderStyle: 'solid'
                                          }}
                                        />
                                      )}
                                      <span className="text-sm font-medium" style={{ color: colors.accent }}>
                                        €{(Number(riga.prezzo) * riga.quantita).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Modalità ordini completi
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sourceOrders.map((order) => (
                      <div key={order.id} className="p-2 rounded-lg" style={{ backgroundColor: 'transparent' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                            Ordine #{order.id.slice(-6)} - {order.stato}
                          </span>
                          <span className="text-sm font-bold" style={{ color: colors.accent }}>
                            €{Number(order.totale).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: colors.text.muted }}>
                          {order.User.nome} • {order.RigaOrdinazione.length} prodotti
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 mt-2 flex justify-between font-medium" style={{ 
                  borderTop: `1px solid ${colors.border.secondary}` 
                }}>
                  <span style={{ color: colors.text.primary }}>
                    {operationType === 'products' && selectedProducts.length > 0 
                      ? `✓ ${selectedProducts.length} prodotti selezionati`
                      : 'Totale'}
                  </span>
                  <span className="text-lg" style={{ color: colors.accent }}>
                    €{operationType === 'products' && selectedProducts.length > 0 
                      ? getSelectedTotal().toFixed(2)
                      : sourceOrders.reduce((sum, o) => sum + Number(o.totale), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Destination Table Selection */}
          <div>
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2" style={{ color: colors.text.primary }}>
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">3</span>
              Seleziona Tavolo di Destinazione
            </h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
              <input
                type="text"
                placeholder="Cerca tavolo destinazione..."
                value={searchDest}
                onChange={(e) => setSearchDest(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>

            {/* Table List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredDestTables.filter(t => t.numero !== sourceTable).length === 0 ? (
                <div className="text-center py-8" style={{ color: colors.text.muted }}>
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Nessun tavolo disponibile come destinazione</p>
                </div>
              ) : (
                filteredDestTables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setDestinationTable(table.numero)}
                    disabled={table.numero === sourceTable}
                    className={`w-full p-3 rounded-lg transition-all text-left ${
                      table.numero === sourceTable ? 'opacity-50 cursor-not-allowed' : 'hover:scale-102'
                    } ${destinationTable === table.numero ? 'ring-2 shadow-md' : ''}`}
                    style={{
                      backgroundColor: destinationTable === table.numero ? colors.accent : colors.bg.card,
                      borderColor: destinationTable === table.numero ? colors.accent : colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      color: destinationTable === table.numero ? colors.button.primaryText : colors.text.primary,
                      outlineColor: colors.accent
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {destinationTable === table.numero && <Check className="h-4 w-4" />}
                        <MapPin className="h-4 w-4" />
                        <span className="font-medium">Tavolo {table.numero}</span>
                      </div>
                      <span className="text-sm" style={{ 
                        color: destinationTable === table.numero ? colors.button.primaryText : colors.text.muted 
                      }}>
                        {table.zona} • {table.stato}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Button - Always visible when both tables selected */}
        {(sourceTable && destinationTable) && (
          <div className="mt-8 animate-fade-in">
            <div className="flex justify-center">
              <button
                onClick={handleOperation}
                disabled={!canProceed || isChanging}
                className="px-8 py-4 rounded-lg font-medium text-lg flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg"
                style={{
                  backgroundColor: !canProceed ? colors.bg.card : colors.accent,
                  color: !canProceed ? colors.text.muted : colors.button.primaryText,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {isChanging ? (
                  <>
                    <Clock className="h-6 w-6 animate-spin" />
                    Operazione in corso...
                  </>
                ) : !canProceed && isLoading ? (
                  <>
                    <Clock className="h-6 w-6 animate-spin" />
                    Caricamento ordini...
                  </>
                ) : !canProceed && sourceOrders.length === 0 ? (
                  <>
                    <AlertCircle className="h-6 w-6" />
                    Nessun ordine sul tavolo origine
                  </>
                ) : operationType === 'products' && selectedProducts.length === 0 ? (
                  <>
                    <AlertCircle className="h-6 w-6" />
                    Seleziona almeno un prodotto
                  </>
                ) : (
                  <>
                    {operationType === 'merge' ? (
                      <Merge className="h-6 w-6" />
                    ) : operationType === 'products' ? (
                      <Package className="h-6 w-6" />
                    ) : (
                      <ArrowLeftRight className="h-6 w-6" />
                    )}
                    Conferma {operationType === 'merge' ? 'Fusione' : operationType === 'products' ? 'Spostamento Prodotti' : 'Spostamento'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}