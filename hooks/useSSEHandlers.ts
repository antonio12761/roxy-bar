import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Ordinazione, OrderItem } from '@/app/prepara/types';

interface SSEHandlersProps {
  setOrders: React.Dispatch<React.SetStateAction<Ordinazione[]>>;
  selectedOrder: Ordinazione | null;
  setSelectedOrder: React.Dispatch<React.SetStateAction<Ordinazione | null>>;
  clearEventQueue: () => void;
  loadMergeRequests: (ordinazioneId?: string, showLoader?: boolean) => Promise<void>;
}

export function useSSEHandlers({
  setOrders,
  selectedOrder,
  setSelectedOrder,
  clearEventQueue,
  loadMergeRequests
}: SSEHandlersProps) {
  
  const handleNewOrder = useCallback((data: any) => {
    console.log('[Prepara] Nuovo ordine ricevuto:', data);
    if (!data.orderId) {
      console.error('[Prepara] Dati ordine non validi:', data);
      return;
    }
    
    setOrders(prev => {
      // Check if order already exists
      if (prev.some(order => order.id === data.orderId)) {
        console.log('[Prepara] Ordine già presente, ignorato:', data.orderId);
        return prev;
      }
      
      const newOrder: Ordinazione = {
        id: data.orderId,
        tavolo: data.tableNumber || data.tableName || 'N/A',
        nomeCliente: data.customerName || 'Cliente',
        timestamp: data.timestamp || new Date().toISOString(),
        items: (data.items || []).map((item: any) => ({
          id: item.id,
          ordinazioneId: data.orderId,
          prodotto: item.productName,
          quantita: item.quantity,
          prezzo: item.price || 0,
          stato: 'INSERITO' as const,
          timestamp: new Date().toISOString(),
          postazione: item.station,
          glassesCount: item.glassesCount
        })),
        totaleCosto: data.totalAmount || 0,
        stato: 'ORDINATO' as const,
        hasKitchenItems: data.hasKitchenItems || false,
        cameriere: data.waiterName
      };
      
      console.log('[Prepara] Aggiunto nuovo ordine:', newOrder);
      toast.success(`Nuovo ordine dal tavolo ${newOrder.tavolo}`);
      return [...prev, newOrder];
    });
  }, [setOrders]);

  const handleItemUpdate = useCallback(async (data: any) => {
    console.log('[Prepara] Item update received:', data);
    if (!data.itemId || !data.newStatus) return;
    
    // Aggiorna lo stato locale immediatamente
    setOrders(prev => prev.map(order => {
      const updatedItems = order.items.map(item => 
        item.id === data.itemId 
          ? { ...item, stato: data.newStatus }
          : item
      );
      
      // Check if all items are ready
      const allReady = updatedItems.every(item => 
        item.stato === 'PRONTO' || item.stato === 'CONSEGNATO'
      );
      
      // Update order status if all items are ready
      const newOrderStatus = allReady ? 'PRONTO' as const : order.stato;
      
      return order.items.some(item => item.id === data.itemId)
        ? { ...order, items: updatedItems, stato: newOrderStatus }
        : order;
    }));
    
    // Update selected order if needed
    if (selectedOrder?.items.some(item => item.id === data.itemId)) {
      setSelectedOrder(prev => {
        if (!prev) return null;
        const updatedItems = prev.items.map(item => 
          item.id === data.itemId 
            ? { ...item, stato: data.newStatus }
            : item
        );
        const allReady = updatedItems.every(item => 
          item.stato === 'PRONTO' || item.stato === 'CONSEGNATO'
        );
        return { 
          ...prev, 
          items: updatedItems,
          stato: allReady ? 'PRONTO' as const : prev.stato
        };
      });
    }
    
    // Clear processed events
    clearEventQueue();
  }, [setOrders, selectedOrder, setSelectedOrder, clearEventQueue]);

  const handleOrderCancelled = useCallback((data: any) => {
    console.log('[Prepara] Ordine cancellato:', data);
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
  }, [setOrders]);

  const handleReminder = useCallback((data: any) => {
    console.log('[Prepara] Reminder ricevuto:', data);
    toast.info(data.message || 'Reminder ordine');
  }, []);

  return {
    handleNewOrder,
    handleItemUpdate,
    handleOrderCancelled,
    handleReminder
  };
}