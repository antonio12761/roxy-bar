"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  X
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { getOrdinazioniAperte, aggiornaStatoRiga, aggiornaStatoOrdinazione, sollecitaOrdinePronto, segnaOrdineRitirato, cancellaOrdiniAttivi, getRichiesteMergePendenti, accettaRichiestaMerge, rifiutaRichiestaMerge } from "@/lib/actions/ordinazioni";
import { toggleProductAvailability } from "@/lib/actions/prodotti";
import { useSSE } from "@/contexts/sse-context";
import { StationType } from "@/lib/sse/station-filters";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { ProcedureViewModal } from "@/components/prepara/ProcedureViewModal";
import { ProductAvailabilityModal } from "@/components/prepara/ProductAvailabilityModal";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { TabBookmarks, TabContentCard } from "@/components/ui/tab-bookmarks";

interface OrderItem {
  id: string;
  ordinazioneId: string;
  prodotto: string;
  prodottoId?: number;
  quantita: number;
  prezzo: number;
  stato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO";
  timestamp: string;
  postazione: string;
  note?: string | null;
  glassesCount?: number;
}

interface Ordinazione {
  id: string;
  tavolo?: string | number;
  cliente?: string;
  nomeCliente?: string;
  timestamp: string;
  items: OrderItem[];
  totaleCosto: number;
  stato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO";
  hasKitchenItems: boolean;
  cameriere?: string;
  note?: string;
}

