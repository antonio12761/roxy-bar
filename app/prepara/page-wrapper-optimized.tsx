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
import { getOrdinazioniAperte, aggiornaStatoRiga } from "@/lib/actions/ordinazioni";
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
  destinazione: string;
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
  stato: "APERTA" | "INVIATA" | "IN_PREPARAZIONE" | "PRONTA" | "CONSEGNATA";
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

  // Process SSE events
  useEffect(() => {
    eventQueue.forEach(({ event, data, timestamp }) => {
      console.log(`[Prepara] Processing event: ${event}`, data);
      
      switch (event) {
        case 'order:new':
          if (data.items?.some((item: any) => item.destination === 'BAR')) {
            handleNewOrder(data);
          }
          break;
          
        case 'order:item:update':
          if (data.destination === 'BAR') {
            handleItemUpdate(data);
          }
          break;
          
        case 'order:cancelled':
          handleOrderCancelled(data);
          break;
          
        case 'notification:reminder':
          handleReminder(data);
          break;
      }
    });
    
    // Clear processed events
    clearEventQueue();
  }, [eventQueue]);

  // Load initial data with cache support
  const loadOrders = useCallback(async () => {
    try {
      // Check cache first
      const cachedOrders = getCachedData<Ordinazione[]>('orders:active:bar');
      if (cachedOrders && cachedOrders.length > 0) {
        console.log('[Prepara] Using cached orders:', cachedOrders.length);
        setOrders(cachedOrders);
        setIsLoading(false);
      }

      // Then fetch fresh data
      const data = await getOrdinazioniAperte();
      const serializedData = serializeDecimalData(data);
      
      // Transform and filter for BAR items only
      const barOrders = serializedData
        .filter(ord => ord.righe.some(item => item.destinazione === 'BAR'))
        .map(ord => ({
          id: ord.id,
          tavolo: ord.tavolo?.numero || ord.tipo,
          nomeCliente: ord.nomeCliente || ord.note?.split('Cliente: ')[1]?.split(' - ')[0],
          timestamp: ord.dataApertura,
          items: ord.righe
            .filter(item => item.destinazione === 'BAR')
            .map(item => ({
              id: item.id,
              ordinazioneId: ord.id,
              prodotto: item.prodotto.nome,
              quantita: item.quantita,
              prezzo: item.prezzo,
              stato: item.stato,
              timestamp: item.timestampOrdine,
              destinazione: item.destinazione,
              note: item.note
            })),
          totaleCosto: ord.totale,
          stato: ord.stato,
          hasKitchenItems: ord.righe.some(item => item.destinazione === 'CUCINA'),
          cameriere: ord.cameriere?.nome,
          note: ord.note
        }))
        .filter(ord => ord.items.length > 0);

      setOrders(barOrders);
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
        .filter((item: any) => item.destination === 'BAR')
        .map((item: any) => ({
          id: item.id,
          ordinazioneId: data.orderId,
          prodotto: item.productName,
          quantita: item.quantity,
          prezzo: 0, // Will be updated from DB
          stato: 'INSERITO',
          timestamp: data.timestamp,
          destinazione: item.destination
        })),
      totaleCosto: data.totalAmount,
      stato: 'APERTA',
      hasKitchenItems: data.items.some((item: any) => item.destination === 'CUCINA'),
      cameriere: data.waiterName
    };

    setOrders(prev => {
      const newOrders = [newOrder, ...prev];
      
      // Auto-select if this is the first order or no order is currently selected
      if (!selectedOrder || prev.length === 0) {
        autoSelectFirstOrder(newOrder);
      }
      
      return newOrders;
    });
    
    toast.success(`Nuovo ordine dal tavolo ${newOrder.tavolo}`);
  }, [selectedOrder, autoSelectFirstOrder]);

  // Handle item status update
  const handleItemUpdate = useCallback((data: any) => {
    console.log('[Prepara] Item update:', data);
    
    setOrders(prev => prev.map(order => {
      if (order.id === data.orderId) {
        return {
          ...order,
          items: order.items.map(item => 
            item.id === data.itemId 
              ? { ...item, stato: data.status }
              : item
          )
        };
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
        rollbackOptimisticUpdate(updateId);
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
      rollbackOptimisticUpdate(updateId);
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
  }, [orders, selectedOrder]);

  // Auto-start first item when a new order is selected
  useEffect(() => {
    if (selectedOrder && selectedOrder.items.length > 0) {
      const firstPendingItem = selectedOrder.items.find(item => item.stato === 'INSERITO');
      if (firstPendingItem) {
        console.log('[Prepara] Auto-starting first item for selected order:', firstPendingItem.id);
        
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
  }, [selectedOrder]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coffee className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Postazione Bar</h1>
              <span className="text-sm text-gray-500">
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
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Aggiorna ordini"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-80px)]">
        {/* Left Column - Orders List */}
        <div className="space-y-4 overflow-y-auto scrollbar-hide">
          <h2 className="text-lg font-semibold flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-gray-900 pb-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Coda Ordini ({orders.length})
          </h2>
          
          {orders.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Nessun ordine in coda</p>
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
              />
            ))
          )}
        </div>

        {/* Right Column - Order Details */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-gray-900 pb-2">
            <Check className="h-5 w-5 text-green-500" />
            Dettaglio Ordine
          </h2>
          
          {selectedOrder ? (
            <OrderDetailsPanel
              order={selectedOrder}
              onStatusChange={handleStatusChange}
              processingItems={processingItems}
              isLoading={isLoadingOrderDetails}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Seleziona un ordine dalla lista per vedere i dettagli</p>
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
}

function OrderListCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  processingItems,
  position
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
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Parziale</span>;
    } else if (hasInProgress) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">In Corso</span>;
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">In Attesa</span>;
  };
  
  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
      } ${position === 1 ? 'ring-2 ring-green-500/30 bg-green-50 dark:bg-green-900/10' : ''}`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
              position === 1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {typeof order.tavolo === 'string' ? order.tavolo.toUpperCase() : order.tavolo}
            </div>
            <div>
              <div className="font-medium">{order.nomeCliente || 'Cliente'}</div>
              <div className="text-xs text-gray-500">{getTimeElapsed(order.timestamp)} fa</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg">€{typeof order.totaleCosto === 'number' ? order.totaleCosto.toFixed(2) : parseFloat(order.totaleCosto.toString()).toFixed(2)}</div>
          </div>
        </div>
        
        <div className="flex items-center justify-end text-sm">
          {order.hasKitchenItems && (
            <div className="flex items-center gap-1 text-orange-600">
              <ChefHat className="h-3 w-3" />
              <span className="text-xs">+ Cucina</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Order Details Panel Component (Right Column)
interface OrderDetailsPanelProps {
  order: Ordinazione;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  isLoading: boolean;
}

function OrderDetailsPanel({
  order,
  onStatusChange,
  processingItems,
  isLoading
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
      <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">Tavolo {order.tavolo}</h3>
          <span className="text-sm text-gray-500">
            {getTimeElapsed(order.timestamp)} fa
          </span>
        </div>
        {order.nomeCliente && (
          <div className="flex items-center gap-2 text-gray-600">
            <User className="h-4 w-4" />
            <span>{order.nomeCliente}</span>
          </div>
        )}
        {order.cameriere && (
          <div className="text-sm text-gray-500 mt-1">
            Cameriere: {order.cameriere}
          </div>
        )}
      </div>

      {/* Products List */}
      <div className="p-6">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Coffee className="h-4 w-4" />
          Prodotti da Preparare ({order.items.length})
        </h4>
        
        <div className="space-y-3">
          {order.items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{item.quantita}x {item.prodotto}</div>
                {item.note && (
                  <div className="text-sm text-gray-500 mt-1">{item.note}</div>
                )}
                <div className={`text-xs mt-1 font-medium ${
                  item.stato === 'INSERITO' ? 'text-gray-500' :
                  item.stato === 'IN_LAVORAZIONE' ? 'text-blue-600' :
                  item.stato === 'PRONTO' ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {item.stato === 'INSERITO' ? 'In Attesa' :
                   item.stato === 'IN_LAVORAZIONE' ? 'In Preparazione' :
                   item.stato === 'PRONTO' ? 'Pronto' : item.stato}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {processingItems.has(item.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {item.stato === 'IN_LAVORAZIONE' && (
                      <button
                        onClick={() => onStatusChange(item, 'PRONTO')}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium transition-colors"
                      >
                        Segna Pronto
                      </button>
                    )}
                    {item.stato === 'PRONTO' && (
                      <div className="px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm font-medium">
                        ✓ Pronto
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
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
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-blue-800 text-sm">
              <strong>Note ordine:</strong> {order.note}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}