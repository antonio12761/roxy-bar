import React, { useState, useEffect } from 'react';
import { X, Euro, User, CreditCard, Banknote, Coins, Printer } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { searchClienti, getRecentClienti } from '@/lib/actions/clienti-autocomplete';
import { usePrinterSettings } from '@/hooks/usePrinterSettings';

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
  };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
  pagatoDa?: string;
  configurazione?: {
    selezioni?: any[];
  };
}

interface Order {
  id: string;
  numero: number;
  righe: OrderItem[];
  totale: number;
  totalePagato: number;
  rimanente: number;
  pagamenti?: any[];
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
  
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [clienteNome, setClienteNome] = useState('');
  const [modalitaPagamento, setModalitaPagamento] = useState<'POS' | 'CONTANTI' | 'MISTO'>('POS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stampaScontrino, setStampaScontrino] = useState(true);
  const [allClienti, setAllClienti] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && order) {
      // Reset state
      setSelectedItems(new Map());
      setClienteNome('');
      setModalitaPagamento('POS');
      setStampaScontrino(printerSettings.autoprint || printerSettings.defaultEnabled);
      
      // Carica clienti recenti
      getRecentClienti().then(setAllClienti);
      
      // Blocca scroll del body
      document.body.classList.add('modal-open');
    }
    
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, order, printerSettings]);

  // Aggiorna suggerimenti mentre digita (con debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (clienteNome.length >= 2) {
        const results = await searchClienti(clienteNome);
        setAllClienti(results);
      } else if (clienteNome.length === 0) {
        const recent = await getRecentClienti();
        setAllClienti(recent);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [clienteNome]);

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

  const handleSelectAll = () => {
    if (selectedItems.size === righeNonPagate.length) {
      setSelectedItems(new Map());
    } else {
      const newItems = new Map();
      righeNonPagate.forEach(item => {
        newItems.set(item.id, item.quantita);
      });
      setSelectedItems(newItems);
    }
  };

  const handleConfirm = async () => {
    if (selectedItems.size === 0 || !clienteNome.trim()) return;
    
    setIsProcessing(true);
    try {
      const items: SelectedItem[] = Array.from(selectedItems.entries()).map(([id, quantita]) => {
        const riga = righeNonPagate.find(r => r.id === id)!;
        return { id, quantita, prezzo: riga.prezzo };
      });
      
      await onConfirmPayment(items, clienteNome.trim(), modalitaPagamento, stampaScontrino);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-lg" style={{ backgroundColor: colors.bg.card }}>
        {/* Header */}
        <div className="modal-header" style={{ borderColor: colors.border.primary }}>
          <div className="flex-1 mr-2">
            <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
              Pagamento Parziale - Ordine #{order.numero}
            </h2>
          </div>
          <button onClick={onClose} className="p-2">
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        <div className="modal-body">
          {/* Selezione articoli */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium" style={{ color: colors.text.primary }}>
                Articoli da pagare
              </h3>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 text-sm rounded-lg"
                style={{
                  backgroundColor: selectedItems.size === righeNonPagate.length 
                    ? colors.button.primary 
                    : colors.bg.hover,
                  color: selectedItems.size === righeNonPagate.length 
                    ? colors.button.primaryText 
                    : colors.text.primary
                }}
              >
                {selectedItems.size === righeNonPagate.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
              </button>
            </div>

            <div className="space-y-2">
              {righeNonPagate.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id, item.quantita)}
                  className="p-3 rounded-lg border cursor-pointer"
                  style={{
                    borderColor: selectedItems.has(item.id) 
                      ? colors.button.primary 
                      : colors.border.primary,
                    backgroundColor: selectedItems.has(item.id) 
                      ? colors.button.primary + '10' 
                      : colors.bg.card
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        {item.prodotto.nome}
                      </span>
                      <span className="ml-2 text-sm" style={{ color: colors.text.secondary }}>
                        x{item.quantita}
                      </span>
                    </div>
                    <span className="font-medium" style={{ color: colors.text.primary }}>
                      €{(item.prezzo * item.quantita).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nome Cliente con datalist nativo */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Nome Cliente *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                style={{ color: colors.text.secondary }}
              />
              <input
                type="text"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                list="clienti-datalist"
                placeholder="Inserisci o seleziona il nome del cliente"
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{
                  borderColor: colors.border.primary,
                  backgroundColor: colors.bg.card,
                  color: colors.text.primary,
                  fontSize: '16px'
                }}
              />
              <datalist id="clienti-datalist">
                {allClienti.map((cliente, index) => (
                  <option key={index} value={cliente} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Modalità Pagamento */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Modalità di Pagamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['POS', 'CONTANTI', 'MISTO'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setModalitaPagamento(mode)}
                  className="p-3 rounded-lg border flex flex-col items-center gap-1"
                  style={{
                    borderColor: modalitaPagamento === mode ? colors.button.primary : colors.border.primary,
                    backgroundColor: modalitaPagamento === mode ? colors.button.primary : colors.bg.card,
                    color: modalitaPagamento === mode ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  {mode === 'POS' && <CreditCard className="h-5 w-5" />}
                  {mode === 'CONTANTI' && <Banknote className="h-5 w-5" />}
                  {mode === 'MISTO' && <Coins className="h-5 w-5" />}
                  <span className="text-sm font-medium">{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Opzione Stampa */}
          {printerSettings.showConfirmDialog && !printerSettings.autoprint && (
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stampaScontrino}
                  onChange={(e) => {
                    setStampaScontrino(e.target.checked);
                    updatePrinterSettings({ defaultEnabled: e.target.checked });
                  }}
                  className="w-5 h-5"
                />
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4" style={{ color: colors.text.secondary }} />
                  <span className="text-sm" style={{ color: colors.text.primary }}>
                    Stampa scontrino
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderColor: colors.border.primary }}>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm" style={{ color: colors.text.secondary }}>
                Totale selezionato:
              </span>
              <span className="text-2xl font-bold ml-2" style={{ color: colors.text.primary }}>
                €{totaleSelezionato.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-lg border"
                style={{
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedItems.size === 0 || !clienteNome.trim() || isProcessing}
                className="px-6 py-2 rounded-lg disabled:opacity-50"
                style={{
                  backgroundColor: colors.button.primary,
                  color: colors.button.primaryText
                }}
              >
                {isProcessing ? 'Elaborazione...' : 'Conferma Pagamento'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}