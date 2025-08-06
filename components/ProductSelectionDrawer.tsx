"use client";

import { useState, useEffect } from "react";
import { X, ShoppingCart, CreditCard, Euro, Check, Minus, Plus } from "lucide-react";
import { creaPagamentoRigheSpecifiche } from "@/lib/actions/pagamenti";
import { toast } from "@/lib/toast";

interface ProductItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
  ordinazioneId: string;
  tavoloNumero?: string;
}

export interface SelectionMode {
  type: 'all' | 'table' | 'customer' | 'order' | 'product';
  label: string;
  description: string;
}

interface ProductSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onPaymentComplete?: () => void;
}

export default function ProductSelectionDrawer({
  isOpen,
  onClose,
  products,
  onPaymentComplete
}: ProductSelectionDrawerProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState<"POS" | "CONTANTI" | "MISTO">("POS");
  const [customerName, setCustomerName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode['type']>('product');
  const [showSplitSuggestion, setShowSplitSuggestion] = useState(false);
  
  // Modalità di selezione disponibili
  const selectionModes: SelectionMode[] = [
    { type: 'all', label: 'Tutto', description: 'Tutti i prodotti di tutti i tavoli' },
    { type: 'table', label: 'Per Tavolo', description: 'Tutti i prodotti di un tavolo specifico' },
    { type: 'customer', label: 'Per Cliente', description: 'Prodotti associati a un cliente' },
    { type: 'order', label: 'Per Ordinazione', description: 'Tutti i prodotti di una singola ordinazione' },
    { type: 'product', label: 'Prodotto Singolo', description: 'Selezione manuale prodotto per prodotto' }
  ];

  // Reset when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedProducts(new Set());
      setCustomerName("");
    }
  }, [isOpen]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Funzioni di selezione avanzate
  const selectAllProducts = () => {
    const availableProductIds = products
      .filter(p => !p.isPagato)
      .map(p => p.id);
    setSelectedProducts(new Set(availableProductIds));
  };

  const selectByTable = (tableNumber: string) => {
    const tableProductIds = products
      .filter(p => !p.isPagato && p.tavoloNumero === tableNumber)
      .map(p => p.id);
    setSelectedProducts(new Set(tableProductIds));
  };

  const selectByCustomer = (customerName: string) => {
    // Implementazione per cliente specifico
    const customerProductIds = products
      .filter(p => !p.isPagato && (p.pagatoDa === customerName || p.ordinazioneId.includes(customerName)))
      .map(p => p.id);
    setSelectedProducts(new Set(customerProductIds));
  };

  const selectByOrder = (orderId: string) => {
    const orderProductIds = products
      .filter(p => !p.isPagato && p.ordinazioneId === orderId)
      .map(p => p.id);
    setSelectedProducts(new Set(orderProductIds));
  };

  const calculateEqualSplit = () => {
    const total = calculateTotal();
    const uniqueCustomers = [...new Set(products.map(p => p.ordinazioneId))].length;
    return uniqueCustomers > 1 ? total / uniqueCustomers : total;
  };

  const suggestEqualSplit = () => {
    const total = calculateTotal();
    const availableProducts = products.filter(p => !p.isPagato);
    const uniqueOrders = [...new Set(availableProducts.map(p => p.ordinazioneId))];
    
    if (uniqueOrders.length > 1) {
      const perPerson = total / uniqueOrders.length;
      setShowSplitSuggestion(true);
      return { perPerson, totalPeople: uniqueOrders.length, total };
    }
    return null;
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const calculateTotal = () => {
    return products
      .filter(p => selectedProducts.has(p.id))
      .reduce((sum, p) => sum + (p.prezzo * p.quantita), 0);
  };

  const handlePayment = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Seleziona almeno un prodotto");
      return;
    }

    setIsProcessing(true);
    
    try {
      const result = await creaPagamentoRigheSpecifiche(
        Array.from(selectedProducts),
        paymentMethod,
        customerName || undefined
      );

      if (result.success) {
        toast.success(`Pagamento completato! Totale: €${result.totaleImporto?.toFixed(2) || '0.00'}`);
        onPaymentComplete?.();
        onClose();
      } else {
        toast.error(result.error || "Errore durante il pagamento");
      }
    } catch (error) {
      console.error("Errore pagamento:", error);
      toast.error("Errore durante il pagamento");
    } finally {
      setIsProcessing(false);
    }
  };

  const groupedProducts = products.reduce((acc, product) => {
    const key = product.tavoloNumero || 'Asporto';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(product);
    return acc;
  }, {} as Record<string, ProductItem[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full max-h-[80vh] rounded-t-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Selezione Prodotti</h2>
            <span className="text-sm text-muted-foreground">
              ({selectedProducts.size} selezionati)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selection Mode Controls */}
        <div className="p-4 border-b bg-gray-50">
          {/* Selection Mode Tabs */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Modalità di Selezione:</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {selectionModes.map((mode) => (
                <button
                  key={mode.type}
                  onClick={() => setSelectionMode(mode.type)}
                  className={`p-2 text-xs rounded-lg border transition-colors ${
                    selectionMode === mode.type
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Quick Actions based on mode */}
          <div className="flex flex-wrap gap-2 mb-3">
            {selectionMode === 'all' && (
              <button
                onClick={selectAllProducts}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
              >
                Seleziona Tutto
              </button>
            )}
            
            {selectionMode === 'table' && (
              <>
                {[...new Set(products.map(p => p.tavoloNumero))].map(table => (
                  <button
                    key={table}
                    onClick={() => selectByTable(table || 'Asporto')}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200"
                  >
                    Tavolo {table || 'Asporto'}
                  </button>
                ))}
              </>
            )}
            
            {selectionMode === 'order' && (
              <>
                {[...new Set(products.map(p => p.ordinazioneId))].map(orderId => (
                  <button
                    key={orderId}
                    onClick={() => selectByOrder(orderId)}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md text-sm hover:bg-purple-200"
                  >
                    Ordine #{orderId.slice(-4)}
                  </button>
                ))}
              </>
            )}
            
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              Deseleziona Tutto
            </button>
            
            <button
              onClick={() => {
                const suggestion = suggestEqualSplit();
                if (suggestion) setShowSplitSuggestion(true);
              }}
              className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md text-sm hover:bg-yellow-200"
            >
              Divisione Equa
            </button>
          </div>
          
          {/* Customer Name Input */}
          <input
            type="text"
            placeholder="Nome cliente (opzionale)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(groupedProducts).map(([tableNumber, tableProducts]) => (
            <div key={tableNumber} className="mb-6">
              <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {tableNumber === 'Asporto' ? 'A' : tableNumber}
                </div>
                Tavolo {tableNumber}
              </h3>
              
              <div className="space-y-2">
                {tableProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      product.isPagato
                        ? 'bg-gray-50 opacity-60 border-gray-200'
                        : selectedProducts.has(product.id)
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      {product.isPagato ? (
                        <div className="w-5 h-5 bg-green-100 text-green-600 rounded flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          className="w-5 h-5 text-blue-600 rounded"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-medium ${product.isPagato ? 'line-through text-gray-500' : ''}`}>
                            {product.quantita}x {product.prodotto.nome}
                          </div>
                          {product.isPagato && product.pagatoDa && (
                            <div className="text-xs text-green-600">
                              Pagato da {product.pagatoDa}
                            </div>
                          )}
                        </div>
                        <div className={`font-semibold ${product.isPagato ? 'text-gray-500' : 'text-gray-900'}`}>
                          €{(product.prezzo * product.quantita).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Split Suggestion Modal */}
        {showSplitSuggestion && (() => {
          const suggestion = suggestEqualSplit();
          return suggestion ? (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Suggerimento Divisione Equa</h3>
                <div className="space-y-2 mb-4">
                  <div>Totale: €{suggestion.total.toFixed(2)}</div>
                  <div>Persone: {suggestion.totalPeople}</div>
                  <div className="font-semibold">Per persona: €{suggestion.perPerson.toFixed(2)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Implementare logica di divisione equa
                      setShowSplitSuggestion(false);
                    }}
                    className="flex-1 bg-primary text-white py-2 rounded hover:bg-primary/90"
                  >
                    Applica
                  </button>
                  <button
                    onClick={() => setShowSplitSuggestion(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {/* Payment Footer */}
        <div className="border-t bg-white p-4">
          {/* Receipt Preview */}
          {selectedProducts.size > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium mb-2">Anteprima Scontrino:</div>
              <div className="text-xs font-mono bg-white p-2 rounded border">
                <div className="text-center border-b pb-1 mb-2">
                  <div className="font-bold">Roxy Bar</div>
                  <div className="text-xs">{new Date().toLocaleString()}</div>
                </div>
                {products
                  .filter(p => selectedProducts.has(p.id))
                  .map(product => (
                    <div key={product.id} className="flex justify-between text-xs">
                      <span>{product.quantita}x {product.prodotto.nome}</span>
                      <span>€{(product.prezzo * product.quantita).toFixed(2)}</span>
                    </div>
                  ))
                }
                <div className="border-t pt-1 mt-2 flex justify-between font-bold">
                  <span>TOTALE:</span>
                  <span>€{calculateTotal().toFixed(2)}</span>
                </div>
                <div className="text-center text-xs mt-2 pt-1 border-t">
                  Pagamento: {paymentMethod}
                  {customerName && ` • Cliente: ${customerName}`}
                </div>
              </div>
            </div>
          )}
          
          {/* Payment Method Selection */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Metodo di Pagamento:</div>
            <div className="flex gap-2">
              {(['POS', 'CONTANTI', 'MISTO'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Total and Pay Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-gray-600" />
              <span className="text-lg font-bold">
                Totale: €{calculateTotal().toFixed(2)}
              </span>
            </div>
            
            <button
              onClick={handlePayment}
              disabled={selectedProducts.size === 0 || isProcessing}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium ${
                selectedProducts.size === 0 || isProcessing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              {isProcessing ? 'Elaborazione...' : 'Paga Selezionati'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}