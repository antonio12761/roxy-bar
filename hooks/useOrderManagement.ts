import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Ordinazione, OrderItem } from '@/app/prepara/types';
import { 
  getOrdinazioniAperte, 
  aggiornaStatoRiga, 
  aggiornaStatoOrdinazione,
  cancellaOrdiniAttivi,
  getRichiesteMergePendenti,
  accettaRichiestaMerge,
  rifiutaRichiestaMerge
} from '@/lib/actions/ordinazioni';
import { toggleProductAvailability } from '@/lib/actions/prodotti';

export function useOrderManagement(currentUser: any) {
  const [orders, setOrders] = useState<Ordinazione[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Ordinazione | null>(null);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [orderMergeRequests, setOrderMergeRequests] = useState<any[]>([]);
  const [isLoadingMergeRequests, setIsLoadingMergeRequests] = useState(false);
  const [processingMergeRequest, setProcessingMergeRequest] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      console.log('[Prepara] Loading orders...');
      const result = await getOrdinazioniAperte();
      if (result && 'success' in result && result.success && 'ordinazioni' in result && Array.isArray(result.ordinazioni)) {
        const filteredOrders = result.ordinazioni.filter((order: any) => 
          order.RigaOrdinazione?.some((item: any) => 
            item.postazione === 'BANCO' || item.postazione === 'PREPARA'
          )
        );
        
        const mappedOrders: Ordinazione[] = filteredOrders.map((order: any) => ({
          id: order.id,
          tavolo: order.Tavolo?.numero || 'N/A',
          nomeCliente: order.cliente || 'Cliente',
          timestamp: order.dataApertura,
          items: order.RigaOrdinazione
            .filter((item: any) => item.postazione === 'BANCO' || item.postazione === 'PREPARA')
            .map((item: any) => ({
              id: item.id,
              ordinazioneId: order.id,
              prodotto: item.Prodotto?.nome || 'Prodotto',
              prodottoId: item.prodottoId,
              quantita: item.quantita,
              prezzo: item.prezzo,
              stato: item.stato,
              timestamp: item.timestamp || order.dataApertura,
              postazione: item.postazione,
              note: item.note,
              glassesCount: item.Prodotto?.requiresGlasses ? item.quantita : undefined
            })),
          totaleCosto: order.totale || 0,
          stato: order.stato,
          hasKitchenItems: order.RigaOrdinazione?.some((item: any) => 
            item.postazione === 'CUCINA'
          ) || false,
          cameriere: order.Utente?.nome || null,
          note: order.note,
          numero: order.numero
        }));
        
        setOrders(mappedOrders);
      }
    } catch (error) {
      console.error('[Prepara] Errore caricamento ordini:', error);
      toast.error('Errore nel caricamento degli ordini');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle status change
  const handleStatusChange = useCallback(async (item: OrderItem, newStatus: any) => {
    if (processingItems.has(item.id)) return;
    
    try {
      setProcessingItems(prev => new Set(prev).add(item.id));
      
      // Update local state immediately
      setOrders(prevOrders => prevOrders.map(order => ({
        ...order,
        items: order.items.map(i => 
          i.id === item.id ? { ...i, stato: newStatus } : i
        )
      })));
      
      const result = await aggiornaStatoRiga(item.id, newStatus);
      
      if (!result.success) {
        // Revert on error
        setOrders(prevOrders => prevOrders.map(order => ({
          ...order,
          items: order.items.map(i => 
            i.id === item.id ? { ...i, stato: item.stato } : i
          )
        })));
        toast.error(result.error || 'Errore aggiornamento stato');
      }
    } catch (error) {
      console.error('[Prepara] Errore cambio stato:', error);
      toast.error('Errore durante il cambio stato');
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [processingItems]);

  // Handle merge requests
  const handleAcceptMerge = useCallback(async (richiestaId: string) => {
    if (processingMergeRequest) return;
    
    setProcessingMergeRequest(richiestaId);
    try {
      const result = await accettaRichiestaMerge(richiestaId);
      if (result.success) {
        toast.success("Prodotti aggiunti all'ordine");
        await loadOrders();
        if (selectedOrder) {
          setOrderMergeRequests(prev => prev.filter(r => r.id !== richiestaId));
        }
      } else {
        toast.error(result.error || "Errore nell'accettare la richiesta");
      }
    } catch (error) {
      console.error("Errore accettazione merge:", error);
      toast.error("Errore durante l'accettazione");
    } finally {
      setProcessingMergeRequest(null);
    }
  }, [processingMergeRequest, loadOrders, selectedOrder]);

  const handleRejectMerge = useCallback(async (richiestaId: string) => {
    if (processingMergeRequest) return;
    
    setProcessingMergeRequest(richiestaId);
    try {
      const result = await rifiutaRichiestaMerge(richiestaId);
      if (result.success) {
        toast.success("Richiesta rifiutata");
        setOrderMergeRequests(prev => prev.filter(r => r.id !== richiestaId));
      } else {
        toast.error(result.error || "Errore nel rifiutare la richiesta");
      }
    } catch (error) {
      console.error("Errore rifiuto merge:", error);
      toast.error("Errore durante il rifiuto");
    } finally {
      setProcessingMergeRequest(null);
    }
  }, [processingMergeRequest]);

  // Handle product availability toggle
  const handleToggleAvailability = useCallback(async (productId: number, available: boolean) => {
    try {
      const result = await toggleProductAvailability(productId, available);
      if (result.success) {
        toast.success(available ? 'Prodotto disponibile' : 'Prodotto non disponibile');
      } else {
        toast.error(result.error || 'Errore aggiornamento disponibilità');
      }
    } catch (error) {
      console.error('Errore toggle disponibilità:', error);
      toast.error('Errore durante l\'aggiornamento');
    }
  }, []);

  // Delete all orders
  const handleDeleteAllOrders = useCallback(async () => {
    if (isDeletingAll) return;
    
    setIsDeletingAll(true);
    try {
      const result = await cancellaOrdiniAttivi();
      if (result.success) {
        toast.success('Tutti gli ordini sono stati cancellati');
        setOrders([]);
        setSelectedOrder(null);
      } else {
        toast.error(result.error || 'Errore durante la cancellazione');
      }
    } catch (error) {
      console.error('Errore cancellazione ordini:', error);
      toast.error('Errore durante la cancellazione degli ordini');
    } finally {
      setIsDeletingAll(false);
    }
  }, [isDeletingAll]);

  return {
    orders,
    setOrders,
    selectedOrder,
    setSelectedOrder,
    processingItems,
    isLoading,
    orderMergeRequests,
    setOrderMergeRequests,
    isLoadingMergeRequests,
    setIsLoadingMergeRequests,
    processingMergeRequest,
    isDeletingAll,
    loadOrders,
    handleStatusChange,
    handleAcceptMerge,
    handleRejectMerge,
    handleToggleAvailability,
    handleDeleteAllOrders
  };
}