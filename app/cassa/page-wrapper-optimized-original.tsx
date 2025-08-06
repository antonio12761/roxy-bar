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
import { getOrdinazioniPerStato, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { creaDebito, pagaDebito, getClientiConDebiti } from "@/lib/actions/debiti";
import { getClienti, creaCliente } from "@/lib/actions/clienti";
import { useSSE, useOrderUpdates, useNotifications, useSSEEvent } from "@/contexts/sse-context";
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
  
  const [tableGroupsRitirate, setTableGroupsRitirate] = useState<TableGroup[]>([]);
  const [tableGroupsDaPagare, setTableGroupsDaPagare] = useState<TableGroup[]>([]);
  const [tableGroupsPagate, setTableGroupsPagate] = useState<TableGroup[]>([]);
  const [debiti, setDebiti] = useState<any[]>([]);
  const [clientiConDebiti, setClientiConDebiti] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableGroup | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTableDrawer, setShowTableDrawer] = useState(false);
  const [showScontrinoQueue, setShowScontrinoQueue] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"table" | "order" | "partial">("table");
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [allClients, setAllClients] = useState<any[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ nome: "", telefono: "", email: "", note: "" });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });

  // Use SSE context
  const { connected, quality, latency } = useSSE();

  // Search clients
  const searchClients = useCallback(async (search: string) => {
    try {
      setIsLoadingClients(true);
      const result = await getClienti(1, 20, search);
      if (result.success && result.data) {
        setAllClients(result.data.clienti || []);
      }
    } catch (error) {
      console.error("Errore ricerca clienti:", error);
    } finally {
      setIsLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showClientModal) {
        searchClients(clientSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, showClientModal, searchClients]);

  // Load table groups
  const loadOrders = useCallback(async () => {
    try {
      // Fetch fresh data
      const data = await getOrdinazioniPerStato();
      const serializedData = serializeDecimalData(data);
      
      // Helper function to group orders by table
      const groupOrdersByTable = (orders: any[]) => {
        const tableGroupsMap = new Map<string, TableGroup>();
        
        orders.forEach((order: any) => {
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
        
        return Array.from(tableGroupsMap.values());
      };
      
      // Group orders by state
      const ritirate = groupOrdersByTable(serializedData.ritirate || []);
      const daPagare = groupOrdersByTable(serializedData.daPagare || []);
      const pagate = groupOrdersByTable(serializedData.pagate || []);
      
      setTableGroupsRitirate(ritirate);
      setTableGroupsDaPagare(daPagare);
      setTableGroupsPagate(pagate);
      setDebiti(serializedData.debiti || []);
      setIsLoading(false);
      
      // Load clients with debts
      const clienti = await getClientiConDebiti();
      setClientiConDebiti(clienti);
      
    } catch (error) {
      console.error("Errore caricamento tavoli:", error);
      setIsLoading(false);
    }
  }, []);

  // Handle order delivered event
  const handleOrderDelivered = useCallback((data: any) => {
    console.log('[Cassa] Order delivered event received:', data);
    console.log('[Cassa] Event data structure:', JSON.stringify(data, null, 2));
    // Reload table groups to include the newly delivered order
    loadOrders();
  }, [loadOrders]);

  // Handle order paid event
  const handleOrderPaid = useCallback((data: any) => {
    console.log('[Cassa] Order paid:', data);
    // Reload table groups to reflect payment changes
    loadOrders();
  }, [loadOrders]);
  
  // Handle order status change event
  const handleOrderStatusChange = useCallback((data: any) => {
    console.log('[Cassa] Order status changed:', data);
    console.log('[Cassa] Status change details:', JSON.stringify(data, null, 2));
    // Reload when order status changes (e.g., from CONSEGNATO to PAGATO)
    loadOrders();
  }, [loadOrders]);

  // Subscribe to order events
  useOrderUpdates({
    onOrderDelivered: handleOrderDelivered,
    onOrderUpdate: handleOrderStatusChange,
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
  
  // Subscribe to order:paid event specifically
  useSSEEvent('order:paid', handleOrderPaid, [handleOrderPaid]);
  
  // Subscribe to order:status-change event for CONSEGNATO updates
  useSSEEvent('order:status-change', (data) => {
    console.log('[Cassa] Status change event:', data);
    if (data.newStatus === 'CONSEGNATO' || data.newStatus === 'RICHIESTA_CONTO') {
      console.log('[Cassa] Order delivered via status change, reloading...');
      loadOrders();
    }
  }, [loadOrders]);

  // Subscribe to debt events
  useSSEEvent('debt:created' as any, (data) => {
    console.log('[Cassa] Debt created event:', data);
    loadOrders();
  }, [loadOrders]);

  useSSEEvent('debt:paid' as any, (data) => {
    console.log('[Cassa] Debt paid event:', data);
    loadOrders();
  }, [loadOrders]);
  
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
    
    // Apply optimistic update to table groups (remove from current group)
    const tableGroupsRitirateBackup = [...tableGroupsRitirate];
    const tableGroupsDaPagareBackup = [...tableGroupsDaPagare];
    
    // Check which group the order belongs to and update
    if (tableGroupsRitirate.some(table => table.ordinazioni.some(ord => ord.id === selectedOrder.id))) {
      setTableGroupsRitirate(prev => 
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
    } else if (tableGroupsDaPagare.some(table => table.ordinazioni.some(ord => ord.id === selectedOrder.id))) {
      setTableGroupsDaPagare(prev => 
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
    }
    
    try {
      const result = await creaPagamento(
        selectedOrder.id,
        paymentMethod,
        selectedOrder.rimanente,
        selectedOrder.nomeCliente || undefined
      );
      
      if (!result.success) {
        // Rollback on failure
        setTableGroupsRitirate(tableGroupsRitirateBackup);
        setTableGroupsDaPagare(tableGroupsDaPagareBackup);
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
      setTableGroupsRitirate(tableGroupsRitirateBackup);
      setTableGroupsDaPagare(tableGroupsDaPagareBackup);
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
  
  // Reload on reconnection
  useEffect(() => {
    if (connected) {
      console.log('[Cassa] SSE Connected, reloading orders...');
      // Small delay to ensure any queued events are delivered
      setTimeout(() => {
        loadOrders();
      }, 500);
    }
  }, [connected, loadOrders]);

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: colors.text.secondary }} />
              <span className="text-base" style={{ color: colors.text.primary }}>
                {tableGroupsRitirate.length} da pagare
              </span>
            </div>
            <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: colors.text.secondary }} />
              <span className="text-base" style={{ color: colors.text.primary }}>
                {tableGroupsDaPagare.length} pagando
              </span>
            </div>
            <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />
              <span className="text-base" style={{ color: colors.text.primary }}>
                {tableGroupsPagate.length} pagati
              </span>
            </div>
            <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: colors.text.warning || colors.text.accent }} />
              <span className="text-base" style={{ color: colors.text.primary }}>
                {debiti.length} debiti
              </span>
            </div>
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
          <div className="space-y-6">
            {/* Tavoli da Pagare (CONSEGNATO/RICHIESTA_CONTO) */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Tavoli da Pagare</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {tableGroupsRitirate.length === 0 ? (
                <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                  <Package className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                  <p style={{ color: colors.text.secondary }}>Nessun tavolo da pagare</p>
                </div>
              ) : (
                tableGroupsRitirate.map((table: TableGroup) => {
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
                    className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
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
            </div>

            {/* Pagando (NON_PAGATO/PARZIALMENTE_PAGATO) */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Pagando</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {tableGroupsDaPagare.length === 0 ? (
                  <div className="col-span-3 text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                    <CreditCard className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessun ordine in pagamento</p>
                  </div>
                ) : (
                  tableGroupsDaPagare.map((table: TableGroup) => {
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
                      className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
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
            </div>

            {/* Pagato (COMPLETAMENTE_PAGATO) */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Pagato</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {tableGroupsPagate.length === 0 ? (
                  <div className="col-span-3 text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                    <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.success }} />
                    <p style={{ color: colors.text.secondary }}>Nessun ordine pagato recentemente</p>
                  </div>
                ) : (
                  tableGroupsPagate.map((table: TableGroup) => {
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
                      className="rounded-lg p-4 cursor-pointer transition-all duration-200 opacity-75 hover:opacity-100"
                      style={{ backgroundColor: colors.bg.card, borderColor: colors.text.success, borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {table.tavoloNumero === 'Asporto' ? (
                            <>
                              <Package className="h-5 w-5" style={{ color: colors.text.success }} />
                              <span className="font-medium" style={{ color: colors.text.primary }}>Asporto</span>
                            </>
                          ) : (
                            <>
                              <Users className="h-5 w-5" style={{ color: colors.text.success }} />
                              <span className="font-medium" style={{ color: colors.text.primary }}>Tavolo {table.tavoloNumero}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />
                          <span className="text-sm" style={{ color: colors.text.secondary }}>
                            {getElapsedTime(table.primaDaApertura)}
                          </span>
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
                        <div className="text-lg font-semibold" style={{ color: colors.text.success }}>
                          €{(table.totaleComplessivo || 0).toFixed(2)} ✓
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>

            {/* Debiti */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Debiti Aperti</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {debiti.length === 0 ? (
                  <div className="col-span-3 text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                    <CreditCard className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessun debito aperto</p>
                  </div>
                ) : (
                  debiti.map((debito: any) => (
                    <div
                      key={debito.id}
                      onClick={() => {
                        setSelectedDebt(debito);
                        setShowDebtModal(true);
                      }}
                      className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105"
                      style={{ backgroundColor: colors.bg.card, borderColor: colors.text.warning || colors.text.accent, borderWidth: '1px', borderStyle: 'solid' }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5" style={{ color: colors.text.warning || colors.text.accent }} />
                          <span className="font-medium" style={{ color: colors.text.primary }}>{debito.clienteNome}</span>
                        </div>
                        <span className="text-sm" style={{ color: colors.text.secondary }}>
                          Ordine #{debito.numeroOrdine}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: colors.text.secondary }}>Importo totale</span>
                          <span style={{ color: colors.text.primary }}>€{debito.importo.toFixed(2)}</span>
                        </div>
                        {debito.importoPagato > 0 && (
                          <div className="flex justify-between text-sm">
                            <span style={{ color: colors.text.secondary }}>Già pagato</span>
                            <span style={{ color: colors.text.success }}>€{debito.importoPagato.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: colors.text.secondary }}>
                          {new Date(debito.dataCreazione).toLocaleDateString('it-IT')}
                        </span>
                        <div className="text-lg font-semibold" style={{ color: colors.text.warning || colors.text.accent }}>
                          €{debito.rimanente.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                          <button
                            onClick={() => {
                              setShowClientModal(true);
                            }}
                            disabled={isProcessingPayment || (!selectedOrder && paymentMode === 'order')}
                            className="flex-1 py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={{ 
                              backgroundColor: colors.button.warning || colors.button.primary,
                              color: colors.button.warningText || colors.button.primaryText,
                              borderColor: colors.button.warning || colors.button.primary,
                              borderWidth: '1px',
                              borderStyle: 'solid'
                            }}
                            onMouseEnter={(e) => !isProcessingPayment && (e.currentTarget.style.backgroundColor = colors.button.warningHover || colors.button.warning || colors.button.primaryHover)}
                            onMouseLeave={(e) => !isProcessingPayment && (e.currentTarget.style.backgroundColor = colors.button.warning || colors.button.primary)}
                          >
                            <Clock className="h-5 w-5" />
                            Fai debito
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
      
      {/* Client Selection Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.border.primary }}>
              <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>Seleziona Cliente per Debito</h2>
              <button
                onClick={() => {
                  setShowClientModal(false);
                  setClientSearch("");
                  setShowNewClientForm(false);
                  setNewClientData({ nome: "", telefono: "", email: "", note: "" });
                }}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>

            <div className="p-6">
              {!showNewClientForm ? (
                <>
                  {/* Search Bar */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Cerca cliente per nome, telefono o email..."
                      className="w-full px-4 py-2 rounded-lg"
                      style={{ 
                        backgroundColor: colors.bg.darker,
                        color: colors.text.primary,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                    />
                  </div>

                  {/* Clients List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                    {isLoadingClients ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.text.muted }} />
                      </div>
                    ) : allClients.length === 0 ? (
                      <div className="text-center py-8" style={{ color: colors.text.secondary }}>
                        Nessun cliente trovato
                      </div>
                    ) : (
                      allClients.map((cliente) => (
                        <div
                          key={cliente.id}
                          onClick={() => setSelectedClient(cliente)}
                          className="p-4 rounded-lg cursor-pointer transition-all duration-200"
                          style={{ 
                            backgroundColor: selectedClient?.id === cliente.id ? colors.bg.hover : colors.bg.darker,
                            borderColor: selectedClient?.id === cliente.id ? colors.border.primary : colors.border.secondary,
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium" style={{ color: colors.text.primary }}>{cliente.nome}</div>
                              {cliente.telefono && (
                                <div className="text-sm" style={{ color: colors.text.secondary }}>{cliente.telefono}</div>
                              )}
                              {cliente.email && (
                                <div className="text-sm" style={{ color: colors.text.secondary }}>{cliente.email}</div>
                              )}
                            </div>
                            {cliente.totaleDebiti > 0 && (
                              <div className="text-sm" style={{ color: colors.text.error }}>
                                Debiti: €{cliente.totaleDebiti.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNewClientForm(true)}
                      className="flex-1 py-2 rounded-lg transition-colors duration-200"
                      style={{ 
                        backgroundColor: colors.button.secondary || colors.button.outlineBg,
                        color: colors.button.secondaryText || colors.button.outlineText,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                    >
                      Nuovo Cliente
                    </button>
                    <button
                      onClick={async () => {
                        if (selectedClient && ((paymentMode === 'table' && selectedTable) || (paymentMode === 'order' && selectedOrder))) {
                          setIsProcessingPayment(true);
                          try {
                            const amount = paymentMode === 'table' 
                              ? selectedTable!.rimanenteComplessivo || 0
                              : selectedOrder!.rimanente || 0;
                            
                            const orderId = paymentMode === 'table'
                              ? selectedTable!.ordinazioni[0]?.id
                              : selectedOrder!.id;

                            if (!orderId) {
                              throw new Error('ID ordine non trovato');
                            }

                            const result = await creaDebito(
                              selectedClient.id,
                              orderId,
                              amount,
                              `Debito per ${paymentMode === 'table' ? `tavolo ${selectedTable!.tavoloNumero || 'N/A'}` : `ordine #${selectedOrder!.numero || 'N/A'}`}`
                            );

                            if (result.success) {
                              setShowClientModal(false);
                              setShowTableDrawer(false);
                              setSelectedTable(null);
                              setSelectedOrder(null);
                              setSelectedClient(null);
                              loadOrders();
                            } else {
                              alert(result.error || "Errore creazione debito");
                            }
                          } catch (error) {
                            console.error("Errore creazione debito:", error);
                            alert("Errore durante la creazione del debito");
                          } finally {
                            setIsProcessingPayment(false);
                          }
                        }
                      }}
                      disabled={!selectedClient || isProcessingPayment}
                      className="flex-1 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: colors.button.primary,
                        color: colors.button.primaryText
                      }}
                    >
                      {isProcessingPayment ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        "Conferma Debito"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* New Client Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={newClientData.nome}
                        onChange={(e) => setNewClientData({ ...newClientData, nome: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          color: colors.text.primary,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                        Telefono
                      </label>
                      <input
                        type="text"
                        value={newClientData.telefono}
                        onChange={(e) => setNewClientData({ ...newClientData, telefono: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          color: colors.text.primary,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={newClientData.email}
                        onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          color: colors.text.primary,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                        Note
                      </label>
                      <textarea
                        value={newClientData.note}
                        onChange={(e) => setNewClientData({ ...newClientData, note: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          color: colors.text.primary,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowNewClientForm(false);
                          setNewClientData({ nome: "", telefono: "", email: "", note: "" });
                        }}
                        className="flex-1 py-2 rounded-lg transition-colors duration-200"
                        style={{ 
                          backgroundColor: colors.button.secondary || colors.button.outlineBg,
                          color: colors.button.secondaryText || colors.button.outlineText,
                          borderColor: colors.border.primary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      >
                        Annulla
                      </button>
                      <button
                        onClick={async () => {
                          if (newClientData.nome.trim()) {
                            try {
                              const result = await creaCliente(newClientData);
                              if (result.success) {
                                setSelectedClient((result as any).cliente);
                                setShowNewClientForm(false);
                                setNewClientData({ nome: "", telefono: "", email: "", note: "" });
                                searchClients(clientSearch);
                              } else {
                                alert(result.error || "Errore creazione cliente");
                              }
                            } catch (error) {
                              console.error("Errore creazione cliente:", error);
                              alert("Errore durante la creazione del cliente");
                            }
                          }
                        }}
                        disabled={!newClientData.nome.trim()}
                        className="flex-1 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ 
                          backgroundColor: colors.button.primary,
                          color: colors.button.primaryText
                        }}
                      >
                        Crea Cliente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debt Payment Modal */}
      {showDebtModal && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg max-w-md w-full" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.border.primary }}>
              <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>Paga Debito</h2>
              <button
                onClick={() => {
                  setShowDebtModal(false);
                  setSelectedDebt(null);
                }}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>Cliente</div>
                  <div className="font-medium" style={{ color: colors.text.primary }}>{selectedDebt.clienteNome}</div>
                </div>
                <div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>Ordine</div>
                  <div className="font-medium" style={{ color: colors.text.primary }}>
                    #{selectedDebt.numeroOrdine} {selectedDebt.tavolo && `- Tavolo ${selectedDebt.tavolo.numero}`}
                  </div>
                </div>
                <div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>Importo da pagare</div>
                  <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    €{selectedDebt.rimanente.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                  Metodo di pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["POS", "CONTANTI", "MISTO"] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className="p-2 rounded-lg transition-colors duration-200"
                      style={{ 
                        backgroundColor: paymentMethod === method ? colors.button.primary : colors.bg.hover,
                        color: paymentMethod === method ? colors.button.primaryText : colors.text.primary
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={async () => {
                  setIsProcessingPayment(true);
                  try {
                    const result = await pagaDebito(
                      selectedDebt.id,
                      selectedDebt.rimanente,
                      paymentMethod,
                      `Pagamento completo debito`
                    );

                    if (result.success) {
                      setShowDebtModal(false);
                      setSelectedDebt(null);
                      loadOrders();
                    } else {
                      alert(result.error || "Errore pagamento debito");
                    }
                  } catch (error) {
                    console.error("Errore pagamento debito:", error);
                    alert("Errore durante il pagamento del debito");
                  } finally {
                    setIsProcessingPayment(false);
                  }
                }}
                disabled={isProcessingPayment}
                className="w-full py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: colors.button.primary,
                  color: colors.button.primaryText
                }}
              >
                {isProcessingPayment ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Paga €{selectedDebt.rimanente.toFixed(2)}
                  </>
                )}
              </button>
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