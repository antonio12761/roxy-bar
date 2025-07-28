"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CreditCard, 
  Euro, 
  Wallet, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  ShoppingBag, 
  User,
  Plus,
  Minus,
  X,
  FileText,
  History,
  Gift
} from "lucide-react";
import { useSSE } from "@/contexts/sse-context";
import { getOrdinazioniConsegnate, getRichiesteScontrino, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { pagaContoAltri, getTavoliConContiAperti } from "@/lib/actions/contributi";
import { toast } from "@/lib/toast";
import PaymentHistory from "@/components/cassa/payment-history";
import UserDisplay from "@/components/UserDisplay";

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
    pagatoDa: string | null;
  }>;
}

interface DrawerSummary {
  totalAmount: number;
  totalItems: number;
}

export default function CassaPageWrapper() {
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [receiptRequests, setReceiptRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CONTANTI' | 'POS' | null>(null);
  const [payerName, setPayerName] = useState('');
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showPagaPerAltriModal, setShowPagaPerAltriModal] = useState(false);
  const [clientePagatore, setClientePagatore] = useState("");
  const [tavoliAperti, setTavoliAperti] = useState<any[]>([]);
  const [processingReceipts, setProcessingReceipts] = useState<Set<string>>(new Set());
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<'CONTANTI' | 'POS' | null>(null);
  const [receiptPayerName, setReceiptPayerName] = useState('');
  const [showReceiptPaymentModal, setShowReceiptPaymentModal] = useState(false);
  const loadOrdersRef = useRef<() => Promise<void>>(null as any);

  // SSE per notifiche real-time
  const { subscribe } = useSSE();

  // Carica ordinazioni consegnate e richieste scontrino
  const loadOrdinazioni = async () => {
    setIsLoading(true);
    try {
      const [ordersData, receiptsData] = await Promise.all([
        getOrdinazioniConsegnate(),
        getRichiesteScontrino()
      ]);
      setDeliveredOrders(ordersData);
      setReceiptRequests(receiptsData);
    } catch (error) {
      console.error("Errore caricamento dati cassa:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTavoliAperti = async () => {
    try {
      const result = await getTavoliConContiAperti();
      if (result.success) {
        setTavoliAperti(result.data);
      }
    } catch (error) {
      console.error("Errore caricamento tavoli aperti:", error);
    }
  };

  // Store reference to loadOrdinazioni
  useEffect(() => {
    loadOrdersRef.current = loadOrdinazioni;
  });

  useEffect(() => {
    loadOrdinazioni();
    
    // Subscribe to order events
    const unsubscribeOrderNew = subscribe('order:new', (data) => {
      console.log('🎉 CASSA: Ricevuto evento order:new:', data);
      loadOrdinazioni();
    });
    
    const unsubscribeOrderUpdate = subscribe('order:status-change', (data) => {
      console.log('Aggiornamento stato ordinazione:', data);
      loadOrdinazioni();
    });
    
    return () => {
      unsubscribeOrderNew();
      unsubscribeOrderUpdate();
    };
  }, [subscribe]);

  // Raggruppa prodotti per nome e prezzo
  const groupProductsByNameAndPrice = (orders: any[]) => {
    const grouped: { [key: string]: GroupedProduct } = {};
    
    orders.forEach(order => {
      const customerName = order.cliente?.nome || order.nomeCliente || 'Cliente sconosciuto';
      
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
          isPagato: riga.isPagato || false,
          pagatoDa: riga.pagatoDa || null
        });
      });
    });
    
    return Object.values(grouped);
  };

  // Ordinamento tavoli secondo sequenza specifica
  const groupOrdersByTable = () => {
    const grouped: { [key: string]: any[] } = {};
    const singleOrders: Array<{ key: string; orders: any[] }> = [];
    
    deliveredOrders.forEach(order => {
      if (order.tavolo) {
        // Ordini con tavolo - raggruppa per tavolo
        const key = `Tavolo ${order.tavolo.numero}`;
        
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(order);
      } else {
        // Ordini senza tavolo - crea card singole
        singleOrders.push({
          key: `Ordine-${order.id}`,
          orders: [order]
        });
      }
    });
    
    // Ordina le chiavi secondo la sequenza: T1-T7, M1-M7, 11-16, 21-26, 31-36, P1-P4
    const sortedGrouped: { [key: string]: { [customerName: string]: any[] } } = {};
    const tableKeys = Object.keys(grouped).filter(key => key.startsWith('Tavolo '));
    
    tableKeys.sort((a, b) => {
      const tavoloA = a.replace('Tavolo ', '');
      const tavoloB = b.replace('Tavolo ', '');
      
      const getOrderWeight = (tavolo: string) => {
        const match = tavolo.match(/^([TMP])?(\d+)$/);
        if (!match) return 999999;
        
        const prefix = match[1] || '';
        const num = parseInt(match[2]);
        
        if (prefix === 'T' && num >= 1 && num <= 7) return 1000 + num;
        if (prefix === 'M' && num >= 1 && num <= 7) return 2000 + num;
        if (prefix === '' && num >= 11 && num <= 16) return 3000 + num;
        if (prefix === '' && num >= 21 && num <= 26) return 4000 + num;
        if (prefix === '' && num >= 31 && num <= 36) return 5000 + num;
        if (prefix === 'P' && num >= 1 && num <= 4) return 6000 + num;
        
        return 10000 + num;
      };
      
      return getOrderWeight(tavoloA) - getOrderWeight(tavoloB);
    });
    
    // Prima aggiungi tutti i tavoli ordinati
    tableKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });
    
    // Poi aggiungi gli ordini singoli
    singleOrders.forEach(({ key, orders }) => {
      sortedGrouped[key] = orders;
    });
    
    return sortedGrouped;
  };

  const toggleTableExpansion = (tableKey: string) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableKey)) {
        newSet.delete(tableKey);
      } else {
        newSet.add(tableKey);
      }
      return newSet;
    });
  };

  const getTableTotal = (orders: any[]) => {
    return orders.reduce((sum, order) => sum + order.totale, 0);
  };

  // Seleziona/deseleziona tutto il tavolo
  const toggleTableSelection = (tableKey: string, orders: any[]) => {
    const isTableSelected = selectedTables.has(tableKey);
    
    if (isTableSelected) {
      // Deseleziona tutto il tavolo
      setSelectedTables(prev => {
        const newSet = new Set(prev);
        newSet.delete(tableKey);
        return newSet;
      });
      
      // Rimuovi tutti gli items del tavolo dalla selezione
      const orderIds = orders.map(o => o.id);
      setSelectedItems(prev => prev.filter(item => !orderIds.includes(item.orderId)));
    } else {
      // Seleziona tutto il tavolo
      setSelectedTables(prev => {
        const newSet = new Set(prev);
        newSet.add(tableKey);
        return newSet;
      });
      
      // Aggiungi tutti i prodotti del tavolo
      const newItems: SelectedItem[] = [];
      orders.forEach(order => {
        const customerName = order.cliente?.nome || order.nomeCliente || 'Cliente sconosciuto';
        const tableNumber = order.tavolo?.numero || 'N/A';
        
        order.righe.forEach((riga: any) => {
          newItems.push({
            orderId: order.id,
            rigaId: riga.id,
            productName: riga.prodotto.nome,
            originalQuantity: riga.quantita,
            selectedQuantity: riga.quantita,
            unitPrice: riga.prezzo,
            totalPrice: riga.quantita * riga.prezzo,
            customerName,
            tableNumber
          });
        });
      });
      
      setSelectedItems(prev => [...prev.filter(item => !orders.some(o => o.id === item.orderId)), ...newItems]);
    }
  };

  // Seleziona/deseleziona prodotto
  const toggleProductSelection = (order: any, riga: any, quantity: number = 1) => {
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
        customerName: order.cliente?.nome || order.nomeCliente || 'Cliente sconosciuto',
        tableNumber: order.tavolo?.numero || 'N/A'
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  // Seleziona/deseleziona tutti i prodotti di un ordine
  const toggleOrderSelection = (order: any) => {
    // Controlla se tutti i prodotti dell'ordine sono già selezionati
    const orderItems = order.righe;
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    const isFullySelected = orderItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );

    if (isFullySelected) {
      // Deseleziona tutti i prodotti dell'ordine
      setSelectedItems(prev => prev.filter(item => item.orderId !== order.id));
    } else {
      // Seleziona tutti i prodotti dell'ordine
      const newSelectedItems = [...selectedItems.filter(item => item.orderId !== order.id)];
      
      orderItems.forEach((riga: any) => {
        const newItem: SelectedItem = {
          orderId: order.id,
          rigaId: riga.id,
          productName: riga.prodotto.nome,
          originalQuantity: riga.quantita,
          selectedQuantity: riga.quantita,
          unitPrice: riga.prezzo,
          totalPrice: riga.quantita * riga.prezzo,
          customerName: order.cliente?.nome || order.nomeCliente || 'Cliente sconosciuto',
          tableNumber: order.tavolo?.numero || 'N/A'
        };
        newSelectedItems.push(newItem);
      });
      
      setSelectedItems(newSelectedItems);
    }
  };

  // Controlla se un ordine è completamente selezionato
  const isOrderFullySelected = (order: any) => {
    const orderItems = order.righe;
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return orderItems.length === selectedOrderItems.length && 
      selectedOrderItems.every(selectedItem => 
        selectedItem.selectedQuantity === selectedItem.originalQuantity
      );
  };

  // Controlla se un ordine è parzialmente selezionato
  const isOrderPartiallySelected = (order: any) => {
    const selectedOrderItems = selectedItems.filter(item => item.orderId === order.id);
    return selectedOrderItems.length > 0 && !isOrderFullySelected(order);
  };

  // Calcola sommario drawer
  const getDrawerSummary = (): DrawerSummary => {
    return {
      totalAmount: selectedItems.reduce((sum, item) => sum + item.totalPrice, 0),
      totalItems: selectedItems.reduce((sum, item) => sum + item.selectedQuantity, 0)
    };
  };

  // Gestisce pagamento
  const handlePayment = async () => {
    if (selectedItems.length === 0 || !paymentMethod || !payerName.trim()) return;
    
    setProcessingPayment(true);
    try {
      const summary = getDrawerSummary();
      
      // Raggruppa gli elementi selezionati per ordinazione
      const orderGroups = selectedItems.reduce((groups, item) => {
        if (!groups[item.orderId]) {
          groups[item.orderId] = {
            orderId: item.orderId,
            totalAmount: 0,
            items: []
          };
        }
        groups[item.orderId].totalAmount += item.totalPrice;
        groups[item.orderId].items.push(item);
        return groups;
      }, {} as Record<string, {orderId: string, totalAmount: number, items: SelectedItem[]}>);
      
      // Processa i pagamenti per ogni ordinazione
      for (const group of Object.values(orderGroups)) {
        console.log('Creando pagamento:', {
          orderId: group.orderId,
          modalita: paymentMethod,
          importo: group.totalAmount,
          clienteNome: payerName
        });
        
        const result = await creaPagamento(
          group.orderId,
          paymentMethod,
          group.totalAmount,
          payerName
        );
        
        if (!result.success) {
          console.error('Errore pagamento:', result.error);
          throw new Error(result.error || 'Errore sconosciuto');
        }
      }
      
      toast.success(`Pagamento di €${summary.totalAmount.toFixed(2)} tramite ${paymentMethod} processato con successo! Pagante: ${payerName}`);
      
      // Reset selezioni dopo pagamento
      setSelectedItems([]);
      setIsDrawerOpen(false);
      setShowPaymentModal(false);
      setPayerName('');
      setPaymentMethod(null);
      
      // Ricarica ordinazioni
      await loadOrdinazioni();
      
    } catch (error) {
      console.error('Errore durante il pagamento:', error);
      toast.error(`Errore durante il pagamento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Apre modal pagamento
  const openPaymentModal = (method: 'CONTANTI' | 'POS') => {
    setPaymentMethod(method);
    
    // Ottieni il nome del cliente dal primo item selezionato
    if (selectedItems.length > 0) {
      // Prendi il nome del cliente più frequente tra gli items selezionati
      const customerNames = selectedItems.map(item => item.customerName);
      const nameCount: { [key: string]: number } = {};
      
      customerNames.forEach(name => {
        nameCount[name] = (nameCount[name] || 0) + 1;
      });
      
      // Trova il nome più frequente
      let mostFrequentName = '';
      let maxCount = 0;
      
      Object.entries(nameCount).forEach(([name, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentName = name;
        }
      });
      
      setPayerName(mostFrequentName);
    }
    
    setShowPaymentModal(true);
  };

  // Gestisce richiesta scontrino
  const handleReceiptRequest = async (orderId: string) => {
    setProcessingReceipts(prev => new Set(prev).add(orderId));
    
    try {
      const result = await generaScontrino(orderId);
      
      if (result.success) {
        toast.success(result.message || 'Scontrino emesso con successo');
        // Ricarica le richieste
        await loadOrdinazioni();
      } else {
        toast.error(result.error || 'Errore emissione scontrino');
      }
    } catch (error) {
      console.error('Errore emissione scontrino:', error);
      toast.error('Errore durante l\'emissione dello scontrino');
    } finally {
      setProcessingReceipts(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  // Gestisce selezione scontrino per pagamento
  const handleReceiptSelection = (receipt: any) => {
    setSelectedReceipt(receipt);
    setIsRightDrawerOpen(true);
    // Pre-fill payer name from receipt requester
    setReceiptPayerName(receipt.richiedente || '');
  };

  // Gestisce pagamento scontrino
  const handleReceiptPayment = async () => {
    if (!selectedReceipt || !receiptPaymentMethod || !receiptPayerName.trim()) return;
    
    setProcessingPayment(true);
    try {
      // Crea pagamento per ordine associato allo scontrino
      const result = await creaPagamento(
        selectedReceipt.orderId,
        receiptPaymentMethod,
        selectedReceipt.importo,
        receiptPayerName
      );
      
      if (result.success) {
        toast.success(`Pagamento di €${selectedReceipt.importo.toFixed(2)} tramite ${receiptPaymentMethod} confermato! Pagante: ${receiptPayerName}`);
        
        // Emetti scontrino dopo pagamento
        await handleReceiptRequest(selectedReceipt.orderId);
        
        // Reset stati
        setSelectedReceipt(null);
        setIsRightDrawerOpen(false);
        setShowReceiptPaymentModal(false);
        setReceiptPayerName('');
        setReceiptPaymentMethod(null);
      } else {
        throw new Error(result.error || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('Errore durante il pagamento scontrino:', error);
      toast.error(`Errore durante il pagamento: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  const drawerSummary = getDrawerSummary();

  return (
    <div className="min-h-screen bg-background p-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-white/60" />
            <h1 className="text-2xl font-bold text-foreground">Cassa - Gestione Pagamenti</h1>
          </div>
          <UserDisplay />
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-border rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/60" />
            <span className="font-medium">Ordini Consegnati: {deliveredOrders.length}</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-border rounded-lg">
            <span className="text-xs text-white/60">● Online</span>
          </div>
          
          <button
            onClick={() => setShowPaymentHistory(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/15/20 hover:bg-white/15/30 border border-white/20-500/30 rounded-lg transition-colors"
          >
            <History className="h-4 w-4 text-white/70" />
            <span className="font-medium text-white/70">Storico Pagamenti</span>
          </button>
          
          <button
            onClick={loadOrdinazioni}
            disabled={isLoading}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-250px)]">
        
        {/* Left Column - Ordinazioni Consegnate */}
        <div className="flex flex-col relative">
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Ordinazioni Consegnate</h2>
          <div className="flex-1 overflow-y-auto bg-card/30 border border-border rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p>Caricamento ordinazioni...</p>
            </div>
          ) : deliveredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nessuna ordinazione consegnata</p>
              <p className="text-sm">Le ordinazioni completate appariranno qui</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {Object.entries(groupOrdersByTable()).map(([tableKey, orders]) => {
                const isExpanded = expandedTables.has(tableKey);
                const tableTotal = getTableTotal(orders);
                const isTableSelected = selectedTables.has(tableKey);
                const groupedProducts = groupProductsByNameAndPrice(orders);
                
                // Ottieni i nomi dei clienti per questo tavolo
                const customerNames = [...new Set(orders.map(o => 
                  o.cliente?.nome || o.nomeCliente || 'Cliente sconosciuto'
                ))].join(', ');
                
                return (
                  <div
                    key={tableKey}
                    className="bg-background border border-border rounded-lg overflow-hidden"
                  >
                    {/* Card Header - Tavolo e Totale */}
                    <div
                      className="p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isTableSelected}
                            onChange={() => toggleTableSelection(tableKey, orders)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 cursor-pointer"
                            title="Seleziona per pagamento totale tavolo"
                          />
                          <button
                            onClick={() => toggleTableExpansion(tableKey)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex flex-col">
                            <span className="font-semibold text-lg">
                              {tableKey}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {customerNames}
                            </span>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-white/60">
                          €{tableTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Card Content */}
                    {isExpanded && (
                      <div className="border-t border-border">
                        {/* Ordinazioni per cliente */}
                        {orders.map((order: any) => {
                          const customerName = order.cliente?.nome || order.nomeCliente || 'Cliente sconosciuto';
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
                            {groupedProducts.map((product, index) => {
                              // Calcola quantità selezionata per questo prodotto
                              let selectedQuantity = 0;
                              let paidQuantity = 0;
                              let unpaidQuantity = 0;
                              const paidBy = new Set<string>();
                              
                              product.items.forEach(item => {
                                if (item.isPagato) {
                                  paidQuantity += item.quantity;
                                  if (item.pagatoDa) paidBy.add(item.pagatoDa);
                                } else {
                                  unpaidQuantity += item.quantity;
                                  const selected = selectedItems.find(sel => 
                                    sel.orderId === item.orderId && sel.rigaId === item.rigaId
                                  );
                                  if (selected) {
                                    selectedQuantity += selected.selectedQuantity;
                                  }
                                }
                              });
                              
                              const isFullyPaid = unpaidQuantity === 0;
                              const productKey = `${tableKey}-${index}`;
                              const isProductExpanded = expandedProducts.has(productKey);
                              
                              return (
                                <div key={index} className="space-y-1">
                                  <div 
                                    className={`flex items-center justify-between p-2 rounded ${
                                      product.items.length > 1 && !isFullyPaid ? 'cursor-pointer' : ''
                                    } ${
                                      isFullyPaid ? 'bg-gray-800/50 opacity-60' : 
                                      selectedQuantity > 0 ? 'bg-white/10/10 border border-white/15-500/20' : 'hover:bg-muted/30'
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
                                      <input
                                        type="checkbox"
                                        checked={selectedQuantity === unpaidQuantity && unpaidQuantity > 0}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          if (selectedQuantity === unpaidQuantity) {
                                            // Deseleziona tutti non pagati
                                            product.items.forEach(item => {
                                              if (!item.isPagato) {
                                                const order = orders.find((o: any) => o.id === item.orderId);
                                                const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                                if (order && riga) {
                                                  toggleProductSelection(order, riga, 0);
                                                }
                                              }
                                            });
                                          } else {
                                            // Seleziona tutti non pagati
                                            product.items.forEach(item => {
                                              if (!item.isPagato) {
                                                const order = orders.find((o: any) => o.id === item.orderId);
                                                const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                                if (order && riga) {
                                                  toggleProductSelection(order, riga, item.quantity);
                                                }
                                              }
                                            });
                                          }
                                        }}
                                        className="w-4 h-4 cursor-pointer"
                                        disabled={isFullyPaid}
                                        title={isFullyPaid ? `Già pagato da: ${Array.from(paidBy).join(', ')}` : "Seleziona tutti i prodotti non pagati"}
                                      />
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
                                        const order = orders.find((o: any) => o.id === item.orderId);
                                        const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                                        const selected = selectedItems.find(sel => 
                                          sel.orderId === item.orderId && sel.rigaId === item.rigaId
                                        );
                                        const isSelected = selected && selected.selectedQuantity > 0;
                                        
                                        return (
                                          <div
                                            key={itemIndex}
                                            className="flex items-center justify-between py-1 px-2 hover:bg-muted/20 rounded text-sm"
                                          >
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                  if (order && riga) {
                                                    toggleProductSelection(order, riga, isSelected ? 0 : item.quantity);
                                                  }
                                                }}
                                                className="w-3 h-3 cursor-pointer"
                                                disabled={item.isPagato}
                                                title={item.isPagato ? `Già pagato da: ${item.pagatoDa || 'N/A'}` : ''}
                                              />
                                              <span className={`text-xs ${item.isPagato ? 'line-through' : ''} text-muted-foreground`}>
                                                {item.quantity}x - {item.customerName}
                                              </span>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
          
          {/* Left Drawer for Payment Summary */}
          <div className={`absolute bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg transition-all duration-300 z-30 ${
            isLeftDrawerOpen ? 'h-64' : 'h-12'
          }`}>
            {/* Drawer Header */}
            <div 
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setIsLeftDrawerOpen(!isLeftDrawerOpen)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isLeftDrawerOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground transform rotate-90" />
                  )}
                  <span className="text-sm font-medium">
                    {selectedItems.length} elementi selezionati
                  </span>
                </div>
                <span className="text-sm font-bold text-white/60">
                  €{drawerSummary.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
            
            {/* Drawer Content */}
            {isLeftDrawerOpen && selectedItems.length > 0 && (
              <div className="p-4 pt-0">
                <div className="max-h-32 overflow-y-auto mb-3">
                  <div className="space-y-1 text-sm">
                    {selectedItems.map((item, index) => (
                      <div key={`${item.orderId}-${item.rigaId}`} className="flex justify-between text-muted-foreground">
                        <span>{item.selectedQuantity}x {item.productName}</span>
                        <span>€{item.totalPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openPaymentModal('CONTANTI')}
                    disabled={processingPayment}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-white/8 text-white rounded text-sm flex items-center justify-center gap-2"
                  >
                    <Euro className="h-4 w-4" />
                    Contanti
                  </button>
                  <button
                    onClick={() => openPaymentModal('POS')}
                    disabled={processingPayment}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/8 text-white rounded text-sm flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    POS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Richieste Scontrino */}
        <div className="flex flex-col relative">
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Richieste Scontrino</h2>
          <div className="flex-1 overflow-y-auto bg-card/30 border border-border rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
                <p>Caricamento richieste...</p>
              </div>
            ) : receiptRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Nessuna richiesta scontrino</p>
                <p className="text-sm">Le richieste di emissione scontrino appariranno qui</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {receiptRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-background border border-border rounded-lg p-4 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-white/70" />
                        <span className="font-medium">
                          {request.tavolo ? `Tavolo ${request.tavolo.numero}` : request.tipo}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${
                        request.stato === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                        request.stato === 'PROCESSING' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {request.stato}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      Richiesto da: {request.richiedente}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Clock className="h-3 w-3" />
                      {new Date(request.dataRichiesta).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="text-lg font-bold text-foreground">
                        €{request.importo.toFixed(2)}
                      </span>
                      {request.stato === 'PENDING' && !processingReceipts.has(request.orderId) && (
                        <button
                          onClick={() => handleReceiptSelection(request)}
                          disabled={processingReceipts.has(request.orderId)}
                          className="px-4 py-2 bg-white/20 hover:bg-white/25 disabled:bg-white/10 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Conferma Pagamento
                        </button>
                      )}
                      {processingReceipts.has(request.orderId) && (
                        <div className="flex items-center gap-2 text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Elaborazione...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Right Drawer for Receipt Payment Confirmation */}
          <div className={`absolute bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg transition-all duration-300 z-30 ${
            isRightDrawerOpen ? 'h-48' : 'h-0'
          } ${!selectedReceipt ? 'hidden' : ''}`}>
            {/* Drawer Header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-white/70" />
                  <span className="font-medium">Conferma Pagamento Scontrino</span>
                </div>
                <button
                  onClick={() => {
                    setIsRightDrawerOpen(false);
                    setSelectedReceipt(null);
                  }}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            
            {/* Drawer Content */}
            {selectedReceipt && (
              <div className="p-4">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedReceipt.tavolo ? `Tavolo ${selectedReceipt.tavolo.numero}` : selectedReceipt.tipo}
                    </span>
                    <span className="text-lg font-bold text-white/60">
                      €{selectedReceipt.importo.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Richiesto da: {selectedReceipt.richiedente}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReceiptPaymentMethod('CONTANTI');
                      setShowReceiptPaymentModal(true);
                    }}
                    disabled={processingPayment}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-white/8 text-white rounded text-sm flex items-center justify-center gap-2"
                  >
                    <Euro className="h-4 w-4" />
                    Contanti
                  </button>
                  <button
                    onClick={() => {
                      setReceiptPaymentMethod('POS');
                      setShowReceiptPaymentModal(true);
                    }}
                    disabled={processingPayment}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/8 text-white rounded text-sm flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    POS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg transition-all duration-300 z-40">
        {/* Drawer Header - Always Visible */}
        <div 
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isDrawerOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transform rotate-90" />
              )}
              {selectedItems.length > 0 && (
                <>
                  <span className="font-medium">
                    {/* Mostra numero tavolo se tutti gli items sono dello stesso tavolo */}
                    {(() => {
                      const tables = [...new Set(selectedItems.map(item => item.tableNumber))];
                      if (tables.length === 1) {
                        return `Tavolo ${tables[0]}`;
                      } else if (tables.length > 1) {
                        return `${tables.length} tavoli`;
                      }
                      return '';
                    })()}
                  </span>
                  <span className="text-lg font-bold text-white/60">
                    €{drawerSummary.totalAmount.toFixed(2)}
                  </span>
                </>
              )}
            </div>
            {selectedItems.length > 0 && !isDrawerOpen && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Ultimo: {selectedItems[selectedItems.length - 1].productName} - 
                  €{selectedItems[selectedItems.length - 1].totalPrice.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Content - Expandable */}
        {isDrawerOpen && (
          <div className="border-t border-border">
            <div className="max-h-96 overflow-y-auto p-4">
              {selectedItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nessun prodotto selezionato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div key={`${item.orderId}-${item.rigaId}`} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.productName}</span>
                          <span className="text-xs text-muted-foreground">
                            Tavolo {item.tableNumber} - {item.customerName}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const order = deliveredOrders.find(o => o.id === item.orderId);
                              const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                              if (order && riga) {
                                toggleProductSelection(order, riga, Math.max(0, item.selectedQuantity - 1));
                              }
                            }}
                            className="p-1 hover:bg-muted rounded"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm">{item.selectedQuantity}</span>
                          <button
                            onClick={() => {
                              const order = deliveredOrders.find(o => o.id === item.orderId);
                              const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                              if (order && riga) {
                                toggleProductSelection(order, riga, Math.min(item.originalQuantity, item.selectedQuantity + 1));
                              }
                            }}
                            className="p-1 hover:bg-muted rounded"
                            disabled={item.selectedQuantity >= item.originalQuantity}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-medium w-16 text-right">
                          €{item.totalPrice.toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            const order = deliveredOrders.find(o => o.id === item.orderId);
                            const riga = order?.righe.find((r: any) => r.id === item.rigaId);
                            if (order && riga) {
                              toggleProductSelection(order, riga, 0);
                            }
                          }}
                          className="p-1 hover:bg-white/8/20 text-white/50 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Payment Buttons */}
            {selectedItems.length > 0 && (
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <button
                    onClick={() => openPaymentModal('CONTANTI')}
                    disabled={processingPayment}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-white/8 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Euro className="h-4 w-4" />
                    Contanti
                  </button>
                  <button
                    onClick={() => openPaymentModal('POS')}
                    disabled={processingPayment}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/8 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    POS
                  </button>
                  <button
                    onClick={() => {
                      setShowPagaPerAltriModal(true);
                      loadTavoliAperti();
                    }}
                    disabled={processingPayment}
                    className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/25-700 disabled:bg-white/10 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Gift className="h-4 w-4" />
                    Paga Altri
                  </button>
                  <button
                    onClick={async () => {
                      // Genera scontrino dettagliato
                      if (selectedItems.length > 0) {
                        toast.success('Scontrino dettagliato stampato!');
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Scontrino
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
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
              Pagamento {paymentMethod === 'CONTANTI' ? 'in Contanti' : 'con POS'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Nome di chi sta pagando
              </label>
              <input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Inserisci il nome..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && payerName.trim()) {
                    handlePayment();
                  }
                }}
              />
            </div>

            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Totale da pagare</div>
              <div className="text-2xl font-bold text-white/60">
                €{drawerSummary.totalAmount.toFixed(2)}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePayment}
                disabled={!payerName.trim() || processingPayment}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground rounded-lg flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : paymentMethod === 'CONTANTI' ? (
                  <Euro className="h-4 w-4" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Conferma Pagamento
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentMethod(null);
                  // Non resettiamo il nome, verrà impostato quando si riapre il modal
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

      {/* Paga per Altri Modal */}
      {showPagaPerAltriModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Paga per Altri</h3>
              <button
                onClick={() => setShowPagaPerAltriModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Cliente Pagatore */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Chi sta pagando?
                </label>
                <input
                  type="text"
                  value={clientePagatore}
                  onChange={(e) => setClientePagatore(e.target.value)}
                  placeholder="Nome del cliente pagatore"
                  className="w-full p-3 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tavoli con Conti Aperti */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Seleziona Tavolo da Pagare
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {tavoliAperti.map((tavolo) => (
                    <div
                      key={tavolo.id}
                      className="p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                      onClick={async () => {
                        if (!clientePagatore) {
                          toast.error("Inserisci il nome del cliente pagatore");
                          return;
                        }

                        try {
                          // Calcola totale del tavolo
                          const totale = tavolo.ordinazioni.reduce((sum: number, ord: any) => 
                            sum + Number(ord.totale), 0
                          );

                          // Per ogni ordinazione del tavolo, crea un pagamento
                          for (const ordinazione of tavolo.ordinazioni) {
                            const result = await creaPagamento(
                              'CONTANTI', // Default a contanti, può essere esteso
                              [ordinazione.id],
                              clientePagatore,
                              ''
                            );

                            if (result.success && result.data?.id) {
                              // Registra il contributo cross-cliente
                              await pagaContoAltri(
                                clientePagatore,
                                result.data.id,
                                Number(ordinazione.totale),
                                tavolo.id,
                                ordinazione.clienteId
                              );
                            }
                          }

                          toast.success(`${clientePagatore} ha pagato il conto del tavolo ${tavolo.numero} (€${totale.toFixed(2)})`);
                          setShowPagaPerAltriModal(false);
                          setClientePagatore("");
                          loadOrdinazioni(); // Ricarica dati
                        } catch (error) {
                          console.error("Errore pagamento per altri:", error);
                          toast.error("Errore durante il pagamento");
                        }
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-foreground">
                            Tavolo {tavolo.numero}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {tavolo.ordinazioni.length} ordinazione/i
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-foreground">
                            €{tavolo.ordinazioni.reduce((sum: number, ord: any) => 
                              sum + Number(ord.totale), 0
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Payment Modal */}
      {showReceiptPaymentModal && selectedReceipt && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowReceiptPaymentModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-lg p-6 w-96 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Conferma Pagamento {receiptPaymentMethod === 'CONTANTI' ? 'in Contanti' : 'con POS'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Nome di chi sta pagando
              </label>
              <input
                type="text"
                value={receiptPayerName}
                onChange={(e) => setReceiptPayerName(e.target.value)}
                placeholder="Inserisci il nome..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && receiptPayerName.trim()) {
                    handleReceiptPayment();
                  }
                }}
              />
            </div>

            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Importo scontrino</div>
              <div className="text-2xl font-bold text-white/60">
                €{selectedReceipt.importo.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {selectedReceipt.tavolo ? `Tavolo ${selectedReceipt.tavolo.numero}` : selectedReceipt.tipo}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReceiptPayment}
                disabled={!receiptPayerName.trim() || processingPayment}
                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground rounded-lg flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Conferma ed Emetti Scontrino
              </button>
              <button
                onClick={() => {
                  setShowReceiptPaymentModal(false);
                  setReceiptPaymentMethod(null);
                  setReceiptPayerName('');
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
    </div>
  );
}