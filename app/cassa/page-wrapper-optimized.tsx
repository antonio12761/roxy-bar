"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  CreditCard, 
  Euro, 
  Receipt, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  Users,
  Package,
  Loader2,
  AlertCircle
} from "lucide-react";
import { getOrdinazioniConsegnate, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { useStationSSE } from "@/hooks/useStationSSE";
import { StationType } from "@/lib/sse/station-filters";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import PaymentHistory from "@/components/cassa/payment-history";

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
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
  note?: string | null;
  stato: string;
  statoPagamento: string;
  dataApertura: string;
}

export default function CassaPageOptimized() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Use optimized SSE hook
  const {
    connectionHealth,
    eventQueue,
    getCachedData,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearEventQueue
  } = useStationSSE({
    stationType: StationType.CASSA,
    userId: currentUser?.id || '',
    enableCache: true,
    enableOptimisticUpdates: true,
    autoReconnect: true
  });

  // Process SSE events
  useEffect(() => {
    eventQueue.forEach(({ event, data }) => {
      console.log(`[Cassa] Processing event: ${event}`, data);
      
      switch (event) {
        case 'order:delivered':
          handleOrderDelivered(data);
          break;
          
        case 'order:ready':
          // Notification for ready orders
          if (Notification.permission === "granted") {
            new Notification("Ordine Pronto", {
              body: `Tavolo ${data.tableNumber} completato`,
              icon: '/icon-192.png'
            });
          }
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
    try {
      // Check cache first
      const cachedOrders = getCachedData<Order[]>('orders:deliverable');
      if (cachedOrders && cachedOrders.length > 0) {
        console.log('[Cassa] Using cached orders:', cachedOrders.length);
        setOrders(cachedOrders);
        setIsLoading(false);
      }

      // Fetch fresh data
      const data = await getOrdinazioniConsegnate();
      const serializedData = serializeDecimalData(data);
      
      setOrders(serializedData);
      setIsLoading(false);
      
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
      setIsLoading(false);
    }
  }, [getCachedData]);

  // Handle order delivered event
  const handleOrderDelivered = useCallback((data: any) => {
    console.log('[Cassa] Order delivered:', data);
    // Reload orders to include the newly delivered one
    loadOrders();
  }, [loadOrders]);

  // Handle order paid event
  const handleOrderPaid = useCallback((data: any) => {
    console.log('[Cassa] Order paid:', data);
    // Remove from payable orders
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
    
    // Clear selection if it was the paid order
    if (selectedOrder?.id === data.orderId) {
      setSelectedOrder(null);
    }
  }, [selectedOrder]);

  // Process payment with optimistic updates
  const handlePayment = async () => {
    if (!selectedOrder || isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      'order',
      selectedOrder.id,
      { statoPagamento: 'COMPLETAMENTE_PAGATO' },
      { statoPagamento: selectedOrder.statoPagamento }
    );
    
    // Remove from UI immediately
    const ordersBackup = [...orders];
    setOrders(prev => prev.filter(order => order.id !== selectedOrder.id));
    
    try {
      const result = await creaPagamento(
        selectedOrder.id,
        paymentMethod,
        selectedOrder.rimanente,
        selectedOrder.nomeCliente || undefined
      );
      
      if (!result.success) {
        // Rollback on failure
        rollbackOptimisticUpdate(updateId);
        setOrders(ordersBackup);
        alert(`Errore: ${result.error}`);
      } else {
        // Generate receipt
        await generaScontrino(selectedOrder.id);
        setSelectedOrder(null);
        
        // Show success notification
        if (Notification.permission === "granted") {
          new Notification("Pagamento Completato", {
            body: `€${selectedOrder.rimanente.toFixed(2)} - ${paymentMethod}`,
            icon: '/icon-192.png'
          });
        }
      }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId);
      setOrders(ordersBackup);
      console.error("Errore pagamento:", error);
      alert("Errore durante il pagamento");
    } finally {
      setIsProcessingPayment(false);
    }
  };

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

  const getElapsedTime = (date: string) => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
              <CreditCard className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Postazione Cassa</h1>
              <span className="text-sm text-gray-500">
                {orders.length} ordini da pagare
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionHealth.status === 'connected' ? 'bg-green-500' :
                  connectionHealth.status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`} />
                <span className="text-sm text-gray-500">
                  {connectionHealth.status === 'connected' ? `${connectionHealth.latency}ms` : 'Offline'}
                </span>
              </div>
              
              {/* Actions */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Storico
              </button>
              
              <button
                onClick={loadOrders}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {showHistory ? (
          <PaymentHistory onClose={() => setShowHistory(false)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Orders List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Ordini da Pagare</h2>
              
              {orders.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                  <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Nessun ordine da pagare</p>
                </div>
              ) : (
                orders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`bg-white dark:bg-gray-800 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedOrder?.id === order.id 
                        ? 'ring-2 ring-primary shadow-lg' 
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {order.tavolo ? (
                          <>
                            <Users className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">Tavolo {order.tavolo.numero}</span>
                          </>
                        ) : (
                          <>
                            <Package className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">Asporto #{order.numero}</span>
                          </>
                        )}
                        {order.nomeCliente && (
                          <span className="text-sm text-gray-500">- {order.nomeCliente}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {getElapsedTime(order.dataApertura)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {order.righe.length} articoli • {order.cameriere.nome}
                      </div>
                      <div className="text-lg font-semibold">
                        €{order.rimanente.toFixed(2)}
                      </div>
                    </div>
                    
                    {order.totalePagato > 0 && (
                      <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                        Pagato parzialmente: €{order.totalePagato.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Payment Panel */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Dettagli Pagamento</h2>
              
              {selectedOrder ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
                  {/* Order Details */}
                  <div className="space-y-2">
                    <h3 className="font-medium">
                      {selectedOrder.tavolo 
                        ? `Tavolo ${selectedOrder.tavolo.numero}` 
                        : `Asporto #${selectedOrder.numero}`}
                      {selectedOrder.nomeCliente && ` - ${selectedOrder.nomeCliente}`}
                    </h3>
                    
                    <div className="border-t border-b py-3 space-y-2 max-h-60 overflow-y-auto">
                      {selectedOrder.righe.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {item.quantita}x {item.prodotto.nome}
                            {item.isPagato && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                Pagato
                              </span>
                            )}
                          </span>
                          <span>€{(item.prezzo * item.quantita).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Totale</span>
                      <span>€{selectedOrder.totale.toFixed(2)}</span>
                    </div>
                    {selectedOrder.totalePagato > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Già pagato</span>
                        <span>-€{selectedOrder.totalePagato.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>Da pagare</span>
                      <span>€{selectedOrder.rimanente.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Metodo di pagamento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["POS", "CONTANTI", "MISTO"] as const).map(method => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`py-2 px-3 rounded-lg border transition-all ${
                            paymentMethod === method
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {method === "POS" && <CreditCard className="h-4 w-4 mx-auto mb-1" />}
                          {method === "CONTANTI" && <Euro className="h-4 w-4 mx-auto mb-1" />}
                          {method === "MISTO" && <Receipt className="h-4 w-4 mx-auto mb-1" />}
                          <span className="text-sm">{method}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handlePayment}
                      disabled={isProcessingPayment}
                      className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessingPayment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-5 w-5" />
                      )}
                      {isProcessingPayment ? 'Elaborazione...' : 'Conferma Pagamento'}
                    </button>
                    
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
                  <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Seleziona un ordine per procedere al pagamento</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}