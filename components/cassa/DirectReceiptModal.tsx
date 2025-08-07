"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Minus, CreditCard, Banknote, Loader2, CheckCircle } from "lucide-react";
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
  const { success: showSuccess, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadProducts();
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">Crea Scontrino Diretto</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Product selection */}
          <div className="flex-1 border-r dark:border-gray-700 flex flex-col">
            <div className="p-4 space-y-3">
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
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
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
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                      <div className="text-sm font-semibold mt-2">
                        €{product.prezzo.toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="w-96 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-semibold">Carrello</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Nessun prodotto nel carrello
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.nome}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          €{item.prezzo.toFixed(2)} cad.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantita}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold">
                        €{(item.prezzo * item.quantita).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment section */}
            <div className="border-t dark:border-gray-700 p-4 space-y-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Totale:</span>
                <span>€{calculateTotal().toFixed(2)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod("CONTANTI")}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    paymentMethod === "CONTANTI"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  Contanti
                </button>
                <button
                  onClick={() => setPaymentMethod("CARTA")}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                    paymentMethod === "CARTA"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  Carta
                </button>
              </div>

              <button
                onClick={handlePayment}
                disabled={cart.length === 0 || isProcessing}
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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