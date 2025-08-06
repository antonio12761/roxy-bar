'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Package, Plus, Trash2 } from 'lucide-react';
import { handleOutOfStockResponse } from '@/lib/actions/out-of-stock';
import { toast } from 'sonner';

interface OutOfStockNotificationProps {
  notification: {
    originalOrderNumber: number;
    newOrderNumber: number;
    tableNumber?: string;
    outOfStockProduct: string;
    outOfStockItems: Array<{
      id: string;
      productName: string;
      quantity: number;
    }>;
    newOrderId: string;
  };
  availableProducts: Array<{
    id: number;
    nome: string;
    prezzo: number;
    categoria: string;
  }>;
  onClose: () => void;
}

export default function OutOfStockNotification({ 
  notification, 
  availableProducts,
  onClose 
}: OutOfStockNotificationProps) {
  const [action, setAction] = useState<'cancel' | 'substitute' | null>(null);
  const [substituteProducts, setSubstituteProducts] = useState<Array<{
    prodottoId: number;
    quantita: number;
    prezzo: number;
    nome?: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-focus when opened
  useEffect(() => {
    // Play notification sound - you can replace this with your preferred sound file
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {
      // Fallback: use Web Audio API to create a beep sound
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Frequency in Hz
        gainNode.gain.value = 0.1; // Volume
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2); // Play for 200ms
      } catch (e) {
        console.log('Could not play notification sound');
      }
    });
  }, []);

  const handleAddSubstitute = () => {
    setSubstituteProducts([...substituteProducts, {
      prodottoId: 0,
      quantita: 1,
      prezzo: 0
    }]);
  };

  const handleRemoveSubstitute = (index: number) => {
    setSubstituteProducts(substituteProducts.filter((_, i) => i !== index));
  };

  const handleSubstituteChange = (index: number, field: string, value: any) => {
    const updated = [...substituteProducts];
    if (field === 'prodottoId') {
      const product = availableProducts.find(p => p.id === parseInt(value));
      if (product) {
        updated[index] = {
          ...updated[index],
          prodottoId: product.id,
          prezzo: product.prezzo,
          nome: product.nome
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSubstituteProducts(updated);
  };

  const handleConfirm = async () => {
    if (!action) return;

    setIsLoading(true);
    try {
      const result = await handleOutOfStockResponse(
        notification.newOrderId,
        action,
        action === 'substitute' ? substituteProducts.filter(p => p.prodottoId > 0) : undefined
      );

      if (result.success) {
        toast.success(result.message);
        onClose();
      } else {
        toast.error(result.error || 'Errore nella gestione della risposta');
      }
    } catch (error) {
      toast.error('Errore inaspettato');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-800 bg-red-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-lg animate-pulse">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Prodotto Esaurito!
                </h2>
                <p className="text-sm text-red-300 mt-1">
                  Ordine #{notification.originalOrderNumber} 
                  {notification.tableNumber && ` - Tavolo ${notification.tableNumber}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">
              Prodotti esauriti:
            </h3>
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
              {notification.outOfStockItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-red-200">
                  <Package className="h-4 w-4" />
                  <span>{item.quantity}x {item.productName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Come vuoi procedere?
            </h3>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="cancel"
                  checked={action === 'cancel'}
                  onChange={() => setAction('cancel')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-white">Annulla l'ordine</div>
                  <div className="text-sm text-gray-400">
                    Il cliente non desidera ordinare altro
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="substitute"
                  checked={action === 'substitute'}
                  onChange={() => setAction('substitute')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-white">Sostituisci con altri prodotti</div>
                  <div className="text-sm text-gray-400">
                    Il cliente vuole ordinare qualcos'altro
                  </div>
                </div>
              </label>
            </div>

            {action === 'substitute' && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-white">Prodotti sostitutivi:</h4>
                  <button
                    onClick={handleAddSubstitute}
                    className="flex items-center gap-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi prodotto
                  </button>
                </div>

                {substituteProducts.map((sub, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-800 p-3 rounded-lg">
                    <select
                      value={sub.prodottoId}
                      onChange={(e) => handleSubstituteChange(index, 'prodottoId', e.target.value)}
                      className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2"
                    >
                      <option value={0}>Seleziona prodotto...</option>
                      {availableProducts
                        .filter(p => p.id.toString() !== notification.outOfStockItems[0]?.id)
                        .map(product => (
                          <option key={product.id} value={product.id}>
                            {product.nome} - €{product.prezzo}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={sub.quantita}
                      onChange={(e) => handleSubstituteChange(index, 'quantita', parseInt(e.target.value))}
                      className="w-20 bg-gray-700 text-white rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={() => handleRemoveSubstitute(index)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {substituteProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Clicca "Aggiungi prodotto" per aggiungere prodotti sostitutivi
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-800/50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Informa il cliente prima di confermare
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Chiudi
              </button>
              <button
                onClick={handleConfirm}
                disabled={!action || isLoading || (action === 'substitute' && substituteProducts.filter(p => p.prodottoId > 0).length === 0)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Elaborazione...
                  </>
                ) : (
                  <>Conferma {action === 'cancel' ? 'Annullamento' : 'Sostituzione'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}