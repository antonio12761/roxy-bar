"use client";

import { useState, useEffect, useRef } from "react";
import { Coffee, Plus, Minus, ShoppingCart, Users, Clock, Wifi, WifiOff, Bell, ArrowLeft, X, Gift, Edit3, Receipt, StickyNote } from "lucide-react";
// Removed old useSSE import - now using SSE context
import { creaOrdinazione, getTavoli, getProdotti, getCustomerNamesForTable, getOrdinazioniAttiveTavolo } from "@/lib/actions/ordinazioni";
import { addRecentProduct, getRecentProducts } from "@/lib/actions/prodotti-recenti";
import { aggiungiProdottoAltroTavolo } from "@/lib/actions/contributi";
import { toast } from "@/lib/toast";
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
import { useSSE, useSSEEvent } from "@/contexts/sse-context";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  requiresGlasses?: boolean;
  disponibile?: boolean;
  ingredienti?: string | null;
}

interface OrderItem {
  prodotto: Product;
  quantita: number;
  glassesCount?: number;
  note?: string;
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
  const tavoloId = parseInt(params.id as string);
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode];
  
  // Parametri per modalità "ordina per altri"
  const modalitaOrdinazione = searchParams.get('modalita');
  const clienteOrdinanteParam = searchParams.get('clienteOrdinante');
  const isOrdinaPerAltri = modalitaOrdinazione === 'per-altri';
  
  const [table, setTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerSeats, setCustomerSeats] = useState(2);
  const [showNameModal, setShowNameModal] = useState(true);
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
  const [showProductOptionsModal, setShowProductOptionsModal] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [unavailableOrderItems, setUnavailableOrderItems] = useState<OrderItem[]>([]);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const orderListRef = useRef<HTMLDivElement>(null);
  const drawerHeaderRef = useRef<HTMLDivElement>(null);
  
  // Connection status will be shown from context
  const isConnected = true; // Temporary - will be replaced with context

  const loadActiveOrders = async () => {
    try {
      const result = await getOrdinazioniAttiveTavolo(tavoloId);
      if (result.success && 'ordinazioni' in result) {
        setActiveOrders((result.ordinazioni || []) as ActiveOrder[]);
        setShowActiveOrders(result.ordinazioni?.length > 0);
      }
    } catch (error) {
      console.error("Errore caricamento ordinazioni attive:", error);
    }
  };

  // Carica dati dal database
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [tavoliData, prodottiData, previousCustomers] = await Promise.all([
          getTavoli(),
          getProdotti(),
          getCustomerNamesForTable(tavoloId)
        ]);
        
        // Carica le ordinazioni attive separatamente
        await loadActiveOrders();
        
        // Se getTavoli restituisce array vuoto, probabilmente non siamo autenticati
        if (!tavoliData || tavoliData.length === 0) {
          console.error("❌ Nessun dato tavoli - probabilmente non autenticato");
          toast.error("Sessione scaduta. Effettua nuovamente il login.");
          router.push("/login");
          return;
        }
        
        const currentTable = tavoliData.find((t: Table) => t.id === tavoloId);
        if (!currentTable) {
          toast.error("Tavolo non trovato");
          router.push("/cameriere/nuova-ordinazione");
          return;
        }
        
        setTable(currentTable);
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
    }
    
    loadData();
  }, [tavoloId, router]);

  // Quando le ordinazioni attive cambiano, aggiorna la visibilità del modal nome
  useEffect(() => {
    if (table && table.stato === "OCCUPATO" && activeOrders.length > 0) {
      setShowNameModal(false);
    }
  }, [activeOrders, table]);

  // Subscribe to product availability events
  useSSEEvent('product:availability', (data) => {
    console.log("[Tavolo] Product availability update received:", data);
    
    // Update the local products state
    setProducts(prev => prev.map(product => 
      product.id === data.productId 
        ? { ...product, disponibile: data.available }
        : product
    ));
    
    // Update search results if any
    setSearchResults(prev => prev.map(product => 
      product.id === data.productId 
        ? { ...product, disponibile: data.available }
        : product
    ));
    
    // Update recent products if any
    setRecentProducts(prev => prev.map(product => 
      product.id === data.productId 
        ? { ...product, disponibile: data.available }
        : product
    ));
    
    // Check if the product is in the current order
    if (!data.available && order.length > 0) {
      const affectedItems = order.filter(item => item.prodotto.id === data.productId);
      if (affectedItems.length > 0) {
        setUnavailableOrderItems(prev => [...prev, ...affectedItems]);
        setShowUnavailableModal(true);
      }
    }
    
    // Show toast notification
    const message = data.available 
      ? `${data.productName} è ora disponibile`
      : `${data.productName} è esaurito`;
    toast.info(message);
  }, [tavoloId, order]);

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.categoria))).sort();

  // Get products for selected category
  const categoryProducts = selectedCategory 
    ? products.filter(p => p.categoria === selectedCategory)
    : [];

  const addToOrder = (product: Product, quantity: number = 1, glasses?: number, note?: string) => {
    // Non permettere l'aggiunta di prodotti non disponibili
    if (product.disponibile === false) {
      toast.error("Questo prodotto non è disponibile");
      return;
    }

    // Se il prodotto richiede bicchieri e non sono stati forniti, mostra il modal
    if (product.requiresGlasses && glasses === undefined) {
      setPendingProduct({ product, quantity });
      setGlassesCount(quantity);
      setShowGlassesModal(true);
      return;
    }

    setOrder(prev => {
      const existing = prev.find(item => item.prodotto.id === product.id && item.note === note);
      if (existing) {
        return prev.map(item => 
          item.prodotto.id === product.id && item.note === note
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
          if (item.quantita <= 1) {
            return null;
          }
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
    return order.reduce((total, item) => total + (item.prodotto.prezzo * item.quantita), 0);
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
    toast.warning("Prodotti non disponibili rimossi dall'ordine");
  };

  const handleKeepUnavailableProducts = () => {
    // Keep products but mark them somehow
    setUnavailableOrderItems([]);
    setShowUnavailableModal(false);
    toast.info("I prodotti sono stati mantenuti nell'ordine. Ricordati di trovare delle alternative!");
  };

  const submitOrder = async () => {
    // Check if customer name is set
    if (!customerName || customerName.trim() === "") {
      // Open the customer name modal
      setShowNameModal(true);
      toast.warning("Inserisci il nome del cliente prima di inviare l'ordine");
      return;
    }
    
    // Automatic routing logic
    try {
      console.log("Invio ordine:", order);
      
      let result;
      
      if (isOrdinaPerAltri && clienteOrdinante) {
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
          tipo: "TAVOLO",
          prodotti: order.map((item: OrderItem) => ({
            prodottoId: item.prodotto.id,
            quantita: item.quantita,
            prezzo: item.prodotto.prezzo,
            glassesCount: item.glassesCount,
            note: item.note
          })),
          note: `Cliente: ${customerName} - Posti: ${customerSeats}${orderNotes ? ` - ${orderNotes}` : ''}`
        });
      }
      
      console.log("Risultato ordine:", result);
      
      if ('mergePending' in result && result.mergePending) {
        // Richiesta di merge inviata
        toast.info('message' in result ? result.message : "Richiesta inviata. In attesa di conferma dalla preparazione.");
        clearOrder();
        // Non ricaricare gli ordini attivi perché l'ordine non è ancora stato creato/mergiato
      } else if (result.success) {
        // Tutti gli ordini dei camerieri vanno a PREPARA
        const messaggio = isOrdinaPerAltri 
          ? `Ordine inviato per altri! ${clienteOrdinante} → Tavolo ${table!.numero} (${customerName})`
          : `Ordine inviato con successo! Tavolo ${table!.numero} - Cliente: ${customerName}`;
        
        toast.success(messaggio);
        clearOrder();
        
        // Ricarica le ordinazioni attive
        await loadActiveOrders();
        
        // Mostra la sezione ordinazioni attive
        setShowActiveOrders(true);
        
        // Non reindirizzare più, permetti multiple ordinazioni
        // router.push("/cameriere");
      } else {
        console.error("Errore ordine:", result.error);
        toast.error(`Errore durante l'invio dell'ordine: ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error) {
      console.error("Errore invio ordine:", error);
      toast.error(`Errore durante l'invio dell'ordine: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  };

  const handleNameSubmit = (name: string, seats: number) => {
    setCustomerName(name);
    setCustomerSeats(seats);
    
    // Save customer name to suggestions
    const names = [...new Set([name, ...customerNameSuggestions])].slice(0, 20); // Keep last 20 names
    localStorage.setItem('customerNames', JSON.stringify(names));
    setCustomerNameSuggestions(names);
    
    setShowNameModal(false);
  };

  const handleProductCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode.trim()) return;

    const product = products.find(p => p.codice?.toString() === productCode.trim());
    if (product) {
      addToOrder(product, 1);
      setProductCode("");
    } else {
      toast.warning(`Prodotto con codice ${productCode} non trovato`);
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
          // Only allow closing if customer name is set
          if (customerName && customerName.trim() !== "") {
            setShowNameModal(false);
          }
        }}
        onSubmit={handleNameSubmit}
        tableNumber={table.numero}
        tableZone={table.zona || undefined}
        maxSeats={table.posti}
        suggestions={customerNameSuggestions}
        initialName={customerName}
        initialSeats={customerSeats}
        onBack={() => router.push('/cameriere/nuova-ordinazione')}
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
            {table.numero}
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
              className="w-full p-2 sm:p-4 rounded-lg focus:outline-none focus:ring-2 text-center text-sm sm:text-lg"
              style={{
                backgroundColor: colors.bg.input,
                borderColor: colors.border.primary,
                color: colors.text.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              autoFocus
            />
            
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
                  {categoryProducts.map((product) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      onAdd={handleProductAdd}
                      colors={colors}
                      onProductClick={handleProductClick}
                    />
                  ))}
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
                {order.map((item: OrderItem, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: colors.bg.hover,
                      borderColor: colors.border.secondary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                    onClick={() => handleEditItemNote(index)}
                    title="Clicca per aggiungere note o modificare bicchieri"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color: colors.text.primary }}>
                        {item.prodotto.nome}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.secondary }}>
                        €{item.prodotto.prezzo.toFixed(2)} x {item.quantita} = €{(item.prodotto.prezzo * item.quantita).toFixed(2)}
                      </div>
                      {item.prodotto.requiresGlasses && (
                        <div className="text-xs mt-1 flex items-center gap-1" style={{ color: colors.accent || colors.button.primary }}>
                          {item.glassesCount !== undefined ? item.glassesCount : 0} bicchier{(item.glassesCount !== undefined ? item.glassesCount : 0) === 1 ? 'e' : 'i'}
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
                          color: 'white'
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
                        onClick={() => addToOrder(item.prodotto, 1)}
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
                    ))}
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
                className="p-3 rounded-lg transition-colors text-sm font-medium"
                style={{
                  backgroundColor: colors.text.error,
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Cancella
              </button>
              <button
                onClick={() => submitOrder()}
                className="p-3 rounded-lg transition-colors text-sm font-medium"
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
                Invio Ordine
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
      </div>
    </>
  );
}

