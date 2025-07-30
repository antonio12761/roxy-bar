"use client";

import { useState, useEffect, useRef } from "react";
import { Coffee, Plus, Minus, ShoppingCart, Users, Clock, Wifi, WifiOff, Bell, ArrowLeft, X, Gift } from "lucide-react";
import { useSSE } from "@/lib/hooks/useSSE";
import { creaOrdinazione, getTavoli, getProdotti, getCustomerNamesForTable, getOrdinazioniAttiveTavolo } from "@/lib/actions/ordinazioni";
import { aggiungiProdottoAltroTavolo } from "@/lib/actions/contributi";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
}

interface OrderItem {
  prodotto: Product;
  quantita: number;
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
  righe: Array<{
    id: string;
    quantita: number;
    prezzo: number;
    stato: string;
    prodotto: {
      id: number;
      nome: string;
      prezzo: number;
    };
  }>;
}

type ModalState = "none" | "categories" | "products";

export default function TavoloPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tavoloId = parseInt(params.id as string);
  
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
  const [modalState, setModalState] = useState<ModalState>("none");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(true);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [customerNameSuggestions, setCustomerNameSuggestions] = useState<string[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const orderListRef = useRef<HTMLDivElement>(null);
  
  // SSE notifications
  const { isConnected, notifications } = useSSE({
    clientId: `cameriere-tavolo-${tavoloId}`,
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      console.log("Notifica ricevuta:", notification);
    }
  });

  const loadActiveOrders = async () => {
    try {
      const result = await getOrdinazioniAttiveTavolo(tavoloId);
      if (result.success) {
        setActiveOrders(result.ordinazioni || []);
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

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.categoria))).sort();

  // Get products for selected category
  const categoryProducts = selectedCategory 
    ? products.filter(p => p.categoria === selectedCategory)
    : [];

  const addToOrder = (product: Product, quantity: number = 1) => {
    setOrder(prev => {
      const existing = prev.find(item => item.prodotto.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.prodotto.id === product.id 
            ? { ...item, quantita: item.quantita + quantity }
            : item
        );
      } else {
        return [...prev, { prodotto: product, quantita: quantity }];
      }
    });
    
    // Track last added product
    setLastAddedProduct(product);
    
    // Auto-expand drawer when adding product
    setDrawerExpanded(true);
    
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

  const clearOrder = () => setOrder([]);

  const getTotalOrder = () => {
    return order.reduce((total, item) => total + (item.prodotto.prezzo * item.quantita), 0);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerName.trim() && customerSeats > 0) {
      // Save customer name to suggestions
      const newName = customerName.trim();
      const names = [...new Set([newName, ...customerNameSuggestions])].slice(0, 20); // Keep last 20 names
      localStorage.setItem('customerNames', JSON.stringify(names));
      setCustomerNameSuggestions(names);
      
      setShowNameModal(false);
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
      toast.warning(`Prodotto con codice ${productCode} non trovato`);
    }
  };


  const addProductFromSearch = (product: Product) => {
    addToOrder(product, 1);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchMode(false);
  };

  const handleProductAdd = (product: Product, quantity: number) => {
    addToOrder(product, quantity);
    // Torna alla pagina principale dopo aver aggiunto il prodotto
    setModalState("none");
    setSelectedCategory(null);
  };

  const closeModal = () => {
    setModalState("none");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-96">
      
      {/* Customer Name Modal - Full Height */}
      {showNameModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-6"
          onClick={() => setShowNameModal(false)}
        >
          <div 
            className="bg-slate-800 p-6 rounded-lg border border-slate-700 w-full max-w-md mt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-foreground mb-2">
              Tavolo {table.numero} - {table.zona}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Capacità massima: {table.posti} posti
            </p>
            <form onSubmit={handleNameSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Nome Cliente
                    {customerNameSuggestions.length > 0 && (
                      <span className="ml-2 text-xs text-white/70">
                        (Clienti precedenti disponibili)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        let value = e.target.value;
                        
                        // Capitalize first letter of each word
                        value = value.replace(/\b\w/g, (char) => char.toUpperCase());
                        
                        setCustomerName(value);
                        
                        // Show suggestions
                        if (value.trim()) {
                          const filtered = customerNameSuggestions.filter((name: string) =>
                            name.toLowerCase().includes(value.toLowerCase())
                          );
                          setShowCustomerSuggestions(filtered.length > 0);
                        } else {
                          setShowCustomerSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (customerNameSuggestions.length > 0) {
                          // Show all suggestions if input is empty, otherwise filter
                          if (!customerName.trim()) {
                            setShowCustomerSuggestions(true);
                          } else {
                            const filtered = customerNameSuggestions.filter((name: string) =>
                              name.toLowerCase().includes(customerName.toLowerCase())
                            );
                            setShowCustomerSuggestions(filtered.length > 0);
                          }
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                      placeholder="Inserisci il nome del cliente"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 text-center text-lg"
                      autoFocus
                      required
                    />
                    
                    {/* Customer name suggestions */}
                    {showCustomerSuggestions && (
                      <div className="absolute top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg max-h-40 overflow-y-auto z-10">
                        <div className="px-3 py-2 text-xs text-white/70 border-b border-slate-700">
                          Clienti precedenti tavolo {table.numero}:
                        </div>
                        {customerNameSuggestions
                          .filter((name: string) => 
                            !customerName.trim() || 
                            name.toLowerCase().includes(customerName.toLowerCase())
                          )
                          .map((name: string, index: number) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setCustomerName(name);
                                setShowCustomerSuggestions(false);
                              }}
                              className="w-full p-2 text-left hover:bg-slate-700 transition-colors text-foreground flex items-center gap-2"
                            >
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {name}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2 text-center">Numero Posti</label>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCustomerSeats(Math.max(1, customerSeats - 1))}
                      className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      value={customerSeats}
                      onChange={(e) => setCustomerSeats(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      max={table.posti}
                      className="w-24 p-3 bg-slate-900 border border-slate-700 rounded-lg text-foreground text-center text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomerSeats(Math.min(table.posti, customerSeats + 1))}
                      className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Link
                  href="/cameriere/nuova-ordinazione"
                  className="flex-1 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-center transition-colors"
                >
                  Annulla
                </Link>
                <button
                  type="submit"
                  className="flex-1 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Conferma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {modalState === "categories" && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-6"
          onClick={closeModal}
        >
          <div 
            className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Menu Categorie</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Categories List - Scrollable */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-2">
                {categories.map((category: string) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setModalState("products");
                    }}
                    className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getCategoryEmoji(category)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{category}</div>
                        <div className="text-sm text-muted-foreground">
                          {products.filter((p: Product) => p.categoria === category).length} prodotti
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Modal */}
      {modalState === "products" && selectedCategory && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-6"
          onClick={closeModal}
        >
          <div 
            className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalState("categories")}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </button>
                <span className="text-xl">{getCategoryEmoji(selectedCategory)}</span>
                <h2 className="text-lg font-bold text-foreground">{selectedCategory}</h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Products List */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-2">
                {categoryProducts.map((product: Product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onAdd={handleProductAdd}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/cameriere/nuova-ordinazione" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-white/70" />
            </Link>
            <Coffee className="h-8 w-8 text-white/70" />
            <h1 className="text-2xl font-bold text-foreground">Tavolo {table.numero}</h1>
            <span className="text-muted-foreground">- {table.zona}</span>
            {isOrdinaPerAltri && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/15/20 border border-white/20-500/30 rounded-lg">
                <Gift className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/70 font-medium">Ordina per Altri</span>
              </div>
            )}
          </div>
          {/* SSE Connection Status */}
          <div className={`flex items-center gap-2 px-2 py-1 rounded ${
            isConnected 
              ? "bg-white/10/20 text-white/60" 
              : "bg-white/8/20 text-white/50"
          }`}>
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="text-xs">
              {isConnected ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        
        {customerName && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Cliente: {customerName} ({customerSeats} posti)</span>
              </div>
              {isOrdinaPerAltri && clienteOrdinante && (
                <div className="flex items-center gap-2 px-2 py-1 bg-white/15/10 rounded">
                  <Gift className="h-3 w-3 text-white/70" />
                  <span className="text-white/70">Ordinato da: {clienteOrdinante}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowNameModal(true)}
              className="text-white/70 hover:text-amber-300 underline"
            >
              Modifica
            </button>
          </div>
        )}
      </div>

      {/* Active Orders Section */}
      {!showNameModal && activeOrders.length > 0 && (
        <div className="px-6 mb-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Ordinazioni Attive ({activeOrders.length})</h2>
              <button
                onClick={() => setShowActiveOrders(!showActiveOrders)}
                className="text-sm text-slate-400 hover:text-white"
              >
                {showActiveOrders ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
            
            {showActiveOrders && (
              <>
                <div className="space-y-3">
                  {activeOrders.map((activeOrder) => (
                    <div key={activeOrder.id} className="bg-slate-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white">#{activeOrder.numero}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            activeOrder.stato === 'ORDINATO' ? 'bg-blue-500 text-white' :
                            activeOrder.stato === 'IN_PREPARAZIONE' ? 'bg-yellow-500 text-black' :
                            activeOrder.stato === 'PRONTO' ? 'bg-green-500 text-white' :
                            'bg-purple-500 text-white'
                          }`}>
                            {activeOrder.stato.replace('_', ' ')}
                          </span>
                          {activeOrder.nomeCliente && (
                            <span className="text-slate-300">{activeOrder.nomeCliente}</span>
                          )}
                        </div>
                        <span className="font-bold text-white">€{Number(activeOrder.totale).toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-1 text-sm">
                        {activeOrder.righe.map((riga) => (
                          <div key={riga.id} className="flex justify-between text-slate-300">
                            <span>{riga.quantita}x {riga.prodotto.nome}</span>
                            <span>€{(Number(riga.prezzo) * riga.quantita).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="text-xs text-slate-400 mt-2">
                        {new Date(activeOrder.dataApertura).toLocaleString('it-IT')}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Totale tavolo:</span>
                    <span className="text-xl font-bold text-white">
                      €{activeOrders.reduce((sum, order) => sum + Number(order.totale), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Quick Product Input */}
      {!showNameModal && (
        <div className="px-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Aggiungi Prodotti</h2>
              {activeOrders.length > 0 && (
                <button
                  onClick={() => setShowNameModal(true)}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                >
                  + Nuova Ordinazione
                </button>
              )}
            </div>
            
            {/* Only show search - code functionality suspended */}
            {true ? (
              /* Product Search */
              <div className="space-y-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setSearchQuery(query);
                    
                    // Real-time search
                    if (query.trim()) {
                      const results = products.filter((p: Product) => 
                        p.nome.toLowerCase().includes(query.toLowerCase().trim())
                      );
                      setSearchResults(results);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  placeholder="Cerca prodotto per nome"
                  className="w-full p-4 bg-slate-900 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 text-center text-lg"
                  autoFocus
                />
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg">
                    {searchResults.map((product: Product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductFromSearch(product)}
                        className="w-full p-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                      >
                        <div className="font-medium text-foreground">{product.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          €{product.prezzo.toFixed(2)} • {product.categoria}
                          {product.codice && <span className="ml-2">#{product.codice}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* No results message */}
                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="p-3 text-center text-muted-foreground bg-slate-900 border border-slate-700 rounded-lg">
                    Nessun prodotto trovato
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Menu Categories Button - Always visible */}
            <button
              type="button"
              onClick={() => setModalState("categories")}
              className="w-full p-3 mt-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Menu Categorie
            </button>
          </div>
        </div>
      )}

      {/* Order Summary - Fixed Bottom Drawer */}
      {!showNameModal && (
        <div className={`fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-40 flex flex-col transition-all duration-300 ${
          drawerExpanded ? 'max-h-96' : 'max-h-20'
        }`}>
          {/* Drawer Header - Always visible */}
          <div 
            className="p-3 bg-slate-900 cursor-pointer"
            onClick={() => setDrawerExpanded(!drawerExpanded)}
          >
            {/* Order info row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                <span className="font-medium text-foreground whitespace-nowrap">
                  Ordine ({order.length})
                </span>
                <span className="text-amber-400 whitespace-nowrap font-medium">
                  T{table?.numero}
                </span>
                <span className="text-foreground whitespace-nowrap">
                  {customerName}
                </span>
                {!drawerExpanded && lastAddedProduct && (
                  <span className="text-slate-400 truncate">
                    + {lastAddedProduct.nome}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white/70 font-bold text-lg">€{getTotalOrder().toFixed(2)}</span>
                <div className={`transform transition-transform ${drawerExpanded ? 'rotate-180' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-slate-400">
                    <path d="M4 6l4 4 4-4z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Content - Only visible when expanded */}
          {drawerExpanded && (
            <>
              {/* Order Items */}
              <div ref={orderListRef} className="flex-1 overflow-y-auto px-4 py-2 border-t border-slate-700">
                {order.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">Nessun prodotto nell'ordine</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {order.map((item: OrderItem, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground text-sm">{item.prodotto.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            €{item.prodotto.prezzo.toFixed(2)} x {item.quantita} = €{(item.prodotto.prezzo * item.quantita).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeFromOrder(item.prodotto.id)}
                            className="p-1 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-foreground">
                            {item.quantita}
                          </span>
                          <button
                            onClick={() => addToOrder(item.prodotto)}
                            className="p-1 bg-green-600 hover:bg-green-700 text-white rounded"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          
          {/* Action Buttons */}
          {order.length > 0 && (
            <div className="p-4 grid grid-cols-2 gap-2 border-t border-slate-700">
              <button
                onClick={clearOrder}
                className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Cancella
              </button>
              <button
                onClick={async () => {
                  // Automatic routing logic
                  try {
                    console.log("Invio ordine:", order);
                    
                    let result;
                    
                    if (isOrdinaPerAltri && clienteOrdinante) {
                      // Modalità "Ordina per Altri" - gestire prodotto per prodotto
                      console.log("Modalità ordina per altri");
                      
                      // Prima crea/trova l'ordinazione del tavolo destinatario
                      const ordinazioneResult = await creaOrdinazione({
                        tavoloId: table.id,
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
                            customerName // Nome cliente beneficiario
                          );
                        }
                        result = ordinazioneResult;
                      } else {
                        result = ordinazioneResult;
                      }
                    } else {
                      // Modalità normale
                      result = await creaOrdinazione({
                        tavoloId: table.id,
                        tipo: "TAVOLO",
                        prodotti: order.map((item: OrderItem) => ({
                          prodottoId: item.prodotto.id,
                          quantita: item.quantita,
                          prezzo: item.prodotto.prezzo
                        })),
                        note: `Cliente: ${customerName} - Posti: ${customerSeats}`
                      });
                    }
                    
                    console.log("Risultato ordine:", result);
                    
                    if (result.success) {
                      // Determina le destinazioni per il messaggio
                      const destinazioni = new Set(order.map((item: OrderItem) => 
                        item.prodotto.postazione || 'BAR'
                      ));
                      
                      const messaggio = isOrdinaPerAltri 
                        ? `Ordine inviato per altri! ${clienteOrdinante} → Tavolo ${table.numero} (${customerName}) - Destinazioni: ${Array.from(destinazioni).join(', ')}`
                        : `Ordine inviato con successo! Tavolo ${table.numero} - Cliente: ${customerName} - Destinazioni: ${Array.from(destinazioni).join(', ')}`;
                      
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
                }}
                className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Invio Ordine
              </button>
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Component per singolo prodotto con controlli quantità
function ProductRow({ product, onAdd }: { 
  product: Product; 
  onAdd: (product: Product, quantity: number) => void; 
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex items-center justify-between p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-foreground">{product.nome}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-muted-foreground">€{product.prezzo.toFixed(2)}</span>
          {product.codice && (
            <span className="text-xs text-muted-foreground bg-slate-600 px-2 py-1 rounded">
              #{product.codice}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {product.postazione || 'Bar'}
          </span>
        </div>
      </div>
      
      {/* Quantity Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-1 hover:bg-slate-700 rounded text-white"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-sm font-medium text-foreground">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="p-1 hover:bg-slate-700 rounded text-white"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        
        <button
          onClick={() => {
            onAdd(product, quantity);
            setQuantity(1); // Reset quantity after adding
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/25-700 text-white rounded-lg transition-colors"
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}