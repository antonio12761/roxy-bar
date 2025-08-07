"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { OrderItem, Ordinazione } from "./types";
import { 
  ChefHat, 
  Clock, 
  RefreshCw, 
  Bell, 
  Check, 
  AlertCircle, 
  Coffee,
  User,
  Package,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  ClipboardList,
  ArrowLeft,
  X,
  AlertTriangle,
  ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { getOrdinazioniAperte, aggiornaStatoRiga, aggiornaStatoOrdinazione, sollecitaOrdinePronto, segnaOrdineRitirato, cancellaOrdiniAttivi, getRichiesteMergePendenti, accettaRichiestaMerge, rifiutaRichiestaMerge } from "@/lib/actions/ordinazioni";
import { toggleProductAvailability } from "@/lib/actions/prodotti";
import { markProductAsOutOfStock } from "@/lib/actions/out-of-stock";
import { useSSE } from "@/contexts/sse-context";
import { StationType } from "@/lib/sse/station-filters";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { ProcedureViewModal } from "@/components/prepara/ProcedureViewModal";
import { ProductAvailabilityModal } from "@/components/prepara/ProductAvailabilityModal";
import OutOfStockModal from "@/components/prepara/OutOfStockModal";
import SplitOrderChoiceModal from "@/components/prepara/SplitOrderChoiceModal";
import OutOfStockQuantityModal from "@/components/prepara/OutOfStockQuantityModal";
import OrderListCard from "@/components/prepara/OrderListCard";
import DeleteAllOrdersModal from "@/components/prepara/DeleteAllOrdersModal";
import PreparaHeader from "@/components/prepara/PreparaHeader";
import EmptyOrdersState from "@/components/prepara/EmptyOrdersState";
import OrderDetailsPanel from "@/components/prepara/OrderDetailsPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { TabBookmarks, TabContentCard } from "@/components/ui/tab-bookmarks";
import PreparaTabs from "@/components/prepara/PreparaTabs";
import { useSSEHandlers } from "@/hooks/useSSEHandlers";
import { useOrderManagement } from "@/hooks/useOrderManagement";
import { useConnectionHealth } from "@/hooks/useConnectionHealth";
import { useSSEEffects } from "@/hooks/useSSEEffects";
import { getFilteredOrders } from "@/utils/orderFilters";
import CameriereModal from "@/components/prepara/CameriereModal";
import CassaModal from "@/components/prepara/CassaModal";


export default function PreparaPageOptimized({ currentUser }: { currentUser: any }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [orders, setOrders] = useState<Ordinazione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Ordinazione | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'esauriti' | 'attesa' | 'preparazione' | 'pronti' | 'ritirati'>('attesa');
  const [isStartingPreparation, setIsStartingPreparation] = useState(false);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
  const [showCameriereModal, setShowCameriereModal] = useState(false);
  const [showCassaModal, setShowCassaModal] = useState(false);
  // Removed showOrderDetail - no longer using modal
  
  // Track ongoing state transitions to prevent loops
  const [ongoingTransitions, setOngoingTransitions] = useState<Set<string>>(new Set());
  
  // Debounce timer for auto-complete orders
  const autoCompleteTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  // Procedure modal state
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProductForProcedure, setSelectedProductForProcedure] = useState<{ name: string; id: number | null; quantity: number } | null>(null);
  const [productProcedureCache, setProductProcedureCache] = useState<Map<number, boolean>>(new Map());
  
  // Availability modal state
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedProductForAvailability, setSelectedProductForAvailability] = useState<any>(null);
  
  // Out of stock modal state
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const [selectedProductForOutOfStock, setSelectedProductForOutOfStock] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [affectedItemsForOutOfStock, setAffectedItemsForOutOfStock] = useState<Array<{
    id: string;
    orderId: string;
    orderNumber: number;
    tableNumber?: string;
    quantity: number;
  }>>([]);
  
  // Delete all orders modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Out of stock quantity modal states
  const [showOutOfStockQuantityModal, setShowOutOfStockQuantityModal] = useState(false);
  const [pendingOutOfStockProduct, setPendingOutOfStockProduct] = useState<{
    productId: number;
    productName: string;
    affectedItems: any[];
    totalQuantity: number;
    hasOtherProducts: boolean;
    multipleProducts?: Array<{
      itemId: string;
      productId: number;
      productName: string;
      quantity: number;
      maxQuantity: number;
    }>;
  } | null>(null);
  
  // Merge requests state - ora caricate per ordine specifico
  const [orderMergeRequests, setOrderMergeRequests] = useState<any[]>([]);
  const [isLoadingMergeRequests, setIsLoadingMergeRequests] = useState(false);
  const [processingMergeRequest, setProcessingMergeRequest] = useState<string | null>(null);
  
  // Particle effect state
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  const ordersCountRef = useRef<HTMLSpanElement>(null);
  const lastRefreshRef = useRef<number>(0);

  // Use SSE context instead of station hook for now
  const sseContext = useSSE();
  const [eventQueue, setEventQueue] = useState<any[]>([]);
  
  // Connection health from context
  const connectionHealth = {
    status: sseContext.connected ? 'connected' : sseContext.connecting ? 'connecting' : 'disconnected',
    quality: sseContext.quality || 'poor',
    latency: sseContext.latency || 0,
    reconnectAttempts: sseContext.reconnectAttempts
  };
  
  const clearEventQueue = useCallback(() => {
    setEventQueue([]);
  }, []);
  
  // Prevent multiple subscriptions with ref
  const subscribedRef = useRef(false);
  const lastOrderRef = useRef<{ orderId: string; timestamp: number }>({ orderId: '', timestamp: 0 });
  const lastProductUpdateRef = useRef<{ productId: number; timestamp: number }>({ productId: 0, timestamp: 0 });

  // Load merge requests when order is selected
  useEffect(() => {
    if (selectedOrder) {
      loadMergeRequests(selectedOrder.id);
    } else {
      setOrderMergeRequests([]);
    }
  }, [selectedOrder?.id]);
  
  // Periodic refresh of merge requests for the selected order
  useEffect(() => {
    if (!selectedOrder) return;
    
    const interval = setInterval(() => {
      loadMergeRequests(selectedOrder.id, false); // Don't show loader on periodic refresh
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [selectedOrder?.id]);

  // Process SSE events - Moved after function definitions

  // Check if a product has a procedure
  const checkProductProcedure = async (productId: number): Promise<boolean> => {
    // Check cache first
    if (productProcedureCache.has(productId)) {
      return productProcedureCache.get(productId) || false;
    }
    
    try {
      const response = await fetch(`/api/products/procedures?productId=${productId}`);
      if (!response.ok) {
        // Cache negative result
        setProductProcedureCache(prev => new Map(prev).set(productId, false));
        return false;
      }
      
      const data = await response.json();
      const hasProcedure = data && data.ProcedureStep && data.ProcedureStep.length > 0;
      
      // Cache the result
      setProductProcedureCache(prev => new Map(prev).set(productId, hasProcedure));
      return hasProcedure;
    } catch (error) {
      console.error("Errore verifica procedura:", error);
      // Cache negative result on error
      setProductProcedureCache(prev => new Map(prev).set(productId, false));
      return false;
    }
  };

  // Load initial data with cache support - Memoized
  const loadMergeRequests = async (ordinazioneId?: string, showLoader = true) => {
    try {
      if (!ordinazioneId) {
        console.log('[Prepara] No ordinazioneId, clearing merge requests');
        setOrderMergeRequests([]);
        setIsLoadingMergeRequests(false);
        return;
      }
      if (showLoader) {
        setIsLoadingMergeRequests(true);
      }
      console.log('[Prepara] Loading merge requests for order:', ordinazioneId);
      const result = await getRichiesteMergePendenti(ordinazioneId);
      console.log('[Prepara] Richieste merge caricate per ordine:', ordinazioneId, 'Result:', result);
      if (result.success && result.richieste) {
        console.log('[Prepara] Setting merge requests:', result.richieste.length, 'items');
        setOrderMergeRequests(result.richieste);
      } else {
        console.log('[Prepara] No merge requests found or error');
        setOrderMergeRequests([]);
      }
    } catch (error) {
      console.error("Errore caricamento richieste merge:", error);
      setOrderMergeRequests([]);
    } finally {
      if (showLoader) {
        setIsLoadingMergeRequests(false);
      }
    }
  };

  const handleAcceptMerge = async (richiestaId: string) => {
    if (processingMergeRequest) return;
    
    setProcessingMergeRequest(richiestaId);
    try {
      const result = await accettaRichiestaMerge(richiestaId);
      if (result.success) {
        toast.success("Prodotti aggiunti all'ordine");
        
        // Mostra lo skeleton loader per i dettagli ordine
        setIsLoadingOrderDetails(true);
        
        // Prima ricarica gli ordini per avere i dati aggiornati
        await loadOrders();
        
        // Poi ricarica le merge requests
        if (selectedOrder) {
          await loadMergeRequests(selectedOrder.id, false);
          
          // Usa setOrders per ottenere gli ordini aggiornati
          setOrders(currentOrders => {
            const updatedOrder = currentOrders.find(o => o.id === selectedOrder.id);
            if (updatedOrder) {
              // Forza il re-render completo del dettaglio ordine
              setTimeout(() => {
                setSelectedOrder(updatedOrder);
                setIsLoadingOrderDetails(false);
              }, 100);
            } else {
              setIsLoadingOrderDetails(false);
            }
            return currentOrders; // Non modificare gli ordini
          });
        } else {
          setIsLoadingOrderDetails(false);
        }
      } else {
        toast.error(result.error || "Errore nell'accettazione");
      }
    } catch (error) {
      console.error("Errore accettazione merge:", error);
      toast.error("Errore nell'accettazione della richiesta");
    } finally {
      setProcessingMergeRequest(null);
    }
  };

  const handleRejectMerge = async (richiestaId: string) => {
    if (processingMergeRequest) return;
    
    setProcessingMergeRequest(richiestaId);
    try {
      const result = await rifiutaRichiestaMerge(richiestaId);
      if (result.success) {
        // Messaggio più dettagliato per il nuovo ordine creato
        if (result.numeroOrdine) {
          toast.success(`Richiesta rifiutata - Creato nuovo ordine #${result.numeroOrdine} in attesa`);
        } else {
          toast.info("Richiesta rifiutata");
        }
        
        // Ricarica gli ordini per mostrare il nuovo ordine creato
        await loadOrders();
        
        // Ricarica le richieste per l'ordine selezionato
        if (selectedOrder) {
          await loadMergeRequests(selectedOrder.id, false);
        }
      } else {
        toast.error(result.error || "Errore nel rifiuto");
      }
    } catch (error) {
      console.error("Errore rifiuto merge:", error);
      toast.error("Errore nel rifiuto della richiesta");
    } finally {
      setProcessingMergeRequest(null);
    }
  };
  
  // Handle product availability toggle
  const handleToggleAvailability = async (productId: number, available: boolean) => {
    try {
      const result = await toggleProductAvailability(productId, available);
      if (result.success) {
        // Don't show toast here - let SSE event handle it to avoid duplicates
        // toast.success(result.message || 'Disponibilità aggiornata');
        // Refresh orders to show updated availability
        loadOrders();
      } else {
        toast.error(result.error || 'Errore aggiornamento disponibilità');
      }
    } catch (error) {
      console.error('Errore toggle disponibilità:', error);
      toast.error('Errore aggiornamento disponibilità');
    }
  };

  const loadOrders = useCallback(async () => {
    console.log('[Prepara] loadOrders called at:', new Date().toISOString());
    console.trace('[Prepara] loadOrders call stack');
    
    try {
      // Se stiamo completando un ordine, aspetta un po' prima di ricaricare
      if (isCompletingOrder) {
        console.log('[Prepara] Completamento ordine in corso, skip reload per evitare race conditions');
        return;
      }

      // Cache temporarily disabled
      // const cachedOrders = getCachedData<Ordinazione[]>('orders:active:prepara');
      // if (cachedOrders && cachedOrders.length > 0) {
      //   console.log('[Prepara] Using cached orders:', cachedOrders.length);
      //   setOrders(cachedOrders);
      //   setIsLoading(false);
      // }

      // Then fetch fresh data
      const data = await getOrdinazioniAperte();
      
      // Map RigaOrdinazione to righe for consistency
      const normalizedData = data.map((ord: any) => ({
        ...ord,
        righe: ord.RigaOrdinazione || ord.righe || []
      }));
      
      // Debug: Log all orders and their destinations
      console.log('[Prepara] All orders received:', normalizedData.length);
      
      // Collect all unique destinations to see what's in the database
      const allDestinations = new Set<string>();
      normalizedData.forEach((ord: any) => {
        ord.righe.forEach((riga: any) => {
          allDestinations.add(riga.postazione || 'NULL');
        });
      });
      console.log('[Prepara] ALL UNIQUE DESTINATIONS IN DATABASE:', Array.from(allDestinations));
      
      // Check for null or empty destinations
      const itemsWithoutDestination = normalizedData.flatMap((ord: any) => 
        ord.righe.filter((riga: any) => !riga.postazione || riga.postazione === '')
      );
      if (itemsWithoutDestination.length > 0) {
        console.log(`[Prepara] WARNING: ${itemsWithoutDestination.length} items without destination!`);
        itemsWithoutDestination.forEach((item: any) => {
          console.log(`  - ${item.prodotto?.nome} (Order: ${item.ordinazioneId})`);
        });
      }
      
      // DETAILED DEBUG LOGGING FOR EACH ORDER
      normalizedData.forEach((ord: any, index: number) => {
        console.log(`\n=== DEBUG ORDER ${index + 1} ===`);
        console.log(`[Prepara] Order ID: ${ord.id}`);
        console.log(`[Prepara] Order Type: ${ord.tipo}`);
        console.log(`[Prepara] Order Stato: ${ord.stato}`);
        console.log(`[Prepara] Number of righe: ${ord.righe.length}`);
        
        // Log each riga (item) in detail
        ord.righe.forEach((riga: any, rigaIndex: number) => {
          console.log(`  Riga ${rigaIndex + 1}:`);
          console.log(`    - ID: ${riga.id}`);
          console.log(`    - Prodotto: ${riga.Prodotto?.nome || riga.prodotto?.nome || 'N/A'}`);
          console.log(`    - Prodotto object:`, riga.Prodotto);
          console.log(`    - Postazione: "${riga.postazione}"`); 
          console.log(`    - Stato: ${riga.stato}`);
          console.log(`    - Quantità: ${riga.quantita}`);
        });
        
        // Check if any riga has PREPARA or BANCO destination
        const hasPreparaItems = ord.righe.some((item: any) => item.postazione === 'PREPARA');
        const hasBancoItems = ord.righe.some((item: any) => item.postazione === 'BANCO');
        console.log(`[Prepara] Has PREPARA items: ${hasPreparaItems}`);
        console.log(`[Prepara] Has BANCO items: ${hasBancoItems}`);
        
        // Show exactly which items match PREPARA or BANCO
        const preparaBancoItems = ord.righe.filter((item: any) => 
          item.postazione === 'PREPARA' || item.postazione === 'BANCO'
        );
        console.log(`[Prepara] PREPARA/BANCO items count: ${preparaBancoItems.length}`);
        preparaBancoItems.forEach((item: any, itemIndex: number) => {
          console.log(`  ${item.postazione} Item ${itemIndex + 1}: ${item.prodotto?.nome} (ID: ${item.id})`);
        });
        
        // Test the exact filter condition
        const passesFilter = ord.righe.some((item: any) => 
          item.postazione === 'PREPARA' || item.postazione === 'BANCO'
        );
        console.log(`[Prepara] Passes filter: ${passesFilter}`);
        console.log(`=== END DEBUG ORDER ${index + 1} ===\n`);
      });

      // Log orders with ORDINATO_ESAURITO stato
      const ordersWithEsaurito = normalizedData.filter((ord: any) => ord.stato === 'ORDINATO_ESAURITO');
      console.log('[Prepara] Orders with ORDINATO_ESAURITO stato:', ordersWithEsaurito.length);
      if (ordersWithEsaurito.length > 0) {
        ordersWithEsaurito.forEach((ord: any) => {
          console.log('[Prepara] ESAURITO Order:', ord.id, ord.numero, ord.stato);
        });
      }
      
      // Transform and filter for PREPARA items (include BANCO temporarily for existing orders)
      const preparaOrders = normalizedData
        .filter((ord: any) => ord.righe.some((item: any) => 
          item.postazione === 'PREPARA' || item.postazione === 'BANCO'
        ))
        .map((ord: any) => ({
            id: ord.id,
            tavolo: ord.Tavolo?.numero || ord.tipo,
            nomeCliente: ord.nomeCliente || ord.note?.split('Cliente: ')[1]?.split(' - ')[0],
            timestamp: ord.dataApertura,
            items: ord.righe
            .filter((item: any) => item.postazione === 'PREPARA' || item.postazione === 'BANCO')
            .map((item: any) => ({
              id: item.id,
              ordinazioneId: ord.id,
              prodotto: item.Prodotto?.nome || item.prodotto?.nome || 'Prodotto sconosciuto',
              prodottoId: item.prodottoId || item.Prodotto?.id || item.prodotto?.id,
              quantita: item.quantita,
              prezzo: item.prezzo,
              stato: item.stato,
              timestamp: item.timestampOrdine,
              postazione: item.postazione,
              note: item.note,
              glassesCount: item.glassesCount,
              configurazione: item.configurazione // Aggiungi configurazione per miscelati
            })),
            totaleCosto: ord.totale,
            stato: ord.stato === 'ORDINATO_ESAURITO' ? 'ORDINATO_ESAURITO' : ord.stato,
            hasKitchenItems: ord.righe.some((item: any) => item.postazione === 'CUCINA'),
            cameriere: ord.cameriere?.nome,
            note: ord.note
        }))  
        .filter(ord => ord.items.length > 0);

      console.log('[Prepara] Filtered PREPARA orders:', preparaOrders.length);
      
      // Debug: Log orders with ORDINATO_ESAURITO after mapping
      const mappedEsauriti = preparaOrders.filter(ord => ord.stato === 'ORDINATO_ESAURITO');
      console.log('[Prepara] Mapped orders with ORDINATO_ESAURITO:', mappedEsauriti.length);
      if (mappedEsauriti.length > 0) {
        mappedEsauriti.forEach(ord => {
          console.log('[Prepara] Mapped ESAURITO Order:', ord.id, 'stato:', ord.stato);
        });
      }

      // Merge with existing orders to preserve SSE-added orders
      setOrders(prevOrders => {
        // Create a map of existing orders for efficient lookup
        const existingOrdersMap = new Map(prevOrders.map(order => [order.id, order]));
        
        // Update or add orders from the database
        preparaOrders.forEach(dbOrder => {
          existingOrdersMap.set(dbOrder.id, dbOrder);
        });
        
        // Convert back to array and sort by timestamp (oldest first)
        const mergedOrders = Array.from(existingOrdersMap.values())
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        console.log('[Prepara] Merged orders:', mergedOrders.length, 'Previous:', prevOrders.length, 'DB:', preparaOrders.length);
        
        return mergedOrders;
      });
      
      setIsLoading(false);
      
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
      toast.error("Errore nel caricamento degli ordini");
      setIsLoading(false);
    }
  }, [isCompletingOrder]);

  // Select order from list
  const selectOrder = useCallback((order: Ordinazione) => {
    console.log('[Prepara] Selecting order:', order.id);
    setIsLoadingOrderDetails(true);
    setSelectedOrder(order);
    
    // Simulate loading time for UX
    setTimeout(() => {
      setIsLoadingOrderDetails(false);
    }, 500);
  }, []);

  // Auto-select first order
  const autoSelectFirstOrder = useCallback(async (newOrder: Ordinazione) => {
    console.log('[Prepara] Auto-selecting first order:', newOrder.id);
    
    setIsLoadingOrderDetails(true);
    setSelectedOrder(newOrder);
    // Don't show detail modal for auto-selection
    
    // Simulate loading time for UX
    setTimeout(() => {
      setIsLoadingOrderDetails(false);
    }, 800);
  }, []);

  // Track last order toast to prevent duplicates
  const lastOrderToastRef = useRef<{ orderId: string; timestamp: number }>({ orderId: '', timestamp: 0 });

  // Handle new order event - Memoized to prevent re-creation
  const handleNewOrder = useCallback((data: any) => {
    
    // Check if we already have this order
    const orderExists = orders.some(order => order.id === data.orderId);
    if (orderExists) {
      // Order already exists, skip
      return;
    }
    
    const newOrder: Ordinazione = {
      id: data.orderId,
      tavolo: data.tableNumber || 'Asporto',
      nomeCliente: data.customerName,
      timestamp: data.timestamp,
      items: data.items
        .filter((item: any) => item.destination === 'PREPARA' || item.destination === 'BANCO')
        .map((item: any) => ({
          id: item.id,
          ordinazioneId: data.orderId,
          prodotto: item.productName,
          quantita: item.quantity,
          prezzo: 0, // Will be updated from DB
          stato: 'INSERITO',
          timestamp: data.timestamp,
          postazione: item.destination
        })),
      totaleCosto: data.totalAmount,
      stato: 'ORDINATO',
      hasKitchenItems: data.items.some((item: any) => item.destination === 'CUCINA'),
      cameriere: data.waiterName
    };

    setOrders(prev => {
      // Double check in setter too
      if (prev.some(order => order.id === data.orderId)) {
        return prev;
      }
      
      // Add new order and sort by timestamp (oldest first)
      const newOrders = [...prev, newOrder].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Added new order
      
      // Auto-select if this is the first order or no order is currently selected - DISABLED
      // if (!selectedOrder || prev.length === 0) {
      //   setTimeout(() => autoSelectFirstOrder(newOrder), 100);
      // }
      
      return newOrders;
    });
    
    // Trigger fireworks effect
    if (ordersCountRef.current) {
      const rect = ordersCountRef.current.getBoundingClientRect();
      setParticlePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setParticleKey(prev => prev + 1);
    }
    
    // Check if we already showed a toast for this order recently
    const now = Date.now();
    const isDuplicateToast = lastOrderToastRef.current.orderId === data.orderId && 
                            (now - lastOrderToastRef.current.timestamp) < 3000;
    
    if (!isDuplicateToast) {
      toast.success(`Nuovo ordine dal tavolo ${newOrder.tavolo}`);
      lastOrderToastRef.current = { orderId: data.orderId, timestamp: now };
    }
  }, [orders, autoSelectFirstOrder]);

  // Handle order cancelled event
  const handleOrderCancelled = useCallback((data: any) => {
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
    if (selectedOrder?.id === data.orderId) {
      setSelectedOrder(null);
    }
    toast.info(`Ordine ${data.orderNumber || data.orderId} cancellato`);
  }, [selectedOrder]);

  // Handle reminder event
  const handleReminder = useCallback((data: any) => {
    toast.warning(data.message || 'Promemoria: controlla gli ordini in attesa');
  }, []);

  // Handle item status update - Memoized
  const handleItemUpdate = useCallback(async (data: any) => {
    
    setOrders(prev => prev.map(order => {
      if (order.id === data.orderId) {
        const updatedOrder = {
          ...order,
          items: order.items.map(item => 
            item.id === data.itemId 
              ? { ...item, stato: data.status }
              : item
          )
        };
        
        // Check if all items are now PRONTO
        const allReady = updatedOrder.items.every(item => item.stato === 'PRONTO');
        if (allReady && updatedOrder.stato !== 'PRONTO') {
          updatedOrder.stato = 'PRONTO';
          
          // Use debounce to prevent multiple calls
          const orderId = order.id;
          
          // Clear existing timer for this order
          if (autoCompleteTimerRef.current[orderId]) {
            clearTimeout(autoCompleteTimerRef.current[orderId]);
          }
          
          // Set new timer with debounce
          autoCompleteTimerRef.current[orderId] = setTimeout(() => {
            // Prevent duplicate state transitions
            const transitionKey = `${orderId}:PRONTO`;
            if (!ongoingTransitions.has(transitionKey)) {
              setOngoingTransitions(prev => new Set(prev).add(transitionKey));
              
              console.log('[Prepara] Auto-completing order to PRONTO after debounce:', orderId);
              
              aggiornaStatoOrdinazione(orderId, 'PRONTO')
                .then(result => {
                  if (!result.success) {
                    console.error('[Prepara] Errore aggiornamento stato ordine:', result.error);
                    toast.error('Errore nell\'aggiornamento dello stato dell\'ordine');
                  } else {
                    console.log('[Prepara] Ordine aggiornato a PRONTO nel backend');
                  }
                })
                .catch(error => {
                  console.error('[Prepara] Errore aggiornamento stato ordine:', error);
                })
                .finally(() => {
                  // Remove from ongoing transitions after completion
                  setOngoingTransitions(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(transitionKey);
                    return newSet;
                  });
                  
                  // Clean up timer reference
                  delete autoCompleteTimerRef.current[orderId];
                });
            }
          }, 1000); // 1 second debounce
        }
        
        return updatedOrder;
      }
      return order;
    }));
  }, [ongoingTransitions]);

  // Subscribe to SSE events with subscribedRef pattern
  useEffect(() => {
    if (!sseContext?.subscribe || subscribedRef.current) {
      return; // Prevent multiple subscriptions
    }
    
    subscribedRef.current = true;
    const unsubscribers: (() => void)[] = [];
    
    // Subscribe to order:new events with deduplication
    unsubscribers.push(
      sseContext.subscribe('order:new', (data) => {
        // Check if this is a duplicate event (same order within 3 seconds)
        const now = Date.now();
        const isDuplicate = lastOrderRef.current.orderId === data.orderId && 
                           (now - lastOrderRef.current.timestamp) < 3000;
        
        if (!isDuplicate) {
          // Process immediately without queueing for instant update
          lastOrderRef.current = { orderId: data.orderId, timestamp: now };
          
          // Directly call handleNewOrder for instant processing
          requestAnimationFrame(() => {
            handleNewOrder(data);
          });
        }
      })
    );
    
    // Subscribe to other events with instant processing
    unsubscribers.push(
      sseContext.subscribe('order:item:update', (data) => {
        requestAnimationFrame(() => handleItemUpdate(data));
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('order:cancelled', (data) => {
        requestAnimationFrame(() => handleOrderCancelled(data));
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('order:status-change', (data) => {
        setEventQueue(prev => [...prev, { event: 'order:status-change', data, timestamp: Date.now() }]);
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('notification:reminder', (data) => {
        requestAnimationFrame(() => handleReminder(data));
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('order:merged', (data) => {
        console.log('[Prepara] Received order:merged event:', data);
        console.log('[Prepara] Event timestamp:', new Date().toISOString());
        setEventQueue(prev => [...prev, { event: 'order:merged', data, timestamp: Date.now() }]);
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('merge:request', (data) => {
        setEventQueue(prev => [...prev, { event: 'merge:request', data, timestamp: Date.now() }]);
      })
    );
    
    // Track product availability updates with deduplication
    unsubscribers.push(
      sseContext.subscribe('order:out-of-stock', (data) => {
        setEventQueue(prev => [...prev, { event: 'order:out-of-stock', data, timestamp: Date.now() }]);
      })
    );
    
    unsubscribers.push(
      sseContext.subscribe('product:availability', (data) => {
        // Check if this is a duplicate event (same product within 3 seconds)
        const now = Date.now();
        const isDuplicate = lastProductUpdateRef.current.productId === data.productId && 
                           (now - lastProductUpdateRef.current.timestamp) < 3000;
        
        if (!isDuplicate) {
          setEventQueue(prev => [...prev, { event: 'product:availability', data, timestamp: now }]);
          lastProductUpdateRef.current = { productId: data.productId, timestamp: now };
        }
      })
    );
    
    // Subscribe to order:paid event to remove paid orders
    unsubscribers.push(
      sseContext.subscribe('order:paid', (data) => {
        console.log('[Prepara] Order paid event received:', data);
        // Remove the order from the list immediately
        setOrders(prev => prev.filter(order => order.id !== data.orderId));
        // Show notification that order was paid
        toast.success(`Ordine pagato e rimosso dalla lista`, { duration: 3000 });
      })
    );
    
    return () => {
      subscribedRef.current = false;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [sseContext, handleNewOrder, handleItemUpdate, handleOrderCancelled, handleReminder]);

  // Change item status with optimistic update
  const handleStatusChange = useCallback(async (item: OrderItem, newStatus: any) => {
    if (processingItems.has(item.id)) return;
    
    setProcessingItems(prev => new Set([...prev, item.id]));
    
    // Apply optimistic update - temporarily disabled
    const updateId = null;
    // const updateId = applyOptimisticUpdate(
    //   'order_item',
    //   item.id,
    //   { stato: newStatus },
    //   { stato: item.stato }
    // );
    
    // Update UI immediately
    handleItemUpdate({
      orderId: item.ordinazioneId,
      itemId: item.id,
      status: newStatus
    });
    
    try {
      const result = await aggiornaStatoRiga(item.id, newStatus);
      
      if (!result.success) {
        // Rollback on failure
        // if (updateId) rollbackOptimisticUpdate(updateId);
        handleItemUpdate({
          orderId: item.ordinazioneId,
          itemId: item.id,
          status: item.stato
        });
        toast.error(`Errore: ${result.error}`);
      } else {
        toast.success("Stato aggiornato");
        
        // Controlla se dobbiamo cambiare tab
        // Se tutti gli items dell'ordine corrente sono pronti, sposta automaticamente alla tab pronti
        const currentOrder = orders.find(o => o.id === item.ordinazioneId);
        if (currentOrder) {
          const updatedItems = currentOrder.items.map(i => 
            i.id === item.id ? { ...i, stato: newStatus } : i
          );
          const allReady = updatedItems.every(i => i.stato === 'PRONTO');
          
          // Non cambiare tab automaticamente se stiamo completando un ordine o se siamo già nella tab corretta
          if (!isCompletingOrder) {
            // Se tutti sono pronti e siamo in preparazione, vai a pronti
            if (allReady && activeTab === 'preparazione') {
              console.log('[Prepara] Tutti i prodotti pronti, passaggio automatico a tab pronti');
              setActiveTab('pronti');
            }
            // Se l'ordine passa a IN_PREPARAZIONE e siamo in attesa, vai a preparazione
            else if (newStatus === 'IN_LAVORAZIONE' && activeTab === 'attesa' && 
                     updatedItems.some(i => i.stato === 'IN_LAVORAZIONE')) {
              console.log('[Prepara] Ordine in lavorazione, passaggio automatico a tab preparazione');
              setActiveTab('preparazione');
            }
          } else {
            console.log('[Prepara] Completamento ordine in corso, evito cambi automatici di tab');
          }
        }
      }
    } catch (error) {
      // Rollback on error
      // if (updateId) rollbackOptimisticUpdate(updateId);
      handleItemUpdate({
        orderId: item.ordinazioneId,
        itemId: item.id,
        status: item.stato
      });
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [processingItems, orders, activeTab]);

  // Filter orders by status
  const getOrdersByStatus = useCallback((status: string[]) => {
    return orders.filter(order => 
      order.items.some(item => status.includes(item.stato))
    );
  }, [orders]);


  // Toggle order expansion
  const toggleOrderExpansion = useCallback((orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  // User is now passed from server, no need to load from localStorage
  
  // Handle delete all orders
  const handleDeleteAllOrders = useCallback(async () => {
    setIsDeletingAll(true);
    try {
      const result = await cancellaOrdiniAttivi();
      if (result.success) {
        toast.success(result.message || 'Tutti gli ordini sono stati cancellati');
        setShowDeleteAllModal(false);
        // Clear local state
        setOrders([]);
        setSelectedOrder(null);
      } else {
        toast.error(result.error || 'Errore durante la cancellazione');
      }
    } catch (error) {
      toast.error('Errore durante la cancellazione degli ordini');
    } finally {
      setIsDeletingAll(false);
    }
  }, []);

  // Auto-select first order when orders change or tab changes
  useEffect(() => {
    const filteredOrders = getFilteredOrders(orders, activeTab);
    
    // Se c'è già un ordine selezionato, verifica se è ancora nella lista filtrata
    if (selectedOrder) {
      const isStillInList = filteredOrders.some(order => order.id === selectedOrder.id);
      if (isStillInList) {
        // L'ordine selezionato è ancora nella lista, aggiorna solo i suoi dati
        const updatedSelectedOrder = filteredOrders.find(order => order.id === selectedOrder.id);
        if (updatedSelectedOrder) {
          setSelectedOrder(updatedSelectedOrder);
        }
        return; // Non cambiare selezione
      }
    }
    
    // Solo se non c'è un ordine selezionato o non è più nella lista, seleziona il primo
    if (filteredOrders.length > 0) {
      setSelectedOrder(filteredOrders[0]);
    } else {
      setSelectedOrder(null);
    }
  }, [activeTab, orders, selectedOrder?.id]); // Usa solo l'id per evitare re-render inutili

  // Manual start preparation function
  const startPreparation = useCallback(async () => {
    if (selectedOrder && selectedOrder.items.length > 0) {
      console.log('[Prepara] Starting preparation for order:', selectedOrder.id, 'Current state:', selectedOrder.stato);
      
      // Prevent duplicate state transitions
      const transitionKey = `${selectedOrder.id}:IN_PREPARAZIONE`;
      if (ongoingTransitions.has(transitionKey)) {
        console.log('[Prepara] Transition already in progress, skipping');
        return;
      }
      
      setIsStartingPreparation(true);
      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
      
      try {
        // Aggiorna lo stato dell'ordine a IN_PREPARAZIONE se necessario
        if (selectedOrder.stato === 'ORDINATO') {
          console.log('[Prepara] Updating order state from ORDINATO to IN_PREPARAZIONE');
          const result = await aggiornaStatoOrdinazione(selectedOrder.id, 'IN_PREPARAZIONE');
          if (!result.success) {
            throw new Error(result.error || 'Errore aggiornamento stato ordine');
          }
          
          // Aggiorna lo stato locale dell'ordine
          setOrders(prevOrders => prevOrders.map(o => 
            o.id === selectedOrder.id ? { ...o, stato: 'IN_PREPARAZIONE' } : o
          ));
          
          setSelectedOrder(prev => prev ? { ...prev, stato: 'IN_PREPARAZIONE' } : null);
        }
        
        toast.success('Preparazione iniziata');
        
        // Sposta automaticamente alla tab "preparazione"
        setActiveTab('preparazione');
        
        // Ricarica gli ordini per essere sicuri di avere lo stato aggiornato
        await loadOrders();
      } catch (error) {
        console.error('[Prepara] Error starting preparation:', error);
        toast.error('Errore nell\'avvio della preparazione');
      } finally {
        setIsStartingPreparation(false);
        // Remove from ongoing transitions
        setOngoingTransitions(prev => {
          const newSet = new Set(prev);
          newSet.delete(transitionKey);
          return newSet;
        });
      }
    }
  }, [selectedOrder, loadOrders, ongoingTransitions]);

  // Initial load
  useEffect(() => {
    console.log('[Prepara] Initial load useEffect triggered');
    loadOrders();
  }, [loadOrders]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      // Clear all pending auto-complete timers
      Object.values(autoCompleteTimerRef.current).forEach(timer => {
        clearTimeout(timer);
      });
      autoCompleteTimerRef.current = {};
    };
  }, []);
  
  // Periodic refresh as backup - always active but less frequent when connected
  useEffect(() => {
    const interval = setInterval(() => {
      // Always refresh, but less frequently when SSE is connected
      const refreshInterval = sseContext.connected ? 10000 : 3000; // 10s when connected, 3s when disconnected
      
      // Check if enough time has passed since last refresh
      if (!lastRefreshRef.current || Date.now() - lastRefreshRef.current > refreshInterval - 100) {
        console.log(`[Prepara] Periodic refresh (SSE ${sseContext.connected ? 'connected' : 'disconnected'})`);
        loadOrders();
        // Le richieste di merge ora vengono caricate solo per l'ordine selezionato
        lastRefreshRef.current = Date.now();
      }
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [sseContext.connected, loadOrders]);

  // Connection health monitor - force reconnect when disconnected
  useEffect(() => {
    if (!sseContext.connected && !sseContext.connecting && sseContext.error) {
      console.log('[Prepara] SSE disconnected with error, attempting manual reconnect');
      // Force reconnection
      sseContext.connect();
    }
  }, [sseContext.connected, sseContext.connecting, sseContext.error]);
  
  // Refresh orders when SSE reconnects (only on actual reconnection)
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (sseContext.connected && !wasConnectedRef.current) {
      console.log('[Prepara] SSE reconnected, refreshing orders');
      // Small delay to ensure any queued events are processed first
      setTimeout(() => loadOrders(), 1000);
    }
    wasConnectedRef.current = sseContext.connected;
  }, [sseContext.connected, loadOrders]);

  // Track last product toast to prevent duplicates
  const lastProductToastRef = useRef<{ productId: string; timestamp: number }>({ productId: '', timestamp: 0 });

  // Process SSE events - Use RAF for better performance
  useEffect(() => {
    if (eventQueue.length === 0) return;
    
    const processEvents = () => {
      eventQueue.forEach(({ event, data, timestamp }) => {
        console.log(`[Prepara] Processing event: ${event}`, data);
        
        switch (event) {
          case 'order:new':
            console.log('[Prepara] Processing order:new, items:', data.items);
            console.log('[Prepara] Items destinations:', data.items?.map((item: any) => item.destination));
            if (data.items?.some((item: any) => 
              item.destination === 'PREPARA' || item.destination === 'BANCO'
            )) {
              handleNewOrder(data);
              // Force immediate refresh to get full order details with longer delay
              setTimeout(() => {
                console.log('[Prepara] Refreshing orders after new order event');
                loadOrders();
              }, 500);
            } else {
              console.log('[Prepara] Skipping order - no PREPARA/BANCO items');
            }
            break;
            
          case 'order:item:update':
            if (data.destination === 'PREPARA') {
              handleItemUpdate(data);
            }
            break;
            
          case 'order:cancelled':
            handleOrderCancelled(data);
            break;
            
          case 'order:ready':
          case 'order:status-change':
            // Update order status when it becomes ready
            if (data.newStatus === 'PRONTO') {
              setOrders(prev => prev.map(order => 
                order.id === data.orderId 
                  ? { ...order, stato: 'PRONTO' }
                  : order
              ));
            }
            break;
            
          case 'notification:reminder':
            handleReminder(data);
            break;
            
          case 'order:merged':
            console.log('[Prepara] Processing order:merged event:', data);
            console.log('[Prepara] Event orderId:', data.orderId, 'tableNumber:', data.tableNumber);
            
            // Gestisci ordini merged - aggiorna l'ordine esistente
            setOrders(prev => prev.map(order => {
              if (order.id === data.orderId) {
                // Aggiungi i nuovi items all'ordine esistente
                const newItems = data.newItems.map((item: any) => ({
                  id: item.id,
                  ordinazioneId: data.orderId,
                  prodotto: item.productName,
                  quantita: item.quantity,
                  prezzo: item.price || 0,
                  stato: 'INSERITO' as const,
                  timestamp: new Date().toISOString(),
                  postazione: item.station,
                  requiresGlasses: item.requiresGlasses || false,
                  glassesCount: item.requiresGlasses ? item.quantity : undefined
                }));
                
                return {
                  ...order,
                  items: [...order.items, ...newItems],
                  totaleCosto: data.totalAmount
                };
              }
              return order;
            }));
            
            // Aggiorna anche selectedOrder se è quello che è stato merged
            if (selectedOrder && selectedOrder.id === data.orderId) {
              // Mostra brevemente lo skeleton loader per indicare l'aggiornamento
              setIsLoadingOrderDetails(true);
              
              // Usa setOrders per ottenere l'ordine aggiornato
              setOrders(currentOrders => {
                const updatedOrder = currentOrders.find(o => o.id === data.orderId);
                if (updatedOrder) {
                  // Aggiorna selectedOrder con l'ordine completo e aggiornato
                  setTimeout(() => {
                    setSelectedOrder(updatedOrder);
                    setIsLoadingOrderDetails(false);
                  }, 100);
                }
                return currentOrders;
              });
              
              // Ricarica anche le merge requests per rimuovere quella accettata
              loadMergeRequests(data.orderId, false);
            }
            
            toast.info(`Ordine unificato per tavolo ${data.tableNumber} da ${data.mergedBy}`);
            
            // Ricarica gli ordini per avere i dati aggiornati dal DB
            console.log('[Prepara] Scheduling loadOrders after order:merged');
            setTimeout(() => {
              console.log('[Prepara] Calling loadOrders after order:merged timeout');
              loadOrders();
            }, 500);
            break;
            
          case 'merge:request':
            // Handle new merge request - reload merge requests if it's for the selected order
            console.log('[Prepara] Received merge:request event for order:', data.ordinazioneId, 'Selected order:', selectedOrder?.id);
            if (selectedOrder && data.ordinazioneId === selectedOrder.id) {
              console.log('[Prepara] New merge request for selected order, reloading merge requests');
              // Force immediate reload
              setIsLoadingMergeRequests(true);
              loadMergeRequests(selectedOrder.id).then(() => {
                toast.info(`Nuova richiesta di aggiunta prodotti da ${data.richiedenteName || 'Cameriere'}`);
              });
            }
            // Also check if the merge request is for any visible order
            const orderExists = orders.some(o => o.id === data.ordinazioneId);
            if (orderExists) {
              // Reload orders to update the badge count
              loadOrders();
            }
            break;
            
          case 'order:out-of-stock':
            // Handle order split for out of stock items
            console.log('[Prepara] Order out of stock event:', data);
            // Reload orders immediately to show the split/updated orders
            loadOrders();
            // If the affected order was selected, update the selection
            if (selectedOrder && selectedOrder.id === data.originalOrderId) {
              // Switch to "esauriti" tab to show the out of stock order
              setActiveTab('esauriti');
            }
            toast.warning(`Prodotto ${data.outOfStockProduct} esaurito - Ordine aggiornato`);
            break;
            
          case 'product:availability':
            // Handle product availability change
            console.log('[Prepara] Product availability changed:', data);
            // Reload orders to reflect product availability changes
            loadOrders();
            
            // Check if we already showed a toast for this product recently
            const now = Date.now();
            const isDuplicateToast = lastProductToastRef.current.productId === data.productId && 
                                    (now - lastProductToastRef.current.timestamp) < 3000;
            
            if (!isDuplicateToast) {
              // Show toast notification
              const message = data.available 
                ? `${data.productName} è ora disponibile`
                : `${data.productName} è esaurito`;
              toast.info(message);
              
              // Update last toast reference
              lastProductToastRef.current = { productId: data.productId, timestamp: now };
            } else {
              console.log('[Prepara] Skipping duplicate toast for product:', data.productId);
            }
            break;
        }
      });
      
      // Clear processed events
      clearEventQueue();
    };
    
    // Use requestAnimationFrame for smoother updates
    const rafId = requestAnimationFrame(processEvents);
    return () => cancelAnimationFrame(rafId);
  }, [eventQueue, handleNewOrder, handleItemUpdate, handleOrderCancelled, handleReminder, clearEventQueue, selectedOrder, loadMergeRequests]);

  // Connection quality indicator
  const getConnectionIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };
  
  // Log connection status changes
  useEffect(() => {
    console.log('[Prepara] SSE Connection status:', connectionHealth.status);
  }, [connectionHealth.status]);

  const getConnectionColor = () => {
    switch (connectionHealth.quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-green-400';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.bg.dark }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.primary }} />
      </div>
    );
  }

  console.log('[Prepara Main] Rendering with selectedOrder:', selectedOrder?.id, 'activeTab:', activeTab);
  
  return (
    <div>
      {/* Particle Effect */}
      <ParticleEffect 
        key={particleKey}
        trigger={true} 
        x={particlePos.x} 
        y={particlePos.y}
        particleCount={20}
        duration={3000}
      />
      
      {/* Header separato dalle tab */}
      <PreparaHeader
        ordersCount={getFilteredOrders(orders, activeTab).length}
        ordersCountRef={ordersCountRef}
        onRefresh={loadOrders}
        onDeleteAll={() => setShowDeleteAllModal(true)}
      />

      {/* Tab-Linguette attaccate alla card */}
      <PreparaTabs 
        orders={orders}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Card del contenuto che si connette con le linguette */}
      <TabContentCard className="p-6">
        <div className={`grid gap-3 sm:gap-4 ${selectedOrder ? 'grid-cols-1 md:grid-cols-[1fr,1.5fr] lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Left Column - Orders List */}
          <div className={`space-y-3 sm:space-y-4 overflow-y-auto scrollbar-hide ${!selectedOrder ? 'max-w-2xl mx-auto' : ''} ${selectedOrder ? 'md:h-[calc(100vh-12rem)]' : ''}`}>
            {getFilteredOrders(orders, activeTab).length === 0 ? (
              <EmptyOrdersState activeTab={activeTab} />
            ) : (
              <div className="space-y-0">
                {getFilteredOrders(orders, activeTab).map((order, index) => (
                  <OrderListCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onSelect={() => selectOrder(order)}
                    onStatusChange={handleStatusChange}
                    processingItems={processingItems}
                    position={index + 1}
                    cardIndex={index}
                    totalCards={getFilteredOrders(orders, activeTab).length}
                    onOrderRetired={loadOrders}
                    onOrderCompleted={() => {
                      // Cambia tab e ricarica ordini
                      setActiveTab('pronti');
                      setTimeout(() => {
                        loadOrders();
                      }, 300);
                    }}
                    ongoingTransitions={ongoingTransitions}
                    setOngoingTransitions={setOngoingTransitions}
                  />
                ))}
              </div>
            )}
          </div>
        
          {/* Right Column - Order Details */}
        {selectedOrder && (
          <div className="space-y-3 sm:space-y-4 md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
            <OrderDetailsPanel
              order={selectedOrder}
              orders={orders}
              onStatusChange={handleStatusChange}
              processingItems={processingItems}
              isLoading={isLoadingOrderDetails}
              onStartPreparation={startPreparation}
              isStartingPreparation={isStartingPreparation}
              currentTheme={currentTheme}
              themeMode={themeMode}
              setSelectedProductForProcedure={setSelectedProductForProcedure}
              setShowProcedureModal={setShowProcedureModal}
              setSelectedProductForAvailability={setSelectedProductForAvailability}
              setShowAvailabilityModal={setShowAvailabilityModal}
              mergeRequests={orderMergeRequests}
              onAcceptMerge={handleAcceptMerge}
              onRejectMerge={handleRejectMerge}
              processingMergeRequest={processingMergeRequest}
              isLoadingMergeRequests={isLoadingMergeRequests}
              setOrders={setOrders}
              selectedOrder={selectedOrder}
              setSelectedOrder={setSelectedOrder}
              loadOrders={loadOrders}
              setActiveTab={setActiveTab}
              setIsCompletingOrder={setIsCompletingOrder}
              productProcedureCache={productProcedureCache}
              ongoingTransitions={ongoingTransitions}
              setOngoingTransitions={setOngoingTransitions}
              isCompletingOrder={isCompletingOrder}
              setSelectedProductForOutOfStock={setSelectedProductForOutOfStock}
              setAffectedItemsForOutOfStock={setAffectedItemsForOutOfStock}
              setShowOutOfStockModal={setShowOutOfStockModal}
              setPendingOutOfStockProduct={setPendingOutOfStockProduct}
              setShowOutOfStockQuantityModal={setShowOutOfStockQuantityModal}
            />
          </div>
        )}
      </div>
      </TabContentCard>
      
      {/* Procedure View Modal */}
      {selectedProductForProcedure && (
        <ProcedureViewModal
          isOpen={showProcedureModal}
          onClose={() => {
            setShowProcedureModal(false);
            setSelectedProductForProcedure(null);
          }}
          productName={selectedProductForProcedure.name}
          productId={selectedProductForProcedure.id}
          quantity={selectedProductForProcedure.quantity}
        />
      )}
      
      {/* Product Availability Modal */}
      <ProductAvailabilityModal
        isOpen={showAvailabilityModal}
        onClose={() => {
          setShowAvailabilityModal(false);
          setSelectedProductForAvailability(null);
        }}
        product={selectedProductForAvailability}
        onToggleAvailability={async (productId, available) => {
          if (!available && selectedOrder) {
            // Se si sta marcando come NON disponibile
            const affectedItems = selectedOrder.items.filter(item => item.prodottoId === productId);
            if (affectedItems.length > 0) {
              console.log('[Prepara] Marking product as out of stock through modal');
              
              // Calcola la quantità totale del prodotto nell'ordine
              const totalQuantity = affectedItems.reduce((sum, item) => sum + item.quantita, 0);
              
              // Controlla se ci sono altri prodotti nell'ordine
              const otherItems = selectedOrder.items.filter(item => item.prodottoId !== productId);
              const hasOtherProducts = otherItems.length > 0;
              
              // Mostra sempre il modal per selezione quantità
              const productName = affectedItems[0]?.prodotto || 'Prodotto';
              setPendingOutOfStockProduct({
                productId,
                productName,
                affectedItems,
                totalQuantity,
                hasOtherProducts
              });
              setShowOutOfStockQuantityModal(true);
              // Chiudi il modal di disponibilità
              setShowAvailabilityModal(false);
            }
          } else {
            // Se si sta riattivando, usa toggleProductAvailability normale
            await handleToggleAvailability(productId, available);
          }
        }}
      />
      
      {/* Delete All Orders Confirmation Modal */}
      <DeleteAllOrdersModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleDeleteAllOrders}
        isDeleting={isDeletingAll}
      />

      {/* Out of Stock Modal */}
      {selectedProductForOutOfStock && (
        <OutOfStockModal
          isOpen={showOutOfStockModal}
          onClose={() => {
            setShowOutOfStockModal(false);
            setSelectedProductForOutOfStock(null);
            setAffectedItemsForOutOfStock([]);
          }}
          product={selectedProductForOutOfStock}
          affectedItems={affectedItemsForOutOfStock}
          onSuccess={() => {
            // Ricarica gli ordini e passa alla tab esauriti
            loadOrders();
            setActiveTab('esauriti');
          }}
        />
      )}
      
      {/* Out of Stock Quantity Modal */}
      {pendingOutOfStockProduct && (
        <OutOfStockQuantityModal
          isOpen={showOutOfStockQuantityModal}
          onClose={() => {
            setShowOutOfStockQuantityModal(false);
            setPendingOutOfStockProduct(null);
          }}
          productName={pendingOutOfStockProduct.productName}
          totalQuantity={pendingOutOfStockProduct.totalQuantity}
          hasOtherProducts={pendingOutOfStockProduct.hasOtherProducts}
          multipleProducts={pendingOutOfStockProduct.multipleProducts}
          onConfirm={async (quantity, shouldSplit) => {
            if (pendingOutOfStockProduct) {
              const { markProductAsOutOfStockPartial } = await import('@/lib/actions/out-of-stock');
              
              // Se ci sono più prodotti selezionati, gestiscili tutti
              if (pendingOutOfStockProduct.multipleProducts && pendingOutOfStockProduct.multipleProducts.length > 1) {
                let allSuccess = true;
                
                for (const product of pendingOutOfStockProduct.multipleProducts) {
                  const result = await markProductAsOutOfStockPartial(
                    product.productId,
                    product.itemId,
                    product.quantity, // Usa la quantità specifica per ogni prodotto
                    shouldSplit
                  );
                  
                  if (!result.success) {
                    allSuccess = false;
                    toast.error(`Errore con ${product.productName}: ${'error' in result ? result.error : 'Errore sconosciuto'}`);
                  }
                }
                
                if (allSuccess) {
                  toast.success(`${pendingOutOfStockProduct.multipleProducts.length} prodotti segnati come esauriti`);
                  loadOrders();
                  setActiveTab('esauriti');
                }
              } else {
                // Gestione singolo prodotto come prima
                const result = await markProductAsOutOfStockPartial(
                  pendingOutOfStockProduct.productId,
                  pendingOutOfStockProduct.affectedItems[0]?.id,
                  quantity,
                  shouldSplit
                );
                
                if (result.success) {
                  toast.success('Prodotto segnato come esaurito');
                  loadOrders();
                  setActiveTab('esauriti');
                } else {
                  toast.error('error' in result && result.error ? result.error : 'Errore');
                }
              }
              
              setPendingOutOfStockProduct(null);
              setShowOutOfStockQuantityModal(false);
            }
          }}
        />
      )}

      {/* Cameriere Modal */}
      <CameriereModal 
        isOpen={showCameriereModal}
        onClose={() => setShowCameriereModal(false)}
      />

      {/* Cassa Modal */}
      <CassaModal 
        isOpen={showCassaModal}
        onClose={() => setShowCassaModal(false)}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex gap-3">
        {/* Cassa Button */}
        <button
          onClick={() => setShowCassaModal(true)}
          className="shadow-lg rounded-full p-4 transition-all hover:scale-110"
          style={{
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText,
          }}
        >
          <ShoppingBag className="w-6 h-6" />
        </button>
        
        {/* Cameriere Button */}
        <button
          onClick={() => setShowCameriereModal(true)}
          className="shadow-lg rounded-full p-4 transition-all hover:scale-110"
          style={{
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText,
          }}
        >
          <Coffee className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
