"use client";

import { useState, useRef, useEffect } from "react";
import { X, User, MapPin, CreditCard, Plus, Minus, ShoppingCart, ArrowLeft } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemedDrawer } from "@/components/ui/ThemedDrawer";
import { ProductItem } from "@/components/cameriere/ProductItem";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
}

interface OrderItem {
  prodotto: Product;
  quantita: number;
}

interface OrdinaPerAltriModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderData: {
    clienteOrdinante: string;
    destinationType: 'tavolo' | 'cliente';
    tavoloDestinatario?: number;
    clienteDestinatario?: string;
    items: OrderItem[];
    pagamentoImmediato: boolean;
  }) => void;
  products: Product[];
  tables: Array<{id: number; numero: string; zona?: string | null}>;
  selectedTableId?: number | null;
}

export function OrdinaPerAltriModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  products, 
  tables,
  selectedTableId
}: OrdinaPerAltriModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [step, setStep] = useState(1); // 1: Cliente ordinante, 2: Destinatario, 3: Prodotti, 4: Pagamento
  
  // Step 1: Cliente che ordina
  const [clienteOrdinante, setClienteOrdinante] = useState("");
  
  // Step 2: Destinatario
  const [destinationType, setDestinationType] = useState<'tavolo' | 'cliente'>('tavolo');
  const [tavoloDestinatario, setTavoloDestinatario] = useState<number | undefined>();
  const [clienteDestinatario, setClienteDestinatario] = useState("");
  
  // Step 3: Prodotti
  const [items, setItems] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'search' | 'categories' | 'products'>('search');
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const orderListRef = useRef<HTMLDivElement>(null);
  
  // Step 4: Pagamento
  const [pagamentoImmediato, setPagamentoImmediato] = useState(true);

  const resetModal = () => {
    setStep(1);
    setClienteOrdinante("");
    setDestinationType('tavolo');
    setTavoloDestinatario(selectedTableId || undefined);
    setClienteDestinatario("");
    setItems([]);
    setSearchQuery("");
    setPagamentoImmediato(true);
    setSelectedCategory(null);
    setViewState('search');
    setDrawerExpanded(false);
    setLastAddedProduct(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      clienteOrdinante,
      destinationType: 'tavolo', // Sempre tavolo ora
      tavoloDestinatario,
      clienteDestinatario: clienteDestinatario.trim() || undefined, // Opzionale
      items,
      pagamentoImmediato
    });
    resetModal();
  };

  const addProduct = (product: Product, quantity: number = 1) => {
    const existingItem = items.find(item => item.prodotto.id === product.id);
    if (existingItem) {
      setItems(items.map(item => 
        item.prodotto.id === product.id 
          ? { ...item, quantita: item.quantita + quantity }
          : item
      ));
    } else {
      setItems([...items, { prodotto: product, quantita: quantity }]);
    }
    setLastAddedProduct(product);
    setDrawerExpanded(true);
    
    // Auto-scroll to bottom of order list
    setTimeout(() => {
      if (orderListRef.current) {
        orderListRef.current.scrollTop = orderListRef.current.scrollHeight;
      }
    }, 100);
  };

  const removeProduct = (productId: number) => {
    setItems(prev => {
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

  const updateQuantity = (productId: number, quantita: number) => {
    if (quantita <= 0) {
      removeProduct(productId);
    } else {
      setItems(items.map(item => 
        item.prodotto.id === productId 
          ? { ...item, quantita }
          : item
      ));
    }
  };

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.categoria))).sort();
  
  // Get products for selected category
  const categoryProducts = selectedCategory 
    ? products.filter(p => p.categoria === selectedCategory)
    : [];
    
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

  const totalAmount = items.reduce((sum, item) => sum + (item.prodotto.prezzo * item.quantita), 0);

  // Initialize tavoloDestinatario when modal opens with selectedTableId
  useEffect(() => {
    if (isOpen && selectedTableId && !tavoloDestinatario) {
      setTavoloDestinatario(selectedTableId);
    }
  }, [isOpen, selectedTableId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg w-full overflow-hidden ${
        step === 3 ? 'max-w-6xl h-[95vh]' : 'max-w-2xl max-h-[90vh]'
      }`} style={{
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: colors.border.primary }}>
          <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>Ordina per Altri</h2>
          <button 
            onClick={handleClose} 
            className="p-2 rounded-lg transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        <div className={`overflow-y-auto ${
          step === 3 ? 'p-6 max-h-[calc(95vh-80px)]' : 'p-4 max-h-[calc(90vh-120px)]'
        }`}>
          {/* Progress indicator - Hide in step 3 for more space */}
          {step !== 3 && (
            <div className="flex items-center justify-center mb-6">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{
                    backgroundColor: s <= step ? colors.button.primary : colors.bg.hover,
                    color: s <= step ? colors.button.primaryText : colors.text.muted
                  }}>
                    {s}
                  </div>
                  {s < 4 && <div className="w-8 h-0.5" style={{
                    backgroundColor: s < step ? colors.button.primary : colors.bg.hover
                  }} />}
                </div>
              ))}
            </div>
          )}

          {/* Step 1: Cliente ordinante */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
                <User className="h-5 w-5" style={{ color: colors.text.secondary }} />
                Chi sta ordinando?
              </h3>
              <div>
                <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Nome del cliente che ordina</label>
                <input
                  type="text"
                  value={clienteOrdinante}
                  onChange={(e) => setClienteOrdinante(e.target.value)}
                  placeholder="Nome e cognome..."
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: colors.bg.input,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: colors.text.primary
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!clienteOrdinante.trim()}
                  className="px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.button.primary;
                  }}
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Destinatario */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
                <MapPin className="h-5 w-5" style={{ color: colors.text.secondary }} />
                Chi riceverà l'ordine?
              </h3>
              
              {/* Show selected table if coming from table selection */}
              {selectedTableId && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                  <p className="text-sm" style={{ color: colors.text.muted }}>Tavolo selezionato:</p>
                  <p className="font-medium" style={{ color: colors.text.primary }}>
                    Tavolo {tables.find(t => t.id === selectedTableId)?.numero}
                  </p>
                </div>
              )}
              
              <div className="space-y-3">
                {!selectedTableId && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Seleziona tavolo</label>
                    <select
                      value={tavoloDestinatario || ''}
                      onChange={(e) => setTavoloDestinatario(Number(e.target.value))}
                      className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        backgroundColor: colors.bg.input,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        color: colors.text.primary
                      }}
                    >
                      <option value="">Seleziona un tavolo...</option>
                      {tables.map(table => (
                        <option key={table.id} value={table.id}>
                          Tavolo {table.numero} {table.zona && `(${table.zona})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Cliente specifico (opzionale)</label>
                  <input
                    type="text"
                    value={clienteDestinatario}
                    onChange={(e) => setClienteDestinatario(e.target.value)}
                    placeholder="Nome e cognome..."
                    className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      color: colors.text.primary
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.hover,
                    color: colors.text.primary,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  Indietro
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!tavoloDestinatario}
                  className="px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.button.primary;
                  }}
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Selezione prodotti con drawer */}
          {step === 3 && (
            <div className="relative" style={{ minHeight: '600px' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>Seleziona prodotti</h3>
              
              {/* Search Input - Always visible */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  setViewState('search');
                  setSelectedCategory(null);
                }}
                placeholder="Cerca prodotto per nome"
                className="w-full p-4 rounded-lg focus:outline-none focus:ring-2 text-center text-lg mb-4"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                autoFocus
              />
              
              {/* Search Results */}
              {viewState === 'search' && filteredProducts.length > 0 && searchQuery.trim() && (
                <div 
                  className="max-h-64 overflow-y-auto rounded-lg mb-4 grid grid-cols-1 md:grid-cols-2 gap-2 p-2"
                  style={{
                    backgroundColor: colors.bg.darker,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  {filteredProducts.map((product: Product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        addProduct(product);
                        // Don't clear search to allow adding multiple similar products
                      }}
                      className="p-3 text-left transition-colors rounded-lg m-1"
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
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="font-medium" style={{ color: colors.text.primary }}>
                        {product.nome}
                      </div>
                      <div className="text-sm" style={{ color: colors.text.secondary }}>
                        €{product.prezzo.toFixed(2)} • {product.categoria}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Menu Categories Button */}
              {viewState === 'search' && (
                <button
                  type="button"
                  onClick={() => setViewState('categories')}
                  className="w-full p-3 rounded-lg transition-colors font-medium mb-4"
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
              {viewState === 'categories' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setViewState('products');
                      }}
                      className="p-4 rounded-lg transition-all duration-200 hover:scale-105"
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
                      <div className="text-2xl mb-2">{getCategoryEmoji(category)}</div>
                      <div className="font-medium text-sm" style={{ color: colors.text.primary }}>
                        {category}
                      </div>
                      <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                        {products.filter(p => p.categoria === category).length} prodotti
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Products View */}
              {viewState === 'products' && selectedCategory && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => {
                        setViewState('categories');
                        setSelectedCategory(null);
                      }}
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
                    <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                      {selectedCategory}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                    {categoryProducts.map((product) => (
                      <ProductItem
                        key={product.id}
                        product={product}
                        onAdd={(product, quantity) => {
                          addProduct(product, quantity);
                          // Stay in current category to allow adding more products
                        }}
                        colors={colors}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Order Summary */}
              <div className="p-4 rounded-lg mb-4 mt-6" style={{
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.primary,
                borderWidth: '2px',
                borderStyle: 'solid'
              }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ color: colors.text.primary }}>
                    Riepilogo Ordine ({items.length} prodotti)
                  </span>
                  <span className="font-bold text-lg" style={{ color: colors.text.primary }}>
                    €{totalAmount.toFixed(2)}
                  </span>
                </div>
                
                {items.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                    {items.map((item: OrderItem, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded"
                        style={{
                          backgroundColor: colors.bg.card,
                          borderColor: colors.border.secondary,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm" style={{ color: colors.text.primary }}>
                            {item.prodotto.nome}
                          </div>
                          <div className="text-xs" style={{ color: colors.text.secondary }}>
                            €{item.prodotto.prezzo.toFixed(2)} x {item.quantita}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeProduct(item.prodotto.id)}
                            className="p-1 rounded transition-colors"
                            style={{
                              backgroundColor: colors.text.error,
                              color: 'white'
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium" style={{ color: colors.text.primary }}>
                            {item.quantita}
                          </span>
                          <button
                            onClick={() => addProduct(item.prodotto)}
                            className="p-1 rounded transition-colors"
                            style={{
                              backgroundColor: colors.button.success,
                              color: colors.button.successText
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {items.length === 0 && (
                  <div className="text-center py-4">
                    <ShoppingCart 
                      className="h-8 w-8 mx-auto mb-2 opacity-50" 
                      style={{ color: colors.text.muted }} 
                    />
                    <p style={{ color: colors.text.muted }}>Nessun prodotto nell'ordine</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.hover,
                    color: colors.text.primary,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  Indietro
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={items.length === 0}
                  className="px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.button.primary;
                  }}
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Pagamento */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text.primary }}>
                <CreditCard className="h-5 w-5" style={{ color: colors.text.secondary }} />
                Modalità di pagamento
              </h3>
              
              <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                <div className="text-sm mb-2" style={{ color: colors.text.muted }}>Riepilogo ordine:</div>
                <div style={{ color: colors.text.primary }}>
                  <strong>Ordinante:</strong> {clienteOrdinante}
                </div>
                <div style={{ color: colors.text.primary }}>
                  <strong>Destinatario:</strong> {
                    destinationType === 'tavolo' 
                      ? `Tavolo ${tables.find(t => t.id === tavoloDestinatario)?.numero}`
                      : clienteDestinatario
                  }
                </div>
                <div style={{ color: colors.text.primary }}>
                  <strong>Totale:</strong> €{totalAmount.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>Modalità di pagamento</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setPagamentoImmediato(true)}
                    className="w-full p-3 rounded-lg border text-left transition-colors"
                    style={{
                      backgroundColor: pagamentoImmediato ? colors.button.primary : colors.bg.card,
                      borderColor: pagamentoImmediato ? colors.button.primary : colors.border.primary,
                      color: pagamentoImmediato ? colors.button.primaryText : colors.text.secondary
                    }}
                  >
                    <div className="font-medium">Pagamento immediato</div>
                    <div className="text-sm" style={{ opacity: 0.8 }}>Il cliente paga subito l'ordine</div>
                  </button>
                  <button
                    onClick={() => setPagamentoImmediato(false)}
                    className="w-full p-3 rounded-lg border text-left transition-colors"
                    style={{
                      backgroundColor: !pagamentoImmediato ? colors.button.primary : colors.bg.card,
                      borderColor: !pagamentoImmediato ? colors.button.primary : colors.border.primary,
                      color: !pagamentoImmediato ? colors.button.primaryText : colors.text.secondary
                    }}
                  >
                    <div className="font-medium">Aggiungi al conto</div>
                    <div className="text-sm" style={{ opacity: 0.8 }}>L'importo viene aggiunto al conto di {clienteOrdinante}</div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.hover,
                    color: colors.text.primary,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  Indietro
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 rounded-lg transition-colors"
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
                  Conferma Ordine
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}