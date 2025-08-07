import React, { useState, useEffect, useRef } from 'react';
import { X, Euro, User, CreditCard, Banknote, Coins, Printer } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { getRecentClienti } from '@/lib/actions/clienti-autocomplete';
import { usePrinterSettings } from '@/hooks/usePrinterSettings';

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
}

interface Order {
  id: string;
  numero: number;
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
}

interface SelectedItem {
  id: string;
  quantita: number;
  prezzo: number;
}

interface SimplePartialPaymentModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirmPayment: (selectedItems: SelectedItem[], clienteNome: string, modalita: 'POS' | 'CONTANTI' | 'MISTO', stampaScontrino?: boolean) => Promise<void>;
}

export function SimplePartialPaymentModal({
  isOpen,
  order,
  onClose,
  onConfirmPayment
}: SimplePartialPaymentModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { settings: printerSettings, updateSettings: updatePrinterSettings } = usePrinterSettings();
  
  // Stati essenziali
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [clienteNome, setClienteNome] = useState('');
  const [modalitaPagamento, setModalitaPagamento] = useState<'POS' | 'CONTANTI' | 'MISTO'>('POS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stampaScontrino, setStampaScontrino] = useState(true);
  const [clientiRecenti, setClientiRecenti] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Ref per mantenere il valore dell'input
  const inputRef = useRef<HTMLInputElement>(null);
  const clienteNomeRef = useRef(clienteNome);
  
  // Aggiorna il ref quando cambia il valore
  useEffect(() => {
    clienteNomeRef.current = clienteNome;
  }, [clienteNome]);

  useEffect(() => {
    if (isOpen && order) {
      // Reset state
      setSelectedItems(new Map());
      setClienteNome('');
      clienteNomeRef.current = '';
      setModalitaPagamento('POS');
      setStampaScontrino(printerSettings.autoprint || printerSettings.defaultEnabled);
      setShowDropdown(false);
      
      // Carica clienti recenti
      getRecentClienti().then(setClientiRecenti);
      
      // Blocca scroll del body
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, order, printerSettings]);

  if (!isOpen || !order) return null;

  const righeNonPagate = order.righe.filter(r => !r.isPagato);
  const totaleSelezionato = Array.from(selectedItems.entries()).reduce((sum, [id, quantita]) => {
    const riga = righeNonPagate.find(r => r.id === id);
    return sum + (riga ? riga.prezzo * quantita : 0);
  }, 0);

  const handleToggleItem = (itemId: string, maxQuantita: number) => {
    const newItems = new Map(selectedItems);
    if (newItems.has(itemId)) {
      newItems.delete(itemId);
    } else {
      newItems.set(itemId, maxQuantita);
    }
    setSelectedItems(newItems);
  };

  const handleConfirm = async () => {
    // Usa il ref per ottenere il valore corrente
    const currentClienteNome = clienteNomeRef.current || clienteNome;
    
    if (selectedItems.size === 0 || !currentClienteNome.trim()) {
      alert('Seleziona almeno un articolo e inserisci il nome del cliente');
      return;
    }
    
    setIsProcessing(true);
    try {
      const items: SelectedItem[] = Array.from(selectedItems.entries()).map(([id, quantita]) => {
        const riga = righeNonPagate.find(r => r.id === id)!;
        return { id, quantita, prezzo: riga.prezzo };
      });
      
      await onConfirmPayment(items, currentClienteNome.trim(), modalitaPagamento, stampaScontrino);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // Gestione checkbox con toggle diretto
  const toggleStampaScontrino = () => {
    const newValue = !stampaScontrino;
    setStampaScontrino(newValue);
    updatePrinterSettings({ defaultEnabled: newValue });
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - FISSO */}
        <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-semibold">
            Pagamento Parziale - Ordine #{order.numero}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body - SCROLLABILE */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Selezione articoli */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Articoli da pagare</h3>
            <div className="space-y-2">
              {righeNonPagate.map(item => (
                <label
                  key={item.id}
                  className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedItems.has(item.id) 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => handleToggleItem(item.id, item.quantita)}
                    className="sr-only"
                  />
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{item.prodotto.nome}</span>
                      <span className="ml-2 text-sm text-gray-500">x{item.quantita}</span>
                    </div>
                    <span className="font-medium">€{(item.prezzo * item.quantita).toFixed(2)}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Nome Cliente - SEMPLIFICATO AL MASSIMO */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Nome Cliente *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={clienteNome}
              onChange={(e) => {
                const value = e.target.value;
                setClienteNome(value);
                clienteNomeRef.current = value;
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                // Delay maggiore per Android PWA
                setTimeout(() => {
                  setShowDropdown(false);
                }, 300);
              }}
              placeholder="Inserisci il nome del cliente"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
            />
            
            {/* Dropdown clienti recenti - SEMPLICE */}
            {showDropdown && clientiRecenti.length > 0 && (
              <div className="mt-1 border rounded-lg bg-white dark:bg-gray-800 shadow-lg max-h-40 overflow-y-auto">
                {clientiRecenti.map((cliente, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setClienteNome(cliente);
                      clienteNomeRef.current = cliente;
                      setShowDropdown(false);
                      // Blur immediato per chiudere la tastiera
                      if (inputRef.current) {
                        inputRef.current.blur();
                      }
                    }}
                    onTouchEnd={(e) => {
                      // Per Android, previeni comportamenti default del touch
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {cliente}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Modalità Pagamento */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Modalità di Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setModalitaPagamento('POS')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${
                  modalitaPagamento === 'POS' 
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-sm">POS</span>
              </button>
              
              <button
                type="button"
                onClick={() => setModalitaPagamento('CONTANTI')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${
                  modalitaPagamento === 'CONTANTI' 
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span className="text-sm">CONTANTI</span>
              </button>
              
              <button
                type="button"
                onClick={() => setModalitaPagamento('MISTO')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${
                  modalitaPagamento === 'MISTO' 
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <Coins className="h-5 w-5" />
                <span className="text-sm">MISTO</span>
              </button>
            </div>
          </div>

          {/* Checkbox Stampa - ULTRA SEMPLIFICATO */}
          {printerSettings.showConfirmDialog && !printerSettings.autoprint && (
            <div className="mb-6">
              <button
                type="button"
                onClick={toggleStampaScontrino}
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  stampaScontrino 
                    ? 'bg-orange-500 border-orange-500' 
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
                }`}>
                  {stampaScontrino && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 text-left">
                  <Printer className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Stampa scontrino</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer - FISSO */}
        <div className="p-4 border-t flex justify-between items-center flex-shrink-0">
          <div>
            <span className="text-sm text-gray-500">Totale selezionato:</span>
            <span className="text-2xl font-bold ml-2">€{totaleSelezionato.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Elaborazione...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}