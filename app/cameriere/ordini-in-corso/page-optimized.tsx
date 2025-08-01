"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Clock, Coffee, ChefHat, Users, CheckCircle, RefreshCw, ChevronDown, ChevronUp, CreditCard, ArrowLeft, X, Edit3, Package, Loader2 } from "lucide-react";
import { getOrdinazioniAperte, aggiornaStatoRiga } from "@/lib/actions/ordinazioni";
import Link from "next/link";
import { useStationSSE } from "@/hooks/useStationSSE";
import { useSearchParams } from "next/navigation";
import { OrderEditModal } from "@/components/cameriere/OrderEditModal";
import { OrdersSkeleton } from "@/components/ui/OrdersSkeleton";
import { ProductsAvailabilityModal } from "@/components/prepara/ProductsAvailabilityModal";
import { ActiveOrdersUnavailableModal } from "@/components/cameriere/ActiveOrdersUnavailableModal";
import { useSSEEvent } from "@/contexts/sse-context";
import { StationType } from "@/lib/sse/station-filters";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/lib/toast";

interface LocalOrderItem {
  id: string;
  prodotto: {
    nome: string;
    categoria: string;
  };
  quantita: number;
  stato: string;
  postazione: string;
  timestampOrdine: Date;
  timestampInizio?: Date | null;
  timestampPronto?: Date | null;
}

