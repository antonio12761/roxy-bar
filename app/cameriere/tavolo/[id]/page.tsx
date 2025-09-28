"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Coffee, Plus, Minus, ShoppingCart, Users, Clock, Wifi, WifiOff, Bell, ArrowLeft, X, Gift, Edit3, Receipt, StickyNote, Hash } from "lucide-react";
// Removed old useSSE import - now using SSE context
import { creaOrdinazione, getTavoli, getProdotti, getCustomerNamesForTable, getOrdinazioniAttiveTavolo } from "@/lib/actions/ordinazioni";
import { syncProductAvailability } from "@/lib/actions/sync-product-availability";
import { addRecentProduct, getRecentProducts } from "@/lib/actions/prodotti-recenti";
import { aggiungiProdottoAltroTavolo } from "@/lib/actions/contributi";
import { toast } from "@/lib/toast";
import { 
  notifyProductAvailability, 
  notifyOrderSent,
  notifyOrderReady, 
  notifyError, 
  notifyWarning, 
  notifyInfo 
} from "@/lib/utils/notification-helper";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { CustomerNameModal } from "@/components/cameriere/CustomerNameModal";
import { ProductItem } from "@/components/cameriere/ProductItem";
import { SearchProductItem } from "@/components/cameriere/SearchProductItem";
import { NumericKeypad } from "@/components/cameriere/NumericKeypad";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { ThemedDrawer } from "@/components/ui/ThemedDrawer";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { ProductNotesModal } from "@/components/cameriere/ProductNotesModal";
import { UnavailableProductsModal } from "@/components/cameriere/UnavailableProductsModal";
import { useSSE } from "@/contexts/sse-context";
import { FireworksAnimation } from "@/components/ui/FireworksAnimation";
import { HeartsAnimation } from "@/components/ui/HeartsAnimation";
import { QRScannerModal } from "@/components/cameriere/QRScannerModal";
import ProductVariantModal from "@/components/cameriere/ProductVariantModal";
import { getProdottoConfigurabile } from "@/lib/actions/prodotti-configurabili";
import { MixedProductModal } from "@/components/cameriere/MixedProductModal";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  requiresGlasses?: boolean;
  disponibile?: boolean;
  terminato?: boolean;
  ingredienti?: string | null;
  isMiscelato?: boolean;
  partiallyUnavailable?: boolean;  // Indicates item has partial availability
  availableQuantity?: number;  // How many are available
  unavailableQuantity?: number;  // How many are not available
}

interface OrderItem {
  prodotto: Product;
  quantita: number;
  glassesCount?: number;
  note?: string;
  isExhausted?: boolean;
  quantitaDisponibile?: number;  // Available quantity for partially out of stock items
  quantitaNonDisponibile?: number;  // Unavailable quantity for partially out of stock items
  configurazione?: any;  // Configurazione per prodotti configurabili
  prezzoFinale?: number;  // Prezzo finale con varianti
}

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  attivo: boolean;
  clienteNome?: string | null;
}

interface ActiveOrder {
  id: string;
  numero: number;
  stato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO";
  statoPagamento: "NON_PAGATO" | "PAGATO" | "PARZIALE";
  totale: number;
  note?: string;
  dataApertura: string;
  nomeCliente?: string;
  RigaOrdinazione?: Array<{
    id: string;
    quantita: number;
    prezzo: number;
    stato: string;
    Prodotto?: {
      id: number;
      nome: string;
      prezzo: number;
    };
  }>;
}

type ViewState = "search" | "categories" | "products";

// CSS for vibration animation
const vibrationAnimation = `
  @keyframes vibrate {
    0% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    50% { transform: translateX(2px); }
    75% { transform: translateX(-2px); }
    100% { transform: translateX(0); }
  }
  .vibrate {
    animation: vibrate 0.3s ease-in-out 3;
  }
`;

