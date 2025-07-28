"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CreditCard, Euro, Wallet, Calculator, Receipt, ArrowLeft, Check, RefreshCw, CheckCircle, FileText, Clock, Loader2, ChevronDown, ChevronRight, Users, ShoppingBag, User } from "lucide-react";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatus";
import { EntityType, OperationType } from "@/lib/types/notifications";
import { getOrdinazioniConsegnate, getRichiesteScontrino, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";

interface PaymentItem {
  id: string;
  description: string;
  amount: number;
  table?: string;
  ordinazioneId: string;
  cameriere: string;
}

interface Payment {
  amount: number;
  method: "CONTANTI" | "POS" | "BUONI";
}

export default function CassaPage() {
  const [drawer, setDrawer] = useState<PaymentItem[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [receiptRequests, setReceiptRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PaymentItem | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState("");
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<"CONTANTI" | "POS" | "BUONI">("CONTANTI");
  const [optimisticPayments, setOptimisticPayments] = useState<Set<string>>(new Set());
  const [processingReceipts, setProcessingReceipts] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const loadOrdersRef = useRef<() => Promise<void>>(null as any);

  // Enhanced SSE per notifiche real-time
  const { 
    connectionHealth, 
    notifications,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate 
  } = useEnhancedSSE({
    clientId: "cassa-1",
    userRole: "CASSA",
    onNotification: (notification) => {
      // Handle various notification types
      if (notification.type === "payment_request" || 
          notification.type === "new_order" ||
          notification.type === "order_completed" ||
          notification.type === "order_status_change") {
        // Debounce rapid updates
        const now = Date.now();
        if (now - lastUpdateRef.current > 500) {
          lastUpdateRef.current = now;
          loadOrdinazioni();
        }
      }
    },
    onEntityUpdate: (entityType, entityId, changes) => {
      // Handle granular entity updates
      if (entityType === EntityType.ORDER) {
        updateOrderLocally(entityId, changes);
      } else if (entityType === EntityType.PAYMENT) {
        updatePaymentLocally(entityId, changes);
      }
    },
    enableOptimisticUpdates: true
  });

  // Update order locally
  const updateOrderLocally = useCallback((orderId: string, changes: any) => {
    if (changes.operation === OperationType.DELETE) {
      // Remove order if deleted
      setDeliveredOrders(prev => prev.filter(order => order.id !== orderId));
    } else if (changes.operation === OperationType.UPDATE) {
      // Update order fields
      setDeliveredOrders(prev => prev.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            ...changes.fields,
            // Handle date fields
            dataConsegna: changes.fields?.dataConsegna ? new Date(changes.fields.dataConsegna) : order.dataConsegna,
            dataChiusura: changes.fields?.dataChiusura ? new Date(changes.fields.dataChiusura) : order.dataChiusura
          };
        }
        return order;
      }));
    } else if (changes.operation === OperationType.CREATE) {
      // New order delivered - reload to get full data
      const now = Date.now();
      if (now - lastUpdateRef.current > 500) {
        lastUpdateRef.current = now;
        if (loadOrdersRef.current) {
          loadOrdersRef.current();
        }
      }
    }
  }, []);

  // Carica ordinazioni consegnate
  const loadDeliveredOrders = async () => {
    try {
      const data = await getOrdinazioniConsegnate();
      setDeliveredOrders(data);
    } catch (error) {
      console.error('Errore caricamento ordinazioni consegnate:', error);
    }
  };

  // Carica richieste scontrino
  const loadReceiptRequests = async () => {
    try {
      const data = await getRichiesteScontrino();
      setReceiptRequests(data);
    } catch (error) {
      console.error('Errore caricamento richieste scontrino:', error);
    }
  };

  // Carica ordinazioni dal database
  const loadOrdinazioni = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadDeliveredOrders(),
        loadReceiptRequests()
      ]);
    } catch (error) {
      console.error("Errore caricamento dati cassa:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update payment locally
  const updatePaymentLocally = useCallback((paymentId: string, changes: any) => {
    // Remove from optimistic payments if confirmed
    if (optimisticPayments.has(paymentId)) {
      setOptimisticPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
    }
    
    // Update receipt requests if this payment generated a receipt
    if (changes.fields?.receiptGenerated) {
      loadReceiptRequests();
    }
  }, [optimisticPayments, loadReceiptRequests]);

  // Store reference to loadOrdinazioni
  useEffect(() => {
    loadOrdersRef.current = loadOrdinazioni;
  });

  useEffect(() => {
    loadOrdinazioni();
  }, []);

  const handleReceiptRequest = async (orderId: string) => {
    setProcessingReceipts(prev => new Set(prev).add(orderId));

    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      EntityType.ORDER,
      orderId,
      { receiptStatus: "PROCESSING" },
      { receiptStatus: "PENDING" } // Rollback data
    );

    try {
      const result = await generaScontrino(orderId);
      if (result.success) {
        // Update receipt requests locally
        setReceiptRequests(prev => prev.map(req => 
          req.orderId === orderId 
            ? { ...req, stato: 'COMPLETED' } 
            : req
        ));
        alert(`Scontrino generato con successo: ${result.message}`);
      } else {
        // Rollback on failure
        rollbackOptimisticUpdate(updateId);
        alert(`Errore nella generazione dello scontrino: ${result.error}`);
      }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId);
      alert('Errore nella richiesta di scontrino');
    } finally {
      setProcessingReceipts(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const addPayment = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (!amount || amount <= 0) return;

    const newPayment: Payment = {
      amount: Math.min(amount, remainingAmount),
      method: currentPaymentMethod
    };

    const newPayments = [...payments, newPayment];
    const newRemaining = remainingAmount - newPayment.amount;

    setPayments(newPayments);
    setRemainingAmount(newRemaining);
    
    if (newRemaining <= 0) {
      // Pagamento completato
      completePayment();
    } else {
      setCurrentPaymentAmount(newRemaining.toFixed(2));
    }
  };

  const completePayment = async () => {
    if (!selectedItem) return;

    const paymentId = `payment_${Date.now()}`;
    setOptimisticPayments(prev => new Set(prev).add(paymentId));

    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      EntityType.ORDER,
      selectedItem.ordinazioneId,
      { pagato: true, stato: "CHIUSA" },
      { pagato: false } // Rollback data
    );

    try {
      // Crea il pagamento nel database
      const totalPaid = getTotalPaid();
      const result = await creaPagamento(
        selectedItem.ordinazioneId,
        payments.length > 1 ? "MISTO" : (currentPaymentMethod === "BUONI" ? "CONTANTI" : currentPaymentMethod),
        totalPaid
      );

      if (result.success) {
        // Update orders locally
        setDeliveredOrders(prev => prev.map(order => 
          order.id === selectedItem.ordinazioneId 
            ? { ...order, pagato: true } 
            : order
        ));
        
        alert(`Pagamento completato per ${selectedItem.description}`);
        closePaymentModal();
      } else {
        // Rollback on failure
        rollbackOptimisticUpdate(updateId);
        setOptimisticPayments(prev => {
          const newSet = new Set(prev);
          newSet.delete(paymentId);
          return newSet;
        });
        alert(`Errore: ${result.error}`);
      }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId);
      setOptimisticPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
      alert("Errore durante il pagamento");
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedItem(null);
    setPayments([]);
    setRemainingAmount(0);
    setCurrentPaymentAmount("");
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getDeliveredTotal = () => {
    if (!Array.isArray(deliveredOrders)) return 0;
    return deliveredOrders.reduce((sum, order) => sum + order.totale, 0);
  };

  const getPendingReceiptsCount = () => {
    if (!Array.isArray(receiptRequests)) return 0;
    return receiptRequests.filter(req => req.stato === 'PENDING').length;
  };

  const groupOrdersByTable = () => {
    const grouped: { [key: string]: { [customerName: string]: any[] } } = {};
    
    deliveredOrders.forEach(order => {
      const key = order.tavolo ? `Tavolo ${order.tavolo.numero}` : 'Altri Ordini';
      const customerName = order.cliente?.nome || order.nomeCliente;
      
      if (!grouped[key]) {
        grouped[key] = {};
      }
      if (!grouped[key][customerName]) {
        grouped[key][customerName] = [];
      }
      grouped[key][customerName].push(order);
    });
    
    // Ordina le chiavi in modo che i tavoli siano in ordine numerico crescente
    const sortedGrouped: { [key: string]: { [customerName: string]: any[] } } = {};
    const tableKeys = Object.keys(grouped).filter(key => key.startsWith('Tavolo '));
    const otherKeys = Object.keys(grouped).filter(key => !key.startsWith('Tavolo '));
    
    // Ordina i tavoli secondo la sequenza: T1-T7, M1-M7, 11-16, 21-26, 31-36, P1-P4
    tableKeys.sort((a, b) => {
      const tavoloA = a.replace('Tavolo ', '');
      const tavoloB = b.replace('Tavolo ', '');
      
      // Funzione per calcolare il peso di ordinamento
      const getOrderWeight = (tavolo: string) => {
        const match = tavolo.match(/^([TMP])?(\d+)$/);
        if (!match) return 999999; // Fallback per tavoli non riconosciuti
        
        const prefix = match[1] || '';
        const num = parseInt(match[2]);
        
        // Definisci l'ordine specifico richiesto
        if (prefix === 'T' && num >= 1 && num <= 7) {
          return 1000 + num; // T1=1001, T2=1002, ..., T7=1007
        }
        if (prefix === 'M' && num >= 1 && num <= 7) {
          return 2000 + num; // M1=2001, M2=2002, ..., M7=2007
        }
        if (prefix === '' && num >= 11 && num <= 16) {
          return 3000 + num; // 11=3011, 12=3012, ..., 16=3016
        }
        if (prefix === '' && num >= 21 && num <= 26) {
          return 4000 + num; // 21=4021, 22=4022, ..., 26=4026
        }
        if (prefix === '' && num >= 31 && num <= 36) {
          return 5000 + num; // 31=5031, 32=5032, ..., 36=5036
        }
        if (prefix === 'P' && num >= 1 && num <= 4) {
          return 6000 + num; // P1=6001, P2=6002, P3=6003, P4=6004
        }
        
        // Per tutti gli altri tavoli, usa un peso alto + numero
        return 10000 + num;
      };
      
      return getOrderWeight(tavoloA) - getOrderWeight(tavoloB);
    });
    
    // Prima i tavoli ordinati, poi gli altri ordini
    [...tableKeys, ...otherKeys].forEach(key => {
      sortedGrouped[key] = grouped[key];
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

  const getTableTotal = (customerOrders: { [customerName: string]: any[] }) => {
    let total = 0;
    Object.values(customerOrders).forEach(orders => {
      total += orders.reduce((sum, order) => sum + order.totale, 0);
    });
    return total;
  };

  const getTablePaymentStatus = (customerOrders: { [customerName: string]: any[] }) => {
    const allOrders: any[] = [];
    Object.values(customerOrders).forEach(orders => {
      allOrders.push(...orders);
    });
    const allPaid = allOrders.every(order => order.pagato);
    const somePaid = allOrders.some(order => order.pagato);
    if (allPaid) return 'paid';
    if (somePaid) return 'partial';
    return 'unpaid';
  };
  
  const getTotalOrdersInTable = (customerOrders: { [customerName: string]: any[] }) => {
    let total = 0;
    Object.values(customerOrders).forEach(orders => {
      total += orders.length;
    });
    return total;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-8 w-8 text-white/60" />
          <h1 className="text-2xl font-bold text-foreground">Cassa - Gestione Ordini e Scontrini</h1>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-border rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/60" />
            <span className="font-medium">Ordini Consegnati: {deliveredOrders.length}</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-border rounded-lg">
            <FileText className="h-4 w-4 text-white/70" />
            <span className="font-medium">Scontrini Richiesti: {getPendingReceiptsCount()}</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-border rounded-lg">
            <Euro className="h-4 w-4" />
            <span className="font-medium">Totale: €{getDeliveredTotal().toFixed(2)}</span>
          </div>
          
          <ConnectionStatusIndicator 
            connectionHealth={connectionHealth} 
            compact={true}
            showLatency={true}
          />
          
          <button
            onClick={loadOrdinazioni}
            disabled={isLoading}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {notifications.length > 0 && (
            <div className="px-2 py-1 bg-white/15/20 text-white/70 rounded text-xs">
              {notifications.length} notifiche
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
        
        {/* Left Column - Delivered Orders */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-white/60" />
            Ordinazioni Consegnate
          </h2>
          
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
                {Object.entries(groupOrdersByTable()).map(([tableKey, tableOrders]) => {
                  const isExpanded = expandedTables.has(tableKey);
                  const tableTotal = getTableTotal(tableOrders);
                  const paymentStatus = getTablePaymentStatus(tableOrders);
                  
                  return (
                    <div
                      key={tableKey}
                      className="bg-background border border-border rounded-lg overflow-hidden"
                    >
                      <div
                        onClick={() => toggleTableExpansion(tableKey)}
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <Users className="h-5 w-5 text-white/60" />
                            <span className="font-semibold text-lg">{tableKey}</span>
                            <span className="text-sm text-muted-foreground">({getTotalOrdersInTable(tableOrders)} ordini)</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-white/60">
                              €{tableTotal.toFixed(2)}
                            </span>
                            <div className={`px-3 py-1 rounded text-sm font-medium ${
                              paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                              paymentStatus === 'partial' ? 'bg-orange-100 text-orange-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {paymentStatus === 'paid' ? 'TUTTO PAGATO' :
                               paymentStatus === 'partial' ? 'PARZIALMENTE PAGATO' :
                               'DA PAGARE'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t border-border">
                          {Object.entries(tableOrders).map(([customerName, customerOrders], customerIndex) => (
                            <div
                              key={customerName}
                              className={`${customerIndex > 0 ? 'border-t border-border' : ''}`}
                            >
                              {/* Customer Header */}
                              <div className="px-4 py-3 bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-white/60" />
                                  <span className="font-semibold text-base">{customerName}</span>
                                  <span className="text-sm text-muted-foreground">({customerOrders.length} {customerOrders.length === 1 ? 'ordine' : 'ordini'})</span>
                                </div>
                              </div>
                              
                              {/* Customer Orders */}
                              {customerOrders.map((order: any, orderIndex: number) => (
                                <div
                                  key={order.id}
                                  className={`p-4 ${orderIndex > 0 ? 'border-t border-border/50' : ''} bg-muted/10`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">Ordine #{order.id.slice(-6)}</span>
                                      <span className="text-sm text-muted-foreground">
                                        Cameriere: {order.cameriere?.nome}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {new Date(order.dataConsegna).toLocaleTimeString('it-IT', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </div>
                                      <div className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                                        order.pagato ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                      } ${optimisticPayments.has(`payment_${order.id}`) ? 'opacity-70' : ''}`}>
                                        {optimisticPayments.has(`payment_${order.id}`) && (
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                        )}
                                        {order.pagato ? 'PAGATO' : 'DA PAGARE'}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="ml-7 space-y-1">
                                    {order.righe.map((riga: any, idx: number) => (
                                      <div key={idx} className="text-sm flex justify-between items-center py-1">
                                        <span className="text-muted-foreground">
                                          <span className="inline-block w-8 text-right mr-2">{riga.quantita}x</span>
                                          <span className="text-foreground">{riga.prodotto.nome}</span>
                                        </span>
                                        <span className="font-medium">€{(riga.prezzo * riga.quantita).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  <div className="ml-7 mt-3 pt-2 border-t border-border/50 flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">Totale ordine</span>
                                    <span className="font-bold text-base">€{order.totale.toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Receipt Requests */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-white/70" />
            Richieste Emissione Scontrino
          </h2>
          
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
                    className="bg-background border border-border rounded-lg p-4 hover:border-white/20-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-white/70" />
                        <span className="font-medium">
                          {request.tavolo ? `Tavolo ${request.tavolo.numero}` : request.tipo}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${
                        request.stato === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                        request.stato === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
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
                          onClick={() => handleReceiptRequest(request.orderId)}
                          disabled={processingReceipts.has(request.orderId)}
                          className="px-4 py-2 bg-white/20 hover:bg-white/25-700 disabled:bg-white/10 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Emetti Scontrino
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
        </div>
      </div>

    </div>
  );
}