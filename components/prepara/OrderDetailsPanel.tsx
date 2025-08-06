'use client';

import React, { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { Loader2, Check, ArrowLeft, ChefHat, RefreshCw, UserCheck, AlertCircle, Package, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useSSE } from '@/contexts/sse-context';
import type { OrderItem, Ordinazione } from '@/app/prepara/types';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { aggiornaStatoOrdinazione, segnaOrdineRitirato } from '@/lib/actions/ordinazioni';
import OrderInfo from './OrderInfo';
import OrderItemsList from './OrderItemsList';
import OrderActionButtons from './OrderActionButtons';
import MergeRequestsList from './MergeRequestsList';
import OrderNotesDisplay from './OrderNotesDisplay';
import MultiOutOfStockSelector from './MultiOutOfStockSelector';
import { WaiterSelectionModal } from './WaiterSelectionModal';


interface OrderDetailsPanelProps {
  order: Ordinazione;
  orders: Ordinazione[];
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  isLoading: boolean;
  onStartPreparation: () => void;
  isStartingPreparation: boolean;
  currentTheme: any;
  themeMode: string;
  setSelectedProductForProcedure: (product: { name: string; id: number | null; quantity: number } | null) => void;
  setShowProcedureModal: (show: boolean) => void;
  setSelectedProductForAvailability: (product: any) => void;
  setShowAvailabilityModal: (show: boolean) => void;
  setOrders: React.Dispatch<React.SetStateAction<Ordinazione[]>>;
  selectedOrder: Ordinazione | null;
  setSelectedOrder: React.Dispatch<React.SetStateAction<Ordinazione | null>>;
  loadOrders: () => Promise<void>;
  setActiveTab: (tab: 'attesa' | 'preparazione' | 'pronti' | 'ritirati' | 'esauriti') => void;
  setIsCompletingOrder: (value: boolean) => void;
  mergeRequests: any[];
  onAcceptMerge: (richiestaId: string) => Promise<void>;
  onRejectMerge: (richiestaId: string) => Promise<void>;
  processingMergeRequest: string | null;
  isLoadingMergeRequests: boolean;
  productProcedureCache: Map<number, boolean>;
  ongoingTransitions: Set<string>;
  setOngoingTransitions: React.Dispatch<React.SetStateAction<Set<string>>>;
  isCompletingOrder?: boolean;
  setSelectedProductForOutOfStock?: (product: any) => void;
  setAffectedItemsForOutOfStock?: (items: any[]) => void;
  setShowOutOfStockModal?: (show: boolean) => void;
  setPendingOutOfStockProduct?: (product: any) => void;
  setShowOutOfStockQuantityModal?: (show: boolean) => void;
}

function OrderDetailsPanel({
  order,
  orders,
  onStatusChange,
  processingItems,
  isLoading,
  onStartPreparation,
  isStartingPreparation,
  currentTheme,
  themeMode,
  setSelectedProductForProcedure,
  setShowProcedureModal,
  setSelectedProductForAvailability,
  setShowAvailabilityModal,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  loadOrders,
  setActiveTab,
  setIsCompletingOrder,
  mergeRequests,
  onAcceptMerge,
  onRejectMerge,
  processingMergeRequest,
  isLoadingMergeRequests,
  productProcedureCache,
  ongoingTransitions,
  setOngoingTransitions,
  isCompletingOrder = false,
  setSelectedProductForOutOfStock,
  setAffectedItemsForOutOfStock,
  setShowOutOfStockModal,
  setPendingOutOfStockProduct,
  setShowOutOfStockQuantityModal
}: OrderDetailsPanelProps) {
  console.log('[OrderDetailsPanel] Rendering with order:', order?.id, 'items:', order?.items?.length);
  
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isCheckingOrders, setIsCheckingOrders] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [takenBy, setTakenBy] = useState<string | null>(null);
  const [showWaiterSelectionModal, setShowWaiterSelectionModal] = useState(false);
  const [isMarkingAsDelivered, setIsMarkingAsDelivered] = useState(false);
  const sseContext = useSSE();
  
  // Sottoscrivi agli eventi di presa in carico ordini esauriti
  useEffect(() => {
    if (!sseContext?.subscribe || !order) return;
    
    const unsubTaken = sseContext.subscribe('order:esaurito:taken', (data) => {
      if (data.orderId === order.id) {
        setTakenBy(data.takenBy);
        console.log('[OrderDetailsPanel] Order taken by:', data.takenBy);
      }
    });
    
    const unsubReleased = sseContext.subscribe('order:esaurito:released', (data) => {
      if (data.orderId === order.id) {
        setTakenBy(null);
      }
    });
    
    // Estrai chi ha preso in carico dalle note se presente
    if (order.note && order.note.includes('preso in carico da')) {
      const match = order.note.match(/preso in carico da ([^|]+)/);
      if (match) {
        setTakenBy(match[1].split(' alle')[0].trim());
      }
    }
    
    return () => {
      unsubTaken();
      unsubReleased();
    };
  }, [sseContext, order?.id, order?.note]);
  
  // Controlla ordini in coda quando si inizia la preparazione - DISABILITATO per evitare confusione
  // Il merge automatico è già gestito nel backend quando si crea un nuovo ordine
  useEffect(() => {
    // Disabilitato per evitare duplicazioni e confusione
    // Il backend già gestisce il merge automatico degli ordini
  }, [order.id, order.stato, order.tavolo]);
  
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return { text: `${minutes}m`, minutes };
    return { text: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
  };
  
  // Check if a product has a procedure
  const checkProductProcedure = async (productId: number): Promise<boolean> => {
    // Check cache first
    if (productProcedureCache.has(productId)) {
      return productProcedureCache.get(productId) || false;
    }
    
    try {
      const response = await fetch(`/api/products/procedures?productId=${productId}`);
      if (!response.ok) {
        // Cache negative result
        productProcedureCache.set(productId, false);
        return false;
      }
      
      const data = await response.json();
      const hasProcedure = data && data.ProcedureStep && data.ProcedureStep.length > 0;
      
      // Cache the result
      productProcedureCache.set(productId, hasProcedure);
      return hasProcedure;
    } catch (error) {
      console.error("Errore verifica procedura:", error);
      // Cache negative result on error
      productProcedureCache.set(productId, false);
      return false;
    }
  };
  
  const handleProductOutOfStock = async (item: OrderItem) => {
    console.log('[OrderDetailsPanel] handleProductOutOfStock called for item:', item);
    if (!item.prodottoId) {
      console.log('[OrderDetailsPanel] No prodottoId, returning');
      return;
    }
    
    // Controlla se ci sono altri prodotti nell'ordine
    const hasOtherItems = order.items.length > 1 || 
                          order.items.some((i: OrderItem) => i.id !== item.id && i.quantita > 1);
    
    // Se la quantità è > 1, mostra il modal per chiedere quanti sono esauriti
    if (item.quantita > 1) {
      console.log('[OrderDetailsPanel] Quantity > 1, showing modal');
      setSelectedProductForOutOfStock?.({
        id: item.prodottoId,
        name: item.prodotto
      });
      setAffectedItemsForOutOfStock?.([
        {
          id: item.id,
          orderId: order.id,
          orderNumber: order.numero,
          tableNumber: order.tavolo,
          quantity: item.quantita
        }
      ]);
      setShowOutOfStockModal?.(true);
    } else {
      // Se la quantità è 1, chiedi cosa fare se ci sono altri prodotti
      console.log('[OrderDetailsPanel] Quantity = 1, checking if should ask for split/block');
      
      let shouldSplit = true; // Default: dividi l'ordine
      
      // Se ci sono altri prodotti, chiedi all'utente
      if (hasOtherItems) {
        const userChoice = confirm(
          `L'ordine contiene altri prodotti disponibili.\n\n` +
          `Vuoi:\n` +
          `• OK = Dividere l'ordine (prodotti disponibili proseguono)\n` +
          `• Annulla = Bloccare tutto l'ordine fino alla gestione del cameriere`
        );
        shouldSplit = userChoice;
      }
      
      try {
        const { markProductAsOutOfStock } = await import('@/lib/actions/out-of-stock');
        console.log('[OrderDetailsPanel] Calling markProductAsOutOfStock with:', {
          productId: item.prodottoId,
          itemIds: [item.id],
          splitOrder: shouldSplit
        });
        
        const result = await markProductAsOutOfStock(item.prodottoId, [item.id], shouldSplit);
        
        console.log('[OrderDetailsPanel] markProductAsOutOfStock result:', result);
        
        if (result.success) {
          const message = shouldSplit 
            ? `${item.prodotto} segnato come esaurito - Ordine diviso`
            : `${item.prodotto} segnato come esaurito - Ordine bloccato`;
          toast.success(message);
          
          console.log('[OrderDetailsPanel] Success! Reloading orders and switching to esauriti tab');
          // Ricarica gli ordini
          await loadOrders();
          
          // Cambia tab a 'esauriti'
          setActiveTab('esauriti');
        } else {
          console.log('[OrderDetailsPanel] Error:', result.error);
          toast.error(result.error || 'Errore nel segnare il prodotto come esaurito');
        }
      } catch (error) {
        console.error('Errore:', error);
        toast.error('Errore nel segnare il prodotto come esaurito');
      }
    }
  };
  
  const handleProductClick = async (item: OrderItem) => {
    if (!item.prodottoId) return;
    
    // Show availability modal for the product
    const productData = {
      id: item.prodottoId,
      nome: item.prodotto,
      prezzo: item.prezzo,
      categoria: '',
      postazione: item.postazione,
      codice: null,
      disponibile: true,
      ingredienti: null
    };
    
    setSelectedProductForAvailability(productData);
    setShowAvailabilityModal(true);
    
    // Also check for procedure
    const hasProcedure = await checkProductProcedure(item.prodottoId);
    if (hasProcedure) {
      setSelectedProductForProcedure({
        name: item.prodotto,
        id: item.prodottoId || null,
        quantity: item.quantita
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="rounded-lg shadow-sm" style={{ 
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}>
        <div className="p-4 sm:p-5 md:p-6">
          {/* Title skeleton */}
          <div className="h-7 rounded w-40 mb-4 animate-pulse" style={{ backgroundColor: colors.bg.hover }}></div>
          
          {/* Order info skeleton */}
          <div className="pb-4 mb-4 border-b animate-pulse" style={{ borderColor: colors.border.primary }}>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-6 rounded w-32" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-4 rounded w-28" style={{ backgroundColor: colors.bg.hover }}></div>
              </div>
              <div className="h-7 rounded w-20" style={{ backgroundColor: colors.bg.hover }}></div>
            </div>
          </div>
          
          {/* Items list skeleton */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 rounded w-36" style={{ backgroundColor: colors.bg.hover }}></div>
              <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
            </div>
            {/* Item skeletons */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg animate-pulse" style={{ backgroundColor: colors.bg.hover }}>
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-5 w-5 rounded" style={{ backgroundColor: colors.bg.card }}></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-5 rounded w-3/4" style={{ backgroundColor: colors.bg.card }}></div>
                    <div className="flex gap-4">
                      <div className="h-4 rounded w-16" style={{ backgroundColor: colors.bg.card }}></div>
                      <div className="h-4 rounded w-20" style={{ backgroundColor: colors.bg.card }}></div>
                    </div>
                  </div>
                </div>
                <div className="h-4 rounded w-16" style={{ backgroundColor: colors.bg.card }}></div>
              </div>
            ))}
          </div>
          
          {/* Action buttons skeleton */}
          <div className="flex justify-center gap-3">
            <div className="h-12 rounded-lg w-32 animate-pulse" style={{ backgroundColor: colors.bg.hover }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg shadow-sm relative" style={{ 
      backgroundColor: colors.bg.card,
      borderColor: colors.border.primary,
      borderWidth: '1px',
      borderStyle: 'solid'
    }}>
      {/* Multi out of stock selector - positioned absolutely */}
      {(order.stato === 'ORDINATO' || order.stato === 'IN_PREPARAZIONE') && (
        <MultiOutOfStockSelector
          orderItems={order.items as any}
          onConfirm={async (selectedItems, shouldSplit) => {
            console.log('[MultiOutOfStock] Selected items:', selectedItems, 'shouldSplit:', shouldSplit);
            
            // Gestisci tutti i prodotti selezionati insieme
            if (selectedItems.length > 0) {
              const { markMultipleProductsAsOutOfStock } = await import('@/lib/actions/out-of-stock');
              
              // Prepara i prodotti per la funzione
              const products = selectedItems.map(item => ({
                productId: item.productId,
                orderItemId: item.itemId,
                outOfStockQuantity: item.quantity
              }));
              
              // Chiama la funzione che gestisce tutti i prodotti insieme
              const result = await markMultipleProductsAsOutOfStock(products, shouldSplit);
              
              if (result.success) {
                console.log('message' in result ? result.message : 'Prodotti segnati come esauriti');
                // Refresh orders
                await loadOrders();
                setActiveTab('esauriti');
              } else {
                console.error('Error marking products as out of stock:', result.error);
              }
            }
          }}
        />
      )}
      
      <div className="p-4 sm:p-5 md:p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
          Dettaglio Ordine
        </h2>
        
        {/* Alert if order is ORDINATO_ESAURITO */}
        {order.stato === 'ORDINATO_ESAURITO' && (
          <div className={`rounded-lg p-4 mb-4 ${takenBy ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'} border-2`}>
            <div className="flex items-center gap-3">
              {takenBy ? (
                <>
                  <UserCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                      {takenBy} sta gestendo il problema
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      I prodotti esauriti verranno sostituiti o rimossi dall'ordine
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 animate-pulse" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-100">
                      Ordine con prodotti esauriti
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      In attesa che un cameriere prenda in gestione il problema
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Order Info */}
        <div className="flex justify-between items-start pb-4 mb-4 border-b" style={{ borderColor: colors.border.primary }}>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              {order.tavolo ? `Tavolo ${order.tavolo}` : order.nomeCliente || 'Cliente'}
            </h3>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Ordine • {getTimeElapsed(order.timestamp).text} fa
            </p>
            {order.cameriere && (
              <p className="text-sm mt-1" style={{ 
                color: colors.text.muted, 
                fontStyle: 'italic',
                opacity: 0.8
              }}>
                {order.cameriere}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold" style={{ color: colors.text.accent }}>
              €{order.totaleCosto.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Items List */}
        <OrderItemsList
          order={order}
          items={order.items}
          processingItems={processingItems}
          onStatusChange={onStatusChange}
          onProductClick={handleProductClick}
          onOutOfStockClick={handleProductOutOfStock}
          productProcedureCache={productProcedureCache}
          orders={orders}
          colors={colors}
        />
        
        {/* Notes */}
        {order.note && (
          <OrderNotesDisplay note={order.note} orderId={order.id} colors={colors} />
        )}
        
        {/* Merge Requests */}
        {(mergeRequests.length > 0 || isLoadingMergeRequests) && (
          <div className="mb-4 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
              Richieste di aggiunta prodotti ({mergeRequests.length})
            </h3>
            {isLoadingMergeRequests ? (
              // Skeleton loader for merge requests
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border animate-pulse"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.primary
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-4 rounded w-32" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-16" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-48" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-40" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              mergeRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm" style={{ color: colors.text.secondary }}>
                      Richiesto da: {request.richiedenteName}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    {new Date(request.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="space-y-1 mb-3">
                  <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Prodotti da aggiungere:
                  </p>
                  {request.prodotti.map((p: any, idx: number) => (
                    <div key={idx} className="text-sm" style={{ color: colors.text.primary }}>
                      • {p.quantita}x {p.nome}
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptMerge(request.id)}
                    disabled={processingMergeRequest === request.id}
                    className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                    style={{
                      backgroundColor: colors.button.success,
                      color: colors.button.successText,
                      opacity: processingMergeRequest === request.id ? 0.6 : 1
                    }}
                  >
                    {processingMergeRequest === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      'Aggiungi all\'ordine'
                    )}
                  </button>
                  <button
                    onClick={() => onRejectMerge(request.id)}
                    disabled={processingMergeRequest === request.id}
                    className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                    style={{
                      backgroundColor: colors.text.error,
                      color: 'white',
                      opacity: processingMergeRequest === request.id ? 0.6 : 1
                    }}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {/* Pulsante Annulla Ordine - Disponibile per tutti gli stati tranne PAGATO e ANNULLATO */}
          {order.stato !== 'CONSEGNATO' && (
            <button
              onClick={async () => {
                const motivo = prompt('Motivo dell\'annullamento:');
                if (!motivo) return;
                
                setIsProcessingAction(true);
                try {
                  const { annullaOrdineDiretto } = await import('@/lib/actions/annullamento-ordini');
                  const result = await annullaOrdineDiretto(order.id, motivo);
                  
                  if (result.success) {
                    toast.success('message' in result && result.message ? result.message : 'Ordine annullato con successo');
                    
                    // Rimuovi l'ordine dalla lista
                    setOrders(prevOrders => prevOrders.filter(o => o.id !== order.id));
                    
                    if (selectedOrder?.id === order.id) {
                      setSelectedOrder(null);
                    }
                    
                    // Ricarica gli ordini
                    await loadOrders();
                  } else {
                    toast.error(result.error || 'Errore durante l\'annullamento');
                  }
                } catch (error) {
                  console.error('Errore annullamento:', error);
                  toast.error('Errore durante l\'annullamento dell\'ordine');
                } finally {
                  setIsProcessingAction(false);
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.text.error,
                color: 'white',
                cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.text.error}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}>
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Annullamento...
                </>
              ) : (
                <>
                  <X className="h-5 w-5" />
                  Annulla Ordine
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Torna Indietro - Disponibile per stati IN_PREPARAZIONE e PRONTO */}
          {(order.stato === 'IN_PREPARAZIONE' || order.stato === 'PRONTO') && (
            <button
              onClick={async () => {
                setIsProcessingAction(true);
                let transitionKey = '';
                try {
                  let nuovoStato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "RICHIESTA_CONTO" | "PAGATO" | "ANNULLATO";
                  
                  // Definisci lo stato precedente in base allo stato attuale
                  if (order.stato === 'IN_PREPARAZIONE') {
                    nuovoStato = 'ORDINATO';
                  } else if (order.stato === 'PRONTO') {
                    nuovoStato = 'IN_PREPARAZIONE';
                  } else {
                    return; // Non dovrebbe mai arrivare qui
                  }
                  
                  // Prevent duplicate state transitions
                  transitionKey = `${order.id}:${nuovoStato}`;
                  if (ongoingTransitions.has(transitionKey)) {
                    console.log('[Prepara] Transition already in progress, skipping');
                    return;
                  }
                  
                  setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                  
                  const result = await aggiornaStatoOrdinazione(order.id, nuovoStato);
                  
                  if (result.success) {
                    toast.success(`Ordine riportato allo stato ${nuovoStato}`);
                    
                    // Aggiorna lo stato locale
                    setOrders(prevOrders => prevOrders.map(o => 
                      o.id === order.id ? { ...o, stato: nuovoStato } : o
                    ));
                    
                    if (selectedOrder?.id === order.id) {
                      setSelectedOrder({ ...order, stato: nuovoStato });
                    }
                    
                    // Cambia tab in base al nuovo stato
                    if (nuovoStato === 'ORDINATO') {
                      setActiveTab('attesa');
                    } else if (nuovoStato === 'IN_PREPARAZIONE') {
                      setActiveTab('preparazione');
                    }
                    
                    // Ricarica gli ordini
                    setTimeout(() => loadOrders(), 300);
                  } else {
                    // Gestione errore con stati permessi
                    if (result.transizioniPermesse) {
                      toast.error(`${result.error}\nStati permessi: ${result.transizioniPermesse.join(', ')}`);
                    } else {
                      toast.error(result.error || 'Errore nel cambio stato');
                    }
                  }
                } catch (error) {
                  console.error('Errore cambio stato:', error);
                  toast.error('Errore durante il cambio stato');
                } finally {
                  setIsProcessingAction(false);
                  // Clean up transition key
                  if (transitionKey) {
                    setOngoingTransitions(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(transitionKey);
                      return newSet;
                    });
                  }
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid',
                color: isProcessingAction ? colors.text.muted : colors.text.primary,
                cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }
              }}>
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  In corso...
                </>
              ) : (
                <>
                  <ArrowLeft className="h-5 w-5" />
                  Torna Indietro
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Inizia - Solo quando l'ordine è in attesa (ORDINATO) */}
          {order.stato === 'ORDINATO' && order.items.every(item => item.stato === 'INSERITO') && (
            <button
              onClick={onStartPreparation}
              disabled={isStartingPreparation}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isStartingPreparation ? colors.bg.hover : colors.button.primary,
                color: isStartingPreparation ? colors.text.muted : colors.button.text,
                cursor: isStartingPreparation ? 'not-allowed' : 'pointer',
                transform: isStartingPreparation ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isStartingPreparation) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.primary}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isStartingPreparation) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}>
              {isStartingPreparation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Avvio in corso...
                </>
              ) : (
                <>
                  <ChefHat className="h-5 w-5" />
                  Inizia a Preparare
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Ritirato - Solo quando l'ordine è PRONTO */}
          {order.stato === 'PRONTO' && (
            <button
              onClick={() => {
                console.log('[OrderDetailsPanel] Opening waiter selection modal for order:', order.id, order.numero);
                setShowWaiterSelectionModal(true);
              }}
              disabled={isMarkingAsDelivered}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isMarkingAsDelivered ? colors.bg.hover : colors.button.success,
                color: isMarkingAsDelivered ? colors.text.muted : colors.button.successText,
                cursor: isMarkingAsDelivered ? 'not-allowed' : 'pointer',
                transform: isMarkingAsDelivered ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isMarkingAsDelivered) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.success}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isMarkingAsDelivered) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}>
              {isMarkingAsDelivered ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  In corso...
                </>
              ) : (
                <>
                  <Package className="h-5 w-5" />
                  Segna come Ritirato
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Finito - Quando l'ordine è in preparazione e non tutti i prodotti sono pronti */}
          {order.stato === 'IN_PREPARAZIONE' && 
           !order.items.every(item => item.stato === 'PRONTO') && (
            <button
              onClick={async () => {
                // Previeni doppi click
                if (isCompletingOrder || isProcessingAction) {
                  console.log('[Prepara] Ignorando click multiplo su Finito');
                  return;
                }
                
                setIsProcessingAction(true);
                setIsCompletingOrder(true);
                
                // Contatore per retry
                let retryCount = 0;
                const maxRetries = 3;
                
                const executeCompletion = async (): Promise<boolean> => {
                  try {
                    // Aggiorna TUTTI gli items in una sola volta
                    const itemsToComplete = order.items.filter(item => item.stato !== 'PRONTO' && item.stato !== 'CONSEGNATO');
                    
                    // Aggiorna tutti gli stati localmente in una sola volta
                    const updatedItems = order.items.map(item => ({
                      ...item,
                      stato: (item.stato === 'PRONTO' || item.stato === 'CONSEGNATO') ? item.stato : 'PRONTO'
                    }));
                    
                    // Aggiorna l'UI immediatamente per un feedback istantaneo
                    setOrders(prevOrders => prevOrders.map(o => 
                      o.id === order.id 
                        ? { ...o, items: updatedItems, stato: 'PRONTO' }
                        : o
                    ));
                    
                    // Se c'è un ordine selezionato, aggiornalo anche lui
                    if (selectedOrder?.id === order.id) {
                      setSelectedOrder({ ...order, items: updatedItems, stato: 'PRONTO' });
                    }
                    
                    // Usa la nuova funzione ottimizzata per completare tutti gli items
                    const { completaTuttiGliItems } = await import('@/lib/actions/ordinazioni');
                    
                    // Completa tutti gli items in una singola transazione veloce
                    const result = await completaTuttiGliItems(order.id);
                    
                    if (result.success) {
                      // Tutti i prodotti sono stati aggiornati con successo
                      toast.success('Tutti i prodotti sono pronti per la consegna');
                      
                      // Cambia tab immediatamente
                      setActiveTab('pronti');
                      
                      // Ricarica gli ordini con un delay maggiore per evitare race conditions
                      setTimeout(async () => {
                        try {
                          await loadOrders();
                        } catch (error) {
                          console.error('[Prepara] Errore nel reload ordini:', error);
                        } finally {
                          // Reset il flag sempre, anche in caso di errore
                          setIsCompletingOrder(false);
                        }
                      }, 300); // Aumentato da 50ms a 300ms per dare tempo al database
                      return true;
                    } else {
                      console.error('[Prepara] Errore completamento ordine:', result.error);
                      
                      // Se è un conflitto o timeout, prova a fare retry
                      if (result.error?.includes('Conflitto') || result.error?.includes('scaduta')) {
                        if (retryCount < maxRetries) {
                          retryCount++;
                          console.log(`[Prepara] Retry ${retryCount}/${maxRetries} per ordine ${order.id}`);
                          // Exponential backoff: 200ms, 400ms, 800ms
                          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                          return await executeCompletion();
                        }
                      }
                      
                      toast.error(result.error || 'Errore durante il completamento dell\'ordine');
                      // Ricarica gli ordini per sincronizzare con il backend
                      await loadOrders();
                      return false;
                    }
                  } catch (error) {
                    console.error('[Prepara] Errore generale nel completamento:', error);
                    
                    if (retryCount < maxRetries) {
                      retryCount++;
                      console.log(`[Prepara] Retry ${retryCount}/${maxRetries} dopo errore per ordine ${order.id}`);
                      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                      return await executeCompletion();
                    }
                    
                    toast.error('Errore durante il completamento dell\'ordine');
                    // Ricarica gli ordini per sincronizzare con il backend
                    await loadOrders();
                    return false;
                  }
                };
                
                try {
                  await executeCompletion();
                } catch (error) {
                  console.error('[Prepara] Errore nel completamento ordine:', error);
                  toast.error('Errore nel completamento dell\'ordine');
                  // Ricarica gli ordini in caso di errore
                  loadOrders();
                } finally {
                  setIsProcessingAction(false);
                  // Reset anche qui in caso di errore con un delay maggiore
                  setTimeout(() => {
                    console.log('[Prepara] Reset completamento ordine flag (finally)');
                    setIsCompletingOrder(false);
                  }, 500); // Aumentato a 500ms per essere sicuri
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.button.success,
                color: isProcessingAction ? colors.text.muted : 'white',
                boxShadow: `0 2px 8px ${colors.button.success}30`,
                cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.success}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.button.success}30`;
                }
              }}>
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Completamento...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Finito!
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Riattiva Prodotti - Solo per ordini ORDINATO_ESAURITO */}
          {order.stato === 'ORDINATO_ESAURITO' && (
            <button
              onClick={async () => {
                if (isProcessingAction) return;
                
                setIsProcessingAction(true);
                
                try {
                  // Trova tutti i prodotti unici negli items dell'ordine
                  const uniqueProductIds = [...new Set(order.items
                    .filter(item => item.prodottoId)
                    .map(item => item.prodottoId)
                  )] as number[];
                  
                  const { reactivateProductAfterOutOfStock } = await import('@/lib/actions/out-of-stock');
                  
                  // Riattiva tutti i prodotti
                  for (const productId of uniqueProductIds) {
                    await reactivateProductAfterOutOfStock(productId);
                  }
                  
                  // Aggiorna lo stato dell'ordine a CONSEGNATO
                  const { aggiornaStatoOrdinazione } = await import('@/lib/actions/ordinazioni');
                  await aggiornaStatoOrdinazione(order.id, 'CONSEGNATO');
                  
                  toast.success('Prodotti riattivati e ordine completato');
                  
                  // Ricarica gli ordini
                  await loadOrders();
                  
                  // Cambia tab a 'ritirati'
                  setActiveTab('ritirati');
                } catch (error) {
                  console.error('Errore riattivazione prodotti:', error);
                  toast.error('Errore nella riattivazione dei prodotti');
                } finally {
                  setIsProcessingAction(false);
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.button.success,
                color: isProcessingAction ? colors.text.muted : 'white',
                cursor: isProcessingAction ? 'not-allowed' : 'pointer'
              }}
            >
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Riattivazione...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Gestisci e Riattiva Prodotti
                </>
              )}
            </button>
          )}
          
        </div>
      </div>
      
      {/* Merge Dialog */}
      <ThemedModal
        isOpen={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        title="Ordini in coda per questo tavolo"
        size="md"
      >
        <div className="space-y-4">
          <p style={{ color: colors.text.primary }}>
            Ci sono {pendingOrders.length} ordini in coda per il tavolo {order.tavolo}.
            Vuoi prepararli insieme?
          </p>
          
          {/* Lista ordini in coda */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingOrders.map((pendingOrder) => (
              <div 
                key={pendingOrder.id}
                className="p-3 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium" style={{ color: colors.text.primary }}>
                      Ordine #{pendingOrder.numero}
                    </p>
                    <p className="text-sm" style={{ color: colors.text.muted }}>
                      {pendingOrder.RigaOrdinazione?.length || 0} prodotti - €{pendingOrder.totale?.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {new Date(pendingOrder.dataApertura).toLocaleTimeString('it-IT')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pulsanti azione */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowMergeDialog(false)}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.darker;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              No, prepara separatamente
            </button>
            <button
              onClick={async () => {
                try {
                  // Aggiungi tutti i prodotti degli ordini in coda all'ordine corrente
                  for (const pendingOrder of pendingOrders) {
                    // Prevent duplicate state transitions
                    const transitionKey = `${pendingOrder.id}:IN_PREPARAZIONE`;
                    if (!ongoingTransitions.has(transitionKey)) {
                      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                      
                      try {
                        // Aggiorna stato ordine a IN_PREPARAZIONE
                        await aggiornaStatoOrdinazione(pendingOrder.id, 'IN_PREPARAZIONE');
                        
                        // Aggiungi notifica di merge
                        toast.success(`Ordine #${pendingOrder.numero} unificato`);
                      } finally {
                        // Clean up transition key
                        setOngoingTransitions(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(transitionKey);
                          return newSet;
                        });
                      }
                    }
                  }
                  
                  setShowMergeDialog(false);
                  
                  // Ricarica gli ordini per aggiornare la vista
                  window.location.reload();
                } catch (error) {
                  toast.error('Errore durante unificazione ordini');
                }
              }}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.button.primaryHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.button.primary;
              }}
            >
              Sì, prepara insieme
            </button>
          </div>
        </div>
      </ThemedModal>
      
      {/* Modal for Waiter Selection */}
      <WaiterSelectionModal
        isOpen={showWaiterSelectionModal}
        onClose={() => {
          console.log('[OrderDetailsPanel] Closing waiter selection modal');
          setShowWaiterSelectionModal(false);
        }}
        orderNumber={order.numero}
        tableNumber={order.tavolo?.toString()}
        onConfirm={async (waiterId: string, waiterName: string) => {
          setIsMarkingAsDelivered(true);
          try {
            const result = await segnaOrdineRitirato(order.id, waiterName);
            
            if (result.success) {
              toast.success(`Ordine #${order.numero} ritirato da ${waiterName}`);
              setShowWaiterSelectionModal(false);
              
              // Aggiorna lo stato del tab a "ritirati"
              setActiveTab('ritirati');
              
              // Ricarica gli ordini
              await loadOrders();
              
              // Deseleziona l'ordine corrente
              setSelectedOrder(null);
            } else {
              toast.error(result.error || 'Errore nel marcare l\'ordine come ritirato');
            }
          } catch (error) {
            console.error('Errore marking order as delivered:', error);
            toast.error('Errore durante il ritiro dell\'ordine');
          } finally {
            setIsMarkingAsDelivered(false);
          }
        }}
      />
    </div>
  );
}


export default OrderDetailsPanel;
