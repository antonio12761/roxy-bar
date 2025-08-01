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
import { useSSE, useOrderUpdates, useNotifications } from "@/contexts/sse-context";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import PaymentHistory from "@/components/cassa/payment-history";
import ScontrinoQueueManager from "@/components/cassa/scontrino-queue-manager";
import { useTheme } from "@/contexts/ThemeContext";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { ThemeSelector } from "@/components/ui/ThemeSelector";

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
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
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
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });

  // Use SSE context
  const { connected, quality, latency } = useSSE();

  // Load table groups
  const loadOrders = useCallback(async () => {
    try {
      // Fetch fresh data
      const data = await getOrdinazioniConsegnate();
      const serializedData = serializeDecimalData(data);
      
      // Group orders by table
      const tableGroupsMap = new Map<string, TableGroup>();
      
      serializedData.forEach((order: any) => {
        const tableNumber = order.tavolo?.numero || 'Asporto';
        
        if (!tableGroupsMap.has(tableNumber)) {
          tableGroupsMap.set(tableNumber, {
            tavoloNumero: tableNumber,
            ordinazioni: [],
            totaleComplessivo: 0,
            totalePagatoComplessivo: 0,
            rimanenteComplessivo: 0,
            numeroClienti: 0,
            clientiNomi: [],
            primaDaApertura: order.dataApertura
          });
        }
        
        const group = tableGroupsMap.get(tableNumber)!;
        
        // Add order to group
        group.ordinazioni.push({
          id: order.id,
          numero: order.numero,
          tavolo: order.tavolo,
          cameriere: order.cameriere,
          righe: order.righe,
          totale: order.totale,
          totalePagato: order.totalePagamenti || 0,
          rimanente: order.rimanente,
          nomeCliente: order.nomeCliente,
          note: order.note,
          stato: order.stato,
          statoPagamento: order.statoPagamento,
          dataApertura: order.dataApertura
        });
        
        // Update totals
        group.totaleComplessivo += order.totale;
        group.totalePagatoComplessivo += order.totalePagamenti || 0;
        group.rimanenteComplessivo += order.rimanente;
        
        // Update client info
        if (order.nomeCliente) {
          group.clientiNomi.push(order.nomeCliente);
          group.numeroClienti += 1;
        } else {
          group.numeroClienti += 1;
        }
        
        // Update earliest opening time
        if (new Date(order.dataApertura) < new Date(group.primaDaApertura)) {
          group.primaDaApertura = order.dataApertura;
        }
      });
      
      // Convert map to array
      const tableGroups = Array.from(tableGroupsMap.values());
      
      setTableGroups(tableGroups);
      setIsLoading(false);
      
    } catch (error) {
      console.error("Errore caricamento tavoli:", error);
      setIsLoading(false);
    }
  }, []);

  // Handle order delivered event
  const handleOrderDelivered = useCallback((data: any) => {
    console.log('[Cassa] Order delivered:', data);
    // Reload table groups to include the newly delivered order
    loadOrders();
  }, [loadOrders]);

  // Handle order paid event
  const handleOrderPaid = useCallback((data: any) => {
    console.log('[Cassa] Order paid:', data);
    // Reload table groups to reflect payment changes
    loadOrders();
  }, [loadOrders]);

  // Subscribe to order events
  useOrderUpdates({
    onOrderDelivered: handleOrderDelivered,
    onOrderReady: (data) => {
      console.log('[Cassa] Order ready:', data);
      loadOrders();
      if (Notification.permission === "granted") {
        new Notification("Ordine Pronto", {
          body: `Tavolo ${data.tableNumber} completato`,
          icon: '/icon-192.png'
        });
      }
    }
  });
  
  // Subscribe to notifications
  useNotifications((notification) => {
    console.log('[Cassa] Notification:', notification);
    // Handle direct notifications
    if ((notification as any).type === 'order:paid') {
      handleOrderPaid((notification as any).data);
    }
    // Handle payment/receipt request notifications
    if ((notification as any).type === 'payment_request') {
      console.log('[Cassa] Payment/Receipt request received:', notification);
      // Reload orders to show the new payment request
      loadOrders();
      // Show notification to the cashier
      if (Notification.permission === "granted") {
        const data = (notification as any).data;
        new Notification("Richiesta Scontrino", {
          body: data.tableNumber 
            ? `Tavolo ${data.tableNumber} - €${data.amount?.toFixed(2)} (${data.paymentMethod || 'N/A'})`
            : `${data.orderType} - €${data.amount?.toFixed(2)} (${data.paymentMethod || 'N/A'})`,
          icon: '/icon-192.png'
        });
      }
    }
  });

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
    
    // Prevent payment if order is already paid or has no remaining balance
    if (selectedOrder.rimanente <= 0) {
      alert("Questo ordine è già stato pagato completamente.");
      return;
    }
    
    setIsProcessingPayment(true);
    
    // Store backup for rollback
    const originalStatus = selectedOrder.statoPagamento;
    
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

  const triggerParticles = (element: HTMLElement | null) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setParticlePos({ x: rect.right - 40, y: rect.top - 20 });
    setParticleKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.bg.dark }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.primary }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-96" style={{ backgroundColor: colors.bg.dark }}>
      {/* Header - Full Width Header Pattern from Style Guide */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.card }}>
        <div className="flex items-center gap-4">
          <CreditCard className="h-5 w-5" style={{ color: colors.text.secondary }} />
          <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>Postazione Cassa</h1>
          <span className="text-base" style={{ color: colors.text.secondary }}>
            {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: colors.text.secondary }} />
            <span className="text-base" style={{ color: colors.text.primary }}>
              {tableGroups.length} tavoli
            </span>
          </div>
          <div className="flex-1" />
            
          {/* Connection Status */}
          <SSEConnectionStatus 
            compact={true}
            showLatency={true}
            showReconnectAttempts={false}
          />

          {/* Theme Selector */}
          <ThemeSelector />
              
          {/* Actions */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          >
            <Clock className="h-4 w-4" />
            Storico
          </button>
              
          <button
            onClick={() => setShowScontrinoQueue(!showScontrinoQueue)}
            className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            <Receipt className="h-4 w-4" />
            Queue Scontrini
          </button>
              
          <button
            onClick={loadOrders}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <RefreshCw className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
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
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Tavoli da Pagare</h2>
              
              {tableGroups.length === 0 ? (
                <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                  <Package className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                  <p style={{ color: colors.text.secondary }}>Nessun tavolo da pagare</p>
                </div>
              ) : (
                tableGroups.map((table: TableGroup) => {
                  // Ensure table has required properties
                  if (!table || !table.ordinazioni) {
                    return null;
                  }
                  return (
                  <div
                    key={table.tavoloNumero}
                    onClick={() => {
                      setSelectedTable(table);
                      setShowTableDrawer(true);
                    }}
                    className="rounded-lg p-6 cursor-pointer transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {table.tavoloNumero === 'Asporto' ? (
                          <>
                            <Package className="h-5 w-5" style={{ color: colors.text.secondary }} />
                            <span className="font-medium" style={{ color: colors.text.primary }}>Asporto</span>
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5" style={{ color: colors.text.secondary }} />
                            <span className="font-medium" style={{ color: colors.text.primary }}>Tavolo {table.tavoloNumero}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {getElapsedTime(table.primaDaApertura)}
                        </span>
                        <ChevronRight className="h-4 w-4" style={{ color: colors.text.muted }} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-sm">
                        <span style={{ color: colors.text.secondary }}>Ordinazioni: </span>
                        <span className="font-medium" style={{ color: colors.text.primary }}>{table.ordinazioni?.length || 0}</span>
                      </div>
                      <div className="text-sm">
                        <span style={{ color: colors.text.secondary }}>Clienti: </span>
                        <span className="font-medium" style={{ color: colors.text.primary }}>{table.numeroClienti}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-sm" style={{ color: colors.text.secondary }}>
                        {table.clientiNomi?.length > 0 ? 
                          table.clientiNomi.slice(0, 2).join(', ') + 
                          (table.clientiNomi.length > 2 ? ` +${table.clientiNomi.length - 2}` : '') 
                          : 'Nessun nome cliente'
                        }
                      </div>
                      <div className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                        €{(table.rimanenteComplessivo || 0).toFixed(2)}
                      </div>
                    </div>
                    
                    {(table.totalePagatoComplessivo || 0) > 0 && (
                      <div className="mt-2 text-sm" style={{ color: colors.text.success }}>
                        Pagato parzialmente: €{table.totalePagatoComplessivo.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Azioni Rapide</h2>
              
              <div className="rounded-lg p-6 text-center" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                <AlertCircle className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                <p className="mb-4" style={{ color: colors.text.secondary }}>Seleziona un tavolo per vedere le opzioni di pagamento</p>
                <p className="text-sm" style={{ color: colors.text.muted }}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.border.primary }}>
              <div className="flex items-center gap-3">
                {selectedTable.tavoloNumero === 'Asporto' ? (
                  <>
                    <Package className="h-6 w-6" style={{ color: colors.text.secondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>Ordini Asporto</h2>
                  </>
                ) : (
                  <>
                    <Users className="h-6 w-6" style={{ color: colors.text.secondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>Tavolo {selectedTable.tavoloNumero}</h2>
                  </>
                )}
                <span className="text-sm" style={{ color: colors.text.secondary }}>
                  {selectedTable.ordinazioni?.length || 0} ordinazioni • {selectedTable.numeroClienti || 0} clienti
                </span>
              </div>
              <button
                onClick={() => {
                  setShowTableDrawer(false);
                  setSelectedTable(null);
                  setSelectedOrder(null);
                }}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Orders List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>Ordinazioni</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaymentMode('table')}
                        className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                        style={{ 
                          backgroundColor: paymentMode === 'table' ? colors.button.primary : colors.bg.hover,
                          color: paymentMode === 'table' ? colors.button.primaryText : colors.text.primary
                        }}
                      >
                        Tutto il tavolo
                      </button>
                      <button
                        onClick={() => setPaymentMode('order')}
                        className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                        style={{ 
                          backgroundColor: paymentMode === 'order' ? colors.button.primary : colors.bg.hover,
                          color: paymentMode === 'order' ? colors.button.primaryText : colors.text.primary
                        }}
                      >
                        Singola ordinazione
                      </button>
                    </div>
                  </div>
                  
                  {(selectedTable.ordinazioni || []).map((order: Order) => (
                    <div
                      key={order.id}
                      onClick={() => paymentMode === 'order' ? setSelectedOrder(order) : null}
                      className={`rounded-lg p-4 transition-all duration-200 ${
                        paymentMode === 'order'
                          ? `cursor-pointer hover:scale-105 ${
                              selectedOrder?.id === order.id ? 'ring-2' : ''
                            }`
                          : 'opacity-75'
                      }`}
                      style={{ 
                        backgroundColor: colors.bg.darker,
                        borderColor: selectedOrder?.id === order.id ? colors.border.primary : colors.border.secondary,
                        borderWidth: selectedOrder?.id === order.id ? '2px' : '1px',
                        borderStyle: 'solid'
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" style={{ color: colors.text.secondary }} />
                          <span className="font-medium" style={{ color: colors.text.primary }}>
                            Ordine #{order.numero}
                          </span>
                          {order.nomeCliente && (
                            <span className="text-sm" style={{ color: colors.text.secondary }}>- {order.nomeCliente}</span>
                          )}
                        </div>
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          {getElapsedTime(order.dataApertura)}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        {order.righe.slice(0, 3).map((item: OrderItem) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="flex items-center gap-2" style={{ color: colors.text.primary }}>
                              {item.quantita}x {item.prodotto.nome}
                              {item.isPagato && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.button.success, color: colors.button.successText }}>
                                  Pagato
                                </span>
                              )}
                            </span>
                            <span style={{ color: colors.text.primary }}>€{(item.prezzo * item.quantita).toFixed(2)}</span>
                          </div>
                        ))}
                        {order.righe.length > 3 && (
                          <div className="text-xs text-center" style={{ color: colors.text.muted }}>
                            ... e altri {order.righe.length - 3} articoli
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm" style={{ color: colors.text.secondary }}>
                          {order.righe.length} articoli • {order.cameriere.nome}
                        </div>
                        <div className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                          €{order.rimanente.toFixed(2)}
                        </div>
                      </div>
                      
                      {order.totalePagato > 0 && (
                        <div className="mt-2 text-sm" style={{ color: colors.text.success }}>
                          Pagato parzialmente: €{order.totalePagato.toFixed(2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Payment Panel */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>Pagamento</h3>
                  
                  <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: colors.bg.darker, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                    {/* Payment Summary */}
                    <div className="space-y-2">
                      {paymentMode === 'table' ? (
                        <>
                          <div className="flex justify-between">
                            <span style={{ color: colors.text.primary }}>Totale tavolo</span>
                            <span style={{ color: colors.text.primary }}>€{(selectedTable.totaleComplessivo || 0).toFixed(2)}</span>
                          </div>
                          {selectedTable.totalePagatoComplessivo > 0 && (
                            <div className="flex justify-between" style={{ color: colors.text.success }}>
                              <span>Già pagato</span>
                              <span>-€{(selectedTable.totalePagatoComplessivo || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-semibold border-t pt-2" style={{ borderColor: colors.border.secondary }}>
                            <span style={{ color: colors.text.primary }}>Da pagare</span>
                            <span style={{ color: colors.text.primary }}>€{(selectedTable.rimanenteComplessivo || 0).toFixed(2)}</span>
                          </div>
                        </>
                      ) : selectedOrder ? (
                        <>
                          <div className="flex justify-between">
                            <span style={{ color: colors.text.primary }}>Totale ordine #{selectedOrder.numero}</span>
                            <span style={{ color: colors.text.primary }}>€{selectedOrder.totale.toFixed(2)}</span>
                          </div>
                          {selectedOrder.totalePagato > 0 && (
                            <div className="flex justify-between" style={{ color: colors.text.success }}>
                              <span>Già pagato</span>
                              <span>-€{selectedOrder.totalePagato.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-semibold border-t pt-2" style={{ borderColor: colors.border.secondary }}>
                            <span style={{ color: colors.text.primary }}>Da pagare</span>
                            <span style={{ color: colors.text.primary }}>€{selectedOrder.rimanente.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4" style={{ color: colors.text.secondary }}>
                          Seleziona un'ordinazione per vedere i dettagli
                        </div>
                      )}
                    </div>

                    {/* Payment Method */}
                    {(paymentMode === 'table' || selectedOrder) && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" style={{ color: colors.text.primary }}>Metodo di pagamento</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['POS', 'CONTANTI', 'MISTO'] as const).map((method: 'POS' | 'CONTANTI' | 'MISTO') => (
                              <button
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className="py-2 px-3 rounded-lg transition-all duration-200"
                                style={{ 
                                  backgroundColor: paymentMethod === method ? colors.button.primary : 'transparent',
                                  color: paymentMethod === method ? colors.button.primaryText : colors.text.primary,
                                  borderColor: paymentMethod === method ? colors.button.primary : colors.border.primary,
                                  borderWidth: '1px',
                                  borderStyle: 'solid'
                                }}
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
                            onClick={(e) => {
                              if (paymentMode === 'table') {
                                handleTablePayment();
                              } else {
                                handlePayment();
                              }
                              triggerParticles(e.currentTarget);
                            }}
                            disabled={isProcessingPayment}
                            className="flex-1 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ 
                              backgroundColor: colors.button.success,
                              color: colors.button.successText
                            }}
                            onMouseEnter={(e) => !isProcessingPayment && (e.currentTarget.style.backgroundColor = colors.button.successHover)}
                            onMouseLeave={(e) => !isProcessingPayment && (e.currentTarget.style.backgroundColor = colors.button.success)}
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
      
      {/* Particle Effect */}
      <ParticleEffect 
        key={particleKey}
        trigger={true} 
        x={particlePos.x} 
        y={particlePos.y}
        particleCount={20}
        duration={3000}
      />
    </div>
  );
}