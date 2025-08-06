"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { CassaErrorBoundary, withCassaErrorBoundary } from "@/components/error-boundary-cassa";
import { useToast, ToastContainer } from "@/lib/toast-notifications";
import { 
  Package,
  Loader2,
  AlertCircle,
  CreditCard,
  CheckCircle,
  Plus,
  ShoppingBag
} from "lucide-react";
import { getOrdinazioniPerStato, generaScontrino } from "@/lib/actions/cassa";
import { creaPagamento } from "@/lib/actions/pagamenti";
import { creaPagamentiParziali } from "@/lib/actions/pagamenti-parziali";
import { creaDebito, getClientiConDebiti } from "@/lib/actions/debiti";
import { creaDebitoDiretto, getDebitiAperti } from "@/lib/actions/debiti-direct";
import { useSSE } from "@/contexts/sse-context";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";
import { useCassaState } from "@/hooks/useCassaState";
import { useSSEDeduplication } from "@/hooks/useSSEDeduplication";
import { useDebounceCallback, useRequestDeduplication } from "@/hooks/useDebounceCallback";
import { CreatePaymentSchema, MultiOrderPaymentSchema, CreateDebtSchema, usePaymentValidation } from "@/lib/validation/payment-schemas";
// import { useClientRateLimit } from "@/lib/middleware/rate-limiter-client"; // Removed - file deleted
import PaymentHistory from "@/components/cassa/payment-history";
import ScontrinoQueueManager from "@/components/cassa/scontrino-queue-manager";
import { useTheme } from "@/contexts/ThemeContext";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { BrowserNotificationHelper } from "@/lib/utils/notification-helper";
import dynamic from 'next/dynamic';

// Componenti sempre visibili (non lazy)
import CassaHeader from "@/components/cassa/CassaHeader";
import TableCard from "@/components/cassa/TableCard";
import DebtCard from "@/components/cassa/DebtCard";

// Modal caricati lazy (solo quando necessari)
const TableDetailsDrawer = dynamic(
  () => import("@/components/cassa/TableDetailsDrawer"),
  { 
    loading: () => <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>,
    ssr: false 
  }
);

const ClientSelectionModal = dynamic(
  () => import("@/components/cassa/ClientSelectionModal"),
  { ssr: false }
);

const PayDebtModal = dynamic(
  () => import("@/components/cassa/PayDebtModal").then(mod => ({ default: mod.PayDebtModal })),
  { ssr: false }
);

const SimplePartialPaymentModal = dynamic(
  () => import("@/components/cassa/SimplePartialPaymentModal").then(mod => ({ default: mod.SimplePartialPaymentModal })),
  { ssr: false }
);

const MultiOrderPartialPaymentModal = dynamic(
  () => import("@/components/cassa/MultiOrderPartialPaymentModal").then(mod => ({ default: mod.MultiOrderPartialPaymentModal })),
  { ssr: false }
);

const AddDebtModal = dynamic(
  () => import("@/components/cassa/AddDebtModal").then(mod => ({ default: mod.AddDebtModal })),
  { ssr: false }
);

const CameriereModal = dynamic(
  () => import("@/components/prepara/CameriereModal"),
  { ssr: false }
);

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

interface Payment {
  importo: number;
  modalita: string;
  clienteNome: string | null;
  timestamp: Date | string;
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
  pagamenti?: Payment[];
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

function CassaPageOptimized() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const toast = useToast();
  
