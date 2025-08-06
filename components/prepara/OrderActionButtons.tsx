'use client';

import React, { useState } from 'react';
import { ChefHat, Check, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { aggiornaStatoOrdinazione, completaTuttiGliItems } from '@/lib/actions/ordinazioni';
import { ThankYouHeart } from '@/components/ui/ThankYouHeart';
import type { Ordinazione } from '@/app/prepara/types';

interface OrderActionButtonsProps {
  order: Ordinazione;
  onStartPreparation: () => void;
  isStartingPreparation: boolean;
  isProcessingAction: boolean;
  setIsProcessingAction: React.Dispatch<React.SetStateAction<boolean>>;
  isCompletingOrder: boolean;
  setIsCompletingOrder: (value: boolean) => void;
  setOrders: React.Dispatch<React.SetStateAction<Ordinazione[]>>;
  selectedOrder: Ordinazione | null;
  setSelectedOrder: React.Dispatch<React.SetStateAction<Ordinazione | null>>;
  loadOrders: () => Promise<void>;
  setActiveTab: (tab: 'attesa' | 'preparazione' | 'pronti' | 'ritirati') => void;
  ongoingTransitions: Set<string>;
  setOngoingTransitions: React.Dispatch<React.SetStateAction<Set<string>>>;
  colors: any;
}

export default function OrderActionButtons({
  order,
  onStartPreparation,
  isStartingPreparation,
  isProcessingAction,
  setIsProcessingAction,
  isCompletingOrder,
  setIsCompletingOrder,
  setOrders,
  selectedOrder,
  setSelectedOrder,
  loadOrders,
  setActiveTab,
  ongoingTransitions,
  setOngoingTransitions,
  colors
}: OrderActionButtonsProps) {
  const [showThankYou, setShowThankYou] = useState(false);
  
  const handleBackButton = async () => {
    setIsProcessingAction(true);
    let transitionKey = '';
    try {
      let nuovoStato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO" | "RICHIESTA_CONTO" | "PAGATO" | "ANNULLATO";
      
      if (order.stato === 'IN_PREPARAZIONE') {
        nuovoStato = 'ORDINATO';
      } else if (order.stato === 'PRONTO') {
        nuovoStato = 'IN_PREPARAZIONE';
      } else {
        return;
      }
      
      transitionKey = `${order.id}:${nuovoStato}`;
      if (ongoingTransitions.has(transitionKey)) {
        console.log('[Prepara] Transition already in progress, skipping');
        return;
      }
      
      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
      
      const result = await aggiornaStatoOrdinazione(order.id, nuovoStato);
      
      if (result.success) {
        toast.success(`Ordine riportato allo stato ${nuovoStato}`);
        
        setOrders(prevOrders => prevOrders.map(o => 
          o.id === order.id ? { ...o, stato: nuovoStato } : o
        ));
        
        if (selectedOrder?.id === order.id) {
          setSelectedOrder({ ...order, stato: nuovoStato });
        }
        
        if (nuovoStato === 'ORDINATO') {
          setActiveTab('attesa');
        } else if (nuovoStato === 'IN_PREPARAZIONE') {
          setActiveTab('preparazione');
        }
        
        setTimeout(() => loadOrders(), 300);
      } else {
        if (result.transizioniPermesse) {
          toast.error(`${result.error}\\nStati permessi: ${result.transizioniPermesse.join(', ')}`);
        } else {
          toast.error(result.error || 'Errore nel cambio stato');
        }
      }
    } catch (error) {
      console.error('Errore cambio stato:', error);
      toast.error('Errore durante il cambio stato');
    } finally {
      setIsProcessingAction(false);
      if (transitionKey) {
        setOngoingTransitions(prev => {
          const newSet = new Set(prev);
          newSet.delete(transitionKey);
          return newSet;
        });
      }
    }
  };

  const handleCompleteOrder = async () => {
    if (isCompletingOrder || isProcessingAction) {
      console.log('[Prepara] Ignorando click multiplo su Finito');
      return;
    }
    
    console.log('[OrderActionButtons] Complete button clicked, showing thank you heart');
    setShowThankYou(true);
    setIsProcessingAction(true);
    setIsCompletingOrder(true);
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const executeCompletion = async (): Promise<boolean> => {
      try {
        const updatedItems = order.items.map(item => ({
          ...item,
          stato: (item.stato === 'PRONTO' || item.stato === 'CONSEGNATO') ? item.stato : 'PRONTO' as const
        }));
        
        setOrders(prevOrders => prevOrders.map(o => 
          o.id === order.id 
            ? { ...o, items: updatedItems, stato: 'PRONTO' as const }
            : o
        ));
        
        if (selectedOrder?.id === order.id) {
          setSelectedOrder({ ...order, items: updatedItems, stato: 'PRONTO' as const });
        }
        
        const result = await completaTuttiGliItems(order.id);
        
        if (result.success) {
          toast.success('Tutti i prodotti sono pronti per la consegna');
          setActiveTab('pronti');
          
          setTimeout(async () => {
            try {
              await loadOrders();
            } catch (error) {
              console.error('[Prepara] Errore nel reload ordini:', error);
            } finally {
              setIsCompletingOrder(false);
            }
          }, 300);
          return true;
        } else {
          console.error('[Prepara] Errore completamento ordine:', result.error);
          
          if (result.error?.includes('Conflitto') || result.error?.includes('scaduta')) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`[Prepara] Retry ${retryCount}/${maxRetries} per ordine ${order.id}`);
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
              return await executeCompletion();
            }
          }
          
          toast.error(result.error || 'Errore durante il completamento dell\'ordine');
          await loadOrders();
          return false;
        }
      } catch (error) {
        console.error('[Prepara] Errore generale nel completamento:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[Prepara] Retry ${retryCount}/${maxRetries} dopo errore per ordine ${order.id}`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
          return await executeCompletion();
        }
        
        toast.error('Errore durante il completamento dell\'ordine');
        await loadOrders();
        return false;
      }
    };
    
    try {
      await executeCompletion();
    } catch (error) {
      console.error('[Prepara] Errore nel completamento ordine:', error);
      toast.error('Errore nel completamento dell\'ordine');
      loadOrders();
    } finally {
      setIsProcessingAction(false);
      setTimeout(() => {
        console.log('[Prepara] Reset completamento ordine flag (finally)');
        setIsCompletingOrder(false);
      }, 500);
    }
  };

  console.log('[OrderActionButtons] Render - showThankYou:', showThankYou);
  
  return (
    <>
      {showThankYou && (
        <ThankYouHeart 
          onComplete={() => {
            console.log('[OrderActionButtons] Heart animation complete, hiding');
            setShowThankYou(false);
          }} 
          duration={3000}
        />
      )}
      <div className="flex justify-center gap-3">
      {/* Back button */}
      {(order.stato === 'IN_PREPARAZIONE' || order.stato === 'PRONTO') && (
        <button
          onClick={handleBackButton}
          disabled={isProcessingAction}
          className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
          style={{ 
            backgroundColor: isProcessingAction ? colors.bg.hover : colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '2px',
            borderStyle: 'solid',
            color: isProcessingAction ? colors.text.muted : colors.text.primary,
            cursor: isProcessingAction ? 'not-allowed' : 'pointer',
            transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!isProcessingAction) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isProcessingAction) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = colors.bg.card;
            }
          }}>
          {isProcessingAction ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              In corso...
            </>
          ) : (
            <>
              <ArrowLeft className="h-5 w-5" />
              Torna Indietro
            </>
          )}
        </button>
      )}
      
      {/* Start button */}
      {order.stato === 'ORDINATO' && order.items.every(item => item.stato === 'INSERITO') && (
        <button
          onClick={() => {
            console.log('[OrderActionButtons] Start button clicked, showing thank you heart');
            setShowThankYou(true);
            onStartPreparation();
          }}
          disabled={isStartingPreparation}
          className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
          style={{ 
            backgroundColor: isStartingPreparation ? colors.bg.hover : colors.button.primary,
            color: isStartingPreparation ? colors.text.muted : colors.button.text,
            cursor: isStartingPreparation ? 'not-allowed' : 'pointer',
            transform: isStartingPreparation ? 'scale(0.95)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!isStartingPreparation) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.primary}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isStartingPreparation) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}>
          {isStartingPreparation ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Avvio in corso...
            </>
          ) : (
            <>
              <ChefHat className="h-5 w-5" />
              Inizia a Preparare
            </>
          )}
        </button>
      )}
      
      {/* Complete button */}
      {order.stato === 'IN_PREPARAZIONE' && 
       !order.items.every(item => item.stato === 'PRONTO') && (
        <button
          onClick={handleCompleteOrder}
          disabled={isProcessingAction}
          className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 transform"
          style={{ 
            backgroundColor: isProcessingAction ? colors.bg.hover : colors.button.success,
            color: isProcessingAction ? colors.text.muted : 'white',
            boxShadow: `0 2px 8px ${colors.button.success}30`,
            cursor: isProcessingAction ? 'not-allowed' : 'pointer',
            transform: isProcessingAction ? 'scale(0.95)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!isProcessingAction) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.button.success}40`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isProcessingAction) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = `0 2px 8px ${colors.button.success}30`;
            }
          }}>
          {isProcessingAction ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Completamento...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              Finito!
            </>
          )}
        </button>
      )}
    </div>
    </>
  );
}