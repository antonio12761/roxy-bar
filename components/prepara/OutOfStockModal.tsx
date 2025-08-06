'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { toast } from '@/lib/toast';

interface OutOfStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    name: string;
  } | null;
  affectedItems: Array<{
    id: string;
    orderId: string;
    orderNumber: number;
    tableNumber?: string;
    quantity: number;
  }>;
  onSuccess?: () => void;
}

export default function OutOfStockModal({
  isOpen,
  onClose,
  product,
  affectedItems,
  onSuccess
}: OutOfStockModalProps) {
  const [outOfStockQuantity, setOutOfStockQuantity] = useState(1);
  
  if (!product || affectedItems.length === 0) return null;
  
  const availableQuantity = affectedItems[0]?.quantity || 1;

  const handleConfirm = async () => {
    if (outOfStockQuantity <= 0) {
      toast.error('La quantità deve essere maggiore di 0');
      return;
    }
    if (outOfStockQuantity > availableQuantity) {
      toast.error(`La quantità non può superare ${availableQuantity}`);
      return;
    }
    
    console.log('[OutOfStockModal] Marking out of stock:', {
      productId: product.id,
      productName: product.name,
      affectedItemIds: affectedItems.map(item => item.id),
      quantity: outOfStockQuantity
    });
    
    try {
      const { markProductAsOutOfStock } = await import('@/lib/actions/out-of-stock');
      
      // Per ora usa sempre true per dividere l'ordine
      // La scelta vera viene gestita dal SplitOrderChoiceModal in page-wrapper-optimized.tsx
      const shouldSplit = true;
      
      // Marca il prodotto come esaurito per gli ordini selezionati
      // Questa funzione crea automaticamente un nuovo ordine con stato ORDINATO_ESAURITO
      // e sposta i prodotti esauriti nel nuovo ordine
      const result = await markProductAsOutOfStock(
        product.id,
        affectedItems.map(item => item.id),
        shouldSplit
      );
      
      if (result.success) {
        toast.success(`${product.name} segnato come esaurito. Ordine aggiornato.`);
        onClose();
        
        // Chiama la callback invece di ricaricare la pagina
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.error || 'Errore nel segnare il prodotto come esaurito');
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel segnare il prodotto come esaurito');
    }
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prodotto Esaurito"
    >
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            Quantità disponibile: {availableQuantity}
          </p>
        </div>

        {availableQuantity > 1 ? (
          <div className="space-y-2">
            <label htmlFor="quantity" className="block text-sm font-medium">
              Quanti sono esauriti?
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              max={availableQuantity}
              value={outOfStockQuantity}
              onChange={(e) => setOutOfStockQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:border-gray-600"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Inserisci il numero di prodotti esauriti (max {availableQuantity})
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Il prodotto verrà segnato come completamente esaurito
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Conferma Esaurito
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}