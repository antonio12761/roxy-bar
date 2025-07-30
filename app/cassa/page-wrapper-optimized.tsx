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
  AlertCircle,
  ChevronRight,
  X,
  User
} from "lucide-react";
import { getOrdinazioniConsegnate, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { useStationSSE } from "@/hooks/useStationSSE";
import { StationType } from "@/lib/sse/station-filters";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import PaymentHistory from "@/components/cassa/payment-history";
import ScontrinoQueueManager from "@/components/cassa/scontrino-queue-manager";

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
  note?: string | null;
  stato: string;
  statoPagamento: string;
  dataApertura: string;
}

interface TableGroup {
  tavoloNumero: string;
  ordinazioni: Order[];
  totaleComplessivo: number;
  totalePagatoComplessivo: number;
  rimanenteComplessivo: number;
  numeroClienti: number;
  clientiNomi: string[];
  primaDaApertura: string;
}

export default function CassaPageOptimized() {
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableGroup | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTableDrawer, setShowTableDrawer] = useState(false);
  const [showScontrinoQueue, setShowScontrinoQueue] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"table" | "order" | "partial">("table");
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
          // Notification for ready orders - reload to get updated table groups
          loadOrders();
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

  // Load table groups with cache support
  const loadOrders = useCallback(async () => {
    try {
      // Check cache first
      const cachedData = getCachedData<TableGroup[]>('tables:deliverable');
      if (cachedData && cachedData.length > 0) {
        console.log('[Cassa] Using cached table groups:', cachedData.length);
        setTableGroups(cachedData);
        setIsLoading(false);
      }

      // Fetch fresh data
      const data = await getOrdinazioniConsegnate();
      const serializedData = serializeDecimalData(data) as TableGroup[];
      
      setTableGroups(serializedData);
      setIsLoading(false);
      
    } catch (error) {
      console.error("Errore caricamento tavoli:", error);
      setIsLoading(false);
    }
  }, [getCachedData]);

  // Handle order delivered event
  const handleOrderDelivered = useCallback((data: any) => {
    console.log('[Cassa] Order delivered:', data);
    // Reload table groups to include the newly delivered order
    loadOrders();
    
    // If the delivered order belongs to currently selected table, refresh drawer
    if (selectedTable && showTableDrawer) {
      // The loadOrders will update the tableGroups, which will automatically update the selectedTable view
    }
  }, [loadOrders, selectedTable, showTableDrawer]);

  // Handle order paid event
  const handleOrderPaid = useCallback((data: any) => {
    console.log('[Cassa] Order paid:', data);
    // Reload table groups to reflect payment changes
    loadOrders();
    
    // Clear selections if the paid order was selected
    if (selectedOrder?.id === data.orderId) {
      setSelectedOrder(null);
    }
    
    // If all orders in the selected table are paid, close the drawer
    if (selectedTable && showTableDrawer) {
      const updatedTable = tableGroups.find((t: TableGroup) => t.tavoloNumero === selectedTable.tavoloNumero);
      if (!updatedTable || updatedTable.ordinazioni.length === 0) {
        setShowTableDrawer(false);
        setSelectedTable(null);
      }
    }
  }, [selectedOrder, loadOrders, selectedTable, showTableDrawer, tableGroups]);

  // Handle table payment (pay all orders in the table)
  const handleTablePayment = async () => {
    if (!selectedTable || isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    try {
      // Pay all orders in the table
      for (const order of selectedTable.ordinazioni) {
        if (order.rimanente > 0) {
          const result = await creaPagamento(
            order.id,
            paymentMethod,
            order.rimanente,
            order.nomeCliente || undefined
          );
          
          if (!result.success) {
            alert(`Errore pagamento ordine #${order.numero}: ${result.error}`);
            return;
          }
          
          // Generate receipt for each order
          await generaScontrino(order.id);
        }
      }
      
      // Success notification
      if (Notification.permission === "granted") {
        new Notification("Pagamento Tavolo Completato", {
          body: `€${selectedTable.rimanenteComplessivo.toFixed(2)} - ${paymentMethod}`,
          icon: '/icon-192.png'
        });
      }
      
      // Close drawer and refresh data
      setShowTableDrawer(false);
      setSelectedTable(null);
      loadOrders();
      
    } catch (error) {
      console.error("Errore pagamento tavolo:", error);
      alert("Errore durante il pagamento del tavolo");
    } finally {
      setIsProcessingPayment(false);
    }
  };

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
    
    // Apply optimistic update to table groups
    const tableGroupsBackup = [...tableGroups];
    setTableGroups(prev => 
      prev.map((table: TableGroup) => {
        if (table.ordinazioni.some((ord: Order) => ord.id === selectedOrder.id)) {
          return {
            ...table,
            ordinazioni: table.ordinazioni.filter((ord: Order) => ord.id !== selectedOrder.id),
            rimanenteComplessivo: table.rimanenteComplessivo - selectedOrder.rimanente
          };
        }
        return table;
      }).filter((table: TableGroup) => table.ordinazioni.length > 0)
    );
    
    try {
      const result = await creaPagamento(
        selectedOrder.id,
        paymentMethod,
        selectedOrder.rimanente,
        selectedOrder.nomeCliente || undefined
      );
      
      if (!result.success) {
        // Rollback on failure
        if (updateId) rollbackOptimisticUpdate(updateId);
        setTableGroups(tableGroupsBackup);
        alert(`Errore: ${result.error}`);
      } else {
        // Generate receipt
        await generaScontrino(selectedOrder.id);
        
        // Show success notification
        if (Notification.permission === "granted") {
          new Notification("Pagamento Completato", {
            body: `€${selectedOrder.rimanente.toFixed(2)} - ${paymentMethod}`,
            icon: '/icon-192.png'
          });
        }
        
        // Clear selection and refresh data
        setSelectedOrder(null);
        
        // If we're in drawer mode, refresh the table data
        if (showTableDrawer) {
          loadOrders();
        }
      }
    } catch (error) {
      // Rollback on error
      if (updateId) rollbackOptimisticUpdate(updateId);
      setTableGroups(tableGroupsBackup);
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
                {tableGroups.length} tavoli da pagare
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
                onClick={() => setShowScontrinoQueue(!showScontrinoQueue)}
                className="px-4 py-2 bg-blue-100 dark:bg-blue-700 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <Receipt className="h-4 w-4" />
                Queue Scontrini
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
          <PaymentHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />
        ) : showScontrinoQueue ? (
          <ScontrinoQueueManager 
            isOpen={showScontrinoQueue} 
            onClose={() => setShowScontrinoQueue(false)} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tables List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Tavoli da Pagare</h2>
              
              {tableGroups.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                  <Package className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Nessun tavolo da pagare</p>
                </div>
              ) : (
                tableGroups.map((table: TableGroup) => (
                  <div
                    key={table.tavoloNumero}
                    onClick={() => {
                      setSelectedTable(table);
                      setShowTableDrawer(true);
                    }}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {table.tavoloNumero === 'Asporto' ? (
                          <>
                            <Package className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">Asporto</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">Tavolo {table.tavoloNumero}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          {getElapsedTime(table.primaDaApertura)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-sm">
                        <span className="text-gray-500">Ordinazioni: </span>
                        <span className="font-medium">{table.ordinazioni.length}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Clienti: </span>
                        <span className="font-medium">{table.numeroClienti}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {table.clientiNomi.length > 0 ? 
                          table.clientiNomi.slice(0, 2).join(', ') + 
                          (table.clientiNomi.length > 2 ? ` +${table.clientiNomi.length - 2}` : '') 
                          : 'Nessun nome cliente'
                        }
                      </div>
                      <div className="text-lg font-semibold">
                        €{table.rimanenteComplessivo.toFixed(2)}
                      </div>
                    </div>
                    
                    {table.totalePagatoComplessivo > 0 && (
                      <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                        Pagato parzialmente: €{table.totalePagatoComplessivo.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Azioni Rapide</h2>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">Seleziona un tavolo per vedere le opzioni di pagamento</p>
                <p className="text-sm text-gray-400">
                  Clicca su un tavolo a sinistra per aprire i dettagli e procedere con i pagamenti
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scontrino Queue Manager */}
      <ScontrinoQueueManager 
        isOpen={showScontrinoQueue} 
        onClose={() => setShowScontrinoQueue(false)} 
      />

      {/* Table Details Drawer */}
      {showTableDrawer && selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                {selectedTable.tavoloNumero === 'Asporto' ? (
                  <>
                    <Package className="h-6 w-6 text-gray-500" />
                    <h2 className="text-xl font-semibold">Ordini Asporto</h2>
                  </>
                ) : (
                  <>
                    <Users className="h-6 w-6 text-gray-500" />
                    <h2 className="text-xl font-semibold">Tavolo {selectedTable.tavoloNumero}</h2>
                  </>
                )}
                <span className="text-sm text-gray-500">
                  {selectedTable.ordinazioni.length} ordinazioni • {selectedTable.numeroClienti} clienti
                </span>
              </div>
              <button
                onClick={() => {
                  setShowTableDrawer(false);
                  setSelectedTable(null);
                  setSelectedOrder(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Orders List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Ordinazioni</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMode('table')}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          paymentMode === 'table' 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Tutto il tavolo
                      </button>
                      <button
                        onClick={() => setPaymentMode('order')}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          paymentMode === 'order' 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Singola ordinazione
                      </button>
                    </div>
                  </div>
                  
                  {selectedTable.ordinazioni.map((order: Order) => (
                    <div
                      key={order.id}
                      onClick={() => paymentMode === 'order' ? setSelectedOrder(order) : null}
                      className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 transition-all ${
                        paymentMode === 'order'
                          ? `cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${
                              selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
                            }`
                          : 'opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            Ordine #{order.numero}
                          </span>
                          {order.nomeCliente && (
                            <span className="text-sm text-gray-500">- {order.nomeCliente}</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {getElapsedTime(order.dataApertura)}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        {order.righe.slice(0, 3).map((item: OrderItem) => (
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
                        {order.righe.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            ... e altri {order.righe.length - 3} articoli
                          </div>
                        )}
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
                  ))}
                </div>

                {/* Payment Panel */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Pagamento</h3>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
                    {/* Payment Summary */}
                    <div className="space-y-2">
                      {paymentMode === 'table' ? (
                        <>
                          <div className="flex justify-between">
                            <span>Totale tavolo</span>
                            <span>€{selectedTable.totaleComplessivo.toFixed(2)}</span>
                          </div>
                          {selectedTable.totalePagatoComplessivo > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Già pagato</span>
                              <span>-€{selectedTable.totalePagatoComplessivo.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-semibold border-t pt-2">
                            <span>Da pagare</span>
                            <span>€{selectedTable.rimanenteComplessivo.toFixed(2)}</span>
                          </div>
                        </>
                      ) : selectedOrder ? (
                        <>
                          <div className="flex justify-between">
                            <span>Totale ordine #{selectedOrder.numero}</span>
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
                        </>
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          Seleziona un'ordinazione per vedere i dettagli
                        </div>
                      )}
                    </div>

                    {/* Payment Method */}
                    {(paymentMode === 'table' || selectedOrder) && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Metodo di pagamento</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['POS', 'CONTANTI', 'MISTO'] as const).map((method: 'POS' | 'CONTANTI' | 'MISTO') => (
                              <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={`py-2 px-3 rounded-lg border transition-all ${
                                  paymentMethod === method
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                              >
                                {method === 'POS' && <CreditCard className="h-4 w-4 mx-auto mb-1" />}
                                {method === 'CONTANTI' && <Euro className="h-4 w-4 mx-auto mb-1" />}
                                {method === 'MISTO' && <Receipt className="h-4 w-4 mx-auto mb-1" />}
                                <span className="text-sm">{method}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={paymentMode === 'table' ? handleTablePayment : handlePayment}
                            disabled={isProcessingPayment}
                            className="flex-1 bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                                : 'Paga ordinazione'
                            }
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}