'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, UserX, RefreshCw } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { getOutOfStockOrderDetails, modifyOutOfStockOrder, cancelOutOfStockOrder } from '@/lib/actions/gestione-esauriti';
import { releaseOutOfStockOrder } from '@/lib/actions/esaurito-handling';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface OutOfStockOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  tableNumber: string;
  tableId: number;
}

export function OutOfStockOrderModal({
  isOpen,
  onClose,
  orderId,
  tableNumber,
  tableId
}: OutOfStockOrderModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails();
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const result = await getOutOfStockOrderDetails(orderId);
      if (result.success) {
        setOrderDetails(result);
      } else {
        toast.error(result.error || 'Errore caricamento dettagli');
      }
    } catch (error) {
      toast.error('Errore caricamento dettagli ordine');
    } finally {
      setLoading(false);
    }
  };

  const handleModifyOrder = () => {
    // Naviga alla pagina del tavolo con parametri per modificare l'ordine
    // Non passiamo più excludeProducts perché il backend gestisce già le quantità disponibili
    const params = new URLSearchParams({
      modifyOrder: orderId
    });
    
    router.push(`/cameriere/tavolo/${tableId}?${params.toString()}`);
    onClose();
  };

  const handleCancelOrder = async () => {
    if (!confirm('Sei sicuro di voler annullare questo ordine esaurito?')) return;
    
    setActionLoading('cancel');
    try {
      const result = await cancelOutOfStockOrder(orderId);
      if (result.success) {
        toast.success('Ordine annullato');
        onClose();
      } else {
        toast.error(result.error || 'Errore annullamento');
      }
    } catch (error) {
      toast.error('Errore annullamento ordine');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseOrder = async () => {
    setActionLoading('release');
    try {
      const result = await releaseOutOfStockOrder(orderId);
      if (result.success) {
        toast.success('Gestione rilasciata');
        loadOrderDetails();
      } else {
        toast.error(result.error || 'Errore rilascio');
      }
    } catch (error) {
      toast.error('Errore rilascio gestione');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Gestione Ordine Esaurito - Tavolo ${tableNumber}`}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : orderDetails ? (
        <div className="space-y-4">
          {/* Info ordine */}
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
              Ordine #{orderDetails.order.numero}
            </h3>
            
            {orderDetails.handledBy && (
              <p className="text-sm text-red-600 dark:text-red-300 mb-2">
                Gestito da: {orderDetails.handledBy}
              </p>
            )}
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Cliente: {orderDetails.order.nomeCliente || 'N/D'}
            </div>
          </div>

          {/* Prodotti non disponibili */}
          <div>
            <h4 className="font-semibold mb-2 text-red-600 dark:text-red-400">
              Prodotti Esauriti ({orderDetails.unavailableProducts.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orderDetails.unavailableProducts.map((item: any) => (
                <div key={item.id} className="bg-red-100 dark:bg-red-900/30 p-2 rounded flex justify-between">
                  <span className="font-medium">{item.Prodotto.nome}</span>
                  <span className="text-sm">x{item.quantita}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prodotti ancora disponibili (se ci sono) */}
          {orderDetails.availableProducts.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">
                Prodotti Disponibili ({orderDetails.availableProducts.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderDetails.availableProducts.map((item: any) => (
                  <div key={item.id} className="bg-green-100 dark:bg-green-900/30 p-2 rounded flex justify-between">
                    <span className="font-medium">{item.Prodotto.nome}</span>
                    <span className="text-sm">x{item.quantita}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Azioni */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <button
              onClick={handleModifyOrder}
              disabled={!!actionLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Edit className="h-4 w-4" />
              Modifica Ordine
            </button>

            {orderDetails.handledBy && (
              <button
                onClick={handleReleaseOrder}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                {actionLoading === 'release' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <UserX className="h-4 w-4" />
                )}
                Rilascia Gestione
              </button>
            )}

            <button
              onClick={handleCancelOrder}
              disabled={!!actionLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === 'cancel' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Annulla Ordine
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500">
          Nessun dettaglio disponibile
        </div>
      )}
    </ThemedModal>
  );
}