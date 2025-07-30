"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ChefHat, 
  Clock, 
  RefreshCw, 
  Bell, 
  Check, 
  AlertCircle, 
  Coffee,
  User,
  Package,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  ClipboardList
} from "lucide-react";
import { getOrdinazioniAperte, aggiornaStatoRiga, aggiornaStatoOrdinazione, sollecitaOrdinePronto, segnaOrdineRitirato } from "@/lib/actions/ordinazioni";
import { useStationSSE } from "@/hooks/useStationSSE";
import { StationType } from "@/lib/sse/station-filters";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

interface OrderItem {
  id: string;
  ordinazioneId: string;
  prodotto: string;
  quantita: number;
  prezzo: number;
  stato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO";
  timestamp: string;
  postazione: string;
  note?: string | null;
}

interface Ordinazione {
  id: string;
  tavolo?: string | number;
  cliente?: string;
  nomeCliente?: string;
  timestamp: string;
  items: OrderItem[];
  totaleCosto: number;
  stato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO";
  hasKitchenItems: boolean;
  cameriere?: string;
  note?: string;
}

export default function PreparaPageOptimized() {
  const [orders, setOrders] = useState<Ordinazione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<Ordinazione | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);

  // Use the optimized SSE hook
  const {
    connectionHealth,
    eventQueue,
    getCachedData,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearEventQueue
  } = useStationSSE({
    stationType: StationType.PREPARA,
    userId: currentUser?.id || '',
    enableCache: true,
    enableOptimisticUpdates: true,
    autoReconnect: true
  });

  // Process SSE events - Moved after function definitions

  // Load initial data with cache support
  const loadOrders = useCallback(async () => {
    try {
      // Check cache first
      const cachedOrders = getCachedData<Ordinazione[]>('orders:active:prepara');
      if (cachedOrders && cachedOrders.length > 0) {
        console.log('[Prepara] Using cached orders:', cachedOrders.length);
        setOrders(cachedOrders);
        setIsLoading(false);
      }

      // Then fetch fresh data
      const data = await getOrdinazioniAperte();
      const serializedData = serializeDecimalData(data);
      
      // Debug: Log all orders and their destinations
      console.log('[Prepara] All orders received:', serializedData.length);
      
      // Collect all unique destinations to see what's in the database
      const allDestinations = new Set<string>();
      serializedData.forEach((ord: any) => {
        ord.righe.forEach((riga: any) => {
          allDestinations.add(riga.postazione || 'NULL');
        });
      });
      console.log('[Prepara] ALL UNIQUE DESTINATIONS IN DATABASE:', Array.from(allDestinations));
      
      // Check for null or empty destinations
      const itemsWithoutDestination = serializedData.flatMap((ord: any) => 
        ord.righe.filter((riga: any) => !riga.postazione || riga.postazione === '')
      );
      if (itemsWithoutDestination.length > 0) {
        console.log(`[Prepara] WARNING: ${itemsWithoutDestination.length} items without destination!`);
        itemsWithoutDestination.forEach((item: any) => {
          console.log(`  - ${item.prodotto?.nome} (Order: ${item.ordinazioneId})`);
        });
      }
      
      // DETAILED DEBUG LOGGING FOR EACH ORDER
      serializedData.forEach((ord: any, index: number) => {
        console.log(`\n=== DEBUG ORDER ${index + 1} ===`);
        console.log(`[Prepara] Order ID: ${ord.id}`);
        console.log(`[Prepara] Order Type: ${ord.tipo}`);
        console.log(`[Prepara] Order Stato: ${ord.stato}`);
        console.log(`[Prepara] Number of righe: ${ord.righe.length}`);
        
        // Log each riga (item) in detail
        ord.righe.forEach((riga: any, rigaIndex: number) => {
          console.log(`  Riga ${rigaIndex + 1}:`);
          console.log(`    - ID: ${riga.id}`);
          console.log(`    - Prodotto: ${riga.prodotto?.nome || 'N/A'}`);
          console.log(`    - Postazione: "${riga.postazione}"`); 
          console.log(`    - Stato: ${riga.stato}`);
          console.log(`    - Quantità: ${riga.quantita}`);
        });
        
        // Check if any riga has PREPARA destination
        const hasPreparaItems = ord.righe.some((item: any) => item.postazione === 'PREPARA');
        console.log(`[Prepara] Has PREPARA items: ${hasPreparaItems}`);
        
        // Show exactly which items match PREPARA
        const preparaItems = ord.righe.filter((item: any) => item.postazione === 'PREPARA');
        console.log(`[Prepara] PREPARA items count: ${preparaItems.length}`);
        preparaItems.forEach((item: any, itemIndex: number) => {
          console.log(`  PREPARA Item ${itemIndex + 1}: ${item.prodotto?.nome} (ID: ${item.id})`);
        });
        
        // Test the exact filter condition
        const passesFilter = ord.righe.some((item: any) => item.postazione === 'PREPARA');
        console.log(`[Prepara] Passes filter: ${passesFilter}`);
        console.log(`=== END DEBUG ORDER ${index + 1} ===\n`);
      });

      // Transform and filter for PREPARA items only
      const preparaOrders = serializedData
        .filter((ord: any) => ord.righe.some((item: any) => item.postazione === 'PREPARA'))
        .map((ord: any) => ({
          id: ord.id,
          tavolo: ord.tavolo?.numero || ord.tipo,
          nomeCliente: ord.nomeCliente || ord.note?.split('Cliente: ')[1]?.split(' - ')[0],
          timestamp: ord.dataApertura,
          items: ord.righe
            .filter((item: any) => item.postazione === 'PREPARA')
            .map((item: any) => ({
              id: item.id,
              ordinazioneId: ord.id,
              prodotto: item.prodotto.nome,
              quantita: item.quantita,
              prezzo: item.prezzo,
              stato: item.stato,
              timestamp: item.timestampOrdine,
              postazione: item.postazione,
              note: item.note
            })),
          totaleCosto: ord.totale,
          stato: ord.stato,
          hasKitchenItems: ord.righe.some((item: any) => item.postazione === 'CUCINA'),
          cameriere: ord.cameriere?.nome,
          note: ord.note
        }))
        .filter(ord => ord.items.length > 0);

      console.log('[Prepara] Filtered PREPARA orders:', preparaOrders.length);

      setOrders(preparaOrders);
      setIsLoading(false);
      
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
      toast.error("Errore nel caricamento degli ordini");
      setIsLoading(false);
    }
  }, [getCachedData]);

  // Select order from list
  const selectOrder = useCallback((order: Ordinazione) => {
    console.log('[Prepara] Selecting order:', order.id);
    setIsLoadingOrderDetails(true);
    setSelectedOrder(order);
    
    // Simulate loading time for UX
    setTimeout(() => {
      setIsLoadingOrderDetails(false);
    }, 500);
  }, []);

  // Auto-select first order and send "inizia" notification
  const autoSelectFirstOrder = useCallback(async (newOrder: Ordinazione) => {
    console.log('[Prepara] Auto-selecting first order:', newOrder.id);
    
    setIsLoadingOrderDetails(true);
    setSelectedOrder(newOrder);
    
    // Auto-start first item in "INSERITO" state
    const firstPendingItem = newOrder.items.find(item => item.stato === 'INSERITO');
    if (firstPendingItem) {
      console.log('[Prepara] Auto-starting first item:', firstPendingItem.id);
      
      // Send "inizia" notification automatically - passa ordine allo stato iniziata preparazione
      try {
        // We'll handle this in a separate useEffect to avoid circular dependency
        console.log('[Prepara] Auto-starting will be handled after component mount');
      } catch (error) {
        console.error('[Prepara] Error auto-starting item:', error);
      }
    }
    
    // Simulate loading time for UX
    setTimeout(() => {
      setIsLoadingOrderDetails(false);
    }, 800);
  }, []);

  // Handle new order event
  const handleNewOrder = useCallback((data: any) => {
    console.log('[Prepara] New order received:', data);
    
    const newOrder: Ordinazione = {
      id: data.orderId,
      tavolo: data.tableNumber || 'Asporto',
      nomeCliente: data.customerName,
      timestamp: data.timestamp,
      items: data.items
        .filter((item: any) => item.destination === 'PREPARA')
        .map((item: any) => ({
          id: item.id,
          ordinazioneId: data.orderId,
          prodotto: item.productName,
          quantita: item.quantity,
          prezzo: 0, // Will be updated from DB
          stato: 'INSERITO',
          timestamp: data.timestamp,
          postazione: item.destination
        })),
      totaleCosto: data.totalAmount,
      stato: 'ORDINATO',
      hasKitchenItems: data.items.some((item: any) => item.destination === 'CUCINA'),
      cameriere: data.waiterName
    };

    setOrders(prev => {
      const newOrders = [newOrder, ...prev];
      
      // Auto-select if this is the first order or no order is currently selected - DISABLED
      // if (!selectedOrder || prev.length === 0) {
      //   setTimeout(() => autoSelectFirstOrder(newOrder), 100);
      // }
      
      return newOrders;
    });
    
    toast.success(`Nuovo ordine dal tavolo ${newOrder.tavolo}`);
  }, [selectedOrder?.id, autoSelectFirstOrder]);

  // Handle item status update
  const handleItemUpdate = useCallback((data: any) => {
    console.log('[Prepara] Item update:', data);
    
    setOrders(prev => prev.map(order => {
      if (order.id === data.orderId) {
        const updatedOrder = {
          ...order,
          items: order.items.map(item => 
            item.id === data.itemId 
              ? { ...item, stato: data.status }
              : item
          )
        };
        
        // Check if all items are now PRONTO
        const allReady = updatedOrder.items.every(item => item.stato === 'PRONTO');
        if (allReady) {
          updatedOrder.stato = 'PRONTO';
        }
        
        return updatedOrder;
      }
      return order;
    }));
  }, []);

  // Handle order cancelled
  const handleOrderCancelled = useCallback((data: any) => {
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
    toast.info(`Ordine ${data.orderId} annullato`);
  }, []);

  // Handle reminder notification
  const handleReminder = useCallback((data: any) => {
    toast.warning(data.message);
  }, []);

  // Change item status with optimistic update
  const handleStatusChange = useCallback(async (item: OrderItem, newStatus: any) => {
    if (processingItems.has(item.id)) return;
    
    setProcessingItems(prev => new Set([...prev, item.id]));
    
    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      'order_item',
      item.id,
      { stato: newStatus },
      { stato: item.stato }
    );
    
    // Update UI immediately
    handleItemUpdate({
      orderId: item.ordinazioneId,
      itemId: item.id,
      status: newStatus
    });
    
    try {
      const result = await aggiornaStatoRiga(item.id, newStatus);
      
      if (!result.success) {
        // Rollback on failure
        if (updateId) rollbackOptimisticUpdate(updateId);
        handleItemUpdate({
          orderId: item.ordinazioneId,
          itemId: item.id,
          status: item.stato
        });
        toast.error(`Errore: ${result.error}`);
      } else {
        toast.success("Stato aggiornato");
      }
    } catch (error) {
      // Rollback on error
      if (updateId) rollbackOptimisticUpdate(updateId);
      handleItemUpdate({
        orderId: item.ordinazioneId,
        itemId: item.id,
        status: item.stato
      });
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [applyOptimisticUpdate, rollbackOptimisticUpdate, processingItems]);

  // Filter orders by status
  const getOrdersByStatus = useCallback((status: string[]) => {
    return orders.filter(order => 
      order.items.some(item => status.includes(item.stato))
    );
  }, [orders]);

  // Toggle order expansion
  const toggleOrderExpansion = useCallback((orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  // Load current user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Auto-select first order when orders change
  useEffect(() => {
    if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    }
  }, [orders.length, selectedOrder?.id]);

  // Auto-start first item when a new order is selected - only for PREPARA items
  useEffect(() => {
    if (selectedOrder && selectedOrder.items.length > 0) {
      const firstPendingItem = selectedOrder.items.find(item => 
        item.stato === 'INSERITO' && item.postazione === 'PREPARA'
      );
      if (firstPendingItem) {
        console.log('[Prepara] Auto-starting first PREPARA item for selected order:', firstPendingItem.id);
        
        // Auto-start with a small delay to ensure UI is ready
        const timeoutId = setTimeout(async () => {
          try {
            await handleStatusChange(firstPendingItem, 'IN_LAVORAZIONE');
            toast.success(`Avviata preparazione automaticamente: ${firstPendingItem.prodotto}`);
          } catch (error) {
            console.error('[Prepara] Error auto-starting item:', error);
          }
        }, 1000);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedOrder?.id, selectedOrder?.items?.find(item => item.stato === 'INSERITO' && item.postazione === 'PREPARA')?.id]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Process SSE events
  useEffect(() => {
    if (eventQueue.length === 0) return;
    
    eventQueue.forEach(({ event, data, timestamp }) => {
      console.log(`[Prepara] Processing event: ${event}`, data);
      
      switch (event) {
        case 'order:new':
          if (data.items?.some((item: any) => item.destination === 'PREPARA')) {
            handleNewOrder(data);
          }
          break;
          
        case 'order:item:update':
          if (data.destination === 'PREPARA') {
            handleItemUpdate(data);
          }
          break;
          
        case 'order:cancelled':
          handleOrderCancelled(data);
          break;
          
        case 'order:ready':
        case 'order:status-change':
          // Update order status when it becomes ready
          if (data.newStatus === 'PRONTO') {
            setOrders(prev => prev.map(order => 
              order.id === data.orderId 
                ? { ...order, stato: 'PRONTO' }
                : order
            ));
          }
          break;
          
        case 'notification:reminder':
          handleReminder(data);
          break;
      }
    });
    
    // Clear processed events
    clearEventQueue();
  }, [eventQueue, handleNewOrder, handleItemUpdate, handleOrderCancelled, handleReminder, clearEventQueue]);

  // Connection quality indicator
  const getConnectionIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionHealth.quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-green-400';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="bg-card shadow-sm border-b border-border mb-4 rounded-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coffee className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">Postazione Prepara</h1>
              <span className="text-sm text-muted-foreground">
                {orders.length} ordini attivi
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {getConnectionIcon()}
                <span className={`text-sm ${getConnectionColor()}`}>
                  {connectionHealth.latency}ms
                </span>
              </div>
              
              {/* User Display */}
              <UserDisplay />
              
              {/* Refresh Button */}
              <button
                onClick={loadOrders}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Aggiorna ordini"
              >
                <RefreshCw className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)]">
        {/* Left Column - Orders List */}
        <div className="space-y-4 overflow-y-auto scrollbar-hide">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 sticky top-0 bg-background pb-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Coda Ordini ({orders.length})
          </h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border border-border">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nessun ordine in coda per PREPARA</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Debug: {isLoading ? 'Caricamento...' : 'Caricamento completato'}</p>
            </div>
          ) : (
            orders.map((order, index) => (
              <OrderListCard
                key={order.id}
                order={order}
                isSelected={selectedOrder?.id === order.id}
                onSelect={() => selectOrder(order)}
                onStatusChange={handleStatusChange}
                processingItems={processingItems}
                position={index + 1}
                onOrderRetired={loadOrders}
              />
            ))
          )}
        </div>

        {/* Right Column - Order Details */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 sticky top-0 bg-background pb-2">
            <Check className="h-5 w-5 text-green-500" />
            Dettaglio Ordine
          </h2>
          
          {selectedOrder ? (
            <OrderDetailsPanel
              order={selectedOrder}
              orders={orders}
              onStatusChange={handleStatusChange}
              processingItems={processingItems}
              isLoading={isLoadingOrderDetails}
              onOrderCompleted={(nextOrder) => {
                if (nextOrder) {
                  setIsLoadingOrderDetails(true);
                  setSelectedOrder(nextOrder);
                  setTimeout(() => setIsLoadingOrderDetails(false), 500);
                }
              }}
            />
          ) : (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Seleziona un ordine dalla lista per vedere i dettagli</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Order List Card Component (Left Column)
interface OrderListCardProps {
  order: Ordinazione;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  position: number;
  onOrderRetired: () => void;
}

function OrderListCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  processingItems,
  position,
  onOrderRetired
}: OrderListCardProps) {
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const getOrderStatusBadge = () => {
    const hasInProgress = order.items.some(item => item.stato === 'IN_LAVORAZIONE');
    const hasReady = order.items.some(item => item.stato === 'PRONTO');
    const allReady = order.items.every(item => item.stato === 'PRONTO');
    
    if (allReady) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Completato</span>;
    } else if (hasReady) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Parziale</span>;
    } else if (hasInProgress) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">In Corso</span>;
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">In Attesa</span>;
  };
  
  return (
    <div 
      className={`rounded-lg shadow-sm border-2 transition-all ${
        order.stato === 'PRONTO'
          ? 'border-green-500 bg-green-700 shadow-lg ring-2 ring-green-500/30 cursor-default'
          : isSelected 
            ? 'border-primary shadow-lg ring-2 ring-primary/20 bg-card cursor-pointer' 
            : 'border-border hover:border-primary/50 hover:shadow-md bg-card cursor-pointer'
      } ${position === 1 && order.stato !== 'PRONTO' ? 'ring-2 ring-green-500/30 bg-green-50/10' : ''}`}
      onClick={order.stato === 'PRONTO' ? undefined : onSelect}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
              order.stato === 'PRONTO' 
                ? 'bg-white text-green-700' 
                : position === 1 
                  ? 'bg-green-500 text-white' 
                  : 'bg-muted text-muted-foreground'
            }`}>
              {typeof order.tavolo === 'string' ? order.tavolo.toUpperCase() : order.tavolo}
            </div>
            <div>
              <div className={`font-medium ${order.stato === 'PRONTO' ? 'text-white' : 'text-foreground'}`}>
                {order.nomeCliente || 'Cliente'}
              </div>
              <div className={`text-xs ${order.stato === 'PRONTO' ? 'text-green-100' : 'text-muted-foreground'}`}>
                {getTimeElapsed(order.timestamp)} fa
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-semibold text-lg ${order.stato === 'PRONTO' ? 'text-white' : 'text-foreground'}`}>
              €{Number(order.totaleCosto).toFixed(2)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end text-sm">
          {order.stato === 'PRONTO' ? (
            <div className="flex gap-2">
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await sollecitaOrdinePronto(order.id);
                    if (result.success) {
                      toast.success('Sollecito inviato al cameriere');
                    } else {
                      toast.error(result.error || 'Errore durante il sollecito');
                    }
                  } catch (error) {
                    toast.error('Errore durante il sollecito');
                  }
                }}
                className="px-3 py-1 bg-yellow-500 text-white text-xs rounded-md hover:bg-yellow-600 transition-colors font-medium"
              >
                Sollecita
              </button>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await segnaOrdineRitirato(order.id);
                    if (result.success) {
                      toast.success('Ordine segnato come ritirato');
                      // Ricarica gli ordini per aggiornare la lista
                      onOrderRetired();
                    } else {
                      toast.error(result.error || 'Errore durante il ritiro');
                    }
                  } catch (error) {
                    toast.error('Errore durante il ritiro');
                  }
                }}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors font-medium"
              >
                Ritirato
              </button>
            </div>
          ) : (
            order.hasKitchenItems && (
              <div className="flex items-center gap-1 text-orange-600">
                <ChefHat className="h-3 w-3" />
                <span className="text-xs">+ Cucina</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// Order Details Panel Component (Right Column)
interface OrderDetailsPanelProps {
  order: Ordinazione;
  orders: Ordinazione[];
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  isLoading: boolean;
  onOrderCompleted: (nextOrder: Ordinazione | null) => void;
}

function OrderDetailsPanel({
  order,
  orders,
  onStatusChange,
  processingItems,
  isLoading,
  onOrderCompleted
}: OrderDetailsPanelProps) {
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  // Skeleton loader
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
              {typeof order.tavolo === 'string' ? order.tavolo.toUpperCase() : order.tavolo}
            </div>
            <div>
              <div className="text-xl font-semibold">{order.nomeCliente || 'Cliente'}</div>
              {order.cameriere && (
                <div className="text-sm text-gray-500">
                  Cameriere: {order.cameriere}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-red-600">
              {getTimeElapsed(order.timestamp)}
            </div>
            <div className="text-xs text-gray-500">
              tempo attesa
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-6">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          Prodotti da Preparare ({order.items.length})
        </h4>
        
        <div className="space-y-3">
          {order.items.map(item => (
            <div key={item.id} className={`flex items-center justify-between p-4 rounded-lg ${
              item.postazione !== 'PREPARA' 
                ? 'bg-gray-200 dark:bg-gray-600 opacity-60' 
                : 'bg-gray-50 dark:bg-gray-700'
            }`}>
              <div className="flex-1">
                <div className={`font-medium ${
                  item.postazione !== 'PREPARA' ? 'text-gray-500' : ''
                }`}>
                  {item.quantita}x {item.prodotto}
                  {item.postazione === 'CUCINA' && (
                    <span className="ml-2 text-xs text-orange-600 font-normal">
                      (Cucina)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Order Ready Button */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-center">
            {order.items.every(item => item.stato === 'PRONTO') ? (
              <div className="px-6 py-3 bg-green-100 text-green-800 rounded-lg text-lg font-semibold">
                ✓ Ordine Completato
              </div>
            ) : (
              <button
                onClick={async () => {
                  // Segna tutti gli item come PRONTO
                  for (const item of order.items) {
                    if (item.stato !== 'PRONTO') {
                      await onStatusChange(item, 'PRONTO');
                    }
                  }
                  
                  // Aggiorna lo stato dell'ordine a PRONTO
                  try {
                    const result = await aggiornaStatoOrdinazione(order.id, 'PRONTO');
                    if (result.success) {
                      toast.success('Ordine pronto! Notifica inviata al cameriere');
                    }
                  } catch (error) {
                    console.error('Errore aggiornamento stato ordine:', error);
                  }
                  
                  // Auto-select next order after completion
                  const currentIndex = orders.findIndex(o => o.id === order.id);
                  const nextOrders = orders.filter((o, index) => 
                    index > currentIndex && o.stato !== 'PRONTO'
                  );
                  
                  if (nextOrders.length > 0) {
                    setTimeout(() => {
                      onOrderCompleted(nextOrders[0]);
                    }, 800);
                  } else {
                    onOrderCompleted(null);
                  }
                }}
                disabled={order.items.some(item => processingItems.has(item.id))}
                className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {order.items.some(item => processingItems.has(item.id)) ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Elaborazione...
                  </>
                ) : (
                  'Ordine Pronto'
                )}
              </button>
            )}
          </div>
        </div>
        
        {order.hasKitchenItems && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800 text-sm">
              <ChefHat className="h-4 w-4" />
              <span className="font-medium">Questo ordine include anche elementi per la cucina</span>
            </div>
          </div>
        )}
        
        {order.note && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600">
            <div className="text-gray-800 dark:text-gray-200 text-sm">
              <strong>Note ordine:</strong> {order.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}