  // Usa il nuovo hook ottimizzato per lo stato
  const {
    tableGroupsRitirate,
    tableGroupsDaPagare,
    tableGroupsPagate,
    debiti,
    clientiConDebiti,
    updateState,
    updateSingleOrder,
    moveOrderBetweenStates,
    updateDebiti,
    updateClientiConDebiti,
    invalidateCache,
    invalidateCacheOnSSE,
    cache
  } = useCassaState();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableGroup | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showMultiOrderPaymentModal, setShowMultiOrderPaymentModal] = useState(false);
  const [showTableDrawer, setShowTableDrawer] = useState(false);
  const [showScontrinoQueue, setShowScontrinoQueue] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"table" | "order" | "partial" | "client">("table");
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  const [showCameriereModal, setShowCameriereModal] = useState(false);
  
  // Validazione con Zod
  const paymentValidation = usePaymentValidation(CreatePaymentSchema);
  const multiOrderValidation = usePaymentValidation(MultiOrderPaymentSchema);
  const debtValidation = usePaymentValidation(CreateDebtSchema);
  
  // Rate limiting client-side - Disabled
  // const paymentRateLimit = useClientRateLimit({
  //   maxRequests: 10,
  //   interval: 60000, // 1 minuto
  //   onRateLimited: (resetTime) => {
  //     const secondsLeft = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
  //     toast.warning('Troppe richieste', `Riprova tra ${secondsLeft} secondi`);
  //   }
  // });
  
  // const debtRateLimit = useClientRateLimit({
  //   maxRequests: 5,
  //   interval: 60000,
  //   onRateLimited: (resetTime) => {
  //     const secondsLeft = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
  //     toast.warning('Troppe richieste', `Riprova tra ${secondsLeft} secondi`);
  //   }
  // });

  // Use SSE context
  const { connected, quality, latency, subscribe, isConnected } = useSSE();
  
  // Usa il nuovo hook per deduplicazione SSE
  const { handleEvent, stopCleanup } = useSSEDeduplication(3000);
  const subscribedRef = useRef(false);
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Load table groups con deduplicazione
  const loadOrdersRaw = useCallback(async (forceRefresh = false) => {
    try {
      // Controlla cache se non è un refresh forzato
      if (!forceRefresh) {
        const cachedData = cache.get('orders');
        if (cachedData) {
          updateState(cachedData, false);
          setIsLoading(false);
          return;
        }
      }
      
      // Fetch fresh data
      const data = await getOrdinazioniPerStato();
      
      // Aggiorna stato con controllo di cambiamenti
      const hasChanged = updateState(data, forceRefresh);
      
      // Salva in cache solo se i dati sono cambiati
      if (hasChanged) {
        cache.set('orders', data);
      }
      
      setIsLoading(false);
      
      // Load clients with debts (separato per non bloccare UI)
      getClientiConDebiti().then(clienti => {
        updateClientiConDebiti(clienti);
      });
      
    } catch (error) {
      console.error("Errore caricamento tavoli:", error);
      setIsLoading(false);
    }
  }, [cache, updateState, updateClientiConDebiti]);
  
  // Applica deduplicazione alle richieste
  const loadOrdersDeduplicated = useRequestDeduplication(loadOrdersRaw, {
    cacheTime: 3000, // Cache per 3 secondi
    dedupeTime: 500  // Deduplica richieste entro 500ms
  });
  
  // Applica debouncing per evitare chiamate eccessive
  const [loadOrders, cancelLoadOrders] = useDebounceCallback(
    loadOrdersDeduplicated,
    {
      delay: 300,      // Attendi 300ms prima di eseguire
      leading: false,  // Non eseguire immediatamente
      trailing: true,  // Esegui alla fine del delay
      maxWait: 2000   // Esegui comunque dopo max 2 secondi
    }
  );

  // Handler ottimizzati con aggiornamenti incrementali
  const handleOrderDelivered = useCallback((data: any) => {
    // Invalida cache basata su evento SSE
    invalidateCacheOnSSE();
    // Usa loadOrders con debouncing automatico
    loadOrders(true);
  }, [invalidateCacheOnSSE, loadOrders]);

  const handleOrderPaid = useCallback((data: any) => {
    // Invalida cache basata su evento SSE
    invalidateCacheOnSSE();
    
    // Sposta ordine da ritirate/daPagare a pagate
    if (data.orderId) {
      // Prima prova a spostare da ritirate
      moveOrderBetweenStates(data.orderId, 'tableGroupsRitirate', 'tableGroupsPagate');
      // Poi da daPagare se non era in ritirate
      moveOrderBetweenStates(data.orderId, 'tableGroupsDaPagare', 'tableGroupsPagate');
    }
    // Ricarica dopo un breve delay per sicurezza (with cleanup)
    const timeoutId = setTimeout(() => {
      loadOrders(true);
      timeoutIdsRef.current.delete(timeoutId);
    }, 500);
    timeoutIdsRef.current.add(timeoutId);
  }, [moveOrderBetweenStates, loadOrders, invalidateCacheOnSSE]);
  
  const handleOrderStatusChange = useCallback((data: any) => {
    if (data.orderId && data.newStatus) {
      // Invalida cache basata su evento SSE
      invalidateCacheOnSSE();
      
      // Aggiorna singolo ordine invece di ricaricare tutto
      updateSingleOrder(data.orderId, { stato: data.newStatus });
      
      // Ricarica solo per cambiamenti di stato significativi
      if (data.newStatus === 'CONSEGNATO' || data.newStatus === 'RICHIESTA_CONTO') {
        const timeoutId = setTimeout(() => {
          loadOrders(true);
          timeoutIdsRef.current.delete(timeoutId);
        }, 500);
        timeoutIdsRef.current.add(timeoutId);
      }
    }
  }, [updateSingleOrder, loadOrders, invalidateCacheOnSSE]);

  // Subscribe to SSE events con deduplicazione automatica
  useEffect(() => {
    if (!subscribe || !isConnected || subscribedRef.current) {
      return;
    }
    
    // Cleanup timeouts esistenti prima di nuove sottoscrizioni
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current.clear();
    
    subscribedRef.current = true;
    
    // Subscribe con wrapper deduplicazione
    const unsubscribeDelivered = subscribe(
      'order:delivered', 
      handleEvent(handleOrderDelivered, 'order:delivered')
    );
    
    const unsubscribePaid = subscribe(
      'order:paid',
      handleEvent(handleOrderPaid, 'order:paid')
    );
    
    const unsubscribeStatusChange = subscribe(
      'order:status-change',
      handleEvent((data: any) => {
        if (data.newStatus === 'CONSEGNATO' || data.newStatus === 'RICHIESTA_CONTO') {
          handleOrderStatusChange(data);
        }
      }, 'order:status-change')
    );
    
    const unsubscribeReady = subscribe(
      'order:ready',
      handleEvent((data: any) => {
        loadOrders(true);
        // Usa helper sicuro per notifiche
        BrowserNotificationHelper.show("Ordine Pronto", {
          body: `Tavolo ${data.tableNumber} completato`,
          icon: '/icon-192.png'
        });
      }, 'order:ready')
    );
    
    const unsubscribeUpdate = subscribe(
      'order:update',
      handleEvent(handleOrderStatusChange, 'order:update')
    );
    
    const unsubscribeDebtCreated = subscribe(
      'notification:new',
      handleEvent((data: any) => {
        if (data.title?.includes('debito') || data.message?.includes('debito')) {
          loadOrders(true);
        }
      }, 'notification:debt')
    );
    
    const unsubscribeNotifications = subscribe(
      'notification:new',
      handleEvent((notification: any) => {
        if (notification.title === 'Pagamento Completato') {
          handleOrderPaid(notification);
        }
        if (notification.title === 'Richiesta Scontrino' || notification.message?.includes('scontrino')) {
          loadOrders(true);
          // Usa helper sicuro per notifiche
          BrowserNotificationHelper.show("Richiesta Scontrino", {
            body: notification.message,
            icon: '/icon-192.png'
          });
        }
      }, 'notification:payment')
    );
    
    // Subscribe to payment cancellation events
    const unsubscribePaymentCancelled = subscribe(
      'payment:cancelled',
      handleEvent((data: any) => {
        loadOrders(true);
        // Usa helper sicuro per notifiche
        BrowserNotificationHelper.show("Pagamento Annullato", {
          body: `Ordine #${data.numero} - ${data.motivo || 'Annullato'}`,
          icon: '/icon-192.png'
        });
      }, 'payment:cancelled')
    );
    
    const unsubscribePartialCancelled = subscribe(
      'payment:partial-cancelled',
      handleEvent((data: any) => {
        loadOrders(true);
        // Usa helper sicuro per notifiche
        BrowserNotificationHelper.show("Pagamento Parziale Annullato", {
          body: `€${data.importoAnnullato.toFixed(2)} - Ordine #${data.numero}`,
          icon: '/icon-192.png'
        });
      }, 'payment:partial-cancelled')
    );
    
    return () => {
      subscribedRef.current = false;
      stopCleanup();
      
      // Cleanup all timeouts
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current.clear();
      
      // Unsubscribe all SSE listeners
      unsubscribeDelivered();
      unsubscribePaid();
      unsubscribeStatusChange();
      unsubscribeReady();
      unsubscribeUpdate();
      unsubscribeDebtCreated();
      unsubscribeNotifications();
      unsubscribePaymentCancelled();
      unsubscribePartialCancelled();
    };
  }, [subscribe, isConnected, handleEvent, handleOrderDelivered, handleOrderPaid, handleOrderStatusChange, loadOrders, stopCleanup]);

  // Handle table payment (pay all orders in the table)
  const handleTablePayment = async (clienteNome: string, modalita?: 'POS' | 'CONTANTI' | 'MISTO') => {
    if (!selectedTable || isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    try {
      // Pay all orders in the table
      for (const order of selectedTable.ordinazioni) {
        if (order.rimanente > 0) {
          const result = await creaPagamento(
            order.id,
            modalita || paymentMethod,
            order.rimanente,
            clienteNome  // Usa il nome cliente fornito
          );
          
          if (!result.success) {
            toast.error(`Errore ordine #${order.numero}`, result.error);
            return;
          }
          
          // Generate receipt for each order
          await generaScontrino(order.id);
        }
      }
      
      // Success notification
      BrowserNotificationHelper.showWithSound(
        "Pagamento Tavolo Completato",
        `€${selectedTable.rimanenteComplessivo.toFixed(2)} - ${paymentMethod}`
      );
      
      // Close drawer and refresh data
      setShowTableDrawer(false);
      setSelectedTable(null);
      loadOrders();
      
    } catch (error) {
      console.error("Errore pagamento tavolo:", error);
      toast.error('Errore pagamento', 'Impossibile completare il pagamento del tavolo');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle payment by client (pay all orders from same client)
  const handlePaymentByClient = async (clienteNome: string, modalita?: 'POS' | 'CONTANTI' | 'MISTO') => {
    if (!selectedTable || !selectedOrder || isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    
    try {
      // Trova tutti gli ordini dello stesso cliente
      const clientName = selectedOrder.nomeCliente || 'Cliente generico';
      const clientOrders = selectedTable.ordinazioni.filter(
        o => (o.nomeCliente || 'Cliente generico') === clientName
      );
      
      let totalePagato = 0;
      
      // Paga tutti gli ordini del cliente
      for (const order of clientOrders) {
        if (order.rimanente > 0) {
          const result = await creaPagamento(
            order.id,
            modalita || paymentMethod,
            order.rimanente,
            clienteNome  // Usa il nome cliente fornito
          );
          
          if (!result.success) {
            toast.error(`Errore ordine #${order.numero}`, result.error);
            return;
          }
          
          totalePagato += order.rimanente;
          
          // Generate receipt for each order
          await generaScontrino(order.id);
        }
      }
      
      // Success notification
      BrowserNotificationHelper.showWithSound(
        "Pagamento Cliente Completato",
        `${clienteNome} ha pagato €${totalePagato.toFixed(2)} per ${clientOrders.length} ordini`
      );
      
      // Close drawer and refresh data
      setShowTableDrawer(false);
      setSelectedTable(null);
      setSelectedOrder(null);
      loadOrders();
      
    } catch (error) {
      console.error("Errore pagamento per cliente:", error);
      toast.error('Errore pagamento', 'Impossibile completare il pagamento del cliente');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Process payment with optimistic updates
  const handlePayment = async (clienteNome: string, modalita?: 'POS' | 'CONTANTI' | 'MISTO') => {
    if (!selectedOrder || isProcessingPayment) return;
    
    // Prevent payment if order is already paid or has no remaining balance
    if (selectedOrder.rimanente <= 0) {
      toast.warning('Ordine già pagato', 'Questo ordine è stato completamente pagato');
      return;
    }
    
    // Validazione dati pagamento
    const paymentData = {
      ordinazioneId: selectedOrder.id,
      modalita: modalita || paymentMethod,
      importo: selectedOrder.rimanente,
      clienteNome
    };
    
    if (!paymentValidation.validate(paymentData)) {
      toast.error('Errori di validazione', paymentValidation.errors.join(', '));
      return;
    }
    
    // Rate limiting client-side - Disabled
    // if (!paymentRateLimit.checkRateLimit()) {
    //   return;
    // }
    
    setIsProcessingPayment(true);
    
    // Store backup for rollback
    const originalStatus = selectedOrder.statoPagamento;
    
    // Apply optimistic update using the new state management
    const inRitirate = tableGroupsRitirate.some(table => 
      table.ordinazioni.some(ord => ord.id === selectedOrder.id)
    );
    const inDaPagare = tableGroupsDaPagare.some(table => 
      table.ordinazioni.some(ord => ord.id === selectedOrder.id)
    );
    
    try {
      const result = await creaPagamento(
        selectedOrder.id,
        modalita || paymentMethod,
        selectedOrder.rimanente,
        clienteNome
      );
      
      if (!result.success) {
        // Refresh data on failure
        loadOrders(true);
        toast.error('Errore pagamento', result.error || 'Errore sconosciuto');
      } else {
        // Move order to paid state
        if (inRitirate) {
          moveOrderBetweenStates(selectedOrder.id, 'tableGroupsRitirate', 'tableGroupsPagate');
        } else if (inDaPagare) {
          moveOrderBetweenStates(selectedOrder.id, 'tableGroupsDaPagare', 'tableGroupsPagate');
        }
        // Generate receipt
        await generaScontrino(selectedOrder.id);
        
        // Show success notification
        BrowserNotificationHelper.showWithSound(
          "Pagamento Completato",
          `€${selectedOrder.rimanente.toFixed(2)} - ${paymentMethod}`
        );
        
        // Clear selection and refresh data
        setSelectedOrder(null);
        
        // If we're in drawer mode, refresh the table data
        if (showTableDrawer) {
          loadOrders();
        }
      }
    } catch (error) {
      // Refresh data on error
      loadOrders(true);
      console.error("Errore pagamento:", error);
      toast.error('Errore', 'Si è verificato un errore durante il pagamento');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCreateDebt = async (selectedClient: any) => {
    setIsProcessingPayment(true);
    try {
      const amount = paymentMode === 'table' 
        ? selectedTable?.rimanenteComplessivo || 0
        : selectedOrder?.rimanente || 0;
      
      const orderId = paymentMode === 'table'
        ? selectedTable?.ordinazioni[0].id
        : selectedOrder?.id;

      if (!orderId) return;
      
      // Validazione dati debito
      const debtData = {
        clienteId: selectedClient.id,
        ordinazioneId: orderId,
        importo: amount,
        note: `Debito per ${paymentMode === 'table' ? `tavolo ${selectedTable?.tavoloNumero}` : `ordine #${selectedOrder?.numero}`}`
      };
      
      if (!debtValidation.validate(debtData)) {
        toast.error('Errori di validazione', debtValidation.errors.join(', '));
        setIsProcessingPayment(false);
        return;
      }
      
      // Rate limiting client-side - Disabled
      // if (!debtRateLimit.checkRateLimit()) {
      //   setIsProcessingPayment(false);
      //   return;
      // }

      const result = await creaDebito(
        selectedClient.id,
        orderId,
        amount,
        `Debito per ${paymentMode === 'table' ? `tavolo ${selectedTable?.tavoloNumero}` : `ordine #${selectedOrder?.numero}`}`
      );

      if (result.success) {
        setShowClientModal(false);
        setShowTableDrawer(false);
        setSelectedTable(null);
        setSelectedOrder(null);
        loadOrders();
      } else {
        toast.error('Errore', result.error || 'Impossibile creare il debito');
      }
    } catch (error) {
      console.error("Errore creazione debito:", error);
      toast.error('Errore', 'Si è verificato un errore durante la creazione del debito');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCreateDirectDebt = async (clienteId: string, clienteNome: string, importo: number, note?: string, data?: string) => {
    try {
      const result = await creaDebitoDiretto(clienteId, importo, note);
      
      if (result.success) {
        setShowAddDebtModal(false);
        loadOrders();
        
        // Show success notification
        BrowserNotificationHelper.show("Debito Creato", {
          body: `Debito di €${importo.toFixed(2)} creato per ${clienteNome}`,
          icon: '/icon-192.png'
        });
      } else {
        toast.error('Errore', result.error || 'Impossibile creare il debito');
      }
    } catch (error) {
      console.error("Errore creazione debito diretto:", error);
      toast.error('Errore', 'Si è verificato un errore durante la creazione del debito');
    }
  };

  // Load current user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Initial load - usa la versione non debounced per caricamento iniziale
  useEffect(() => {
    loadOrdersDeduplicated();
  }, [loadOrdersDeduplicated]);
  
  // Reload on reconnection
  useEffect(() => {
    if (connected) {
      // Small delay to ensure any queued events are delivered (with cleanup)
      const timeoutId = setTimeout(() => {
        loadOrders(); // Usa versione debounced
        timeoutIdsRef.current.delete(timeoutId);
      }, 500);
      timeoutIdsRef.current.add(timeoutId);
    }
  }, [connected, loadOrders]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelLoadOrders();
    };
  }, [cancelLoadOrders]);

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
    <CassaErrorBoundary level="page">
      <div className="min-h-screen pb-96" style={{ backgroundColor: colors.bg.dark }}>
        <ToastContainer />
        {/* Header */}
        <CassaErrorBoundary level="section" isolate>
          <CassaHeader
        stats={{
          daPagere: tableGroupsRitirate.length,
          pagando: tableGroupsDaPagare.length,
          pagati: tableGroupsPagate.length,
          debiti: debiti.length
        }}
        onRefresh={loadOrders}
        onShowHistory={() => setShowHistory(!showHistory)}
        onShowScontrinoQueue={() => setShowScontrinoQueue(!showScontrinoQueue)}
        onShowMultiPayment={() => {
          // Raccogli tutti gli ordini non pagati da tutti i tavoli
          setSelectedTable(null);
          setSelectedOrder(null);
          setShowMultiOrderPaymentModal(true);
        }}
        showHistory={showHistory}
        showScontrinoQueue={showScontrinoQueue}
          />
        </CassaErrorBoundary>

        {/* Main Content */}
        <CassaErrorBoundary level="section" isolate>
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
            {/* Tavoli da Pagare - Unificato */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                  Ordini da Pagare
                </h2>
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.secondary }}>
                  <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.bg.hover }}>
                    {tableGroupsRitirate.length} da pagare
                  </span>
                  <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.bg.hover }}>
                    {tableGroupsDaPagare.length} in pagamento
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(() => {
                  // Usa i dati pre-aggregati dal server per evitare duplicazioni
                  const allTables = [...tableGroupsRitirate, ...tableGroupsDaPagare];
                  
                  if (allTables.length === 0) {
                    return (
                      <div className="col-span-3 text-center py-12 rounded-lg" 
                        style={{ 
                          backgroundColor: colors.bg.card, 
                          borderColor: colors.border.primary, 
                          borderWidth: '1px', 
                          borderStyle: 'solid' 
                        }}
                      >
                        <Package className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                        <p style={{ color: colors.text.secondary }}>Nessun ordine da pagare</p>
                      </div>
                    );
                  }
                  
                  return allTables.map((table) => (
                    <TableCard
                      key={table.tavoloNumero}
                      table={table}
                      onClick={() => {
                        setSelectedTable(table);
                        setShowTableDrawer(true);
                      }}
                    />
                  ));
                })()}
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
                  tableGroupsPagate.map((table: TableGroup) => (
                    <TableCard
                      key={table.tavoloNumero}
                      table={table}
                      onClick={() => {
                        setSelectedTable(table);
                        setShowTableDrawer(true);
                      }}
                      variant="paid"
                    />
                  ))
                )}
              </div>
            </div>

            {/* Debiti */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>Debiti Aperti</h2>
                <button
                  onClick={() => setShowAddDebtModal(true)}
                  className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  style={{
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.button.primary;
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi Debito
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {debiti.length === 0 ? (
                  <div className="col-span-3 text-center py-12 rounded-lg" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                    <CreditCard className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessun debito aperto</p>
                  </div>
                ) : (
                  debiti.map((debito: any) => (
                    <DebtCard
                      key={debito.id}
                      debito={debito}
                      onClick={() => {
                        setSelectedDebt(debito);
                        setShowDebtModal(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
          )}
          </div>
        </CassaErrorBoundary>

        {/* Scontrino Queue Manager */}
        <CassaErrorBoundary level="component" isolate>
          <ScontrinoQueueManager 
        isOpen={showScontrinoQueue} 
        onClose={() => setShowScontrinoQueue(false)} 
          />
        </CassaErrorBoundary>

        {/* Table Details Drawer */}
        <CassaErrorBoundary level="component" isolate>
          <TableDetailsDrawer
        isOpen={showTableDrawer}
        selectedTable={selectedTable}
        selectedOrder={selectedOrder}
        paymentMethod={paymentMethod}
        paymentMode={paymentMode}
        isProcessingPayment={isProcessingPayment}
        onClose={() => {
          setShowTableDrawer(false);
          setSelectedTable(null);
          setSelectedOrder(null);
        }}
        onSelectOrder={setSelectedOrder}
        onChangePaymentMethod={setPaymentMethod}
        onChangePaymentMode={setPaymentMode}
        onPayTable={(clienteNome) => handleTablePayment(clienteNome, paymentMethod)}
        onPayOrder={(clienteNome) => handlePayment(clienteNome, paymentMethod)}
        onPayByClient={(clienteNome) => handlePaymentByClient(clienteNome, paymentMethod)}
        onPayPartial={() => {
          // Se c'è un ordine selezionato, usa il modal singolo
          // Altrimenti usa il modal multi-ordine per il tavolo
          if (selectedOrder) {
            // Trova l'ordine aggiornato dai dati correnti
            const updatedOrder = selectedTable?.ordinazioni.find(o => o.id === selectedOrder.id);
            if (updatedOrder) {
              setSelectedOrder(updatedOrder);
            }
            setShowPartialPaymentModal(true);
          } else if (selectedTable) {
            setShowMultiOrderPaymentModal(true);
          }
        }}
        onCreateDebt={() => setShowClientModal(true)}
        onTriggerParticles={triggerParticles}
        onRefreshData={loadOrders} // Passa il metodo di refresh incrementale
          />
        </CassaErrorBoundary>
        
        {/* Client Selection Modal */}
        <CassaErrorBoundary level="component" isolate>
          <ClientSelectionModal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        onSelectClient={handleCreateDebt}
          />
        </CassaErrorBoundary>

        {/* Debt Payment Modal */}
        <CassaErrorBoundary level="component" isolate>
          <PayDebtModal
        isOpen={showDebtModal}
        onClose={() => {
          setShowDebtModal(false);
          setSelectedDebt(null);
        }}
        debt={selectedDebt}
        onPaymentComplete={loadOrders}
          />
        </CassaErrorBoundary>
        
        {/* Add Debt Modal */}
        <CassaErrorBoundary level="component" isolate>
          <AddDebtModal
        isOpen={showAddDebtModal}
        onClose={() => setShowAddDebtModal(false)}
        onSubmit={handleCreateDirectDebt}
          />
        </CassaErrorBoundary>
        
        {/* Multi-Order Partial Payment Modal */}
        <CassaErrorBoundary level="component" isolate>
          <MultiOrderPartialPaymentModal
        isOpen={showMultiOrderPaymentModal}
        orders={(() => {
          // Se c'è un tavolo selezionato, usa solo i suoi ordini
          if (selectedTable) {
            return selectedTable.ordinazioni;
          }
          
          // Altrimenti raccogli tutti gli ordini non pagati da tutti i tavoli
          const allOrders: Order[] = [];
          
          // Aggiungi ordini da tavoli da pagare
          tableGroupsRitirate.forEach(table => {
            table.ordinazioni.forEach(order => {
              if (order.rimanente > 0) {
                allOrders.push(order);
              }
            });
          });
          
          // Aggiungi ordini da tavoli in pagamento
          tableGroupsDaPagare.forEach(table => {
            table.ordinazioni.forEach(order => {
              if (order.rimanente > 0) {
                allOrders.push(order);
              }
            });
          });
          
          return allOrders;
        })()}
        onClose={() => setShowMultiOrderPaymentModal(false)}
        onConfirmPayment={async (payments, clienteNome, modalita) => {
          // Validazione multi-ordine
          const multiOrderData = {
            payments,
            clienteNome,
            modalita
          };
          
          if (!multiOrderValidation.validate(multiOrderData)) {
            toast.error('Errori di validazione', multiOrderValidation.errors.join(', '));
            return;
          }
          
          setIsProcessingPayment(true);
          try {
            // Processa pagamenti per ogni ordine
            for (const payment of payments) {
              // Crea mappa delle quantità per riga
              const quantitaPerRiga: Record<string, number> = {};
              payment.items.forEach(item => {
                quantitaPerRiga[item.id] = item.quantita;
              });
              
              // Crea pagamento parziale per questo ordine
              const result = await creaPagamentiParziali(
                payment.orderId,
                [{
                  clienteNome,
                  importo: payment.importo,
                  modalita,
                  righeSelezionate: payment.items.map(i => i.id),
                  quantitaPerRiga
                }]
              );
              
              if (!result.success) {
                toast.error('Errore pagamento', 'error' in result ? result.error : 'Errore sconosciuto');
                return;
              }
              
              // Generate receipt if fully paid
              if (result.success && 'data' in result && result.data.statoPagamento === 'COMPLETAMENTE_PAGATO') {
                await generaScontrino(payment.orderId);
              }
            }
            
            // Success notification
            const totale = payments.reduce((sum, p) => sum + p.importo, 0);
            BrowserNotificationHelper.showWithSound(
              "Pagamento Multi-Ordine Completato",
              `${clienteNome} ha pagato €${totale.toFixed(2)} per ${payments.length} ordini`
            );
            
            // Refresh data and close modals
            loadOrders(true);
            setShowMultiOrderPaymentModal(false);
            setShowTableDrawer(false);
            setSelectedTable(null);
          } catch (error) {
            console.error('Errore durante il pagamento multi-ordine:', error);
            toast.error('Errore', 'Si è verificato un errore durante il pagamento');
          } finally {
            setIsProcessingPayment(false);
          }
        }}
          />
        </CassaErrorBoundary>
        
        {/* Simple Partial Payment Modal */}
        <CassaErrorBoundary level="component" isolate>
          <SimplePartialPaymentModal
        isOpen={showPartialPaymentModal}
        order={selectedOrder}
        onClose={() => setShowPartialPaymentModal(false)}
        onConfirmPayment={async (selectedItems, clienteNome, modalita) => {
          if (!selectedOrder) return;
          
          setIsProcessingPayment(true);
          try {
            // Calcola l'importo totale basato sulle quantità selezionate
            const importoTotale = selectedItems.reduce((sum, item) => 
              sum + (item.quantita * item.prezzo), 0
            );
            
            // Prepara i dati per il pagamento parziale
            const righeSelezionate = selectedItems.map(item => item.id);
            
            // Crea mappa delle quantità per riga
            const quantitaPerRiga: Record<string, number> = {};
            selectedItems.forEach(item => {
              quantitaPerRiga[item.id] = item.quantita;
            });
            
            // Crea un singolo pagamento con gli articoli selezionati e le quantità
            const result = await creaPagamentiParziali(
              selectedOrder.id,
              [{
                clienteNome,
                importo: importoTotale,
                modalita,
                righeSelezionate,
                quantitaPerRiga
              }]
            );
            
            if (result.success) {
              // Success notification
              BrowserNotificationHelper.show("Pagamento Parziale Completato", {
                body: `${clienteNome} ha pagato €${importoTotale.toFixed(2)}`,
                icon: '/icon-192.png'
              });
              
              // Check if order is now fully paid
              const isFullyPaid = result.success && 'data' in result && 
                (result.data.statoPagamento === 'COMPLETAMENTE_PAGATO' || 
                 result.data.totaleRimanente === 0);
              
              if (isFullyPaid) {
                // Move order to paid state before refreshing
                const inRitirate = tableGroupsRitirate.some(table => 
                  table.ordinazioni.some(ord => ord.id === selectedOrder.id)
                );
                const inDaPagare = tableGroupsDaPagare.some(table => 
                  table.ordinazioni.some(ord => ord.id === selectedOrder.id)
                );
                
                if (inRitirate) {
                  moveOrderBetweenStates(selectedOrder.id, 'tableGroupsRitirate', 'tableGroupsPagate');
                } else if (inDaPagare) {
                  moveOrderBetweenStates(selectedOrder.id, 'tableGroupsDaPagare', 'tableGroupsPagate');
                }
                
                // Generate receipt
                await generaScontrino(selectedOrder.id);
                setSelectedOrder(null);
                setShowPartialPaymentModal(false);
              }
              
              // Refresh data per aggiornare l'ordine con i nuovi pagamenti
              await loadOrders(true);
              
              // Chiudi i modal dopo il pagamento
              setShowPartialPaymentModal(false);
              setShowTableDrawer(false);
              setSelectedTable(null);
              setSelectedOrder(null);
            } else {
              toast.error('Errore pagamento', 'error' in result ? result.error : 'Errore sconosciuto');
            }
          } catch (error) {
            console.error('Errore durante il pagamento parziale:', error);
            toast.error('Errore', 'Si è verificato un errore durante il pagamento');
          } finally {
            setIsProcessingPayment(false);
          }
        }}
          />
        </CassaErrorBoundary>

        {/* Particle Effect */}
        <ParticleEffect 
        key={particleKey}
        trigger={true} 
        x={particlePos.x} 
        y={particlePos.y}
        particleCount={20}
        duration={3000}
        />

        {/* Cameriere Modal */}
        <CassaErrorBoundary level="component" isolate>
          <CameriereModal 
        isOpen={showCameriereModal}
        onClose={() => setShowCameriereModal(false)}
          />
        </CassaErrorBoundary>

        {/* Floating Action Button for Cameriere */}
        <button
        onClick={() => setShowCameriereModal(true)}
        className="fixed bottom-6 right-6 z-40 shadow-lg rounded-full p-4 transition-all hover:scale-110"
        style={{
          backgroundColor: colors.button.primary,
          color: colors.button.primaryText,
        }}
      >
        <ShoppingBag className="w-6 h-6" />
        </button>
      </div>
    </CassaErrorBoundary>
  );
}

// Esporta il componente wrappato con Error Boundary
export default withCassaErrorBoundary(CassaPageOptimized, {
  level: 'page',
  onError: (error, errorInfo) => {
    console.error('Cassa Page Error:', error);
    // Qui potresti inviare l'errore a un servizio di monitoring
  },
  resetOnPropsChange: true
});