export default function TavoloPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tavoloId = useMemo(() => parseInt(params.id as string), [params.id]);
  
  console.log(`[Tavolo Component] Rendering at ${new Date().toISOString()}, tavoloId: ${tavoloId}`);
  const { currentTheme, themeMode } = useTheme();
  const sseContext = useSSE();
  const { isConnected } = sseContext;
  
  // Debug render counts
  const renderCountRef = useRef(0);
  const prevDepsRef = useRef<any>({});
  useEffect(() => {
    renderCountRef.current++;
    
    // Track what changed
    const changes: string[] = [];
    if (prevDepsRef.current.sseContext !== sseContext) changes.push('sseContext');
    if (prevDepsRef.current.isConnected !== isConnected) changes.push('isConnected');
    if (prevDepsRef.current.tableId !== table?.id) changes.push('tableId');
    if (prevDepsRef.current.tableNumero !== table?.numero) changes.push('tableNumero');
    
    console.log(`[Tavolo ${tavoloId}] Render #${renderCountRef.current} at ${new Date().toISOString()}, changes:`, changes);
    
    // Update prev deps
    prevDepsRef.current = {
      sseContext,
      isConnected,
      tableId: table?.id,
      tableNumero: table?.numero
    };
  });
  
  // Reset submission attempts on mount and when table changes
  useEffect(() => {
    submissionAttemptsRef.current = 0;
    console.log('[Tavolo] Reset submission attempts counter for table:', tavoloId);
  }, [tavoloId]);
  
  // Listener per aggiornamenti inventario
  useEffect(() => {
    if (!sseContext?.subscribe) return;
    
    const unsubInventoryUpdate = sseContext.subscribe('inventory:updated', (data) => {
      console.log('[SSE] Inventory updated:', data);
      setInventarioLimitato(prev => {
        const newMap = new Map(prev);
        newMap.set(data.productId, data.availableQuantity);
        return newMap;
      });
      
      // Aggiorna anche gli items nell'ordine se stanno modificando un ordine esaurito
      const modifyOrderId = searchParams.get('modifyOrder');
      if (modifyOrderId) {
        setOrder(prevOrder => {
          return prevOrder.map(item => {
            if (item.prodotto.id === data.productId) {
              // Aggiorna la quantità disponibile per questo item
              const nuovaQuantitaDisponibile = data.availableQuantity;
              
              // Se la nuova quantità disponibile è 0, marca il prodotto come non disponibile
              if (nuovaQuantitaDisponibile === 0) {
                toast.warning(`${data.productName} è ora completamente esaurito! Rimuovilo dall'ordine.`, { duration: 5000 });
                return {
                  ...item,
                  quantitaDisponibile: 0,
                  prodotto: {
                    ...item.prodotto,
                    disponibile: false,
                    terminato: true
                  }
                };
              }
              
              // Se la nuova quantità disponibile è minore di quella richiesta, aggiorna e avvisa
              if (nuovaQuantitaDisponibile < item.quantita) {
                toast.warning(`${data.productName}: solo ${nuovaQuantitaDisponibile} disponibili ora (richiesti: ${item.quantita})`, { duration: 5000 });
                return {
                  ...item,
                  quantitaDisponibile: nuovaQuantitaDisponibile,
                  // Aggiusta automaticamente la quantità al massimo disponibile
                  quantita: Math.min(item.quantita, nuovaQuantitaDisponibile)
                };
              }
              
              // Altrimenti aggiorna solo la quantità disponibile
              return {
                ...item,
                quantitaDisponibile: nuovaQuantitaDisponibile
              };
            }
            return item;
          });
        });
      } else {
        // Se non sta modificando un ordine esaurito, mostra solo il toast
        toast.info(`${data.productName}: ${data.availableQuantity} disponibili`, { duration: 3000 });
      }
    });
    
    const unsubInventoryReset = sseContext.subscribe('inventory:reset', (data) => {
      console.log('[SSE] Inventory reset:', data);
      setInventarioLimitato(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.productId);
        return newMap;
      });
      
      // Aggiorna anche gli items nell'ordine se presente
      setOrder(prevOrder => {
        return prevOrder.map(item => {
          if (item.prodotto.id === data.productId) {
            return {
              ...item,
              quantitaDisponibile: undefined, // Reset explicit availability
              prodotto: {
                ...item.prodotto,
                disponibile: true,
                terminato: false
              }
            };
          }
          return item;
        });
      });
      
      toast.success(`${data.productName}: tornato disponibile`, { duration: 3000 });
    });
    
    // Listener per cambiamenti di disponibilità prodotti
    const unsubProductAvailability = sseContext.subscribe('product:availability', (data) => {
      console.log('[SSE] Product availability changed:', data);
      
      // Aggiorna lo stato del prodotto negli items dell'ordine
      setOrder(prevOrder => {
        return prevOrder.map(item => {
          if (item.prodotto.id === data.productId) {
            const updatedItem = {
              ...item,
              prodotto: {
                ...item.prodotto,
                disponibile: data.available,
                terminato: !data.available
              }
            };
            
            // Se il prodotto non è più disponibile, avvisa l'utente
            if (!data.available && item.quantita > 0) {
              toast.error(`${data.productName} non è più disponibile! Rimuovilo dall'ordine.`, { duration: 5000 });
            }
            
            return updatedItem;
          }
          return item;
        });
      });
      
      // Aggiorna anche i prodotti nella lista se necessario
      setProducts(prevProducts => {
        return prevProducts.map(product => {
          if (product.id === data.productId) {
            return {
              ...product,
              disponibile: data.available,
              terminato: !data.available
            };
          }
          return product;
        });
      });
    });
    
    return () => {
      unsubInventoryUpdate();
      unsubInventoryReset();
      unsubProductAvailability();
    };
  }, [sseContext]);
  
  // Debug SSE context
  useEffect(() => {
    console.log('[Tavolo] SSE context:', {
      hasContext: !!sseContext,
      hasSubscribe: !!sseContext?.subscribe,
      isConnected: sseContext?.isConnected
    });
  }, [sseContext]);
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode];
  
  // Parametri per modalità "ordina per altri"
  const modalitaOrdinazione = searchParams.get('modalita');
  const clienteOrdinanteParam = searchParams.get('clienteOrdinante');
  const clienteParam = searchParams.get('cliente'); // Nuovo parametro per cliente preselezionato
  const isOrdinaPerAltri = modalitaOrdinazione === 'per-altri';
  
  const [table, setTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [customerName, setCustomerName] = useState(""); // Inizializza vuoto, verrà popolato dopo
  const [customerSeats, setCustomerSeats] = useState(2);
  const [showNameModal, setShowNameModal] = useState(true); // Mostra sempre il modal
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [clienteOrdinante, setClienteOrdinante] = useState(clienteOrdinanteParam || "");
  const [productCode, setProductCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [viewState, setViewState] = useState<ViewState>("search");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(true);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [customerNameSuggestions, setCustomerNameSuggestions] = useState<string[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [selectedQuantities, setSelectedQuantities] = useState<{[key: number]: number}>({});
  const [showKeypadFor, setShowKeypadFor] = useState<number | null>(null);
  const [isVibrating, setIsVibrating] = useState(false);
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  const [showParticle, setShowParticle] = useState(false);
  const [showGlassesModal, setShowGlassesModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{product: Product, quantity: number} | null>(null);
  const [glassesCount, setGlassesCount] = useState(0);
  const [inventarioLimitato, setInventarioLimitato] = useState<Map<number, number>>(new Map());
  const [showProductOptionsModal, setShowProductOptionsModal] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [unavailableOrderItems, setUnavailableOrderItems] = useState<OrderItem[]>([]);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [isSubmittingFromModal, setIsSubmittingFromModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [showMixedModal, setShowMixedModal] = useState(false);
  const [selectedProductForMixed, setSelectedProductForMixed] = useState<Product | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1);
  const [pendingGlasses, setPendingGlasses] = useState<number | undefined>(undefined);
  const [pendingNote, setPendingNote] = useState<string | undefined>(undefined);
  const orderListRef = useRef<HTMLDivElement>(null);
  const drawerHeaderRef = useRef<HTMLDivElement>(null);
  
  // Reset flags when order changes (e.g., after clearing)
  useEffect(() => {
    if (order.length === 0) {
      setIsSubmittingFromModal(false);
      setIsSubmittingOrder(false);
    }
  }, [order.length]);
  
  // Log SSE connection status
  useEffect(() => {
    console.log('[Tavolo] SSE Connection status:', isConnected);
  }, [isConnected]);

  const loadActiveOrders = useCallback(async () => {
    // Prevent concurrent loads or if navigating away
    if (isLoadingActiveOrdersRef.current || isNavigatingAwayRef.current) {
      console.log(`[Tavolo ${tavoloId}] loadActiveOrders skipped - loading: ${isLoadingActiveOrdersRef.current}, navigating: ${isNavigatingAwayRef.current}`);
      return;
    }
    
    isLoadingActiveOrdersRef.current = true;
    console.log(`[Tavolo ${tavoloId}] loadActiveOrders called at ${new Date().toISOString()}`);
    console.trace('[Tavolo] loadActiveOrders call stack');
    
    try {
      const result = await getOrdinazioniAttiveTavolo(tavoloId);
      console.log(`[Tavolo ${tavoloId}] loadActiveOrders result:`, result);
      
      if (result.success && 'ordinazioni' in result) {
        const ordersCount = result.ordinazioni?.length || 0;
        console.log(`[Tavolo ${tavoloId}] Setting ${ordersCount} active orders`);
        setActiveOrders((result.ordinazioni || []) as ActiveOrder[]);
        setShowActiveOrders(result.ordinazioni?.length > 0);
      }
    } catch (error) {
      console.error("Errore caricamento ordinazioni attive:", error);
    } finally {
      isLoadingActiveOrdersRef.current = false;
    }
  }, [tavoloId]);

  // Check for modifyOrder parameter
  useEffect(() => {
    const modifyOrderId = searchParams.get('modifyOrder');
    
    if (modifyOrderId) {
      // Load the out of stock order details
      loadOutOfStockOrder(modifyOrderId);
    }
  }, [searchParams]);

  const loadOutOfStockOrder = async (orderId: string) => {
    try {
      const { getOutOfStockOrderDetails } = await import('@/lib/actions/gestione-esauriti');
      const result = await getOutOfStockOrderDetails(orderId);
      
      console.log('[loadOutOfStockOrder] Result:', result);
      console.log('[loadOutOfStockOrder] Available products:', result.availableProducts);
      console.log('[loadOutOfStockOrder] Unavailable products:', result.unavailableProducts);
      
      if (result.success && result.order) {
        // Set customer name
        setCustomerName(result.order.nomeCliente || '');
        
        // Carichiamo tutti i prodotti nell'ordine per permettere la modifica
        // Gestiamo correttamente le quantità parziali
        const allItems: OrderItem[] = [];
        const productMap = new Map<number, { available: number, unavailable: number, product: any, note?: string }>();
        
        // Prima mappiamo tutti i prodotti per ID per gestire le quantità parziali
        if (result.availableProducts && result.availableProducts.length > 0) {
          result.availableProducts.forEach((item: any) => {
            const existing = productMap.get(item.Prodotto.id) || { available: 0, unavailable: 0, product: item.Prodotto };
            existing.available += item.quantita;
            existing.product = item.Prodotto;
            existing.note = item.note;
            productMap.set(item.Prodotto.id, existing);
          });
        }
        
        if (result.unavailableProducts && result.unavailableProducts.length > 0) {
          result.unavailableProducts.forEach((item: any) => {
            const existing = productMap.get(item.Prodotto.id) || { available: 0, unavailable: 0, product: item.Prodotto };
            existing.unavailable += item.quantita;
            existing.product = item.Prodotto;
            existing.note = existing.note || item.note;
            productMap.set(item.Prodotto.id, existing);
          });
        }
        
        // Ora creiamo gli items dell'ordine con le informazioni corrette
        productMap.forEach((data, productId) => {
          const totalQuantity = data.available + data.unavailable;
          
          if (totalQuantity > 0) {
            // Aggiungiamo il prodotto con la quantità totale
            // Se ci sono prodotti non disponibili, marchiamo il prodotto come parzialmente esaurito
            const productWithAvailability = {
              ...data.product,
              // Marchiamo come parzialmente esaurito se ci sono quantità non disponibili
              partiallyUnavailable: data.unavailable > 0,
              availableQuantity: data.available,
              unavailableQuantity: data.unavailable
            };
            
            allItems.push({
              prodotto: productWithAvailability,
              quantita: totalQuantity, // Quantità totale richiesta
              note: data.note,
              // Aggiungiamo info extra per il drawer
              quantitaDisponibile: data.available,
              quantitaNonDisponibile: data.unavailable
            });
          }
        });
        
        console.log('[loadOutOfStockOrder] Loading all items:', allItems);
        setOrder(allItems);
        
        // Mostra informazioni dettagliate sull'ordine
        const totalUnavailable = Array.from(productMap.values()).reduce((sum, data) => sum + data.unavailable, 0);
        const totalAvailable = Array.from(productMap.values()).reduce((sum, data) => sum + data.available, 0);
        const productsWithIssues = Array.from(productMap.values()).filter(data => data.unavailable > 0);
        
        if (productsWithIssues.length > 0) {
          const details = productsWithIssues.map(data => 
            `${data.product.nome}: ${data.unavailable} esaurit${data.unavailable > 1 ? 'i' : 'o'}${data.available > 0 ? `, ${data.available} disponibil${data.available > 1 ? 'i' : 'e'}` : ''}`
          ).join('; ');
          
          toast.warning(
            `Ordine #${result.order.numero}: ${details}. Modifica le quantità prima di inviare.`,
            { duration: 6000 }
          );
        } else if (totalAvailable > 0) {
          toast.success(
            `Ordine #${result.order.numero}: tutti i ${totalAvailable} prodotti sono disponibili.`,
            { duration: 3000 }
          );
        }
        
        if (allItems.length === 0) {
          toast.info(
            `Ordine #${result.order.numero} vuoto. Seleziona nuovi prodotti dal menu.`,
            { duration: 3000 }
          );
        }
      }
    } catch (error) {
      console.error('Error loading out of stock order:', error);
      toast.error('Errore caricamento ordine esaurito');
    }
  };

  // Funzione per caricare l'inventario limitato
  const loadInventarioLimitato = useCallback(async () => {
    try {
      const { getProdottiConInventarioLimitato } = await import('@/lib/actions/inventario-esaurito');
      const result = await getProdottiConInventarioLimitato();
      if (result.success && result.inventari) {
        const inventarioMap = new Map<number, number>();
        result.inventari.forEach(inv => {
          inventarioMap.set(inv.prodottoId, inv.quantitaDisponibile);
        });
        setInventarioLimitato(inventarioMap);
        console.log('[loadInventarioLimitato] Loaded inventory:', inventarioMap);
      }
    } catch (error) {
      console.error('Error loading inventario limitato:', error);
    }
  }, []);

  // Carica dati dal database
  useEffect(() => {
    console.log(`[Tavolo ${tavoloId}] Main data loading useEffect triggered`);
    console.log(`[Tavolo ${tavoloId}] Dependencies: tavoloId=${tavoloId}`);
    
    // Debounce the data loading to prevent rapid calls
    const loadTimer = setTimeout(async () => {
      if (isNavigatingAwayRef.current) {
        console.log(`[Tavolo ${tavoloId}] Skipping loadData - navigating away`);
        return;
      }
      console.log(`[Tavolo ${tavoloId}] loadData called at ${new Date().toISOString()} after debounce`);
      setIsLoading(true);
      try {
        const [tavoliData, prodottiData, previousCustomers] = await Promise.all([
          getTavoli(),
          getProdotti(),
          getCustomerNamesForTable(tavoloId),
          loadInventarioLimitato()
        ]);
        
        // Carica le ordinazioni attive separatamente
        await loadActiveOrders();
        
        // Se getTavoli restituisce array vuoto, probabilmente non siamo autenticati
        if (!tavoliData || tavoliData.length === 0) {
          console.error("❌ Nessun dato tavoli - probabilmente non autenticato");
          toast.error("Sessione scaduta. Effettua nuovamente il login.");
          isNavigatingAwayRef.current = true;
          router.push("/login");
          return;
        }
        
        const currentTable = tavoliData.find((t: Table) => t.id === tavoloId);
        if (!currentTable) {
          toast.error("Tavolo non trovato");
          isNavigatingAwayRef.current = true;
          router.push("/cameriere/nuova-ordinazione");
          return;
        }
        
        // Only update table if it actually changed
        setTable(prev => {
          if (!prev || prev.id !== currentTable.id || prev.stato !== currentTable.stato) {
            console.log('[Tavolo] Table state changed, updating');
            return currentTable;
          }
          return prev;
        });
        setProducts(prodottiData);
        setCustomerSeats(currentTable.posti);
        
        // Load recent products from database
        const recentProductsResult = await getRecentProducts(tavoloId);
        if (recentProductsResult.success && recentProductsResult.prodottiRecenti) {
          const recentProductsData = recentProductsResult.prodottiRecenti.map((rp: any) => rp.Prodotto);
          setRecentProducts(recentProductsData);
        }
        
        // Initialize quantities
        const initialQuantities: {[key: number]: number} = {};
        prodottiData.forEach((p: Product) => {
          initialQuantities[p.id] = 1;
        });
        setSelectedQuantities(initialQuantities);
        
        // Set customer name suggestions from previous orders at this table
        if (previousCustomers.success && previousCustomers.customerNames.length > 0) {
          setCustomerNameSuggestions(previousCustomers.customerNames);
          // Se c'è un ultimo cliente, usa quello come valore iniziale
          if (previousCustomers.lastCustomerName) {
            setCustomerName(previousCustomers.lastCustomerName);
          }
        } else {
          // Fallback to localStorage suggestions if no previous customers
          const savedNames = localStorage.getItem('customerNames');
          if (savedNames) {
            setCustomerNameSuggestions(JSON.parse(savedNames));
          }
        }
      } catch (error) {
        console.error("Errore caricamento dati:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => {
      console.log(`[Tavolo ${tavoloId}] Cleaning up main data loading timer`);
      clearTimeout(loadTimer);
    };
  }, [tavoloId]); // Only depend on tavoloId to prevent loops

  // Rimuovo la logica che chiudeva automaticamente il modal quando c'erano ordini attivi
  // Il modal deve rimanere aperto sempre all'inizio

  // Track last product update to prevent duplicate toasts
  const lastProductUpdateRef = useRef<{ productId: string; timestamp: number }>({ productId: '', timestamp: 0 });

  // Track if already subscribed to prevent duplicates
  const subscribedRef = useRef(false);
  
  // Debounce timer for loadActiveOrders
  const loadActiveOrdersTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Flag to prevent multiple concurrent loads
  const isLoadingActiveOrdersRef = useRef(false);
  // Flag to track navigation
  const isNavigatingAwayRef = useRef(false);
  // Track submission attempts
  const submissionAttemptsRef = useRef(0);

  // Subscribe to SSE events for product availability - INSTANT UPDATES
  useEffect(() => {
    // Only subscribe once when SSE is ready
    if (!sseContext?.subscribe || subscribedRef.current) {
      return;
    }

    console.log('[Tavolo] Setting up SSE subscriptions for product availability');
    subscribedRef.current = true;
    
    // Subscribe to product:availability event
    const unsubscribe = sseContext.subscribe('product:availability', (data: any) => {
      console.log("[Tavolo] Product availability update received via SSE:", data);
      
      // Check if this is a duplicate event (same product within 3 seconds)
      const now = Date.now();
      const isDuplicate = lastProductUpdateRef.current.productId === data.productId && 
                         (now - lastProductUpdateRef.current.timestamp) < 3000;
      
      // Update the local products state IMMEDIATELY
      setProducts(prev => prev.map(product => {
        if (product.id === data.productId) {
          console.log("[Tavolo] Updating product:", product.nome, "- Available:", data.available);
          return { ...product, disponibile: data.available, terminato: !data.available };
        }
        return product;
      }));
      
      // Update search results IMMEDIATELY
      setSearchResults(prev => prev.map(product => 
        product.id === data.productId 
          ? { ...product, disponibile: data.available, terminato: !data.available }
          : product
      ));
      
      // Update recent products IMMEDIATELY
      setRecentProducts(prev => prev.map(product => 
        product.id === data.productId 
          ? { ...product, disponibile: data.available, terminato: !data.available }
          : product
      ));
      
      // Update items in current order and show notifications for affected items
      setOrder(prevOrder => {
        const hasProduct = prevOrder.some(item => item.prodotto.id === data.productId);
        
        if (hasProduct && !data.available) {
          // Product in order became unavailable - show prominent warning
          notifyWarning(
            `ATTENZIONE: ${data.productName} è ora ESAURITO nel tuo ordine! Rimuovilo o trova un'alternativa.`
          );
          
          // Vibrate the drawer if open
          setTimeout(() => {
            const drawer = document.querySelector('[data-drawer-content]');
            if (drawer) {
              drawer.classList.add('vibrate');
              setTimeout(() => drawer.classList.remove('vibrate'), 1000);
            }
          }, 100);
        } else if (hasProduct && data.available) {
          // Product became available again
          notifyInfo(
            `${data.productName} è tornato disponibile!`,
            "Prodotto disponibile"
          );
        }
        
        // Update the order items
        return prevOrder.map(item => 
          item.prodotto.id === data.productId
            ? { 
                ...item, 
                prodotto: { 
                  ...item.prodotto, 
                  disponibile: data.available, 
                  terminato: !data.available 
                }
              }
            : item
        );
      });
      
      // Update timestamp to prevent duplicates
      if (!isDuplicate) {
        lastProductUpdateRef.current = { productId: data.productId, timestamp: now };
      }
      // Notification is handled by OutOfStockNotificationProvider - don't duplicate here
    });

    return () => {
      console.log('[Tavolo] Cleaning up SSE subscription');
      subscribedRef.current = false;
      unsubscribe();
    };
  }, [sseContext]); // Only re-run if sseContext changes
  
  // Memoize table number to avoid unnecessary re-subscriptions
  const tableNumber = useMemo(() => {
    if (!table) return null;
    // Keep table numero as string (supports alphanumeric like M1, M2, etc.)
    const num = table.numero;
    console.log('[Tavolo] tableNumber memoized:', num, 'from table:', table);
    return num;
  }, [table?.numero, table?.id]);
  
  // Subscribe to order-related SSE events
  const orderSSESetupRef = useRef(false);
  useEffect(() => {
    if (!sseContext || !sseContext.subscribe || !table) {
      console.log('[Tavolo] Skipping order SSE setup - sseContext:', !!sseContext, 'table:', !!table);
      return;
    }
    
    // Prevent duplicate setup in development/StrictMode
    if (orderSSESetupRef.current) {
      console.log('[Tavolo] Order SSE already setup, skipping');
      return;
    }
    orderSSESetupRef.current = true;
    
    // Use table numero as string (supports alphanumeric like M1, M2, etc.)
    const currentTableNumber = table.numero;
    
    console.log('[Tavolo] Setting up order SSE subscriptions for table:', currentTableNumber, 'tavoloId:', tavoloId);
    
    const unsubscribers: (() => void)[] = [];
    
    // Subscribe to order:ready event
    unsubscribers.push(sseContext.subscribe('order:ready', (data: any) => {
      console.log("[Tavolo] Order ready received via SSE:", data);
      
      // Check if this order is for current table
      if (data.tableNumber && data.tableNumber === currentTableNumber) {
        // Use notification helper to show both toast and add to NotificationCenter
        notifyOrderReady(data.orderId, data.tableNumber);
      }
    }));
    
    // Subscribe to order:status-change event
    unsubscribers.push(sseContext.subscribe('order:status-change', (data: any) => {
      console.log(`[Tavolo ${tableNumber}] Order status change received via SSE:`, data);
      console.log(`[Tavolo ${tableNumber}] Event table: ${data.tableNumber}, Current table: ${tableNumber}`);
      
      // Reload active orders if it's for current table with debounce
      if (data.tableNumber && data.tableNumber === currentTableNumber) {
        console.log(`[Tavolo ${tableNumber}] Event is for current table, setting up debounce`);
        
        // Clear existing timer
        if (loadActiveOrdersTimerRef.current) {
          console.log(`[Tavolo ${tableNumber}] Clearing existing timer`);
          clearTimeout(loadActiveOrdersTimerRef.current);
        }
        
        // Set new timer with 500ms debounce
        loadActiveOrdersTimerRef.current = setTimeout(() => {
          console.log(`[Tavolo ${tableNumber}] Loading active orders after 500ms debounce`);
          loadActiveOrders();
        }, 500);
      } else {
        console.log(`[Tavolo ${tableNumber}] Event is for different table, ignoring`);
      }
    }));

    return () => {
      console.log('[Tavolo] Cleaning up order SSE subscriptions');
      orderSSESetupRef.current = false; // Reset flag for next setup
      unsubscribers.forEach(unsubscribe => unsubscribe());
      
      // Clean up debounce timer
      if (loadActiveOrdersTimerRef.current) {
        clearTimeout(loadActiveOrdersTimerRef.current);
      }
    };
  }, [sseContext?.subscribe, table?.id, table?.numero, tavoloId]); // Use specific deps instead of whole objects

  // Periodically sync product availability (fallback to ensure consistency)
  useEffect(() => {
    const syncAvailability = async () => {
      console.log('[Tavolo] Syncing product availability...');
      const result = await syncProductAvailability();
      if (result.success && result.products) {
        // Update products with the latest availability
        setProducts(prev => prev.map(product => {
          const updated = result.products.find((p: any) => p.id === product.id);
          if (updated) {
            return { ...product, disponibile: updated.disponibile, terminato: updated.terminato };
          }
          return product;
        }));
      }
    };

    // Initial sync after a delay to ensure SSE is connected
    const initialTimer = setTimeout(syncAvailability, 3000);
    
    // Sync every 30 seconds as a fallback
    const interval = setInterval(syncAvailability, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []); // Remove products.length and order from dependencies

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.categoria))).sort();

  // Get products for selected category
  const categoryProducts = selectedCategory 
    ? products.filter(p => p.categoria === selectedCategory)
    : [];

  const addToOrder = async (product: Product, quantity: number = 1, glasses?: number, note?: string, configurazione?: any, prezzoFinale?: number) => {
    // Non permettere l'aggiunta di prodotti non disponibili o terminati
    if (product.disponibile === false || product.terminato === true) {
      notifyWarning("Questo prodotto non è disponibile");
      return;
    }
    
    // Controlla se il prodotto è miscelato
    if (product.isMiscelato && !configurazione && !prezzoFinale) {
      // Salva i parametri pendenti e apri il modal per miscelati
      setSelectedProductForMixed(product);
      setPendingQuantity(quantity);
      setPendingGlasses(glasses);
      setPendingNote(note);
      setShowMixedModal(true);
      return;
    }
    
    // Controlla se il prodotto è configurabile
    if (!configurazione && !prezzoFinale) {
      const prodottoConfig = await getProdottoConfigurabile(product.id);
      if (prodottoConfig && prodottoConfig.richiedeScelta) {
        // Salva i parametri pendenti e apri il modal
        setSelectedProductForVariant(product);
        setPendingQuantity(quantity);
        setPendingGlasses(glasses);
        setPendingNote(note);
        setShowVariantModal(true);
        return;
      }
    }
    
    // Controlla l'inventario limitato
    const quantitaDisponibile = inventarioLimitato.get(product.id);
    if (quantitaDisponibile !== undefined && quantitaDisponibile !== null) {
      if (quantitaDisponibile === 0) {
        notifyWarning(`${product.nome} è completamente esaurito (0 disponibili)`);
        return;
      }
      
      // Calcola quanti ne abbiamo già nell'ordine
      const quantitaGiaInOrdine = order
        .filter(item => item.prodotto.id === product.id)
        .reduce((sum, item) => sum + item.quantita, 0);
      
      if (quantitaGiaInOrdine + quantity > quantitaDisponibile) {
        const rimanenti = quantitaDisponibile - quantitaGiaInOrdine;
        if (rimanenti <= 0) {
          notifyWarning(`Hai già ordinato tutti i ${quantitaDisponibile} ${product.nome} disponibili`);
        } else {
          notifyWarning(`Solo ${rimanenti} ${product.nome} rimanenti (${quantitaDisponibile} totali, ${quantitaGiaInOrdine} già in ordine)`);
        }
        return;
      }
    }

    // Se il prodotto richiede bicchieri e non sono stati forniti, mostra il modal
    if (product.requiresGlasses && glasses === undefined) {
      setPendingProduct({ product, quantity });
      setGlassesCount(quantity);
      setShowGlassesModal(true);
      return;
    }

    setOrder(prev => {
      // Per prodotti configurabili, cerchiamo se esiste già la stessa configurazione
      if (configurazione) {
        // Funzione helper per confrontare configurazioni
        const isSameConfiguration = (config1: any, config2: any) => {
          if (!config1 || !config2) return false;
          
          // Per miscelati, confronta le selezioni
          if (config1.selezioni && config2.selezioni) {
            return JSON.stringify(config1.selezioni) === JSON.stringify(config2.selezioni);
          }
          
          // Per altre configurazioni, confronta tutto
          return JSON.stringify(config1) === JSON.stringify(config2);
        };
        
        // Cerca un item esistente con la stessa configurazione
        const existingConfigured = prev.find(item => 
          item.prodotto.id === product.id && 
          item.note === note && 
          isSameConfiguration(item.configurazione, configurazione) &&
          item.prezzoFinale === prezzoFinale
        );
        
        if (existingConfigured) {
          // Se esiste, incrementa la quantità
          return prev.map(item => 
            item.prodotto.id === product.id && 
            item.note === note && 
            isSameConfiguration(item.configurazione, configurazione) &&
            item.prezzoFinale === prezzoFinale
              ? { 
                  ...item, 
                  quantita: item.quantita + quantity,
                  glassesCount: item.glassesCount !== undefined && glasses !== undefined 
                    ? item.glassesCount + glasses 
                    : item.glassesCount
                }
              : item
          );
        } else {
          // Se non esiste, aggiungi come nuovo
          return [...prev, { 
            prodotto: product, 
            quantita: quantity,
            glassesCount: product.requiresGlasses ? glasses : undefined,
            note: note,
            configurazione: configurazione,
            prezzoFinale: prezzoFinale
          }];
        }
      }
      
      // Per prodotti non configurabili, mantieni la logica esistente
      const existing = prev.find(item => item.prodotto.id === product.id && item.note === note && !item.configurazione);
      if (existing) {
        return prev.map(item => 
          item.prodotto.id === product.id && item.note === note && !item.configurazione
            ? { 
                ...item, 
                quantita: item.quantita + quantity,
                glassesCount: item.glassesCount !== undefined && glasses !== undefined 
                  ? item.glassesCount + glasses 
                  : item.glassesCount
              }
            : item
        );
      } else {
        return [...prev, { 
          prodotto: product, 
          quantita: quantity,
          glassesCount: product.requiresGlasses ? glasses : undefined,
          note: note
        }];
      }
    });
    
    // Track last added product and trigger vibration + particles
    setLastAddedProduct(product);
    setIsVibrating(true);
    setTimeout(() => setIsVibrating(false), 900); // Reset after animation
    
    // Trigger particle effect above the total price
    if (drawerHeaderRef.current) {
      const rect = drawerHeaderRef.current.getBoundingClientRect();
      // Position directly above the total price (far right of drawer)
      setParticlePos({ x: rect.right - 40, y: rect.top - 20 });
      // Use a new key to force re-render of particle component
      setParticleKey(prev => prev + 1);
      setShowParticle(true);
    }
    
    // Update recent products locally
    setRecentProducts(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      return [product, ...filtered].slice(0, 20); // Keep last 20 products
    });
    
    // Save to database
    addRecentProduct(tavoloId, product.id).catch(error => {
      console.error('Error saving recent product:', error);
    });
    
    // Reset quantity for this product
    setSelectedQuantities(prev => ({ ...prev, [product.id]: 1 }));
    
    // Don't auto-expand drawer anymore
    // setDrawerExpanded(true);
    
    // Don't show success toast anymore
    // toast.success(`${quantity}x ${product.nome} aggiunto all'ordine`);
    
    // Auto-scroll to bottom of order list
    setTimeout(() => {
      if (orderListRef.current) {
        orderListRef.current.scrollTop = orderListRef.current.scrollHeight;
      }
    }, 100);
  };

  const removeFromOrder = (productId: number) => {
    setOrder(prev => {
      return prev.map(item => {
        if (item.prodotto.id === productId) {
          // If quantity is 1, remove the item completely
          if (item.quantita <= 1) {
            return null;
          }
          
          // Otherwise decrement the quantity
          return { ...item, quantita: item.quantita - 1 };
        }
        return item;
      }).filter(Boolean) as OrderItem[];
    });
  };

  const clearOrder = () => {
    setOrder([]);
    setOrderNotes("");
  };
  
  // Handle QR order import
  const handleQROrderImport = (items: Array<{
    prodottoId: number;
    nome: string;
    quantita: number;
    prezzo: number | string;
    note?: string;
    glassesCount?: number;
  }>) => {
    // Find products from the imported items
    const importedOrder: OrderItem[] = [];
    let notFoundProducts: string[] = [];
    
    items.forEach(item => {
      const product = products.find(p => p.id === item.prodottoId);
      if (product) {
        importedOrder.push({
          prodotto: product,
          quantita: item.quantita,
          note: item.note,
          glassesCount: item.glassesCount
        });
      } else {
        notFoundProducts.push(item.nome);
      }
    });
    
    if (importedOrder.length > 0) {
      // Add imported items to current order
      setOrder(prev => {
        const newOrder = [...prev];
        importedOrder.forEach(item => {
          const existingIndex = newOrder.findIndex(o => o.prodotto.id === item.prodotto.id);
          if (existingIndex >= 0) {
            newOrder[existingIndex].quantita += item.quantita;
          } else {
            newOrder.push(item);
          }
        });
        return newOrder;
      });
      
      // Show success message
      notifyInfo(`Importati ${importedOrder.length} prodotti dall'ordine QR`, "Ordine Importato");
      
      // Expand drawer to show imported items
      setDrawerExpanded(true);
    }
    
    if (notFoundProducts.length > 0) {
      notifyWarning(`Prodotti non trovati: ${notFoundProducts.join(', ')}`);
    }
  };
  
  // Helper function to check if an item is completely unavailable
  const isItemCompletelyUnavailable = (item: OrderItem): boolean => {
    const hasExplicitAvailability = item.quantitaDisponibile !== undefined;
    if (hasExplicitAvailability) {
      return item.quantitaDisponibile === 0;
    }
    const quantitaDisponibile = inventarioLimitato.get(item.prodotto.id);
    const hasLimitedInventory = quantitaDisponibile !== undefined && quantitaDisponibile !== null;
    return (hasLimitedInventory && quantitaDisponibile === 0) || 
           item.prodotto.terminato === true || 
           item.prodotto.disponibile === false;
  };
  
  // Check if order has any completely unavailable items
  const hasUnavailableItems = order.some(isItemCompletelyUnavailable);

  const handleProductClick = (product: Product) => {
    setSelectedProductForOptions(product);
    setShowProductOptionsModal(true);
  };

  const handleAddNote = (note: string) => {
    if (editingItemIndex !== null) {
      // Modifica nota di un item esistente
      setOrder(prev => prev.map((item, index) => 
        index === editingItemIndex ? { ...item, note } : item
      ));
      setEditingItemIndex(null);
    }
  };

  const handleOpenGlassesModalFromNotes = () => {
    if (selectedProductForOptions && selectedProductForOptions.requiresGlasses) {
      const item = editingItemIndex !== null ? order[editingItemIndex] : null;
      setPendingProduct({ 
        product: selectedProductForOptions, 
        quantity: item ? item.quantita : 1 
      });
      setGlassesCount(item?.glassesCount || item?.quantita || 1);
      setShowGlassesModal(true);
    }
  };

  const handleEditItemNote = (index: number) => {
    setEditingItemIndex(index);
    const item = order[index];
    setSelectedProductForOptions(item.prodotto);
    setShowProductOptionsModal(true);
  };

  const getTotalOrder = () => {
    return order.reduce((total, item) => {
      const prezzo = item.prezzoFinale || Number(item.prodotto.prezzo);
      return total + (prezzo * item.quantita);
    }, 0);
  };


  const handleVariantConfirm = (configurazione: any, prezzoFinale: number) => {
    if (selectedProductForVariant) {
      // Aggiungi il prodotto con la configurazione
      addToOrder(
        selectedProductForVariant, 
        pendingQuantity, 
        pendingGlasses, 
        pendingNote, 
        configurazione, 
        prezzoFinale
      );
      
      // Reset stati
      setShowVariantModal(false);
      setSelectedProductForVariant(null);
      setPendingQuantity(1);
      setPendingGlasses(undefined);
      setPendingNote(undefined);
    }
  };

  const handleGlassesConfirm = () => {
    if (pendingProduct) {
      // Controlla se stiamo modificando un prodotto esistente
      const existingItem = order.find(item => item.prodotto.id === pendingProduct.product.id);
      
      if (existingItem) {
        // Modifica il numero di bicchieri per il prodotto esistente
        setOrder(prev => prev.map(item => 
          item.prodotto.id === pendingProduct.product.id 
            ? { ...item, glassesCount: glassesCount }
            : item
        ));
      } else {
        // Aggiungi il prodotto all'ordine con il numero di bicchieri specificato
        addToOrder(pendingProduct.product, pendingProduct.quantity, glassesCount);
      }
      
      // Chiudi il modal e resetta gli stati
      setShowGlassesModal(false);
      setPendingProduct(null);
      setGlassesCount(0);
    }
  };

  const handleEditGlasses = (item: OrderItem) => {
    // Apri il modal per modificare i bicchieri di un prodotto esistente
    if (item.prodotto.requiresGlasses) {
      setPendingProduct({ product: item.prodotto, quantity: item.quantita });
      setGlassesCount(item.glassesCount || item.quantita);
      setShowGlassesModal(true);
    }
  };

  const handleRemoveUnavailableProducts = () => {
    // Remove unavailable products from order
    const unavailableProductIds = new Set(unavailableOrderItems.map(item => item.prodotto.id));
    setOrder(prev => prev.filter(item => !unavailableProductIds.has(item.prodotto.id)));
    setUnavailableOrderItems([]);
    setShowUnavailableModal(false);
    notifyWarning("Prodotti non disponibili rimossi dall'ordine");
  };

  const handleKeepUnavailableProducts = () => {
    // Keep products but mark them somehow
    setUnavailableOrderItems([]);
    setShowUnavailableModal(false);
    notifyInfo("I prodotti sono stati mantenuti nell'ordine. Ricordati di trovare delle alternative!", "Prodotti mantenuti");
  };

  const submitOrder = async (fromModal: boolean = false) => {
    // Prevent multiple simultaneous submissions
    if (isSubmittingOrder) {
      console.log('[submitOrder] Already submitting, skipping');
      return;
    }
    
    // Check if we're modifying an out of stock order
    const modifyOrderId = searchParams.get('modifyOrder');
    
    // Check for exhausted products
    const exhaustedProducts = order.filter(item => 
      item.prodotto.terminato || !item.prodotto.disponibile
    );
    
    if (exhaustedProducts.length > 0) {
      const productNames = exhaustedProducts.map(item => item.prodotto.nome).join(', ');
      notifyWarning(
        `ATTENZIONE: I seguenti prodotti sono ESAURITI: ${productNames}. Rimuovili dall'ordine o trova alternative!`
      );
      
      // Add vibration effect to exhausted items
      setTimeout(() => {
        const drawer = document.querySelector('[data-drawer-content]');
        if (drawer) {
          drawer.classList.add('vibrate');
          setTimeout(() => drawer.classList.remove('vibrate'), 1000);
        }
      }, 100);
      
      return;
    }
    
    // Check if customer name is set
    if (!customerName || customerName.trim() === "") {
      console.log('[submitOrder] No customer name, opening modal');
      // Open the customer name modal and flag that we're submitting from it
      setIsSubmittingFromModal(true);
      setShowNameModal(true);
      return;
    }
    
    // Check if order is empty
    if (order.length === 0) {
      console.log('[submitOrder] Order is empty, aborting');
      notifyWarning("L'ordine è vuoto. Aggiungi almeno un prodotto.");
      return;
    }
    
    // Set loading state immediately to prevent double submission
    setIsSubmittingOrder(true);
    console.log('[submitOrder] Starting order submission');
    console.log('[submitOrder] Order has', order.length, 'items');
    
    // Ensure we have a customerId
    if (!customerId) {
      const { getOrCreateCliente } = await import('@/lib/actions/clienti');
      const result = await getOrCreateCliente(customerName);
      
      if (result.success && result.cliente) {
        setCustomerId(result.cliente.id);
      }
    }
    
    // Automatic routing logic
    try {
      console.log("[submitOrder] Invio ordine:", order);
      console.log("[submitOrder] Order length:", order.length);
      console.log("[submitOrder] Table:", table);
      console.log("[submitOrder] Customer name:", customerName);
      
      let result;
      
      // If we're modifying an out of stock order, handle it differently
      if (modifyOrderId) {
        const { modifyOutOfStockOrder } = await import('@/lib/actions/gestione-esauriti');
        result = await modifyOutOfStockOrder(modifyOrderId, order.map((item: OrderItem) => ({
          prodottoId: item.prodotto.id,
          quantita: item.quantita,
          note: item.note
        })));
        
        if (result.success) {
          toast.success('Ordine sostitutivo creato con successo!');
          // Clear the order
          clearOrder();
          // Wait a bit for the transaction to complete and SSE events to propagate
          setTimeout(() => {
            isNavigatingAwayRef.current = true;
            router.push(`/cameriere/nuova-ordinazione`);
          }, 500);
          return;
        }
      } else if (isOrdinaPerAltri && clienteOrdinante) {
        // Modalità "Ordina per Altri" - gestire prodotto per prodotto
        console.log("Modalità ordina per altri");
        
        // Prima crea/trova l'ordinazione del tavolo destinatario
        const ordinazioneResult = await creaOrdinazione({
          tavoloId: table!.id,
          tipo: "TAVOLO",
          prodotti: [], // Ordinazione vuota per iniziare
          note: `Cliente: ${customerName} - Posti: ${customerSeats} - Ordinato da: ${clienteOrdinante}`
        });
        
        if (ordinazioneResult.success) {
          // Ora aggiungi ogni prodotto come contributo
          for (const item of order) {
            await aggiungiProdottoAltroTavolo(
              clienteOrdinante, // Chi ordina (ID del cliente)
              'ordinazione' in ordinazioneResult && ordinazioneResult.ordinazione ? ordinazioneResult.ordinazione.id : '', // ID ordinazione postazione
              item.prodotto.id,
              item.quantita,
              item.prodotto.prezzo,
              customerName, // Nome cliente beneficiario
              item.note // Note del prodotto
            );
          }
          result = ordinazioneResult;
        } else {
          result = ordinazioneResult;
        }
      } else {
        // Modalità normale
        result = await creaOrdinazione({
          tavoloId: table!.id,
          clienteId: customerId || undefined,
          tipo: "TAVOLO",
          prodotti: order.map((item: OrderItem) => ({
            prodottoId: item.prodotto.id,
            quantita: item.quantita,
            prezzo: item.prezzoFinale || item.prodotto.prezzo,
            glassesCount: item.glassesCount,
            note: item.note,
            configurazione: item.configurazione,
            prezzoFinale: item.prezzoFinale
          })),
          note: `Cliente: ${customerName} - Posti: ${customerSeats}${orderNotes ? ` - ${orderNotes}` : ''}`
        });
      }
      
      console.log("Risultato ordine:", result);
      
      if ('mergePending' in result && result.mergePending) {
        // Richiesta di merge inviata
        console.log('[submitOrder] Merge request sent successfully');
        setIsSubmittingOrder(false);
        submissionAttemptsRef.current = 0; // Reset attempts counter
        notifyInfo('message' in result ? result.message : "Richiesta inviata. In attesa di conferma dalla preparazione.", "Richiesta inviata");
        clearOrder();
        // Navigate back after showing the message when from modal
        if (fromModal) {
          setTimeout(() => {
            isNavigatingAwayRef.current = true;
            router.push('/cameriere/nuova-ordinazione');
          }, 1500);
        }
      } else if (result.success) {
        // Close the drawer immediately
        setDrawerExpanded(false);
        submissionAttemptsRef.current = 0; // Reset attempts counter
        
        // Show fireworks animation
        setShowFireworks(true);
        
        // Show order sent notification
        const orderNumber = 'ordinazione' in result && result.ordinazione ? 
          result.ordinazione.numero.toString() : 'N/A';
        const tableNumber = table?.numero?.toString();
        notifyOrderSent(orderNumber, tableNumber);
        
        clearOrder();
        
        // Ricarica le ordinazioni attive
        await loadActiveOrders();
        
        // Mostra la sezione ordinazioni attive
        setShowActiveOrders(true);
        
        // Store fireworks state and customer name in sessionStorage for continuation
        sessionStorage.setItem('showFireworks', 'true');
        sessionStorage.setItem('lastCustomerName', customerName);
        
        // Navigate back to table selection after shorter delay
        // Make sure we always navigate, especially when coming from modal
        setTimeout(() => {
          console.log('[submitOrder] Navigating to /cameriere/nuova-ordinazione');
          isNavigatingAwayRef.current = true; // Set flag to prevent further operations
          router.push('/cameriere/nuova-ordinazione');
        }, fromModal ? 500 : 800); // Slightly faster when from modal
      } else {
        setIsSubmittingOrder(false);
        console.error("Errore ordine:", result.error);
        
        // Increment attempts counter for API errors too
        submissionAttemptsRef.current++;
        if (submissionAttemptsRef.current > 3) {
          notifyError('Troppi errori di invio. Ricarica la pagina e riprova.');
        } else {
          notifyError("Errore durante l'invio dell'ordine", result.error || 'Errore sconosciuto');
        }
      }
    } catch (error) {
      setIsSubmittingOrder(false);
      console.error("Errore invio ordine:", error);
      
      // Increment attempts counter only on real errors
      submissionAttemptsRef.current++;
      if (submissionAttemptsRef.current > 3) {
        notifyError('Troppi errori di invio. Ricarica la pagina e riprova.');
      } else {
        notifyError("Errore durante l'invio dell'ordine", error instanceof Error ? error.message : 'Errore sconosciuto');
      }
    }
  };

  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Add ref to track if handleNameSubmit is in progress
  const isHandlingNameSubmitRef = useRef(false);
  
  const handleNameSubmit = async (name: string, seats: number) => {
    console.log('[handleNameSubmit] Called with name:', name, 'seats:', seats);
    console.log('[handleNameSubmit] isSubmittingFromModal:', isSubmittingFromModal);
    
    // Prevent multiple simultaneous calls
    if (isHandlingNameSubmitRef.current) {
      console.log('[handleNameSubmit] Already handling name submit, skipping');
      return;
    }
    
    isHandlingNameSubmitRef.current = true;
    
    try {
      setCustomerName(name);
      setCustomerSeats(seats);
      
      // Get or create the customer
      const { getOrCreateCliente } = await import('@/lib/actions/clienti');
      const result = await getOrCreateCliente(name);
      
      if (result.success && result.cliente) {
        setCustomerId(result.cliente.id);
      }
      
      // Save customer name to suggestions
      const names = [...new Set([name, ...customerNameSuggestions])].slice(0, 20); // Keep last 20 names
      localStorage.setItem('customerNames', JSON.stringify(names));
      setCustomerNameSuggestions(names);
      
      setShowNameModal(false);
      
      // If we were trying to submit the order, do it now
      if (isSubmittingFromModal) {
        console.log('[handleNameSubmit] Submitting order from modal');
        setIsSubmittingFromModal(false);
        await submitOrder(true); // Pass true to indicate it's from modal
      }
    } finally {
      isHandlingNameSubmitRef.current = false;
    }
  };

  const handleProductCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode.trim()) return;

    const product = products.find(p => p.codice?.toString() === productCode.trim());
    if (product) {
      addToOrder(product, 1);
      setProductCode("");
    } else {
      notifyWarning(`Prodotto con codice ${productCode} non trovato`);
    }
  };


  const addProductFromSearch = (product: Product, quantity?: number) => {
    const qty = quantity || selectedQuantities[product.id] || 1;
    addToOrder(product, qty);
    // Non resettare la ricerca - mantieni i risultati visibili
    // setSearchQuery("");
    // setSearchResults([]);
    // setIsSearchMode(false);
  };

  const handleProductAdd = (product: Product, quantity: number) => {
    addToOrder(product, quantity);
    // Rimani nella vista categorie - non cambiare stato
    // setViewState("search");
    // setSelectedCategory(null);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setViewState("products");
  };

  const handleBackToCategories = () => {
    setViewState("categories");
    setSelectedCategory(null);
  };

  const handleSearchFocus = () => {
    setViewState("search");
    setSelectedCategory(null);
  };

  const getCategoryEmoji = (category: string) => {
    const emojiMap: { [key: string]: string } = {
      'Aperitivi': '🍹',
      'Cocktail & Long Drink': '🍸',
      'Birre': '🍺',
      'Superalcolici': '🥃',
      'Vini & Spumanti': '🍷',
      'Bibite & Succhi': '🥤',
      'Gelati': '🍦',
      'Dolciumi': '🍬',
      'Caffetteria': '☕',
      'Food': '🍽️',
      'Snack': '🥨',
      'altro': '📦'
    };
    return emojiMap[category] || '🍽️';
  };

  if (isLoading || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bg.dark }}>
        <div style={{ color: colors.text.muted }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{vibrationAnimation}</style>
      <div className="min-h-screen pb-96" style={{ backgroundColor: colors.bg.dark }}>
      
      {/* Customer Name Modal - Using new component */}
      <CustomerNameModal
        isOpen={showNameModal}
        onClose={() => {
          // Only allow closing if customer name is set or not submitting
          if ((customerName && customerName.trim() !== "") || !isSubmittingFromModal) {
            setShowNameModal(false);
            setIsSubmittingFromModal(false);
          }
        }}
        onSubmit={handleNameSubmit}
        tableNumber={tableNumber ? String(tableNumber) : "0"}
        tableZone={table.zona || undefined}
        maxSeats={table.posti}
        suggestions={customerNameSuggestions}
        initialName={customerName} // Usa sempre customerName che ora contiene l'ultimo cliente
        initialSeats={customerSeats}
        onBack={() => {
          setIsSubmittingFromModal(false);
          isNavigatingAwayRef.current = true;
          router.push('/cameriere/nuova-ordinazione');
        }}
        submitButtonText={isSubmittingFromModal ? "Invia ordine" : "Conferma"}
        isSubmitting={isSubmittingOrder}
      />


      {/* Header - Full width with responsive padding */}
      <div className="px-2 sm:px-4 py-2 sm:py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Back Arrow */}
          <Link 
            href="/cameriere/nuova-ordinazione" 
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </Link>
          
          {/* Table number circle */}
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold"
            style={{
              backgroundColor: colors.accent || colors.button.primary,
              color: 'white'
            }}
          >
            {tableNumber}
          </div>
          
          {/* Customer Names */}
          <div className="flex-1 min-w-0">
            <div className="text-sm sm:text-base font-medium truncate" style={{ color: colors.text.primary }}>
              {customerName || "Nessun cliente"}
            </div>
            <div className="text-xs sm:text-sm" style={{ color: colors.text.secondary }}>
              {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          {/* Table info - seats and status */}
          <div className="text-right">
            <div className="text-xs sm:text-sm" style={{ color: colors.text.secondary }}>
              {customerSeats || table.posti} posti
            </div>
            <div className="text-xs" style={{ 
              color: table.stato === 'OCCUPATO' ? colors.button.success : colors.text.muted 
            }}>
              {table.stato === 'OCCUPATO' ? 'Occupato' : 'Libero'}
            </div>
          </div>
          
          {/* Edit Button */}
          <button
            onClick={() => setShowNameModal(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Edit3 className="h-4 w-4" style={{ color: colors.text.secondary }} />
          </button>
          
          {/* Active Orders Button */}
          <Link
            href="/cameriere/ordini-in-corso"
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Receipt className="h-4 w-4" style={{ color: colors.text.secondary }} />
          </Link>
        </div>
      </div>


      {/* Product Search and Navigation */}
      {!showNameModal && (
        <div className="px-2 sm:px-4 md:px-6 mb-3 sm:mb-6 mt-3 sm:mt-6">
          <div className="space-y-3 sm:space-y-4">
            {/* Search Input - Always visible */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  
                  // Fuzzy search
                  if (query.trim()) {
                  const searchTerm = query.toLowerCase().trim();
                  const results = products
                    .map((p: Product) => {
                      const productName = p.nome.toLowerCase();
                      let score = 0;
                      
                      // Exact match
                      if (productName === searchTerm) score = 100;
                      // Starts with
                      else if (productName.startsWith(searchTerm)) score = 90;
                      // Contains
                      else if (productName.includes(searchTerm)) score = 80;
                      // Fuzzy match
                      else {
                        const searchChars = searchTerm.split('');
                        let lastIndex = -1;
                        let matches = 0;
                        
                        for (const char of searchChars) {
                          const index = productName.indexOf(char, lastIndex + 1);
                          if (index > lastIndex) {
                            matches++;
                            lastIndex = index;
                          }
                        }
                        
                        if (matches >= searchChars.length * 0.7) {
                          score = 50 + (matches / searchChars.length) * 20;
                        }
                      }
                      
                      return { product: p, score };
                    })
                    .filter(item => item.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(item => item.product);
                    
                  setSearchResults(results);
                } else {
                  setSearchResults([]);
                }
              }}
                onFocus={handleSearchFocus}
                placeholder="Cerca prodotto per nome"
                className="w-full p-2 sm:p-4 pr-12 rounded-lg focus:outline-none focus:ring-2 text-center text-sm sm:text-lg"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                autoFocus
              />
              <button
                onClick={() => setShowQRScannerModal(true)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: colors.accent || colors.button.primary }}
                title="Importa ordine cliente"
              >
                <Hash className="h-5 w-5" />
              </button>
            </div>
            
            {/* Recently Ordered Products - Show when no search */}
            {!searchQuery && recentProducts.length > 0 && viewState === "search" && (
              <div className="space-y-2">
                <h3 className="text-xs sm:text-sm font-semibold" style={{ color: colors.text.secondary }}>
                  Prodotti recenti
                </h3>
                <div 
                  className="rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: colors.bg.darker,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  {recentProducts
                    .slice(0, 5)
                    .map((product: Product) => (
                      <SearchProductItem
                        key={product.id}
                        product={product}
                        quantity={selectedQuantities[product.id] || 1}
                        onQuantityChange={(q) => setSelectedQuantities(prev => ({ ...prev, [product.id]: q }))}
                        onQuantityClick={() => setShowKeypadFor(product.id)}
                        onAdd={(p, q) => {
                          addToOrder(p, q);
                          setSelectedQuantities(prev => ({ ...prev, [p.id]: 1 }));
                        }}
                        colors={colors}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div 
                className="max-h-80 sm:max-h-96 overflow-y-auto rounded-lg"
                style={{
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                {searchResults.map((product: Product) => (
                  <SearchProductItem
                    key={product.id}
                    product={product}
                    quantity={selectedQuantities[product.id] || 1}
                    onQuantityChange={(q) => setSelectedQuantities(prev => ({ ...prev, [product.id]: q }))}
                    onQuantityClick={() => setShowKeypadFor(product.id)}
                    onAdd={(p, q) => {
                      addToOrder(p, q);
                      setSelectedQuantities(prev => ({ ...prev, [p.id]: 1 }));
                    }}
                    colors={colors}
                  />
                ))}
              </div>
            )}
            
            {/* No results message */}
            {searchQuery.trim() && searchResults.length === 0 && (
              <div 
                className="p-2 sm:p-3 text-center rounded-lg"
                style={{
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.muted
                }}
              >
                Nessun prodotto trovato
              </div>
            )}
            
            {/* Menu Categories Button - Only show in search mode */}
            {viewState === "search" && (
              <button
                type="button"
                onClick={() => setViewState("categories")}
                className="w-full p-2 sm:p-3 rounded-lg transition-colors font-medium text-sm sm:text-base"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }}
              >
                Menu Categorie
              </button>
            )}

            {/* Categories View */}
            {viewState === "categories" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    className="p-3 sm:p-4 rounded-lg transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.card;
                    }}
                  >
                    <div className="text-xl sm:text-2xl mb-1 sm:mb-2">{getCategoryEmoji(category)}</div>
                    <div className="font-medium text-xs sm:text-sm" style={{ color: colors.text.primary }}>
                      {category}
                    </div>
                    <div className="text-xs mt-0.5 sm:mt-1" style={{ color: colors.text.secondary }}>
                      {products.filter(p => p.categoria === category).length} prodotti
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Products View */}
            {viewState === "products" && selectedCategory && (
              <div className="space-y-3">
                {/* Back to categories and category name on single line */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={handleBackToCategories}
                    className="p-1 rounded-lg transition-colors"
                    style={{ backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" style={{ color: colors.text.secondary }} />
                  </button>
                  <h3 className="text-base sm:text-lg font-semibold" style={{ color: colors.text.primary }}>
                    {selectedCategory}
                  </h3>
                </div>

                {/* Products list */}
                <div className="space-y-2">
                  {categoryProducts.map((product) => {
                    // Calcola disponibilità e quantità già in ordine
                    const quantitaDisponibile = inventarioLimitato.get(product.id);
                    const quantitaInOrdine = order
                      .filter(item => item.prodotto.id === product.id)
                      .reduce((sum, item) => sum + item.quantita, 0);
                    
                    return (
                      <ProductItem
                        key={product.id}
                        product={product}
                        onAdd={handleProductAdd}
                        colors={colors}
                        onProductClick={handleProductClick}
                        availableQuantity={quantitaDisponibile}
                        orderedQuantity={quantitaInOrdine}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Summary - Fixed Bottom Drawer */}
      {!showNameModal && (
        <ThemedDrawer
          isOpen={drawerExpanded}
          onToggle={() => setDrawerExpanded(!drawerExpanded)}
          maxHeight="max-h-[60vh]"
          headerContent={
            <div ref={drawerHeaderRef} className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                <span className="font-medium whitespace-nowrap" style={{ color: colors.text.primary }}>
                  Ordine ({order.length})
                </span>
                <span className="whitespace-nowrap font-medium" style={{ color: colors.accent || colors.button.primary }}>
                  T{table?.numero}
                </span>
                <span className="whitespace-nowrap" style={{ color: colors.text.primary }}>
                  {customerName}
                </span>
                {!drawerExpanded && lastAddedProduct && (
                  <span className={`truncate ${isVibrating ? 'vibrate' : ''}`} style={{ color: colors.text.muted }}>
                    + {lastAddedProduct.nome}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-bold text-lg" style={{ color: colors.text.primary }}>
                  €{getTotalOrder().toFixed(2)}
                </span>
              </div>
            </div>
          }
        >
          
          {/* Exhausted Products Warning */}
          {order.some(item => item.prodotto.terminato || !item.prodotto.disponibile) && (
            <div className="mx-4 mt-2 p-3 bg-red-100 border border-red-400 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700">
                    ATTENZIONE: Prodotti esauriti nell'ordine!
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Rimuovi i prodotti esauriti o trova delle alternative prima di inviare l'ordine.
                  </p>
                  <button
                    onClick={() => {
                      const exhaustedProducts = order.filter(item => 
                        item.prodotto.terminato || !item.prodotto.disponibile
                      );
                      exhaustedProducts.forEach(item => {
                        removeFromOrder(item.prodotto.id);
                      });
                      notifyInfo("Prodotti esauriti rimossi dall'ordine", "Ordine aggiornato");
                    }}
                    className="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                  >
                    Rimuovi tutti i prodotti esauriti
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Order Items */}
          <div ref={orderListRef} className="flex-1 overflow-y-auto px-4 py-2">
            {order.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart 
                  className="h-12 w-12 mx-auto mb-3 opacity-50" 
                  style={{ color: colors.text.muted }} 
                />
                <p style={{ color: colors.text.muted }}>Nessun prodotto nell'ordine</p>
              </div>
            ) : (
              <div className="space-y-2">
                {order.map((item: OrderItem, index: number) => {
                  // Check if item has explicit availability info from loadOutOfStockOrder or SSE updates
                  const hasExplicitAvailability = item.quantitaDisponibile !== undefined || item.quantitaNonDisponibile !== undefined;
                  
                  let quantitaDisponibile: number | undefined;
                  let isExhausted = false;
                  let hasLimitedInventory = false;
                  let isPartiallyAvailable = false;
                  let isCompletelyUnavailable = false;
                  
                  if (hasExplicitAvailability) {
                    // Use explicit availability from the out-of-stock order or SSE updates
                    quantitaDisponibile = item.quantitaDisponibile ?? 0;
                    hasLimitedInventory = true;
                    isPartiallyAvailable = quantitaDisponibile > 0 && quantitaDisponibile < item.quantita;
                    isCompletelyUnavailable = quantitaDisponibile === 0;
                    // Also check if product is marked as exhausted from SSE update
                    isExhausted = item.prodotto.terminato || !item.prodotto.disponibile;
                  } else {
                    // Fall back to original logic for regular items
                    isExhausted = item.prodotto.terminato || !item.prodotto.disponibile;
                    // Always check inventarioLimitato for the most recent availability
                    const inventoryQuantity = inventarioLimitato.get(item.prodotto.id);
                    quantitaDisponibile = inventoryQuantity;
                    hasLimitedInventory = quantitaDisponibile !== undefined && quantitaDisponibile !== null;
                    isPartiallyAvailable = hasLimitedInventory && quantitaDisponibile !== undefined && quantitaDisponibile > 0 && quantitaDisponibile < item.quantita;
                    isCompletelyUnavailable = hasLimitedInventory && quantitaDisponibile === 0;
                  }
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity relative"
                      style={{
                        backgroundColor: isCompletelyUnavailable || isExhausted ? 'rgba(239, 68, 68, 0.1)' : 
                                        isPartiallyAvailable ? 'rgba(251, 191, 36, 0.1)' : 
                                        colors.bg.hover,
                        borderColor: isCompletelyUnavailable || isExhausted ? '#ef4444' : 
                                    isPartiallyAvailable ? '#f59e0b' :
                                    colors.border.secondary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                      onClick={() => handleEditItemNote(index)}
                      title={isExhausted ? "ATTENZIONE: Prodotto esaurito!" : 
                             isPartiallyAvailable ? `Solo ${quantitaDisponibile} disponibili su ${item.quantita} richiesti` :
                             isCompletelyUnavailable ? "Prodotto non disponibile" :
                             "Clicca per aggiungere note o modificare bicchieri"}
                    >
                      {(isExhausted || isCompletelyUnavailable) && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                          ESAURITO
                        </div>
                      )}
                      {isPartiallyAvailable && (
                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {quantitaDisponibile}/{item.quantita}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2" style={{ 
                          color: isExhausted || isCompletelyUnavailable ? '#ef4444' : 
                                 isPartiallyAvailable ? '#f59e0b' :
                                 colors.text.primary 
                        }}>
                          {item.prodotto.nome}
                          {item.prodotto.isMiscelato && item.configurazione && (
                            <span className="text-xs" style={{ color: colors.text.accent }}>
                              🍸
                            </span>
                          )}
                          {isExhausted && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              Non disponibile
                            </span>
                          )}
                          {isCompletelyUnavailable && !isExhausted && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                              0 disponibili
                            </span>
                          )}
                          {isPartiallyAvailable && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                              Solo {quantitaDisponibile} disponibili
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: colors.text.secondary }}>
                          €{Number(item.prodotto.prezzo).toFixed(2)} x {item.quantita} = €{(Number(item.prodotto.prezzo) * item.quantita).toFixed(2)}
                        </div>
                        {hasLimitedInventory && (
                          <div className="text-xs mt-1 font-medium" style={{ 
                            color: isCompletelyUnavailable ? '#ef4444' : 
                                   isPartiallyAvailable ? '#f59e0b' : 
                                   '#10b981' 
                          }}>
                            {isPartiallyAvailable ? (
                              <>⚠️ Solo {quantitaDisponibile ?? 0} disponibil{(quantitaDisponibile ?? 0) === 1 ? 'e' : 'i'} su {item.quantita} richiest{item.quantita === 1 ? 'o' : 'i'}</>
                            ) : isCompletelyUnavailable ? (
                              <>❌ Non disponibile (richiesti: {item.quantita})</>
                            ) : (
                              <>✓ Tutti disponibili ({item.quantita})</>
                            )}
                          </div>
                        )}
                        {item.prodotto.requiresGlasses && (
                          <div className="text-xs mt-1 flex items-center gap-1" style={{ color: colors.accent || colors.button.primary }}>
                            {item.glassesCount !== undefined ? item.glassesCount : 0} bicchier{(item.glassesCount !== undefined ? item.glassesCount : 0) === 1 ? 'e' : 'i'}
                          </div>
                        )}
                        {item.configurazione?.selezioni && (
                          <div className="text-xs mt-1 space-y-0.5" style={{ color: colors.text.secondary }}>
                            {item.configurazione.selezioni.map((sel: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1">
                                <span>•</span>
                                <span className="font-medium">{sel.categoriaNome}:</span>
                                {sel.bottiglie.map((b: any, bidx: number) => (
                                  <span key={bidx}>
                                    {b.nome}{b.marca && ` (${b.marca})`}
                                    {bidx < sel.bottiglie.length - 1 && ', '}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <div className="text-xs mt-1 flex items-center gap-1" style={{ color: colors.text.muted }}>
                            <StickyNote className="h-3 w-3" />
                            <span className="italic">{item.note}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromOrder(item.prodotto.id);
                        }}
                        className="p-1 rounded transition-colors"
                        style={{
                          backgroundColor: colors.text.error,
                          color: 'white',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium" style={{ color: colors.text.primary }}>
                        {item.quantita}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Check if we can increment (no constraints for partially available items)
                          // We allow adding more to request them
                          // Se è un miscelato, passa anche la configurazione esistente
                          if (item.prodotto.isMiscelato && item.configurazione) {
                            addToOrder(
                              item.prodotto, 
                              1, 
                              item.glassesCount, 
                              undefined, 
                              item.configurazione, 
                              item.prezzoFinale
                            );
                          } else {
                            addToOrder(item.prodotto, 1, item.glassesCount);
                          }
                        }}
                        className="p-1 rounded transition-colors"
                        style={{
                          backgroundColor: colors.button.success,
                          color: colors.button.successText
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.button.successHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.button.success;
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    </div>
                  );
                })}
                  </div>
                )}
              </div>
          
          {/* Order Notes */}
          {order.length > 0 && (
            <div className="p-4" style={{ borderTop: `1px solid ${colors.border.secondary}` }}>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Note generali per l'ordine..."
                className="w-full p-2 rounded-lg resize-none text-sm"
                rows={2}
                style={{
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>
          )}
          
          {/* Action Buttons */}
          {order.length > 0 && (
            <div 
              className="p-4 grid grid-cols-2 gap-2"
              style={{ borderTop: `1px solid ${colors.border.secondary}` }}
            >
              <button
                onClick={clearOrder}
                disabled={isSubmittingOrder}
                className="p-3 rounded-lg transition-colors text-sm font-medium"
                style={{
                  backgroundColor: isSubmittingOrder ? colors.bg.hover : colors.text.error,
                  color: 'white',
                  opacity: isSubmittingOrder ? 0.5 : 1,
                  cursor: isSubmittingOrder ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmittingOrder) e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  if (!isSubmittingOrder) e.currentTarget.style.opacity = '1';
                }}
              >
                Cancella
              </button>
              <button
                onClick={() => {
                  if (hasUnavailableItems) {
                    toast.error('Non puoi inviare l\'ordine con prodotti non disponibili. Rimuovi o modifica i prodotti esauriti.');
                    return;
                  }
                  submitOrder();
                }}
                disabled={isSubmittingOrder || hasUnavailableItems}
                className="p-3 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: isSubmittingOrder || hasUnavailableItems ? colors.bg.hover : colors.button.success,
                  color: hasUnavailableItems ? colors.text.muted : colors.button.successText,
                  cursor: isSubmittingOrder || hasUnavailableItems ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmittingOrder && !hasUnavailableItems) {
                    e.currentTarget.style.backgroundColor = colors.button.successHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmittingOrder && !hasUnavailableItems) {
                    e.currentTarget.style.backgroundColor = colors.button.success;
                  }
                }}
                title={hasUnavailableItems ? 'Rimuovi i prodotti non disponibili prima di inviare' : 'Invia ordine'}
              >
                {isSubmittingOrder ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Invio in corso...
                  </>
                ) : hasUnavailableItems ? (
                  '❌ Prodotti non disponibili'
                ) : (
                  'Invio Ordine'
                )}
              </button>
            </div>
          )}
        </ThemedDrawer>
      )}

      {/* Numeric Keypad Modal */}
      <NumericKeypad
        isOpen={showKeypadFor !== null}
        onClose={() => setShowKeypadFor(null)}
        currentValue={showKeypadFor ? (selectedQuantities[showKeypadFor] || 1) : 1}
        onConfirm={(value) => {
          if (showKeypadFor) {
            setSelectedQuantities(prev => ({ ...prev, [showKeypadFor]: value }));
            setShowKeypadFor(null);
          }
        }}
        title="Inserisci quantità"
      />

      {/* Glasses Modal */}
      <ThemedModal
        isOpen={showGlassesModal}
        onClose={() => {
          setShowGlassesModal(false);
          setPendingProduct(null);
          setGlassesCount(1);
        }}
        title={`Quanti bicchieri per ${pendingProduct?.product.nome}?`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-center" style={{ color: colors.text.secondary }}>
            Hai ordinato {pendingProduct?.quantity} bottigli{pendingProduct?.quantity === 1 ? 'a' : 'e'}.
            <br />
            Specifica il numero di bicchieri necessari (default: {pendingProduct?.quantity}).
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setGlassesCount(Math.max(0, glassesCount - 1))}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: colors.bg.darker,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            >
              <Minus className="h-5 w-5" />
            </button>
            
            <div className="text-3xl font-bold" style={{ color: colors.text.primary }}>
              {glassesCount}
            </div>
            
            <button
              onClick={() => setGlassesCount(glassesCount + 1)}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: colors.bg.darker,
                color: colors.text.primary
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setShowGlassesModal(false);
                setPendingProduct(null);
                setGlassesCount(0);
              }}
              className="flex-1 p-3 rounded-lg transition-colors"
              style={{
                backgroundColor: colors.bg.darker,
                color: colors.text.secondary
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            >
              Annulla
            </button>
            
            <button
              onClick={handleGlassesConfirm}
              className="flex-1 p-3 rounded-lg transition-colors font-medium"
              style={{
                backgroundColor: colors.button.success,
                color: colors.button.successText
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
            >
              Conferma
            </button>
          </div>
        </div>
      </ThemedModal>
      
      {/* Particle Effect - Solo quando si aggiungono prodotti */}
      {showParticle && (
        <ParticleEffect 
          key={particleKey}
          trigger={true} 
          x={particlePos.x} 
          y={particlePos.y}
          particleCount={20}
          duration={3000}
        />
      )}
      
      {/* Product Notes Modal */}
      <ProductNotesModal
        isOpen={showProductOptionsModal}
        onClose={() => {
          setShowProductOptionsModal(false);
          setSelectedProductForOptions(null);
          setEditingItemIndex(null);
        }}
        product={selectedProductForOptions}
        onAddNote={handleAddNote}
        onOpenGlassesModal={handleOpenGlassesModalFromNotes}
        existingNote={editingItemIndex !== null && order[editingItemIndex] ? order[editingItemIndex].note : ""}
      />
      
      {/* Unavailable Products Modal */}
      <UnavailableProductsModal
        isOpen={showUnavailableModal}
        onClose={() => {
          setShowUnavailableModal(false);
          setUnavailableOrderItems([]);
        }}
        unavailableProducts={unavailableOrderItems}
        onRemoveProducts={handleRemoveUnavailableProducts}
        onKeepProducts={handleKeepUnavailableProducts}
      />
      
      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={showQRScannerModal}
        onClose={() => setShowQRScannerModal(false)}
        onOrderImported={handleQROrderImport}
      />

      {/* Product Variant Modal */}
      {selectedProductForVariant && (
        <ProductVariantModal
          isOpen={showVariantModal}
          onClose={() => {
            setShowVariantModal(false);
            setSelectedProductForVariant(null);
            setPendingQuantity(1);
            setPendingGlasses(undefined);
            setPendingNote(undefined);
          }}
          prodotto={{
            id: selectedProductForVariant.id,
            nome: selectedProductForVariant.nome,
            prezzo: selectedProductForVariant.prezzo
          }}
          onConfirm={handleVariantConfirm}
        />
      )}
      
      {/* Mixed Product Modal */}
      {selectedProductForMixed && (
        <MixedProductModal
          isOpen={showMixedModal}
          onClose={() => {
            setShowMixedModal(false);
            setSelectedProductForMixed(null);
            setPendingQuantity(1);
            setPendingGlasses(undefined);
            setPendingNote(undefined);
          }}
          product={{
            id: selectedProductForMixed.id,
            nome: selectedProductForMixed.nome,
            prezzo: selectedProductForMixed.prezzo
          }}
          onConfirm={(configurazione) => {
            // Aggiungi il prodotto con la configurazione miscelato
            addToOrder(
              selectedProductForMixed,
              pendingQuantity,
              pendingGlasses,
              pendingNote,
              configurazione,
              configurazione.prezzoTotale
            );
            
            // Reset stati
            setShowMixedModal(false);
            setSelectedProductForMixed(null);
            setPendingQuantity(1);
            setPendingGlasses(undefined);
            setPendingNote(undefined);
          }}
        />
      )}
      
      {/* Fireworks or Hearts Animation based on customer */}
      {showFireworks && (
        customerName.toLowerCase() === 'giulio colaizzi' ? (
          <HeartsAnimation
            duration={2000}
            showText={true}
            onComplete={() => {
              setShowFireworks(false);
              setIsSubmittingOrder(false);
            }}
          />
        ) : (
          <FireworksAnimation
            duration={2000}
            onComplete={() => {
              setShowFireworks(false);
              setIsSubmittingOrder(false);
            }}
          />
        )
      )}
      </div>
    </>
  );
}