interface Order {
  id: string;
  numero: number;
  tavolo?: {
    id: number;
    numero: string;
    zona?: string | null;
    posti: number;
    stato: string;
    note?: string | null;
    attivo: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  cameriere: {
    nome: string;
  };
  tipo: string;
  stato: string;
  note?: string | null;
  dataApertura: Date;
  totale: number;
  righe: LocalOrderItem[];
}

export default function OrdiniInCorsoPageOptimized() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const searchParams = useSearchParams();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"tutti" | "prepara" | "cucina">("tutti");
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tableFilter, setTableFilter] = useState<string | null>(searchParams.get('tavolo'));
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showActiveOrdersModal, setShowActiveOrdersModal] = useState(false);
  const [unavailableProductInfo, setUnavailableProductInfo] = useState<{
    productName: string;
    affectedOrders: any[];
    isUrgent: boolean;
  } | null>(null);
  const isUnmountingRef = useRef(false);

  // Use optimized SSE hook
  const { 
    connectionHealth, 
    eventQueue,
    getCachedData,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearEventQueue
  } = useStationSSE({
    stationType: StationType.CAMERIERE,
    userId: currentUser?.id || '',
    enableCache: true,
    enableOptimisticUpdates: true,
    autoReconnect: true
  });

  // Handle order ready event
  const handleOrderReady = useCallback((data: any) => {
    console.log('[Cameriere] Order ready:', data);
    
    // Update order state in UI
    setOrders(prev => prev.map((order: Order) => {
      if (order.id === data.orderId) {
        return {
          ...order,
          stato: 'PRONTO',
          righe: order.righe ? order.righe.map((item: LocalOrderItem) => ({
            ...item,
            stato: 'PRONTO'
          })) : []
        };
      }
      return order;
    }));
    
    // Show notification
    if (Notification.permission === "granted") {
      new Notification(`Ordine Pronto!`, {
        body: `Tavolo ${data.tableNumber} è pronto per il ritiro`,
        icon: '/icon-192.png'
      });
    }
  }, []);

  // Handle order update
  const handleOrderUpdate = useCallback((data: any) => {
    setOrders(prev => prev.map((order: Order) => {
      if (order.id === data.orderId) {
        return {
          ...order,
          stato: data.status
        };
      }
      return order;
    }));
  }, []);

  // Handle order delivered
  const handleOrderDelivered = useCallback((data: any) => {
    // Remove from active orders
    setOrders(prev => prev.filter((order: Order) => order.id !== data.orderId));
  }, []);

  // Handle order paid
  const handleOrderPaid = useCallback((data: any) => {
    // Remove from active orders
    setOrders(prev => prev.filter((order: Order) => order.id !== data.orderId));
  }, []);

  // Process SSE events
  useEffect(() => {
    if (eventQueue.length === 0) return;

    eventQueue.forEach(({ event, data }) => {
      console.log(`[Cameriere] Processing event: ${event}`, data);
      
      switch (event) {
        case 'order:ready':
          handleOrderReady(data);
          break;
          
        case 'order:update':
          handleOrderUpdate(data);
          break;
          
        case 'order:delivered':
          handleOrderDelivered(data);
          break;
          
        case 'order:paid':
          handleOrderPaid(data);
          break;
          
        case 'notification:new':
          // Handle direct notifications
          break;
      }
    });
    
    clearEventQueue();
  }, [eventQueue, clearEventQueue, handleOrderReady, handleOrderUpdate, handleOrderDelivered, handleOrderPaid]);

  // Load orders with cache support
  const loadOrders = useCallback(async () => {
    console.log('[Cameriere] loadOrders called');
    // Don't make API calls if component is unmounting
    if (isUnmountingRef.current) {
      console.log('[Cameriere] Skipping loadOrders - component unmounting');
      return;
    }

    try {
      console.log('[Cameriere] Fetching orders...');
      // Check cache first
      const cachedOrders = getCachedData<Order[]>('orders:my-tables');
      if (cachedOrders && cachedOrders.length > 0 && !isUnmountingRef.current) {
        console.log('[Cameriere] Using cached orders:', cachedOrders.length);
        setOrders(cachedOrders);
        setIsLoading(false);
      }

      // Fetch fresh data only if not unmounting
      if (!isUnmountingRef.current) {
        console.log('[Cameriere] Calling getOrdinazioniAperte...');
        const data = await getOrdinazioniAperte();
        console.log('[Cameriere] Got data:', data);
        const serializedData = serializeDecimalData(data);
        
        // Filter only active orders and ensure righe is defined
        const activeOrders = serializedData.filter(order => 
          ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(order.stato)
        ).map(order => ({
          ...order,
          righe: order.righe || []
        }));
        
        console.log('[Cameriere] Active orders:', activeOrders.length);
        
        // Only update state if component is still mounted
        if (!isUnmountingRef.current) {
          setOrders(activeOrders);
          setIsLoading(false);
        }
      }
      
    } catch (error) {
      console.error("[Cameriere] Errore caricamento ordini:", error);
      if (!isUnmountingRef.current) {
        setIsLoading(false);
      }
    }
  }, [getCachedData]);

  // Handle status update with optimistic updates
  const handleStatusUpdate = async (item: LocalOrderItem, orderId: string, newStatus: string) => {
    setUpdatingItems(prev => new Set(prev).add(item.id));

    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      'order_item',
      item.id,
      { stato: newStatus },
      { stato: item.stato }
    );

    // Update UI immediately
    setOrders(prev => prev.map((order: Order) => {
      if (order.id === orderId) {
        return {
          ...order,
          righe: order.righe ? order.righe.map((riga: LocalOrderItem) => 
            riga.id === item.id ? { ...riga, stato: newStatus } : riga
          ) : []
        };
      }
      return order;
    }));

    try {
      const result = await aggiornaStatoRiga(
        item.id, 
        newStatus as "CONSEGNATO" | "ANNULLATO" | "INSERITO" | "IN_LAVORAZIONE" | "PRONTO"
      );
      
      if (!result.success) {
        // Rollback on failure
        if (updateId) rollbackOptimisticUpdate(updateId);
        
        // Revert UI
        setOrders(prev => prev.map((order: Order) => {
          if (order.id === orderId) {
            return {
              ...order,
              righe: order.righe ? order.righe.map((riga: LocalOrderItem) => 
                riga.id === item.id ? { ...riga, stato: item.stato } : riga
              ) : []
            };
          }
          return order;
        }));
        
        toast.error(`Errore: ${result.error}`);
      }
    } catch (error) {
      // Rollback on error
      if (updateId) rollbackOptimisticUpdate(updateId);
      
      // Revert UI
      setOrders(prev => prev.map((order: Order) => {
        if (order.id === orderId) {
          return {
            ...order,
            righe: order.righe ? order.righe.map((riga: LocalOrderItem) => 
              riga.id === item.id ? { ...riga, stato: item.stato } : riga
            ) : []
          };
        }
        return order;
      }));
      
      console.error("Errore aggiornamento stato:", error);
      toast.error("Errore durante l'aggiornamento dello stato");
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const getStatoBadge = (stato: string) => {
    if (stato === "INSERITO") return null;
    
    const stateMap = {
      "IN_LAVORAZIONE": { label: "In preparazione", color: colors.button.primary },
      "PRONTO": { label: "Pronto", color: colors.button.success },
      "CONSEGNATO": { label: "Consegnato", color: colors.text.muted },
      "ANNULLATO": { label: "Annullato", color: colors.text.error }
    };
    
    const config = stateMap[stato as keyof typeof stateMap] || { label: stato, color: colors.text.muted };
    
    return (
      <span 
        className="px-2 py-1 rounded-full text-xs font-medium"
        style={{ 
          backgroundColor: config.color,
          color: 'white'
        }}
      >
        {config.label}
      </span>
    );
  };

  const getElapsedTime = (date: Date) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    
    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m`;
    return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
  };

  const toggleCardCollapse = (orderId: string) => {
    setCollapsedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getOrderStatus = (order: Order) => {
    if (!order.righe || !Array.isArray(order.righe)) {
      return "pending";
    }
    
    const allReady = order.righe.every((item: LocalOrderItem) => ["CONSEGNATO", "ANNULLATO"].includes(item.stato));
    const hasReady = order.righe.some((item: LocalOrderItem) => item.stato === "PRONTO");
    const inProgress = order.righe.some((item: LocalOrderItem) => item.stato === "IN_LAVORAZIONE");
    
    if (allReady) return "completed";
    if (hasReady) return "ready";
    if (inProgress) return "inProgress";
    return "pending";
  };

  const getCleanClientName = (note: string | null | undefined) => {
    if (!note) return '';
    return note
      .replace(/cliente:\s*/i, '')
      .replace(/\s*-\s*posti:\s*\d+/i, '')
      .trim();
  };

  const filteredOrders = orders.filter((order: Order) => {
    // Filtra per tavolo se specificato
    if (tableFilter && order.tavolo?.numero !== tableFilter) {
      return false;
    }
    
    // Filtra per postazione
    if (filter === "tutti") return true;
    if (!order.righe || !Array.isArray(order.righe)) return false;
    return order.righe.some((item: LocalOrderItem) => 
      filter === "prepara" ? item.postazione === "PREPARA" : item.postazione === "CUCINA"
    );
  });

  // Load current user from localStorage
  useEffect(() => {
    console.log('[Cameriere] Checking user auth...');
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      console.log('[Cameriere] User found:', user.nome || user.id);
      setCurrentUser(user);
    } else {
      console.log('[Cameriere] No user data found');
    }
  }, []);

  // Subscribe to product unavailable in order events
  useSSEEvent('product:unavailable-in-order', (data) => {
    console.log('[OrdiniInCorso] Product unavailable in orders:', data);
    
    // Check if any of the affected orders are currently displayed
    const myAffectedOrders = data.affectedOrders.filter(affectedOrder => 
      orders.some(order => order.id === affectedOrder.orderId)
    );
    
    if (myAffectedOrders.length > 0) {
      setUnavailableProductInfo({
        productName: data.productName,
        affectedOrders: myAffectedOrders,
        isUrgent: false
      });
      setShowActiveOrdersModal(true);
    }
  }, [orders]);

  // Subscribe to urgent product unavailable events
  useSSEEvent('product:unavailable-urgent', (data) => {
    console.log('[OrdiniInCorso] URGENT - Product unavailable in preparation:', data);
    
    // Check if any of the affected orders belong to current user
    const myAffectedOrders = data.affectedOrders.filter(affectedOrder => 
      affectedOrder.waiterName === currentUser?.nome ||
      orders.some(order => order.id === affectedOrder.orderId)
    );
    
    if (myAffectedOrders.length > 0) {
      setUnavailableProductInfo({
        productName: data.productName,
        affectedOrders: myAffectedOrders,
        isUrgent: true
      });
      setShowActiveOrdersModal(true);
      
      // Extra notification for urgent cases
      toast.error(`URGENTE: ${data.productName} non disponibile in ordini IN PREPARAZIONE!`, {
        duration: 10000 // Show for 10 seconds
      });
    }
  }, [orders, currentUser]);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[OrdiniInCorso] Component unmounting, cleaning up...');
      isUnmountingRef.current = true;
      clearEventQueue();
    };
  }, [clearEventQueue]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
        {/* Header */}
        <div className="p-6" style={{ borderBottom: `1px solid ${colors.border.primary}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/cameriere" 
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: colors.bg.card,
                  color: colors.text.secondary
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
                Ordini in Corso
              </h1>
            </div>
          </div>
          
          {/* Filters skeleton */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="h-10 w-24 rounded-lg animate-pulse"
                style={{ backgroundColor: colors.bg.card }}
              />
            ))}
          </div>
        </div>

        {/* Orders skeleton */}
        <div className="px-6 py-4">
          <OrdersSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-96" style={{ backgroundColor: colors.bg.main }}>
      {/* Navigation Header - Following Style Guide */}
      <div className="mb-6 px-6 pt-6">
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
              <ArrowLeft className="h-5 w-5" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>Ordini in Corso</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div 
              className="flex items-center gap-2 px-3 py-1 rounded-lg"
              style={{ backgroundColor: colors.bg.card }}
            >
              <div 
                className={`w-2 h-2 rounded-full ${
                  connectionHealth.status === 'connected' ? 'animate-pulse' : ''
                }`}
                style={{
                  backgroundColor: connectionHealth.status === 'connected' ? colors.button.success :
                                 connectionHealth.status === 'connecting' ? colors.accent : colors.text.error
                }}
              />
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                {connectionHealth.status === 'connected' ? `${connectionHealth.latency}ms` : 
                 connectionHealth.status === 'connecting' ? 'Connessione...' : 'Offline'}
              </span>
            </div>
            
            <button
              onClick={loadOrders}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              disabled={isLoading}
              title="Aggiorna ordini"
            >
              <RefreshCw 
                className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} 
                style={{ color: colors.text.secondary }} 
              />
            </button>
            
            {/* Products Availability Button */}
            <button
              onClick={() => setShowAvailabilityModal(true)}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Gestione disponibilità prodotti"
            >
              <Package className="h-5 w-5" style={{ color: colors.text.secondary }} />
            </button>
          </div>
        </div>

        {/* Table Filter Display */}
        {tableFilter && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg" style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
              📍 Filtro attivo: Tavolo {tableFilter}
            </span>
            <button
              onClick={() => setTableFilter(null)}
              className="p-1 rounded-lg transition-colors ml-auto"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Rimuovi filtro tavolo"
            >
              <X className="h-4 w-4" style={{ color: colors.text.secondary }} />
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilter("tutti")}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: filter === "tutti" ? colors.accent : colors.bg.card,
              color: filter === "tutti" ? 'white' : colors.text.secondary
            }}
          >
            Tutti ({filteredOrders.length})
          </button>
          <button
            onClick={() => setFilter("prepara")}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: filter === "prepara" ? colors.accent : colors.bg.card,
              color: filter === "prepara" ? 'white' : colors.text.secondary
            }}
          >
            <Coffee className="h-4 w-4 inline mr-2" />
            Prepara
          </button>
          <button
            onClick={() => setFilter("cucina")}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: filter === "cucina" ? colors.accent : colors.bg.card,
              color: filter === "cucina" ? 'white' : colors.text.secondary
            }}
          >
            <ChefHat className="h-4 w-4 inline mr-2" />
            Cucina
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="px-6 space-y-4">
        {filteredOrders.length === 0 ? (
          <div 
            className="text-center py-12 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <p style={{ color: colors.text.muted }}>Nessun ordine attivo</p>
          </div>
        ) : (
          filteredOrders.map((order: Order) => {
            const status = getOrderStatus(order);
            const isCollapsed = collapsedCards.has(order.id);
            const borderColor = status === "ready" ? colors.border.success :
                              status === "inProgress" ? colors.accent :
                              colors.border.primary;
            
            return (
              <div
                key={order.id}
                className="rounded-lg overflow-hidden transition-all duration-200"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: borderColor,
                  borderWidth: status === "ready" ? '2px' : '1px',
                  borderStyle: 'solid'
                }}
              >
                {/* Order Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleCardCollapse(order.id)}
                  style={{ backgroundColor: status === "ready" ? colors.bg.hover : 'transparent' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg" style={{ color: colors.text.primary }}>
                        Tavolo {order.tavolo?.numero || "---"}
                      </h3>
                      {order.tavolo?.zona && (
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          Zona {order.tavolo.zona}
                        </span>
                      )}
                      {getCleanClientName(order.note) && (
                        <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                          {getCleanClientName(order.note)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Edit button - only for ORDINATO status */}
                      {order.stato === 'ORDINATO' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingOrder(order);
                          }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.bg.hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Modifica ordine"
                        >
                          <Edit3 className="h-4 w-4" style={{ color: colors.text.secondary }} />
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: colors.text.secondary }} />
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {getElapsedTime(order.dataApertura)}
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="h-5 w-5" style={{ color: colors.text.secondary }} />
                      ) : (
                        <ChevronUp className="h-5 w-5" style={{ color: colors.text.secondary }} />
                      )}
                    </div>
                  </div>
                  
                  {/* Summary when collapsed */}
                  {isCollapsed && order.righe && order.righe.length > 0 && (
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-sm" style={{ color: colors.text.muted }}>
                        {order.righe.length} prodotti
                      </span>
                      <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                        €{Number(order.totale).toFixed(2)}
                      </span>
                      {status === "ready" && (
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium animate-pulse"
                          style={{ 
                            backgroundColor: colors.button.success,
                            color: 'white'
                          }}
                        >
                          Pronto per il servizio
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Order Items - Expanded */}
                {!isCollapsed && order.righe && order.righe.length > 0 && (
                  <div 
                    className="p-4 space-y-2"
                    style={{ 
                      borderTopWidth: '1px',
                      borderTopStyle: 'solid',
                      borderTopColor: colors.border.secondary
                    }}
                  >
                    {order.righe.map((item: LocalOrderItem) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ backgroundColor: colors.bg.hover }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium" style={{ color: colors.text.primary }}>
                              {item.quantita}x {item.prodotto.nome}
                            </span>
                            {getStatoBadge(item.stato)}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {item.postazione}
                            </span>
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {item.prodotto.categoria}
                            </span>
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        {item.stato === "PRONTO" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(item, order.id, "CONSEGNATO");
                            }}
                            disabled={updatingItems.has(item.id)}
                            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            style={{
                              backgroundColor: colors.button.success,
                              color: colors.button.successText
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = colors.button.successHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = colors.button.success;
                            }}
                          >
                            {updatingItems.has(item.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Consegnato
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {/* Order Total */}
                    <div 
                      className="flex justify-between items-center pt-3"
                      style={{ 
                        borderTopWidth: '1px',
                        borderTopStyle: 'solid',
                        borderTopColor: colors.border.secondary
                      }}
                    >
                      <span className="font-medium" style={{ color: colors.text.secondary }}>
                        Totale
                      </span>
                      <span className="text-xl font-bold" style={{ color: colors.text.primary }}>
                        €{Number(order.totale).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {/* Order Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          isOpen={true}
          onClose={() => setEditingOrder(null)}
          orderId={editingOrder.id}
          orderNumber={editingOrder.numero}
          tableNumber={editingOrder.tavolo?.numero}
          items={(editingOrder.righe || []).map(item => ({
            id: item.id,
            prodottoId: 0, // Add this to LocalLocalOrderItem if needed
            prodotto: {
              id: 0, // Add this to LocalLocalOrderItem if needed
              nome: item.prodotto.nome,
              prezzo: 0 // Add this to LocalLocalOrderItem if needed
            },
            quantita: item.quantita,
            stato: item.stato,
            postazione: item.postazione || null
          }))}
          orderStatus={editingOrder.stato}
          onUpdate={() => {
            setEditingOrder(null);
            loadOrders();
          }}
        />
      )}
      
      {/* Products Availability Modal */}
      <ProductsAvailabilityModal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
      />
      
      {/* Active Orders Unavailable Modal */}
      {unavailableProductInfo && (
        <ActiveOrdersUnavailableModal
          isOpen={showActiveOrdersModal}
          onClose={() => {
            setShowActiveOrdersModal(false);
            setUnavailableProductInfo(null);
          }}
          productName={unavailableProductInfo.productName}
          affectedOrders={unavailableProductInfo.affectedOrders}
          isUrgent={unavailableProductInfo.isUrgent}
        />
      )}
    </div>
  );
}