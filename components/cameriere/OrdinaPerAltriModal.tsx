"use client";

import { useState } from "react";
import { X, User, MapPin, CreditCard, Plus } from "lucide-react";

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
}

export function OrdinaPerAltriModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  products, 
  tables 
}: OrdinaPerAltriModalProps) {
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
  
  // Step 4: Pagamento
  const [pagamentoImmediato, setPagamentoImmediato] = useState(true);

  const resetModal = () => {
    setStep(1);
    setClienteOrdinante("");
    setDestinationType('tavolo');
    setTavoloDestinatario(undefined);
    setClienteDestinatario("");
    setItems([]);
    setSearchQuery("");
    setPagamentoImmediato(true);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      clienteOrdinante,
      destinationType,
      tavoloDestinatario,
      clienteDestinatario,
      items,
      pagamentoImmediato
    });
    resetModal();
  };

  const addProduct = (product: Product) => {
    const existingItem = items.find(item => item.prodotto.id === product.id);
    if (existingItem) {
      setItems(items.map(item => 
        item.prodotto.id === product.id 
          ? { ...item, quantita: item.quantita + 1 }
          : item
      ));
    } else {
      setItems([...items, { prodotto: product, quantita: 1 }]);
    }
  };

  const removeProduct = (productId: number) => {
    setItems(items.filter(item => item.prodotto.id !== productId));
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

  const totalAmount = items.reduce((sum, item) => sum + (item.prodotto.prezzo * item.quantita), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-foreground">Ordina per Altri</h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Progress indicator */}
          <div className="flex items-center justify-center mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step ? 'bg-white/20 text-white' : 'bg-slate-600 text-muted-foreground'
                }`}>
                  {s}
                </div>
                {s < 4 && <div className={`w-8 h-0.5 ${
                  s < step ? 'bg-white/20' : 'bg-slate-600'
                }`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Cliente ordinante */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-white/70" />
                Chi sta ordinando?
              </h3>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Nome del cliente che ordina</label>
                <input
                  type="text"
                  value={clienteOrdinante}
                  onChange={(e) => setClienteOrdinante(e.target.value)}
                  placeholder="Nome e cognome..."
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!clienteOrdinante.trim()}
                  className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/25-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Destinatario */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-5 w-5 text-white/70" />
                Chi riceverà l'ordine?
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Tipo destinatario</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDestinationType('tavolo')}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        destinationType === 'tavolo'
                          ? 'bg-white/20 text-white border-white/20-600'
                          : 'bg-slate-700 border-slate-600 text-muted-foreground hover:bg-slate-600'
                      }`}
                    >
                      Tavolo
                    </button>
                    <button
                      onClick={() => setDestinationType('cliente')}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        destinationType === 'cliente'
                          ? 'bg-white/20 text-white border-white/20-600'
                          : 'bg-slate-700 border-slate-600 text-muted-foreground hover:bg-slate-600'
                      }`}
                    >
                      Cliente specifico
                    </button>
                  </div>
                </div>

                {destinationType === 'tavolo' && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Seleziona tavolo</label>
                    <select
                      value={tavoloDestinatario || ''}
                      onChange={(e) => setTavoloDestinatario(Number(e.target.value))}
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
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

                {destinationType === 'cliente' && (
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Nome del cliente destinatario</label>
                    <input
                      type="text"
                      value={clienteDestinatario}
                      onChange={(e) => setClienteDestinatario(e.target.value)}
                      placeholder="Nome e cognome..."
                      className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                >
                  Indietro
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={
                    (destinationType === 'tavolo' && !tavoloDestinatario) ||
                    (destinationType === 'cliente' && !clienteDestinatario.trim())
                  }
                  className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/25-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Selezione prodotti */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Seleziona prodotti</h3>
              
              {/* Search */}
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca prodotti..."
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Product list */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <div>
                      <div className="font-medium text-foreground">{product.nome}</div>
                      <div className="text-sm text-muted-foreground">{product.categoria} • €{product.prezzo.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={() => addProduct(product)}
                      className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/25-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Selected items */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Prodotti selezionati:</h4>
                  {items.map(item => (
                    <div key={item.prodotto.id} className="flex items-center justify-between p-2 bg-slate-600 rounded">
                      <span className="text-foreground">{item.prodotto.nome}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.prodotto.id, item.quantita - 1)}
                          className="w-6 h-6 bg-slate-500 rounded text-white text-sm"
                        >
                          -
                        </button>
                        <span className="text-foreground min-w-[20px] text-center">{item.quantita}</span>
                        <button
                          onClick={() => updateQuantity(item.prodotto.id, item.quantita + 1)}
                          className="w-6 h-6 bg-slate-500 rounded text-white text-sm"
                        >
                          +
                        </button>
                        <span className="text-foreground ml-2">€{(item.prodotto.prezzo * item.quantita).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-right font-bold text-foreground">
                    Totale: €{totalAmount.toFixed(2)}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                >
                  Indietro
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={items.length === 0}
                  className="px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/25-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continua
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Pagamento */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-white/70" />
                Modalità di pagamento
              </h3>
              
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-2">Riepilogo ordine:</div>
                <div className="text-foreground">
                  <strong>Ordinante:</strong> {clienteOrdinante}
                </div>
                <div className="text-foreground">
                  <strong>Destinatario:</strong> {
                    destinationType === 'tavolo' 
                      ? `Tavolo ${tables.find(t => t.id === tavoloDestinatario)?.numero}`
                      : clienteDestinatario
                  }
                </div>
                <div className="text-foreground">
                  <strong>Totale:</strong> €{totalAmount.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Modalità di pagamento</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setPagamentoImmediato(true)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      pagamentoImmediato
                        ? 'bg-white/20 text-white border-white/20-600'
                        : 'bg-slate-700 border-slate-600 text-muted-foreground hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-medium">Pagamento immediato</div>
                    <div className="text-sm opacity-80">Il cliente paga subito l'ordine</div>
                  </button>
                  <button
                    onClick={() => setPagamentoImmediato(false)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      !pagamentoImmediato
                        ? 'bg-white/20 text-white border-white/20-600'
                        : 'bg-slate-700 border-slate-600 text-muted-foreground hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-medium">Aggiungi al conto</div>
                    <div className="text-sm opacity-80">L'importo viene aggiunto al conto di {clienteOrdinante}</div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                >
                  Indietro
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
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