export default function PreparaPageOptimized({ currentUser }: { currentUser: any }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [orders, setOrders] = useState<Ordinazione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Ordinazione | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'attesa' | 'preparazione' | 'pronti' | 'ritirati'>('attesa');
  const [isStartingPreparation, setIsStartingPreparation] = useState(false);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
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
  
  // Delete all orders modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Merge requests state - ora caricate per ordine specifico
  const [orderMergeRequests, setOrderMergeRequests] = useState<any[]>([]);
  const [isLoadingMergeRequests, setIsLoadingMergeRequests] = useState(false);
  const [processingMergeRequest, setProcessingMergeRequest] = useState<string | null>(null);
  
  // Particle effect state
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  const ordersCountRef = useRef<HTMLElement>(null);
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
  
  // Subscribe to SSE events
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    console.log('[Prepara] Setting up SSE subscriptions, connected:', sseContext.connected);
    
    // Subscribe to order:new events
    unsubscribers.push(
      sseContext.subscribe('order:new', (data) => {
        console.log('[Prepara] 🎉 Received order:new event:', data);
        console.log('[Prepara] 🎉 Event items:', JSON.stringify(data.items, null, 2));
        setEventQueue(prev => [...prev, { event: 'order:new', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to order:item:update events
    unsubscribers.push(
      sseContext.subscribe('order:item:update', (data) => {
        console.log('[Prepara] Received order:item:update event:', data);
        setEventQueue(prev => [...prev, { event: 'order:item:update', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to order:cancelled events
    unsubscribers.push(
      sseContext.subscribe('order:cancelled', (data) => {
        console.log('[Prepara] Received order:cancelled event:', data);
        setEventQueue(prev => [...prev, { event: 'order:cancelled', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to order:status-change events
    unsubscribers.push(
      sseContext.subscribe('order:status-change', (data) => {
        console.log('[Prepara] Received order:status-change event:', data);
        setEventQueue(prev => [...prev, { event: 'order:status-change', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to notification:reminder events
    unsubscribers.push(
      sseContext.subscribe('notification:reminder', (data) => {
        console.log('[Prepara] Received notification:reminder event:', data);
        setEventQueue(prev => [...prev, { event: 'notification:reminder', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to order:merged events
    unsubscribers.push(
      sseContext.subscribe('order:merged', (data) => {
        console.log('[Prepara] Received order:merged event:', data);
        setEventQueue(prev => [...prev, { event: 'order:merged', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to merge:request events
    unsubscribers.push(
      sseContext.subscribe('merge:request', (data) => {
        console.log('[Prepara] Received merge:request event:', data);
        console.log('[Prepara] Current selectedOrder:', selectedOrder?.id);
        setEventQueue(prev => [...prev, { event: 'merge:request', data, timestamp: Date.now() }]);
      })
    );
    
    // Subscribe to product:availability events
    unsubscribers.push(
      sseContext.subscribe('product:availability', (data) => {
        console.log('[Prepara] Received product:availability event:', data);
        setEventQueue(prev => [...prev, { event: 'product:availability', data, timestamp: Date.now() }]);
      })
    );
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [sseContext, selectedOrder]);

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
        toast.info("Richiesta rifiutata");
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
        toast.success(result.message || 'Disponibilità aggiornata');
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
              glassesCount: item.glassesCount
            })),
          totaleCosto: ord.totale,
          stato: ord.stato,
          hasKitchenItems: ord.righe.some((item: any) => item.postazione === 'CUCINA'),
          cameriere: ord.cameriere?.nome,
          note: ord.note
        }))
        .filter(ord => ord.items.length > 0);

      console.log('[Prepara] Filtered PREPARA orders:', preparaOrders.length);

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

  // Handle new order event - Memoized to prevent re-creation
  const handleNewOrder = useCallback((data: any) => {
    console.log('[Prepara] New order received:', data);
    
    // Check if we already have this order
    const orderExists = orders.some(order => order.id === data.orderId);
    if (orderExists) {
      console.log('[Prepara] Order already exists, skipping:', data.orderId);
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
      
      console.log('[Prepara] Added new order, total orders:', newOrders.length);
      
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
    
    toast.success(`Nuovo ordine dal tavolo ${newOrder.tavolo}`);
  }, [orders, autoSelectFirstOrder]);

  // Handle item status update - Memoized
  const handleItemUpdate = useCallback(async (data: any) => {
    console.log('[Prepara] Item update:', data);
    
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

  // Handle order cancelled - Memoized
  const handleOrderCancelled = useCallback((data: any) => {
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
    toast.info(`Ordine ${data.orderId} annullato`);
  }, []);

  // Handle reminder notification - Memoized
  const handleReminder = useCallback((data: any) => {
    toast.warning(data.message);
  }, []);

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

  // Get filtered orders based on active tab
  const getFilteredOrders = useCallback(() => {
    switch (activeTab) {
      case 'attesa':
        // Mostra solo ordini con stato ORDINATO
        return orders.filter(order => 
          order.stato === 'ORDINATO' &&
          order.items.some(item => item.stato === 'INSERITO')
        );
      case 'preparazione':
        // Mostra ordini con stato IN_PREPARAZIONE o con items in lavorazione
        return orders.filter(order => 
          order.stato === 'IN_PREPARAZIONE'
        );
      case 'pronti':
        // Mostra ordini pronti
        return orders.filter(order => 
          order.stato === 'PRONTO' || 
          (order.items.every(item => item.stato === 'PRONTO') && order.stato !== 'CONSEGNATO')
        );
      case 'ritirati':
        return orders.filter(order => order.stato === 'CONSEGNATO');
      default:
        return orders;
    }
  }, [activeTab, orders]);

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
    const filteredOrders = getFilteredOrders();
    if (filteredOrders.length > 0) {
      // Se l'ordine selezionato non è nella lista filtrata, seleziona il primo
      if (!selectedOrder || !filteredOrders.find(o => o.id === selectedOrder.id)) {
        setSelectedOrder(filteredOrders[0]);
      }
    } else {
      setSelectedOrder(null);
    }
  }, [activeTab, orders.length]);

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
            setTimeout(() => loadOrders(), 500);
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
            
          case 'product:availability':
            // Handle product availability change
            console.log('[Prepara] Product availability changed:', data);
            // Reload orders to reflect product availability changes
            loadOrders();
            // Show toast notification
            const message = data.available 
              ? `${data.productName} è ora disponibile`
              : `${data.productName} è esaurito`;
            toast.info(message);
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
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2" 
          style={{ color: colors.text.primary }}>
          <ClipboardList className="h-5 w-5" style={{ color: colors.accent }} />
          Preparazione Ordini
          <span ref={ordersCountRef} className="text-sm font-normal" style={{ color: colors.text.muted }}>({getFilteredOrders().length})</span>
        </h2>
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => {
              console.log('[Prepara] Manual refresh triggered');
              loadOrders();
            }}
            className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary 
            }}
            title="Aggiorna manualmente"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          {/* Delete All Orders Button */}
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
            style={{ 
              backgroundColor: colors.text.error + '20',
              color: colors.text.error
            }}
            title="Cancella tutti gli ordini"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tab-Linguette attaccate alla card */}
      <TabBookmarks 
        tabs={[
          {
            id: 'attesa',
            title: `Attesa (${orders.filter(o => o.stato === 'ORDINATO' && o.items.some(i => i.stato === 'INSERITO')).length})`,
            icon: Clock,
            isActive: activeTab === 'attesa',
            onClick: () => setActiveTab('attesa')
          },
          {
            id: 'preparazione', 
            title: `Preparazione (${orders.filter(o => o.stato === 'IN_PREPARAZIONE').length})`,
            icon: ChefHat,
            isActive: activeTab === 'preparazione',
            onClick: () => setActiveTab('preparazione')
          },
          {
            id: 'pronti',
            title: `Pronti (${orders.filter(o => (o.stato === 'PRONTO' || o.items.every(i => i.stato === 'PRONTO')) && o.stato !== 'CONSEGNATO').length})`,
            icon: Check,
            isActive: activeTab === 'pronti', 
            onClick: () => setActiveTab('pronti')
          },
          {
            id: 'ritirati',
            title: `Ritirati (${orders.filter(o => o.stato === 'CONSEGNATO').length})`,
            icon: Package,
            isActive: activeTab === 'ritirati',
            onClick: () => setActiveTab('ritirati')
          }
        ]}
        className="mb-0"
      />

      {/* Card del contenuto che si connette con le linguette */}
      <TabContentCard className="p-6">
        <div className={`grid gap-3 sm:gap-4 ${selectedOrder ? 'grid-cols-1 md:grid-cols-[1fr,1.5fr] lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Left Column - Orders List */}
          <div className={`space-y-3 sm:space-y-4 overflow-y-auto scrollbar-hide ${!selectedOrder ? 'max-w-2xl mx-auto' : ''} ${selectedOrder ? 'md:h-[calc(100vh-12rem)]' : ''}`}>
            {getFilteredOrders().length === 0 ? (
              <div className="text-center py-12">
                <Coffee className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
                <p className="text-lg font-medium mb-1" style={{ color: colors.text.primary }}>
                  {activeTab === 'attesa' && 'Nessun ordine in attesa'}
                  {activeTab === 'preparazione' && 'Nessun ordine in preparazione'}
                  {activeTab === 'pronti' && 'Nessun ordine pronto'}
                  {activeTab === 'ritirati' && 'Nessun ordine ritirato'}
                </p>
                <p className="text-sm" style={{ color: colors.text.muted }}>
                  {activeTab === 'attesa' && 'I nuovi ordini appariranno qui'}
                  {activeTab === 'preparazione' && 'Gli ordini in lavorazione appariranno qui'}
                  {activeTab === 'pronti' && 'Gli ordini completati appariranno qui'}
                  {activeTab === 'ritirati' && 'Gli ordini consegnati appariranno qui'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {getFilteredOrders().map((order, index) => (
                  <OrderListCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrder?.id === order.id}
                    onSelect={() => selectOrder(order)}
                    onStatusChange={handleStatusChange}
                    processingItems={processingItems}
                    position={index + 1}
                    cardIndex={index}
                    totalCards={getFilteredOrders().length}
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
        onToggleAvailability={handleToggleAvailability}
      />
      
      {/* Delete All Orders Confirmation Modal */}
      <ThemedModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        title="Conferma Cancellazione"
        size="md"
      >
        <div className="space-y-4">
          <p style={{ color: colors.text.primary }}>
            Sei sicuro di voler cancellare tutti gli ordini attivi?
          </p>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Questa azione non può essere annullata. Tutti gli ordini in attesa, 
            in preparazione e pronti verranno eliminati definitivamente.
          </p>
          
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setShowDeleteAllModal(false)}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
              disabled={isDeletingAll}
            >
              Annulla
            </button>
            <button
              onClick={handleDeleteAllOrders}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              style={{
                backgroundColor: colors.border.error,
                color: 'white'
              }}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancellazione...
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Cancella Tutto
                </>
              )}
            </button>
          </div>
        </div>
      </ThemedModal>
    </div>
  );
}

// Order List Card Component (Left Column) - Memoized for performance
interface OrderListCardProps {
  order: Ordinazione;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  position: number;
  cardIndex: number;
  totalCards: number;
  onOrderRetired: () => void;
  onOrderCompleted: () => void;
  ongoingTransitions: Set<string>;
  setOngoingTransitions: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const OrderListCard = React.memo(function OrderListCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  processingItems,
  position,
  cardIndex,
  totalCards,
  onOrderRetired,
  onOrderCompleted,
  ongoingTransitions,
  setOngoingTransitions
}: OrderListCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return { text: `${minutes}m`, minutes };
    return { text: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
  };

  const getOrderStatusBadge = () => {
    const hasInProgress = order.items.some(item => item.stato === 'IN_LAVORAZIONE');
    const hasReady = order.items.some(item => item.stato === 'PRONTO');
    const allReady = order.items.every(item => item.stato === 'PRONTO');
    
    if (allReady) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.button.success + '20', color: colors.button.success }}>Completato</span>;
    } else if (hasReady) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}>Parziale</span>;
    } else if (hasInProgress) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.text.accent + '20', color: colors.text.accent }}>In Corso</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>In Attesa</span>;
  };
  
  return (
    <div 
      className={`transition-all cursor-pointer border-2 border-l-2 border-r-2 ${
        cardIndex === 0 ? 'rounded-t-2xl border-t-2' : 'border-t-0'
      } ${
        cardIndex === totalCards - 1 ? 'rounded-b-2xl border-b-2' : 'border-b-0'
      }`}
      style={{
        backgroundColor: order.stato === 'PRONTO' 
          ? colors.button.success 
          : isSelected
            ? colors.bg.dark  // Card selezionata più scura
            : colors.bg.card, // Card non selezionate più chiare
        borderColor: order.stato === 'PRONTO'
          ? colors.button.success
          : isSelected 
            ? colors.border.primary
            : colors.border.secondary,
        // Rimuovo transform e shadow per l'effetto di fusione
        zIndex: isSelected ? 10 : 1,
        // Bordo inferiore trasparente per fusione con card sotto (eccetto ultima)
        ...(cardIndex < totalCards - 1 && {
          borderBottomColor: isSelected ? 'transparent' : colors.border.secondary
        }),
        // Leggera sovrapposizione se selezionata
        marginBottom: isSelected && cardIndex < totalCards - 1 ? '-2px' : '0px'
      }}
      onClick={order.stato === 'PRONTO' ? undefined : onSelect}
      onMouseEnter={(e) => {
        if (order.stato !== 'PRONTO' && !isSelected) {
          e.currentTarget.style.borderColor = colors.text.accent + '60';
          e.currentTarget.style.backgroundColor = colors.bg.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (order.stato !== 'PRONTO' && !isSelected) {
          e.currentTarget.style.borderColor = colors.border.secondary;
          e.currentTarget.style.backgroundColor = colors.bg.card; // Ritorna al colore chiaro
        }
      }}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div 
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold ${
                getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO' ? 'animate-pulse' : ''
              }`}
              style={{
                backgroundColor: getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                  ? colors.text.error
                  : order.stato === 'PRONTO' 
                    ? 'white' 
                    : position === 1 
                      ? colors.button.success 
                      : colors.bg.hover,
                color: getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                  ? 'white'
                  : order.stato === 'PRONTO' 
                    ? colors.button.success 
                    : position === 1 
                      ? colors.button.successText 
                      : colors.text.primary,
                animation: getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                  ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  : 'none'
              }}>
              {typeof order.tavolo === 'string' ? order.tavolo.toUpperCase() : order.tavolo}
            </div>
            <div>
              <div className="font-medium" style={{ 
                color: order.stato === 'PRONTO' ? 'white' : colors.text.primary 
              }}>
                {order.nomeCliente || 'Cliente'}
              </div>
              <div className="text-xs" style={{ 
                color: order.stato === 'PRONTO' ? 'rgba(255,255,255,0.8)' : colors.text.muted 
              }}>
                {getTimeElapsed(order.timestamp).text} fa
              </div>
              {order.cameriere && (
                <div className="text-xs" style={{ 
                  color: order.stato === 'PRONTO' ? 'rgba(255,255,255,0.7)' : colors.text.muted,
                  fontStyle: 'italic',
                  opacity: 0.8,
                  marginTop: '2px'
                }}>
                  {order.cameriere}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg" style={{ 
              color: order.stato === 'PRONTO' ? 'white' : colors.text.primary 
            }}>
              €{Number(order.totaleCosto).toFixed(2)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end text-sm">
          {order.stato === 'PRONTO' ? (
            <div className="flex gap-2">
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await sollecitaOrdinePronto(order.id);
                    if (result.success) {
                      toast.success('Sollecito inviato al cameriere');
                    } else {
                      toast.error(result.error || 'Errore durante il sollecito');
                    }
                  } catch (error) {
                    toast.error('Errore durante il sollecito');
                  }
                }}
                className="px-3 py-1 text-xs rounded-md transition-colors font-medium"
                style={{
                  backgroundColor: colors.text.accent,
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.text.accent + 'CC';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.text.accent;
                }}
              >
                Sollecita
              </button>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    // Se l'ordine non è segnato come PRONTO nel database, aggiornalo prima
                    if (order.stato !== 'PRONTO') {
                      const transitionKey = `${order.id}:PRONTO`;
                      if (ongoingTransitions.has(transitionKey)) {
                        console.log('[Prepara] Transition already in progress, skipping');
                        return;
                      }
                      
                      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                      
                      const updateResult = await aggiornaStatoOrdinazione(order.id, 'PRONTO');
                      if (!updateResult.success) {
                        setOngoingTransitions(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(transitionKey);
                          return newSet;
                        });
                        toast.error('Errore nell\'aggiornamento dello stato dell\'ordine');
                        return;
                      }
                      // Aspetta un attimo per permettere al backend di aggiornarsi
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      // Clean up transition key
                      setOngoingTransitions(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(transitionKey);
                        return newSet;
                      });
                    }
                    
                    console.log('[Prepara] Chiamando segnaOrdineRitirato da lista per ordine:', order.id);
                    console.log('[Prepara] Stato ordine prima del ritiro:', order.stato);
                    console.log('[Prepara] Stati items:', order.items.map(i => ({ id: i.id, stato: i.stato })));
                    
                    const result = await segnaOrdineRitirato(order.id);
                    console.log('[Prepara] Risultato segnaOrdineRitirato da lista:', result);
                    
                    if (result.success) {
                      toast.success('Ordine segnato come ritirato');
                      // Ricarica gli ordini per aggiornare la lista
                      onOrderRetired();
                    } else {
                      toast.error(result.error || 'Errore durante il ritiro');
                    }
                  } catch (error) {
                    toast.error('Errore durante il ritiro');
                  }
                }}
                className="px-3 py-1 text-xs rounded-md transition-colors font-medium"
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
                Ritirato
              </button>
            </div>
          ) : (
            order.hasKitchenItems && (
              <div className="flex items-center gap-1" style={{ color: colors.text.accent }}>
                <ChefHat className="h-3 w-3" />
                <span className="text-xs">+ Cucina</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

// Order Details Panel Component
interface OrderDetailsPanelProps {
  order: Ordinazione;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  isLoading: boolean;
  onStartPreparation: () => void;
  isStartingPreparation: boolean;
  currentTheme: any;
  themeMode: string;
  setSelectedProductForProcedure: (product: { name: string; id: number | null; quantity: number } | null) => void;
  setShowProcedureModal: (show: boolean) => void;
  setSelectedProductForAvailability: (product: any) => void;
  setShowAvailabilityModal: (show: boolean) => void;
  setOrders: React.Dispatch<React.SetStateAction<Ordinazione[]>>;
  selectedOrder: Ordinazione | null;
  setSelectedOrder: React.Dispatch<React.SetStateAction<Ordinazione | null>>;
  loadOrders: () => Promise<void>;
  setActiveTab: (tab: 'attesa' | 'preparazione' | 'pronti' | 'ritirati') => void;
  setIsCompletingOrder: (value: boolean) => void;
  mergeRequests: any[];
  onAcceptMerge: (richiestaId: string) => Promise<void>;
  onRejectMerge: (richiestaId: string) => Promise<void>;
  processingMergeRequest: string | null;
  isLoadingMergeRequests: boolean;
  productProcedureCache: Map<number, boolean>;
  ongoingTransitions: Set<string>;
  setOngoingTransitions: React.Dispatch<React.SetStateAction<Set<string>>>;
}

function OrderDetailsPanel({
  order,
  onStatusChange,
  processingItems,
  isLoading,
  onStartPreparation,
  isStartingPreparation,
  currentTheme,
  themeMode,
  setSelectedProductForProcedure,
  setShowProcedureModal,
  setSelectedProductForAvailability,
  setShowAvailabilityModal,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  loadOrders,
  setActiveTab,
  setIsCompletingOrder,
  mergeRequests,
  onAcceptMerge,
  onRejectMerge,
  processingMergeRequest,
  isLoadingMergeRequests,
  productProcedureCache,
  ongoingTransitions,
  setOngoingTransitions
}: OrderDetailsPanelProps) {
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isCheckingOrders, setIsCheckingOrders] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  
  // Controlla ordini in coda quando si inizia la preparazione - DISABILITATO per evitare confusione
  // Il merge automatico è già gestito nel backend quando si crea un nuovo ordine
  useEffect(() => {
    // Disabilitato per evitare duplicazioni e confusione
    // Il backend già gestisce il merge automatico degli ordini
  }, [order.id, order.stato, order.tavolo]);
  
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return { text: `${minutes}m`, minutes };
    return { text: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
  };
  
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
        productProcedureCache.set(productId, false);
        return false;
      }
      
      const data = await response.json();
      const hasProcedure = data && data.ProcedureStep && data.ProcedureStep.length > 0;
      
      // Cache the result
      productProcedureCache.set(productId, hasProcedure);
      return hasProcedure;
    } catch (error) {
      console.error("Errore verifica procedura:", error);
      // Cache negative result on error
      productProcedureCache.set(productId, false);
      return false;
    }
  };
  
  if (isLoading) {
    return (
      <div className="rounded-lg shadow-sm" style={{ 
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}>
        <div className="p-4 sm:p-5 md:p-6">
          {/* Title skeleton */}
          <div className="h-7 rounded w-40 mb-4 animate-pulse" style={{ backgroundColor: colors.bg.hover }}></div>
          
          {/* Order info skeleton */}
          <div className="pb-4 mb-4 border-b animate-pulse" style={{ borderColor: colors.border.primary }}>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-6 rounded w-32" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
                <div className="h-4 rounded w-28" style={{ backgroundColor: colors.bg.hover }}></div>
              </div>
              <div className="h-7 rounded w-20" style={{ backgroundColor: colors.bg.hover }}></div>
            </div>
          </div>
          
          {/* Items list skeleton */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 rounded w-36" style={{ backgroundColor: colors.bg.hover }}></div>
              <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
            </div>
            {/* Item skeletons */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg animate-pulse" style={{ backgroundColor: colors.bg.hover }}>
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-5 w-5 rounded" style={{ backgroundColor: colors.bg.card }}></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-5 rounded w-3/4" style={{ backgroundColor: colors.bg.card }}></div>
                    <div className="flex gap-4">
                      <div className="h-4 rounded w-16" style={{ backgroundColor: colors.bg.card }}></div>
                      <div className="h-4 rounded w-20" style={{ backgroundColor: colors.bg.card }}></div>
                    </div>
                  </div>
                </div>
                <div className="h-4 rounded w-16" style={{ backgroundColor: colors.bg.card }}></div>
              </div>
            ))}
          </div>
          
          {/* Action buttons skeleton */}
          <div className="flex justify-center gap-3">
            <div className="h-12 rounded-lg w-32 animate-pulse" style={{ backgroundColor: colors.bg.hover }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg shadow-sm" style={{ 
      backgroundColor: colors.bg.card,
      borderColor: colors.border.primary,
      borderWidth: '1px',
      borderStyle: 'solid'
    }}>
      <div className="p-4 sm:p-5 md:p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
          Dettaglio Ordine
        </h2>
        
        {/* Order Info */}
        <div className="flex justify-between items-start pb-4 mb-4 border-b" style={{ borderColor: colors.border.primary }}>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              {order.tavolo ? `Tavolo ${order.tavolo}` : order.nomeCliente || 'Cliente'}
            </h3>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Ordine • {getTimeElapsed(order.timestamp).text} fa
            </p>
            {order.cameriere && (
              <p className="text-sm mt-1" style={{ 
                color: colors.text.muted, 
                fontStyle: 'italic',
                opacity: 0.8
              }}>
                {order.cameriere}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold" style={{ color: colors.text.accent }}>
              €{order.totaleCosto.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Items List */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium" style={{ color: colors.text.primary }}>Prodotti da preparare:</h4>
            <span className="text-sm" style={{ color: colors.text.muted }}>
              {order.items.filter(i => i.stato === 'PRONTO').length}/{order.items.length} completati
            </span>
          </div>
          {order.items.map((item) => {
            const isProcessing = processingItems.has(item.id);
            const isReady = item.stato === 'PRONTO';
            const canStart = item.stato === 'INSERITO';
            const isInProgress = item.stato === 'IN_LAVORAZIONE';
            
            return (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
                  isReady ? 'opacity-60' : ''
                }`}
                style={{ 
                  backgroundColor: isReady ? colors.button.success + '10' : colors.bg.hover,
                  borderLeft: `4px solid ${isReady ? colors.button.success : isInProgress ? colors.text.accent : 'transparent'}`,
                  transform: isProcessing ? 'scale(0.98)' : 'scale(1)',
                  boxShadow: isProcessing ? `0 0 0 2px ${colors.text.accent}30` : 'none'
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  {/* Mostra checkbox solo se l'ordine non è consegnato */}
                  {order.stato !== 'CONSEGNATO' ? (
                    <div className="relative group">
                      <Checkbox
                        checked={isReady || isInProgress}
                        indeterminate={isInProgress}
                        onCheckedChange={async (checked) => {
                          if (isProcessing) return;
                          
                          // Aggiungi un leggero effetto visivo quando si clicca
                          const checkbox = document.getElementById(`checkbox-${item.id}`);
                          if (checkbox) {
                            checkbox.style.transform = 'scale(0.9)';
                            setTimeout(() => {
                              checkbox.style.transform = 'scale(1)';
                            }, 100);
                          }
                          
                          // Crea un effetto ripple
                          const ripple = document.createElement('div');
                          ripple.className = 'absolute inset-0 rounded-full pointer-events-none';
                          ripple.style.background = `radial-gradient(circle, ${colors.text.accent}40 0%, transparent 70%)`;
                          ripple.style.animation = 'ripple 0.6s ease-out';
                          checkbox?.parentElement?.appendChild(ripple);
                          setTimeout(() => ripple.remove(), 600);
                          
                          // Logica a 3 stati:
                          // INSERITO -> IN_LAVORAZIONE -> PRONTO -> IN_LAVORAZIONE (ciclo)
                          if (canStart) {
                            // Da INSERITO va a IN_LAVORAZIONE
                            await onStatusChange(item, 'IN_LAVORAZIONE');
                          } else if (isInProgress) {
                            // Da IN_LAVORAZIONE va a PRONTO
                            await onStatusChange(item, 'PRONTO');
                          } else if (isReady) {
                            // Da PRONTO torna a IN_LAVORAZIONE
                            await onStatusChange(item, 'IN_LAVORAZIONE');
                          }
                        }}
                        disabled={isProcessing}
                        id={`checkbox-${item.id}`}
                        className="transition-all duration-200 hover:scale-110 relative z-10"
                        style={{
                          '--primary': colors.button.success,
                          '--border': colors.border.primary,
                          opacity: isProcessing ? 0.5 : 1,
                          cursor: isProcessing ? 'wait' : 'pointer'
                        } as React.CSSProperties}
                      />
                      {/* Hover effect */}
                      <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                        style={{ 
                          background: `radial-gradient(circle, ${colors.text.accent}20 0%, transparent 70%)`,
                          transform: 'scale(1.5)'
                        }}
                      />
                      {isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: colors.text.accent }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <Check className="h-5 w-5" style={{ color: colors.button.success }} />
                    </div>
                  )}
                  <span className="text-lg font-bold" style={{ 
                    color: isReady ? colors.text.muted : colors.text.primary,
                    textDecoration: isReady ? 'line-through' : 'none'
                  }}>
                    {item.quantita}x
                  </span>
                  <div className="flex-1">
                    <p 
                      className={`font-medium transition-all ${
                        isReady ? 'line-through' : ''
                      } ${
                        item.prodottoId && productProcedureCache.get(item.prodottoId) === false 
                          ? 'cursor-default opacity-75' 
                          : 'cursor-pointer hover:underline'
                      }`}
                      style={{ 
                        color: isReady ? colors.text.muted : colors.text.primary 
                      }}
                      onClick={async () => {
                        if (!item.prodottoId) return;
                        
                        // Show availability modal for the product
                        const productData = {
                          id: item.prodottoId,
                          nome: item.prodotto,
                          prezzo: item.prezzo,
                          categoria: '',
                          postazione: item.postazione,
                          codice: null,
                          disponibile: true, // Default to true, will be updated from actual product data
                          ingredienti: null
                        };
                        
                        setSelectedProductForAvailability(productData);
                        setShowAvailabilityModal(true);
                        
                        // Also check for procedure
                        const hasProcedure = await checkProductProcedure(item.prodottoId);
                        if (hasProcedure) {
                          setSelectedProductForProcedure({
                            name: item.prodotto,
                            id: item.prodottoId || null,
                            quantity: item.quantita
                          });
                          // Note: We'll show procedure modal after availability modal closes if needed
                        }
                      }}
                      title="Clicca per gestire disponibilità e procedure"
                    >
                      {item.prodotto}
                      {item.glassesCount !== undefined && (
                        <span className="ml-2 text-sm italic" style={{ color: colors.text.muted }}>
                          ({item.glassesCount} bicchier{item.glassesCount === 1 ? 'e' : 'i'})
                        </span>
                      )}
                      {item.postazione === 'BANCO' && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.text.accent + '20', color: colors.text.accent }}>
                          Banco
                        </span>
                      )}
                      {item.postazione === 'CUCINA' && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.text.error + '20', color: colors.text.error }}>
                          Cucina
                        </span>
                      )}
                    </p>
                    {item.note && (
                      <p className="text-sm" style={{ color: colors.text.secondary }}>
                        Note: {item.note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isProcessing && (
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.text.muted }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Notes */}
        {order.note && (
          <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: colors.bg.hover }}>
            <p className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>Note ordine:</p>
            <p className="text-sm" style={{ color: colors.text.secondary }}>{order.note}</p>
          </div>
        )}
        
        {/* Merge Requests */}
        {(mergeRequests.length > 0 || isLoadingMergeRequests) && (
          <div className="mb-4 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
              Richieste di aggiunta prodotti ({mergeRequests.length})
            </h3>
            {isLoadingMergeRequests ? (
              // Skeleton loader for merge requests
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border animate-pulse"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.primary
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-4 rounded w-32" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-16" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="h-4 rounded w-24" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-48" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="h-3 rounded w-40" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
                      <div className="flex-1 h-10 rounded-lg" style={{ backgroundColor: colors.bg.hover }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              mergeRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm" style={{ color: colors.text.secondary }}>
                      Richiesto da: {request.richiedenteName}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: colors.text.muted }}>
                    {new Date(request.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="space-y-1 mb-3">
                  <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                    Prodotti da aggiungere:
                  </p>
                  {request.prodotti.map((p: any, idx: number) => (
                    <div key={idx} className="text-sm" style={{ color: colors.text.primary }}>
                      • {p.quantita}x {p.nome}
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptMerge(request.id)}
                    disabled={processingMergeRequest === request.id}
                    className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                    style={{
                      backgroundColor: colors.button.success,
                      color: colors.button.successText,
                      opacity: processingMergeRequest === request.id ? 0.6 : 1
                    }}
                  >
                    {processingMergeRequest === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      'Aggiungi all\'ordine'
                    )}
                  </button>
                  <button
                    onClick={() => onRejectMerge(request.id)}
                    disabled={processingMergeRequest === request.id}
                    className="flex-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                    style={{
                      backgroundColor: colors.text.error,
                      color: 'white',
                      opacity: processingMergeRequest === request.id ? 0.6 : 1
                    }}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {/* Pulsante Torna Indietro - Disponibile per stati IN_PREPARAZIONE e PRONTO */}
          {(order.stato === 'IN_PREPARAZIONE' || order.stato === 'PRONTO') && (
            <button
              onClick={async () => {
                setIsProcessingAction(true);
                let transitionKey = '';
                try {
                  let nuovoStato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "RICHIESTA_CONTO" | "PAGATO" | "ANNULLATO";
                  
                  // Definisci lo stato precedente in base allo stato attuale
                  if (order.stato === 'IN_PREPARAZIONE') {
                    nuovoStato = 'ORDINATO';
                  } else if (order.stato === 'PRONTO') {
                    nuovoStato = 'IN_PREPARAZIONE';
                  } else {
                    return; // Non dovrebbe mai arrivare qui
                  }
                  
                  // Prevent duplicate state transitions
                  transitionKey = `${order.id}:${nuovoStato}`;
                  if (ongoingTransitions.has(transitionKey)) {
                    console.log('[Prepara] Transition already in progress, skipping');
                    return;
                  }
                  
                  setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                  
                  const result = await aggiornaStatoOrdinazione(order.id, nuovoStato);
                  
                  if (result.success) {
                    toast.success(`Ordine riportato allo stato ${nuovoStato}`);
                    
                    // Aggiorna lo stato locale
                    setOrders(prevOrders => prevOrders.map(o => 
                      o.id === order.id ? { ...o, stato: nuovoStato } : o
                    ));
                    
                    if (selectedOrder?.id === order.id) {
                      setSelectedOrder({ ...order, stato: nuovoStato });
                    }
                    
                    // Cambia tab in base al nuovo stato
                    if (nuovoStato === 'ORDINATO') {
                      setActiveTab('attesa');
                    } else if (nuovoStato === 'IN_PREPARAZIONE') {
                      setActiveTab('preparazione');
                    }
                    
                    // Ricarica gli ordini
                    setTimeout(() => loadOrders(), 300);
                  } else {
                    // Gestione errore con stati permessi
                    if (result.transizioniPermesse) {
                      toast.error(`${result.error}\nStati permessi: ${result.transizioniPermesse.join(', ')}`);
                    } else {
                      toast.error(result.error || 'Errore nel cambio stato');
                    }
                  }
                } catch (error) {
                  console.error('Errore cambio stato:', error);
                  toast.error('Errore durante il cambio stato');
                } finally {
                  setIsProcessingAction(false);
                  // Clean up transition key
                  if (transitionKey) {
                    setOngoingTransitions(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(transitionKey);
                      return newSet;
                    });
                  }
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid',
                color: isProcessingAction ? colors.text.muted : colors.text.primary,
                cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }
              }}>
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  In corso...
                </>
              ) : (
                <>
                  <ArrowLeft className="h-5 w-5" />
                  Torna Indietro
                </>
              )}
            </button>
          )}
          
          {/* Pulsante Inizia - Solo quando l'ordine è in attesa (ORDINATO) */}
          {order.stato === 'ORDINATO' && order.items.every(item => item.stato === 'INSERITO') && (
            <button
              onClick={onStartPreparation}
              disabled={isStartingPreparation}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isStartingPreparation ? colors.bg.hover : colors.button.primary,
                color: isStartingPreparation ? colors.text.muted : colors.button.text,
                cursor: isStartingPreparation ? 'not-allowed' : 'pointer',
                transform: isStartingPreparation ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isStartingPreparation) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.primary}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isStartingPreparation) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}>
              {isStartingPreparation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Avvio in corso...
                </>
              ) : (
                <>
                  <ChefHat className="h-5 w-5" />
                  Inizia a Preparare
                </>
              )}
            </button>
          )}
          {/* Pulsante Finito - Quando l'ordine è in preparazione e non tutti i prodotti sono pronti */}
          {order.stato === 'IN_PREPARAZIONE' && 
           !order.items.every(item => item.stato === 'PRONTO') && (
            <button
              onClick={async () => {
                setIsProcessingAction(true);
                setIsCompletingOrder(true);
                try {
                  // Aggiorna TUTTI gli items in una sola volta
                  const itemsToComplete = order.items.filter(item => item.stato !== 'PRONTO' && item.stato !== 'CONSEGNATO');
                  
                  // Aggiorna tutti gli stati localmente in una sola volta
                  const updatedItems = order.items.map(item => ({
                    ...item,
                    stato: (item.stato === 'PRONTO' || item.stato === 'CONSEGNATO') ? item.stato : 'PRONTO'
                  }));
                  
                  // Aggiorna l'UI immediatamente per un feedback istantaneo
                  setOrders(prevOrders => prevOrders.map(o => 
                    o.id === order.id 
                      ? { ...o, items: updatedItems, stato: 'PRONTO' }
                      : o
                  ));
                  
                  // Se c'è un ordine selezionato, aggiornalo anche lui
                  if (selectedOrder?.id === order.id) {
                    setSelectedOrder({ ...order, items: updatedItems, stato: 'PRONTO' });
                  }
                  
                  // Usa la nuova funzione ottimizzata per completare tutti gli items
                  const { completaTuttiGliItems } = await import('@/lib/actions/ordinazioni');
                  
                  try {
                    // Completa tutti gli items in una singola transazione veloce
                    const result = await completaTuttiGliItems(order.id);
                    
                    if (result.success) {
                      // Tutti i prodotti sono stati aggiornati con successo
                      toast.success('Tutti i prodotti sono pronti per la consegna');
                      
                      // Cambia tab immediatamente
                      setActiveTab('pronti');
                      
                      // Ricarica gli ordini con un delay maggiore per evitare race conditions
                      setTimeout(async () => {
                        try {
                          await loadOrders();
                        } catch (error) {
                          console.error('[Prepara] Errore nel reload ordini:', error);
                        } finally {
                          // Reset il flag sempre, anche in caso di errore
                          setIsCompletingOrder(false);
                        }
                      }, 300); // Aumentato da 50ms a 300ms per dare tempo al database
                    } else {
                      console.error('[Prepara] Errore completamento ordine:', result.error);
                      toast.error(result.error || 'Errore durante il completamento dell\'ordine');
                      // Ricarica gli ordini per sincronizzare con il backend
                      await loadOrders();
                    }
                  } catch (error) {
                    console.error('[Prepara] Errore generale nel completamento:', error);
                    toast.error('Errore durante il completamento dell\'ordine');
                    // Ricarica gli ordini per sincronizzare con il backend
                    await loadOrders();
                  }
                } catch (error) {
                  console.error('[Prepara] Errore nel completamento ordine:', error);
                  toast.error('Errore nel completamento dell\'ordine');
                  // Ricarica gli ordini in caso di errore
                  loadOrders();
                } finally {
                  setIsProcessingAction(false);
                  // Reset anche qui in caso di errore con un delay maggiore
                  setTimeout(() => {
                    console.log('[Prepara] Reset completamento ordine flag (finally)');
                    setIsCompletingOrder(false);
                  }, 500); // Aumentato a 500ms per essere sicuri
                }
              }}
              disabled={isProcessingAction}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
              style={{ 
                backgroundColor: isProcessingAction ? colors.bg.hover : colors.button.success,
                color: isProcessingAction ? colors.text.muted : 'white',
                boxShadow: `0 2px 8px ${colors.button.success}30`,
                cursor: isProcessingAction ? 'not-allowed' : 'pointer',
                transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
              }}
              onMouseEnter={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.success}40`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isProcessingAction) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 2px 8px ${colors.button.success}30`;
                }
              }}>
              {isProcessingAction ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Completamento...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Finito!
                </>
              )}
            </button>
          )}
          
        </div>
      </div>
      
      {/* Merge Dialog */}
      <ThemedModal
        isOpen={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        title="Ordini in coda per questo tavolo"
        size="md"
      >
        <div className="space-y-4">
          <p style={{ color: colors.text.primary }}>
            Ci sono {pendingOrders.length} ordini in coda per il tavolo {order.tavolo}.
            Vuoi prepararli insieme?
          </p>
          
          {/* Lista ordini in coda */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingOrders.map((pendingOrder) => (
              <div 
                key={pendingOrder.id}
                className="p-3 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium" style={{ color: colors.text.primary }}>
                      Ordine #{pendingOrder.numero}
                    </p>
                    <p className="text-sm" style={{ color: colors.text.muted }}>
                      {pendingOrder.RigaOrdinazione?.length || 0} prodotti - €{pendingOrder.totale?.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    {new Date(pendingOrder.dataApertura).toLocaleTimeString('it-IT')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pulsanti azione */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowMergeDialog(false)}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.darker;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
            >
              No, prepara separatamente
            </button>
            <button
              onClick={async () => {
                try {
                  // Aggiungi tutti i prodotti degli ordini in coda all'ordine corrente
                  for (const pendingOrder of pendingOrders) {
                    // Prevent duplicate state transitions
                    const transitionKey = `${pendingOrder.id}:IN_PREPARAZIONE`;
                    if (!ongoingTransitions.has(transitionKey)) {
                      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                      
                      try {
                        // Aggiorna stato ordine a IN_PREPARAZIONE
                        await aggiornaStatoOrdinazione(pendingOrder.id, 'IN_PREPARAZIONE');
                        
                        // Aggiungi notifica di merge
                        toast.success(`Ordine #${pendingOrder.numero} unificato`);
                      } finally {
                        // Clean up transition key
                        setOngoingTransitions(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(transitionKey);
                          return newSet;
                        });
                      }
                    }
                  }
                  
                  setShowMergeDialog(false);
                  
                  // Ricarica gli ordini per aggiornare la vista
                  window.location.reload();
                } catch (error) {
                  toast.error('Errore durante unificazione ordini');
                }
              }}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
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
              Sì, prepara insieme
            </button>
          </div>
        </div>
      </ThemedModal>
    </div>
  );
}

