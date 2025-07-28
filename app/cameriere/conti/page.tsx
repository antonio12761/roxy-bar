"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, Euro, Calendar, Search, ChevronDown, ChevronRight, MapPin, Clock, User, CreditCard, CheckCircle, Plus, Minus, X, FileText, History } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";
import { getOrdinazioniConsegnate } from "@/lib/actions/cassa";
import { richiediPagamento, richiediScontrino } from "@/lib/actions/pagamenti";
import { toast } from "@/lib/toast";
import PaymentHistory from "@/components/cassa/payment-history";
import { useCameriere } from "@/contexts/cameriere-context";

interface DeliveredOrder {
  id: string;
  tavolo: { numero: string } | null;
  tipo: "TAVOLO" | "ASPORTO" | "BANCONE";
  cameriere: { nome: string };
  totale: number;
  pagato: boolean;
  statoPagamento: "NON_PAGATO" | "PARZIALMENTE_PAGATO" | "COMPLETAMENTE_PAGATO";
  dataConsegna: string;
  // Informazioni dettagliate per pagamenti parziali
  totalePagamenti: number;
  rimanente: number;
  righePagate: number;
  righeNonPagate: number;
  totaleRighePagate: number;
  totaleRigheNonPagate: number;
  hasPagamentoParziale: boolean;
  righe: Array<{
    prezzo: number;
    quantita: number;
    isPagato: boolean;
    pagatoDa?: string;
    prodotto: { nome: string };
  }>;
  pagamenti: Array<{
    importo: number;
    modalita: string;
  }>;
}

interface TableGroup {
  tableNumber: string;
  totalOrders: number;
  totalAmount: number;
  totalPaid: number;
  totalUnpaid: number;
  partiallyPaidOrders: number;
  fullyPaidOrders: number;
  unpaidOrders: number;
  orders: DeliveredOrder[];
}

interface SelectedItem {
  orderId: string;
  rigaId: string;
  productName: string;
  originalQuantity: number;
  selectedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  customerName: string;
  tableNumber: string;
}

interface GroupedProduct {
  productName: string;
  totalQuantity: number;
  unitPrice: number;
  totalPrice: number;
  items: Array<{
    orderId: string;
    rigaId: string;
    quantity: number;
    customerName: string;
    isPagato: boolean;
    pagatoDa?: string;
  }>;
}

