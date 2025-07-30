"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Coffee, ChefHat, Users, CheckCircle, RefreshCw, Loader2, ChevronDown, ChevronUp, CreditCard } from "lucide-react";
import { getOrdinazioniAperte, aggiornaStatoRiga } from "@/lib/actions/ordinazioni";
import Link from "next/link";
import { useStationSSE } from "@/hooks/useStationSSE";
import { StationType } from "@/lib/sse/station-filters";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

interface OrderItem {
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
  righe: OrderItem[];
}

export default function OrdiniInCorsoPageOptimized() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"tutti" | "prepara" | "cucina">("tutti");
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isUnmounting, setIsUnmounting] = useState(false);

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

  // Process SSE events
  useEffect(() => {
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
  }, [eventQueue]);

  // Load orders with cache support
  const loadOrders = useCallback(async () => {
    // Don't make API calls if component is unmounting
    if (isUnmounting) {
      console.log('[Cameriere] Skipping loadOrders - component unmounting');
      return;
    }

    try {
      // Check cache first
      const cachedOrders = getCachedData<Order[]>('orders:my-tables');
      if (cachedOrders && cachedOrders.length > 0 && !isUnmounting) {
        console.log('[Cameriere] Using cached orders:', cachedOrders.length);
        setOrders(cachedOrders);
        setIsLoading(false);
      }

      // Fetch fresh data only if not unmounting
      if (!isUnmounting) {
        const data = await getOrdinazioniAperte();
        const serializedData = serializeDecimalData(data);
        
        // Filter only active orders
        const activeOrders = serializedData.filter(order => 
          ["ORDINATO", "IN_PREPARAZIONE", "PRONTO"].includes(order.stato)
        );
        
        // Only update state if component is still mounted
        if (!isUnmounting) {
          setOrders(activeOrders);
          setIsLoading(false);
        }
      }
      
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
      if (!isUnmounting) {
        setIsLoading(false);
      }
    }
  }, [getCachedData, isUnmounting]);

  // Handle order ready event
  const handleOrderReady = useCallback((data: any) => {
    console.log('[Cameriere] Order ready:', data);
    
    // Update order state in UI
    setOrders(prev => prev.map((order: Order) => {
      if (order.id === data.orderId) {
        return {
          ...order,
          stato: 'PRONTO',
          righe: order.righe.map((item: OrderItem) => ({
            ...item,
            stato: 'PRONTO'
          }))
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

  // Handle status update with optimistic updates
  const handleStatusUpdate = async (item: OrderItem, orderId: string, newStatus: string) => {
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
          righe: order.righe.map((riga: OrderItem) => 
            riga.id === item.id ? { ...riga, stato: newStatus } : riga
          )
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
              righe: order.righe.map((riga: OrderItem) => 
                riga.id === item.id ? { ...riga, stato: item.stato } : riga
              )
            };
          }
          return order;
        }));
        
        alert(`Errore: ${result.error}`);
      }
    } catch (error) {
      // Rollback on error
      if (updateId) rollbackOptimisticUpdate(updateId);
      
      // Revert UI
      setOrders(prev => prev.map((order: Order) => {
        if (order.id === orderId) {
          return {
            ...order,
            righe: order.righe.map((riga: OrderItem) => 
              riga.id === item.id ? { ...riga, stato: item.stato } : riga
            )
          };
        }
        return order;
      }));
      
      console.error("Errore aggiornamento stato:", error);
      alert("Errore durante l'aggiornamento dello stato");
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
      "IN_LAVORAZIONE": { label: "In preparazione", color: "bg-blue-600" },
      "PRONTO": { label: "Pronto", color: "bg-green-600" },
      "CONSEGNATO": { label: "Consegnato", color: "bg-gray-400" },
      "ANNULLATO": { label: "Annullato", color: "bg-red-600" }
    };
    
    const config = stateMap[stato as keyof typeof stateMap] || { label: stato, color: "bg-gray-500" };
    
    return (
      <span className={`${config.color} text-white px-2 py-1 rounded-full text-xs font-medium`}>
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
    const allReady = order.righe.every((item: OrderItem) => ["CONSEGNATO", "ANNULLATO"].includes(item.stato));
    const hasReady = order.righe.some((item: OrderItem) => item.stato === "PRONTO");
    const inProgress = order.righe.some((item: OrderItem) => item.stato === "IN_LAVORAZIONE");
    
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
    if (filter === "tutti") return true;
    return order.righe.some((item: OrderItem) => 
      filter === "prepara" ? item.postazione === "PREPARA" : item.postazione === "CUCINA"
    );
  });

  // Load current user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[OrdiniInCorso] Component unmounting, cleaning up...');
      setIsUnmounting(true);
      clearEventQueue();
    };
  }, [clearEventQueue]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                console.log('[OrdiniInCorso] Navigating to /cameriere via button');
                setIsUnmounting(true);
                window.location.href = '/cameriere';
              }}
              className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white/80 hover:text-white text-sm"
              title="Torna alla dashboard"
            >
              ← Dashboard
            </button>
            <h1 className="text-2xl font-bold text-foreground">Ordini in Corso</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status with improved display */}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                connectionHealth.status === 'connected' ? 'bg-green-500' :
                connectionHealth.status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-sm text-white/70">
                {connectionHealth.status === 'connected' ? `${connectionHealth.latency}ms` : 
                 connectionHealth.status === 'connecting' ? 'Connessione...' : 'Offline'}
              </span>
            </div>
            
            <button
              onClick={loadOrders}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`h-5 w-5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("tutti")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === "tutti" 
                ? "bg-white/20 text-white" 
                : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
            }`}
          >
            Tutti ({orders.length})
          </button>
          <button
            onClick={() => setFilter("prepara")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === "prepara" 
                ? "bg-white/20 text-white" 
                : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
            }`}
          >
            Prepara
          </button>
          <button
            onClick={() => setFilter("cucina")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === "cucina" 
                ? "bg-white/20 text-white" 
                : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
            }`}
          >
            Cucina
          </button>
        </div>
      </div>

      {/* Orders */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-lg">Nessun ordine in corso</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order: Order) => {
            const orderStatus = getOrderStatus(order);
            const isCollapsed = collapsedCards.has(order.id);
            const statusColors = {
              pending: "border-slate-600 bg-slate-800",
              inProgress: "border-blue-500/50 bg-blue-950/20",
              ready: "border-green-500/50 bg-green-950/20",
              completed: "border-gray-500/50 bg-gray-800/50"
            };
            
            return (
              <div key={order.id} className={`${statusColors[orderStatus]} rounded-lg border-2 transition-all duration-200 shadow-lg`}>
                {/* Card Header - Always Visible */}
                <div className="p-4 cursor-pointer" onClick={() => toggleCardCollapse(order.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-white/70" />
                      {order.tavolo && (
                        <span className="font-bold text-lg text-foreground">
                          {order.tavolo.numero}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {getCleanClientName(order.note)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Order Status Indicator */}
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        orderStatus === 'completed' ? 'bg-gray-600 text-white' :
                        orderStatus === 'ready' ? 'bg-green-600 text-white animate-pulse' :
                        orderStatus === 'inProgress' ? 'bg-blue-600 text-white' :
                        'bg-yellow-600 text-white'
                      }`}>
                        {orderStatus === 'completed' ? 'Completato' :
                         orderStatus === 'ready' ? 'Pronto!' :
                         orderStatus === 'inProgress' ? 'In Lavorazione' :
                         'In Attesa'}
                      </div>
                      
                      <span className="text-sm text-muted-foreground">
                        {getElapsedTime(order.dataApertura)} fa
                      </span>
                      <span className="text-white/70 font-medium">
                        €{order.totale.toFixed(2)}
                      </span>
                      
                      {/* Toggle Icon */}
                      {isCollapsed ? (
                        <ChevronDown className="h-5 w-5 text-white/70" />
                      ) : (
                        <ChevronUp className="h-5 w-5 text-white/70" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Content - Expandable */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 border-t border-slate-700/50">
                    {/* Order Items - Single Container */}
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-600/30">
                      <div className="space-y-2">
                        {order.righe.map((item: OrderItem) => (
                          <div key={item.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">
                                {item.quantita}x {item.prodotto.nome}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {item.postazione === "CUCINA" ? (
                                  <ChefHat className="h-3 w-3" />
                                ) : (
                                  <Coffee className="h-3 w-3" />
                                )}
                                {item.postazione}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatoBadge(item.stato)}
                              {item.stato === "IN_LAVORAZIONE" && item.timestampInizio && (
                                <span className="text-xs text-muted-foreground">
                                  {getElapsedTime(item.timestampInizio)}
                                </span>
                              )}
                              {/* Action buttons for status updates */}
                              {item.stato === "PRONTO" && !updatingItems.has(item.id) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(item, order.id, "CONSEGNATO");
                                  }}
                                  className="p-1 hover:bg-green-600/20 rounded transition-colors"
                                  title="Segna come consegnato"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                </button>
                              )}
                              {updatingItems.has(item.id) && (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Note */}
                    {order.note && (
                      <div className="mt-3 p-2 bg-slate-900/30 rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        {getCleanClientName(order.note)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}