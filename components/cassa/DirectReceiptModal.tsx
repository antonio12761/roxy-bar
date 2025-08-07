"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Minus, CreditCard, Banknote, Loader2, CheckCircle, ShoppingCart, Filter } from "lucide-react";
import { getProdotti } from "@/lib/actions/ordinazioni/prodotti";
import { creaSconsintrinoDiretto } from "@/lib/actions/scontrino-diretto";
import { useToast } from "@/lib/toast-notifications";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  disponibile: boolean;
  terminato: boolean;
}

interface CartItem extends Product {
  quantita: number;
}

interface DirectReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DirectReceiptModal({ isOpen, onClose, onSuccess }: DirectReceiptModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("TUTTI");
  const [paymentMethod, setPaymentMethod] = useState<"CONTANTI" | "CARTA">("CONTANTI");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCart, setShowCart] = useState(false); // Mobile cart toggle
  const [showCategories, setShowCategories] = useState(false); // Mobile categories toggle
  const { success: showSuccess, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      // Reset mobile states
      setShowCart(false);
      setShowCategories(false);
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getProdotti();
      setProducts(data.filter((p: any) => p.disponibile && !p.terminato));
    } catch (error) {
      showError("Errore nel caricamento prodotti");
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.categoria));
    return ["TUTTI", ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "TUTTI" || p.categoria === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantita: item.quantita + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantita: 1 }];
    });
    
    // On mobile, show a brief cart indicator
    if (window.innerWidth < 768) {
      const cartButton = document.getElementById('mobile-cart-button');
      if (cartButton) {
        cartButton.classList.add('animate-bounce');
        setTimeout(() => cartButton.classList.remove('animate-bounce'), 500);
      }
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantita + delta;
          if (newQuantity <= 0) {
            return null;
          }
          return { ...item, quantita: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.prezzo * item.quantita), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantita, 0);
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      showError("Aggiungi almeno un prodotto");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await creaSconsintrinoDiretto({
        items: cart.map(item => ({
          prodottoId: item.id.toString(),
          quantita: item.quantita,
          prezzo: item.prezzo
        })),
        modalitaPagamento: paymentMethod,
        totale: calculateTotal()
      });

      if (result.success) {
        showSuccess("Scontrino creato con successo");
        setCart([]);
        onSuccess?.();
        onClose();
      } else {
        showError(result.error || "Errore nella creazione dello scontrino");
      }
    } catch (error) {
      showError("Errore nella creazione dello scontrino");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* Main Container - Full screen on mobile */}
      <div className="bg-white dark:bg-gray-800 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-lg flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <h2 className="text-lg md:text-xl font-semibold">Scontrino Diretto</h2>
          <div className="flex items-center gap-2">
            {/* Mobile Cart Button */}
            <button
              id="mobile-cart-button"
              onClick={() => setShowCart(!showCart)}
              className="md:hidden relative p-2 bg-blue-500 text-white rounded-lg"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getTotalItems()}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          {showCart ? (
            /* Mobile Cart View */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 dark:text-gray-400">Carrello vuoto</p>
                    <button
                      onClick={() => setShowCart(false)}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
                    >
                      Aggiungi Prodotti
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium">{item.nome}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              €{item.prezzo.toFixed(2)} cad.
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center shadow"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center font-medium">{item.quantita}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center shadow"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="font-semibold">
                            €{(item.prezzo * item.quantita).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Payment Section */}
              {cart.length > 0 && (
                <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Totale:</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      €{calculateTotal().toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPaymentMethod("CONTANTI")}
                      className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                        paymentMethod === "CONTANTI"
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      <Banknote className="w-5 h-5" />
                      <span className="font-medium">Contanti</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("CARTA")}
                      className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                        paymentMethod === "CARTA"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="font-medium">Carta</span>
                    </button>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Elaborazione...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Conferma Pagamento
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Mobile Products View */
            <div className="flex-1 flex flex-col">
              {/* Search and Filter */}
              <div className="p-3 space-y-3 bg-gray-50 dark:bg-gray-900">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Cerca prodotto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <button
                    onClick={() => setShowCategories(!showCategories)}
                    className={`px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${
                      showCategories ? "bg-blue-500 text-white" : "bg-white dark:bg-gray-700 border dark:border-gray-600"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                </div>

                {/* Categories - Collapsible on mobile */}
                {showCategories && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setShowCategories(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                          selectedCategory === cat
                            ? "bg-blue-500 text-white"
                            : "bg-white dark:bg-gray-700 border dark:border-gray-600"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {selectedCategory !== "TUTTI" && !showCategories && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Categoria:</span>
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                      {selectedCategory}
                    </span>
                    <button
                      onClick={() => setSelectedCategory("TUTTI")}
                      className="text-sm text-blue-500 underline"
                    >
                      Rimuovi
                    </button>
                  </div>
                )}
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="p-3 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg text-left active:scale-95 transition-transform"
                      >
                        <div className="font-medium text-sm mb-1">{product.nome}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {product.categoria}
                        </div>
                        <div className="text-base font-bold text-green-600 dark:text-green-400">
                          €{product.prezzo.toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop/Tablet View */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {/* Product selection */}
          <div className="flex-1 border-r dark:border-gray-700 flex flex-col">
            <div className="p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cerca prodotto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Categories */}
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="p-3 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                    >
                      <div className="font-medium text-sm">{product.nome}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {product.categoria}
                      </div>
                      <div className="text-sm font-semibold mt-2 text-green-600 dark:text-green-400">
                        €{product.prezzo.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart - Desktop */}
          <div className="w-80 lg:w-96 flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Carrello
                {cart.length > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-sm px-2 py-0.5 rounded-full">
                    {getTotalItems()} articoli
                  </span>
                )}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nessun prodotto nel carrello</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.nome}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          €{item.prezzo.toFixed(2)} cad.
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-medium text-sm">{item.quantita}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold">
                        €{(item.prezzo * item.quantita).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment section - Desktop */}
            <div className="border-t dark:border-gray-700 p-4 space-y-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Totale:</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  €{calculateTotal().toFixed(2)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod("CONTANTI")}
                  className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors ${
                    paymentMethod === "CONTANTI"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  Contanti
                </button>
                <button
                  onClick={() => setPaymentMethod("CARTA")}
                  className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors ${
                    paymentMethod === "CARTA"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Carta
                </button>
              </div>

              <button
                onClick={handlePayment}
                disabled={cart.length === 0 || isProcessing}
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Conferma Pagamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}