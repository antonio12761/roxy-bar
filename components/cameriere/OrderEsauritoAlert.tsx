'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, UserCheck } from 'lucide-react';
import { toast } from '@/lib/toast';
import { takeChargeOfOutOfStockOrder } from '@/lib/actions/esaurito-handling';
import { useSSE } from '@/contexts/sse-context';

interface OrderEsauritoAlertProps {
  currentUserId: string;
  currentUserName: string;
}

interface EsauritoAlert {
  orderId: string;
  orderNumber: number;
  tableNumber: number | string;
  products?: Array<{ name: string; quantity: number }>;
  timestamp: string;
  takenBy?: string | null;
  takenById?: string | null;
}

export default function OrderEsauritoAlert({ currentUserId, currentUserName }: OrderEsauritoAlertProps) {
  const [alerts, setAlerts] = useState<EsauritoAlert[]>([]);
  const [takingCharge, setTakingCharge] = useState<string | null>(null);
  const sseContext = useSSE();

  useEffect(() => {
    if (!sseContext?.subscribe) return;

    // Sottoscrivi agli eventi di ordine esaurito
    const unsubAlert = sseContext.subscribe('order:esaurito:alert', (data) => {
      console.log('[OrderEsauritoAlert] New alert:', data);
      setAlerts(prev => {
        // Evita duplicati
        if (prev.some(a => a.orderId === data.orderId)) {
          return prev;
        }
        return [...prev, data];
      });
      
      // Mostra notifica toast
      toast.error(
        `⚠️ ATTENZIONE: Ordine #${data.orderNumber} Tavolo ${data.tableNumber} ha prodotti esauriti!`,
        { duration: 10000 }
      );
    });

    // Sottoscrivi quando qualcuno prende in carico
    const unsubTaken = sseContext.subscribe('order:esaurito:taken', (data) => {
      console.log('[OrderEsauritoAlert] Order taken by:', data.takenBy);
      setAlerts(prev => prev.map(alert => {
        if (alert.orderId === data.orderId) {
          return { ...alert, takenBy: data.takenBy, takenById: data.takenById };
        }
        return alert;
      }));
      
      // Notifica solo se non sono io che ho preso in carico
      if (data.takenById !== currentUserId) {
        toast.info(`${data.takenBy} sta gestendo l'ordine #${data.orderNumber}`);
      }
    });

    // Sottoscrivi quando qualcuno rilascia
    const unsubReleased = sseContext.subscribe('order:esaurito:released', (data) => {
      setAlerts(prev => prev.map(alert => {
        if (alert.orderId === data.orderId) {
          return { ...alert, takenBy: null, takenById: null };
        }
        return alert;
      }));
    });

    return () => {
      unsubAlert();
      unsubTaken();
      unsubReleased();
    };
  }, [sseContext, currentUserId]);

  const handleTakeCharge = async (alert: EsauritoAlert) => {
    if (takingCharge || alert.takenBy) return;
    
    setTakingCharge(alert.orderId);
    try {
      const result = await takeChargeOfOutOfStockOrder(alert.orderId);
      if (result.success) {
        toast.success(result.message || 'Hai preso in carico l\'ordine');
      } else {
        toast.error(result.error || 'Errore nella presa in carico');
      }
    } catch (error) {
      toast.error('Errore imprevisto');
    } finally {
      setTakingCharge(null);
    }
  };

  const dismissAlert = (orderId: string) => {
    setAlerts(prev => prev.filter(a => a.orderId !== orderId));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-md">
      {alerts.map(alert => (
        <div
          key={alert.orderId}
          className={`
            bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 
            ${alert.takenBy ? 'border-blue-500' : 'border-red-500 animate-pulse'}
            p-4 relative
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-6 w-6 ${alert.takenBy ? 'text-blue-500' : 'text-red-500'}`} />
              <div>
                <h3 className="font-bold text-lg">
                  Ordine #{alert.orderNumber} - Tavolo {alert.tableNumber}
                </h3>
                {alert.takenBy && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <UserCheck className="h-4 w-4" />
                    {alert.takenBy} sta gestendo
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.orderId)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Products */}
          {alert.products && alert.products.length > 0 && (
            <div className="space-y-1 mb-3">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Prodotti esauriti:</p>
              {alert.products.map((product, idx) => (
                <p key={idx} className="text-sm">
                  • {product.quantity}x {product.name}
                </p>
              ))}
            </div>
          )}

          {/* Action Button */}
          {!alert.takenBy && (
            <button
              onClick={() => handleTakeCharge(alert)}
              disabled={takingCharge === alert.orderId}
              className={`
                w-full py-2 px-4 rounded-lg font-semibold transition-colors
                ${takingCharge === alert.orderId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }
              `}
            >
              {takingCharge === alert.orderId ? 'Presa in carico...' : 'Prendi in carico'}
            </button>
          )}

          {/* If taken by current user */}
          {alert.takenBy === currentUserName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Stai gestendo questo ordine
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}