export default function ContiPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalUnpaid: 0
  });
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CONTANTI' | 'POS' | null>(null);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  
  // Use cameriere context to communicate with layout
  const { setIsConnected } = useCameriere();

  // SSE for real-time updates when orders are delivered
  const { notifications, isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-conti",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      // Skip notifications during initial load
      if (isInitialLoadRef.current) {
        console.log("⏸️ Skipping notification during initial load");
        return;
      }
      
      console.log("📨 Cameriere received notification:", notification.type, notification);
      
      // Refresh when orders are delivered or paid
      if (notification.type === "order:delivered" || 
          notification.type === "order:paid" ||
          notification.type === "order_delivered" ||
          notification.type === "payment_completed") {
        // Debounce rapid updates with longer delay
        const now = Date.now();
        if (now - lastUpdateRef.current > 3000) { // Increased from 1000ms to 3000ms
          lastUpdateRef.current = now;
          console.log("🔄 Refreshing delivered orders after", notification.type);
          fetchDeliveredOrders();
        } else {
          console.log("⏳ Skipping refresh - too soon after last update");
        }
      }
    }
  });

  useEffect(() => {
    fetchDeliveredOrders();
  }, []);

  // Update layout connection status when SSE connection changes
  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  const fetchDeliveredOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getOrdinazioniConsegnate();
      
      const grouped = groupOrdersByTable(data);
      setTableGroups(grouped);
      calculateTotalStats(grouped);
      
      // Mark initial load as complete after first successful fetch
      if (isInitialLoadRef.current) {
        setTimeout(() => {
          isInitialLoadRef.current = false;
          console.log("✅ Initial load complete, SSE notifications enabled");
        }, 1000); // Give a small delay to avoid immediate notifications
      }
    } catch (error) {
      console.error('Error fetching delivered orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupOrdersByTable = (orders: DeliveredOrder[]): TableGroup[] => {
    const groups: { [key: string]: TableGroup } = {};
    
    orders.forEach(order => {
      const tableNumber = order.tavolo?.numero || (order.tipo === 'ASPORTO' ? 'ASPORTO' : order.tipo);
      
      if (!groups[tableNumber]) {
        groups[tableNumber] = {
          tableNumber,
          totalOrders: 0,
          totalAmount: 0,
          totalPaid: 0,
          totalUnpaid: 0,
          partiallyPaidOrders: 0,
          fullyPaidOrders: 0,
          unpaidOrders: 0,
          orders: []
        };
      }
      
      groups[tableNumber].orders.push(order);
      groups[tableNumber].totalOrders++;
      groups[tableNumber].totalAmount += order.totale;
      
      // Usa i dati più precisi dei pagamenti parziali
      groups[tableNumber].totalPaid += order.totalePagamenti;
      groups[tableNumber].totalUnpaid += order.rimanente;
      
      // Conta gli ordini per stato di pagamento
      if (order.statoPagamento === 'COMPLETAMENTE_PAGATO') {
        groups[tableNumber].fullyPaidOrders++;
      } else if (order.statoPagamento === 'PARZIALMENTE_PAGATO') {
        groups[tableNumber].partiallyPaidOrders++;
      } else {
        groups[tableNumber].unpaidOrders++;
      }
    });
    
    return Object.values(groups).sort((a, b) => {
      // Sort by table number, putting ASPORTO and other types at the end
      if (a.tableNumber === 'ASPORTO') return 1;
      if (b.tableNumber === 'ASPORTO') return -1;
      if (a.tableNumber === 'BANCONE') return 1;
      if (b.tableNumber === 'BANCONE') return -1;
      return parseInt(a.tableNumber) - parseInt(b.tableNumber);
    });
  };

  const calculateTotalStats = (groups: TableGroup[]) => {
    const stats = groups.reduce((acc, group) => ({
      totalOrders: acc.totalOrders + group.totalOrders,
      totalAmount: acc.totalAmount + group.totalAmount,
      totalPaid: acc.totalPaid + group.totalPaid,
      totalUnpaid: acc.totalUnpaid + group.totalUnpaid
    }), { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalUnpaid: 0 });
    
    setTotalStats(stats);
  };

  const toggleTableExpansion = (tableNumber: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableNumber)) {
      newExpanded.delete(tableNumber);
    } else {
      newExpanded.add(tableNumber);
    }
    setExpandedTables(newExpanded);
  };

  // Raggruppa prodotti per nome e prezzo
  const groupProductsByNameAndPrice = (orders: DeliveredOrder[]) => {
    const grouped: { [key: string]: GroupedProduct } = {};
    
    orders.forEach(order => {
      const customerName = order.cameriere.nome;
      
      order.righe.forEach((riga: any) => {
        const key = `${riga.prodotto.nome}-${riga.prezzo}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            productName: riga.prodotto.nome,
            totalQuantity: 0,
            unitPrice: riga.prezzo,
            totalPrice: 0,
            items: []
          };
        }
        
        grouped[key].totalQuantity += riga.quantita;
        grouped[key].totalPrice += riga.quantita * riga.prezzo;
        grouped[key].items.push({
          orderId: order.id,
          rigaId: riga.id,
          quantity: riga.quantita,
          customerName,
          isPagato: riga.isPagato,
          pagatoDa: riga.pagatoDa
        });
      });
    });
    
    return Object.values(grouped);
  };

  // Seleziona/deseleziona prodotto
  const toggleProductSelection = (order: DeliveredOrder, riga: any, quantity: number = 1) => {
    // Solo prodotti non pagati possono essere selezionati
    if (riga.isPagato) return;

    const existingIndex = selectedItems.findIndex(item => 
      item.orderId === order.id && item.rigaId === riga.id
    );

    if (existingIndex >= 0) {
      // Aggiorna quantità esistente
      const newSelectedItems = [...selectedItems];
      newSelectedItems[existingIndex].selectedQuantity = quantity;
      newSelectedItems[existingIndex].totalPrice = quantity * riga.prezzo;
      
      if (quantity <= 0) {
        // Rimuovi se quantità è 0
        newSelectedItems.splice(existingIndex, 1);
      }
      
      setSelectedItems(newSelectedItems);
    } else if (quantity > 0) {
      // Aggiungi nuovo item
      const newItem: SelectedItem = {
        orderId: order.id,
        rigaId: riga.id,
        productName: riga.prodotto.nome,
        originalQuantity: riga.quantita,
        selectedQuantity: quantity,
        unitPrice: riga.prezzo,
        totalPrice: quantity * riga.prezzo,
        customerName: order.cameriere.nome,
        tableNumber: order.tavolo?.numero || 'N/A'
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  // Seleziona/deseleziona tutti i prodotti non pagati di un ordine
  const toggleOrderSelection = (order: DeliveredOrder) => {
    // Solo prodotti non pagati
    const unpaidItems = order.righe.filter(riga => !riga.isPagato);
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    const isFullySelected = unpaidItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );

    if (isFullySelected) {
      // Deseleziona tutti i prodotti dell'ordine
      setSelectedItems(prev => prev.filter(item => item.orderId !== order.id));
    } else {
      // Seleziona tutti i prodotti non pagati dell'ordine
      const newSelectedItems = [...selectedItems.filter(item => item.orderId !== order.id)];
      
      unpaidItems.forEach((riga: any) => {
        const newItem: SelectedItem = {
          orderId: order.id,
          rigaId: riga.id,
          productName: riga.prodotto.nome,
          originalQuantity: riga.quantita,
          selectedQuantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo,
          customerName: order.cameriere.nome,
          tableNumber: order.tavolo?.numero || 'N/A'
        };
        newSelectedItems.push(newItem);
      });
      
      setSelectedItems(newSelectedItems);
    }
  };

  // Controlla se un ordine è completamente selezionato
  const isOrderFullySelected = (order: DeliveredOrder) => {
    const unpaidItems = order.righe.filter(riga => !riga.isPagato);
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return unpaidItems.length > 0 && unpaidItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );
  };

  // Controlla se un ordine è parzialmente selezionato
  const isOrderPartiallySelected = (order: DeliveredOrder) => {
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return selectedOrderItems.length > 0 && !isOrderFullySelected(order);
  };

  // Seleziona/deseleziona tutto il tavolo
  const toggleTableSelection = (group: TableGroup) => {
    const allUnpaidItems: SelectedItem[] = [];
    
    group.orders.forEach(order => {
      const unpaidRighe = order.righe.filter(riga => !riga.isPagato);
      unpaidRighe.forEach(riga => {
        allUnpaidItems.push({
          orderId: order.id,
          rigaId: riga.id,
          productName: riga.prodotto.nome,
          originalQuantity: riga.quantita,
          selectedQuantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo,
          customerName: order.cameriere.nome,
          tableNumber: group.tableNumber
        });
      });
    });

    // Controlla se tutti gli items del tavolo sono già selezionati
    const tableItemsSelected = allUnpaidItems.every(item =>
      selectedItems.some(sel => 
        sel.orderId === item.orderId && sel.rigaId === item.rigaId
      )
    );

    if (tableItemsSelected) {
      // Deseleziona tutto il tavolo
      const orderIds = group.orders.map(o => o.id);
      setSelectedItems(prev => prev.filter(item => !orderIds.includes(item.orderId)));
    } else {
      // Seleziona tutto il tavolo
      setSelectedItems(prev => {
        const newItems = [...prev];
        allUnpaidItems.forEach(item => {
          const existingIndex = newItems.findIndex(sel => 
            sel.orderId === item.orderId && sel.rigaId === item.rigaId
          );
          if (existingIndex === -1) {
            newItems.push(item);
          }
        });
        return newItems;
      });
    }
  };

  // Controlla se il tavolo è completamente selezionato
  const isTableFullySelected = (group: TableGroup) => {
    const unpaidItemsCount = group.orders.reduce((sum, order) => 
      sum + order.righe.filter(riga => !riga.isPagato).length, 0
    );
    
    if (unpaidItemsCount === 0) return false;
    
    const selectedTableItems = selectedItems.filter(item => 
      group.orders.some(order => order.id === item.orderId)
    );
    
    return selectedTableItems.length === unpaidItemsCount;
  };

  // Gestisci pagamento diretto del cameriere
  const handleWaiterPayment = async () => {
    if (selectedItems.length === 0 || !paymentMethod) return;

    setProcessingPayment(true);
    try {
      const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      // Mostra successo pagamento
      toast.success(`Pagamento ${paymentMethod} di €${totalAmount.toFixed(2)} ricevuto`);
      
      // Prepara i dati per la richiesta scontrino
      const itemsForReceipt = selectedItems.map(item => ({
        orderId: item.orderId,
        totalPrice: item.totalPrice
      }));
      
      // Invia richiesta scontrino alla cassa
      const result = await richiediScontrino(
        itemsForReceipt,
        totalAmount,
        paymentMethod,
        '' // waiterName verrà preso dalla sessione utente
      );
      
      if (result.success) {
        toast.info('Richiesta scontrino inviata alla cassa');
      } else {
        toast.error(result.error || 'Errore invio richiesta scontrino');
      }
      
      // Pulisci selezione
      setSelectedItems([]);
      setShowPaymentModal(false);
      setPaymentMethod(null);
      
      // Ricarica dati
      await fetchDeliveredOrders();
    } catch (error) {
      console.error('Errore gestione pagamento:', error);
      toast.error('Errore durante il pagamento');
    } finally {
      setProcessingPayment(false);
    }
  };

  const filteredTableGroups = tableGroups.filter(group => 
    group.tableNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.orders.some(order => 
      order.cameriere.nome.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getTableIcon = (tableNumber: string) => {
    if (tableNumber === 'ASPORTO') return '📦';
    if (tableNumber === 'BANCONE') return '🍺';
    return '🪑';
  };

  const getPaymentStatusColor = (statoPagamento: string) => {
    switch (statoPagamento) {
      case 'COMPLETAMENTE_PAGATO': return "text-green-400";
      case 'PARZIALMENTE_PAGATO': return "text-yellow-400";
      default: return "text-red-400";
    }
  };

  const getPaymentStatusText = (order: DeliveredOrder) => {
    switch (order.statoPagamento) {
      case 'COMPLETAMENTE_PAGATO': 
        return 'Pagato';
      case 'PARZIALMENTE_PAGATO': 
        return `Parziale (€${order.totalePagamenti.toFixed(2)}/€${order.totale.toFixed(2)})`;
      default: 
        return 'Da pagare';
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/cameriere" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-white/70" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Conti Clienti</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPaymentHistory(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/15/20 hover:bg-white/15/30 border border-white/20-500/30 rounded-lg transition-colors"
            >
              <History className="h-4 w-4 text-white/70" />
              <span className="font-medium text-white/70">Storico Pagamenti</span>
            </button>
            <ConnectionStatusIndicator 
              connectionHealth={connectionHealth}
            />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca per tavolo o cameriere..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Caricamento conti...</div>
        </div>
      ) : (
        <>
          {/* Table Groups */}
          <div className="space-y-4">
            {filteredTableGroups.map((group) => (
              <Card key={group.tableNumber} className="overflow-hidden">
                <CardHeader 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isTableFullySelected(group)}
                        onChange={() => toggleTableSelection(group)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 cursor-pointer"
                        title="Seleziona tutto il tavolo"
                        disabled={group.unpaidOrders === 0}
                      />
                      <button
                        onClick={() => toggleTableExpansion(group.tableNumber)}
                        className="p-1 hover:bg-muted rounded flex items-center gap-2"
                      >
                        {expandedTables.has(group.tableNumber) ? 
                          <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                        <span className="text-lg">{getTableIcon(group.tableNumber)}</span>
                        <CardTitle className="text-lg">
                          {group.tableNumber === 'ASPORTO' ? 'Asporto' : 
                           group.tableNumber === 'BANCONE' ? 'Bancone' : 
                           `Tavolo ${group.tableNumber}`}
                        </CardTitle>
                      </button>
                      <div className="text-sm text-muted-foreground">
                        {group.totalOrders} ordinazioni
                        {group.partiallyPaidOrders > 0 && (
                          <span className="ml-2 px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs">
                            {group.partiallyPaidOrders} parziali
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        € {group.totalAmount.toFixed(2)}
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-white/60">Pagato: €{group.totalPaid.toFixed(2)}</span>
                        {group.totalUnpaid > 0 && (
                          <span className="text-white/50">Da pagare: €{group.totalUnpaid.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                {expandedTables.has(group.tableNumber) && (
                  <CardContent className="pt-0 border-t border-border">
                    {/* Ordinazioni per cliente */}
                    {group.orders.map((order: any) => {
                      const customerName = order.cameriere.nome;
                      const orderTotal = order.totale;
                      
                      return (
                        <div key={order.id} className="p-4 border-t border-border/50">
                          {/* Cliente, Orario e Totale Ordinazione */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isOrderFullySelected(order)}
                                onChange={() => toggleOrderSelection(order)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 cursor-pointer"
                                title="Seleziona ordinazione per pagamento"
                                disabled={order.righeNonPagate === 0}
                              />
                              <User className="h-4 w-4 text-white/60" />
                              <span className="font-medium">{customerName}</span>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(order.dataConsegna).toLocaleTimeString('it-IT', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              {order.statoPagamento === 'PARZIALMENTE_PAGATO' && (
                                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
                                  Parziale
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold text-white/60">
                              €{orderTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Prodotti Accorpati */}
                    <div className="p-4 pt-0">
                      <div className="pl-6 space-y-2">
                        {groupProductsByNameAndPrice(group.orders).map((product, index) => {
                          // Calcola quantità selezionata per questo prodotto
                          let selectedQuantity = 0;
                          product.items.forEach(item => {
                            const selected = selectedItems.find(sel => 
                              sel.orderId === item.orderId && sel.rigaId === item.rigaId
                            );
                            if (selected) {
                              selectedQuantity += selected.selectedQuantity;
                            }
                          });
                          
                          const productKey = `${group.tableNumber}-${index}`;
                          const isProductExpanded = expandedProducts.has(productKey);
                          const hasUnpaidItems = product.items.some(item => !item.isPagato);
                          const paidQuantity = product.items.filter(item => item.isPagato).reduce((sum, item) => sum + item.quantity, 0);
                          const unpaidQuantity = product.items.filter(item => !item.isPagato).reduce((sum, item) => sum + item.quantity, 0);
                          const isFullyPaid = unpaidQuantity === 0;
                          
                          return (
                            <div key={index} className="space-y-1">
                              <div 
                                className={`flex items-center justify-between p-2 rounded ${
                                  product.items.length > 1 && hasUnpaidItems ? 'cursor-pointer' : ''
                                } ${
                                  isFullyPaid ? 'bg-muted/10 opacity-60' :
                                  selectedQuantity > 0 ? 'bg-white/10 border border-white/15' : 
                                  'hover:bg-muted/30'
                                } transition-colors`}
                                onClick={() => {
                                  if (product.items.length > 1) {
                                    setExpandedProducts(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(productKey)) {
                                        newSet.delete(productKey);
                                      } else {
                                        newSet.add(productKey);
                                      }
                                      return newSet;
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {hasUnpaidItems && (
                                    <input
                                      type="checkbox"
                                      checked={selectedQuantity === product.items.filter(item => !item.isPagato).reduce((sum, item) => sum + item.quantity, 0)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const unpaidItems = product.items.filter(item => !item.isPagato);
                                        const totalUnpaidQty = unpaidItems.reduce((sum, item) => sum + item.quantity, 0);
                                        
                                        if (selectedQuantity === totalUnpaidQty) {
                                          // Deseleziona tutti
                                          unpaidItems.forEach(item => {
                                            const order = group.orders.find((o: any) => o.id === item.orderId);
                                            const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                            if (order && riga) {
                                              toggleProductSelection(order, riga, 0);
                                            }
                                          });
                                        } else {
                                          // Seleziona tutti non pagati
                                          unpaidItems.forEach(item => {
                                            const order = group.orders.find((o: any) => o.id === item.orderId);
                                            const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                            if (order && riga) {
                                              toggleProductSelection(order, riga, item.quantity);
                                            }
                                          });
                                        }
                                      }}
                                      className="w-4 h-4 cursor-pointer"
                                      title="Seleziona tutti i prodotti del gruppo"
                                    />
                                  )}
                                  {product.items.length > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedProducts(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(productKey)) {
                                            newSet.delete(productKey);
                                          } else {
                                            newSet.add(productKey);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="p-0.5"
                                    >
                                      {isProductExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-sm font-medium w-8">
                                    {product.totalQuantity}x
                                  </span>
                                  <span className={`text-sm ${isFullyPaid ? 'line-through text-muted-foreground' : ''}`}>{product.productName}</span>
                                  {!hasUnpaidItems && (
                                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                                      ✓ Tutto Pagato
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-medium">
                                    €{product.totalPrice.toFixed(2)}
                                  </span>
                                  {paidQuantity > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {paidQuantity}x pagato
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Dropdown con dettagli singoli prodotti */}
                              {isProductExpanded && product.items.length > 1 && (
                                <div className="ml-8 space-y-1 border-l-2 border-gray-200 pl-4">
                                  {product.items.map((item, itemIndex) => {
                                    const order = group.orders.find((o: any) => o.id === item.orderId);
                                    const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                    const selected = selectedItems.find(sel => 
                                      sel.orderId === item.orderId && sel.rigaId === item.rigaId
                                    );
                                    const isSelected = selected && selected.selectedQuantity > 0;
                                    
                                    return (
                                      <div
                                        key={itemIndex}
                                        className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
                                          item.isPagato ? 'bg-muted/10 opacity-60' : 'hover:bg-muted/20'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {!item.isPagato && (
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {
                                                if (order && riga) {
                                                  toggleProductSelection(order, riga, isSelected ? 0 : item.quantity);
                                                }
                                              }}
                                              className="w-3 h-3 cursor-pointer"
                                            />
                                          )}
                                          <span className={`text-xs ${item.isPagato ? 'line-through' : ''} text-muted-foreground`}>
                                            {item.quantity}x - {item.customerName}
                                          </span>
                                          {item.isPagato && item.pagatoDa && (
                                            <span className="text-xs bg-green-600/20 text-green-400 px-1 rounded" title={`Pagato da: ${item.pagatoDa}`}>
                                              ✓ {item.pagatoDa}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-xs font-medium">
                                          €{(item.quantity * product.unitPrice).toFixed(2)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          
          {/* Empty State */}
          {filteredTableGroups.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nessuna ordinazione consegnata trovata</p>
            </div>
          )}
        </>
      )}

      {/* Bottom Action Bar - Visible when items are selected */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg p-4 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {selectedItems.length} prodott{selectedItems.length === 1 ? 'o' : 'i'} selezionat{selectedItems.length === 1 ? 'o' : 'i'}
              </span>
              <span className="text-lg font-bold">
                €{selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedItems([])}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Annulla
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('CONTANTI');
                  setShowPaymentModal(true);
                }}
                disabled={processingPayment}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg flex items-center gap-2"
              >
                <Euro className="h-4 w-4" />
                Contanti
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('POS');
                  setShowPaymentModal(true);
                }}
                disabled={processingPayment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                POS
              </button>
            </div>
          </div>
          
          {/* Selected Items Summary */}
          <div className="mt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                selectedItems.reduce((acc, item) => {
                  const key = `${item.productName}`;
                  if (!acc[key]) {
                    acc[key] = 0;
                  }
                  acc[key] += item.selectedQuantity;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([product, quantity]) => (
                <span key={product} className="bg-muted px-2 py-1 rounded">
                  {quantity}x {product}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowPaymentModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 w-96 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Conferma Pagamento {paymentMethod === 'CONTANTI' ? 'in Contanti' : 'con POS'}
            </h3>
            
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Totale da incassare</div>
              <div className="text-2xl font-bold text-white/60">
                €{selectedItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
              </div>
            </div>

            {paymentMethod === 'CONTANTI' && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400">
                  Ricevi i contanti dal cliente e conferma il pagamento
                </p>
              </div>
            )}

            {paymentMethod === 'POS' && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  Procedi con il pagamento POS e conferma quando completato
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleWaiterPayment}
                disabled={processingPayment}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground rounded-lg flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Conferma Pagamento
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentMethod(null);
                }}
                disabled={processingPayment}
                className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      <PaymentHistory 
        isOpen={showPaymentHistory}
        onClose={() => setShowPaymentHistory(false)}
      />
    </>
  );
}