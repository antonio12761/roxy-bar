'use client';

import React from 'react';
import { ChefHat } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { sollecitaOrdinePronto, aggiornaStatoOrdinazione, segnaOrdineRitirato } from '@/lib/actions/ordinazioni';
import type { Ordinazione, OrderItem } from '@/app/prepara/types';
import { MatrixPrice } from '@/components/ui/MatrixPrice';
import '@/styles/holographic.css';

interface OrderListCardProps {
  order: Ordinazione;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  processingItems: Set<string>;
  position: number;
  cardIndex: number;
  totalCards: number;
  onOrderRetired: () => void;
  onOrderCompleted: () => void;
  ongoingTransitions: Set<string>;
  setOngoingTransitions: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const OrderListCard = React.memo(function OrderListCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  processingItems,
  position,
  cardIndex,
  totalCards,
  onOrderRetired,
  onOrderCompleted,
  ongoingTransitions,
  setOngoingTransitions
}: OrderListCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return { text: `${minutes}m`, minutes };
    return { text: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
  };

  const getOrderStatusBadge = () => {
    const hasInProgress = order.items.some(item => item.stato === 'IN_LAVORAZIONE');
    const hasReady = order.items.some(item => item.stato === 'PRONTO');
    const allReady = order.items.every(item => item.stato === 'PRONTO');
    
    if (allReady) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.button.success + '20', color: colors.button.success }}>Completato</span>;
    } else if (hasReady) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.bg.hover, color: colors.text.primary }}>Parziale</span>;
    } else if (hasInProgress) {
      return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.text.accent + '20', color: colors.text.accent }}>In Corso</span>;
    }
    return <span className="px-2 py-1 text-xs rounded-full" style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>In Attesa</span>;
  };
  
  // Check if the order is from special customers with holographic effect
  const specialCustomers = ['giulio colaizzi', 'obsidian'];
  const isGiulioColaizzi = specialCustomers.includes(order.nomeCliente?.toLowerCase() || '');
  
  return (
    <div 
      className={`transition-all cursor-pointer border-2 border-l-2 border-r-2 ${
        cardIndex === 0 ? 'rounded-t-2xl border-t-2' : 'border-t-0'
      } ${
        cardIndex === totalCards - 1 ? 'rounded-b-2xl border-b-2' : 'border-b-0'
      } ${
        isGiulioColaizzi ? 'holographic-card' : ''
      }`}
      style={{
        backgroundColor: order.stato === 'PRONTO' 
          ? colors.button.success 
          : isSelected
            ? colors.bg.dark  // Card selezionata più scura
            : colors.bg.card, // Card non selezionate più chiare
        borderTopColor: order.stato === 'PRONTO'
          ? colors.button.success
          : isSelected 
            ? colors.border.primary
            : colors.border.secondary,
        borderRightColor: order.stato === 'PRONTO'
          ? colors.button.success
          : isSelected 
            ? colors.border.primary
            : colors.border.secondary,
        borderLeftColor: order.stato === 'PRONTO'
          ? colors.button.success
          : isSelected 
            ? colors.border.primary
            : colors.border.secondary,
        borderBottomColor: cardIndex < totalCards - 1 && isSelected 
          ? 'transparent' 
          : order.stato === 'PRONTO'
            ? colors.button.success
            : isSelected 
              ? colors.border.primary
              : colors.border.secondary,
        // Rimuovo transform e shadow per l'effetto di fusione
        zIndex: isSelected ? 10 : 1,
        // Leggera sovrapposizione se selezionata
        marginBottom: isSelected && cardIndex < totalCards - 1 ? '-2px' : '0px'
      }}
      onClick={order.stato === 'PRONTO' ? undefined : onSelect}
      onMouseEnter={(e) => {
        if (!isGiulioColaizzi && order.stato !== 'PRONTO' && !isSelected) {
          const hoverBorderColor = colors.text.accent + '60';
          e.currentTarget.style.borderTopColor = hoverBorderColor;
          e.currentTarget.style.borderRightColor = hoverBorderColor;
          e.currentTarget.style.borderLeftColor = hoverBorderColor;
          e.currentTarget.style.borderBottomColor = cardIndex < totalCards - 1 && isSelected ? 'transparent' : hoverBorderColor;
          e.currentTarget.style.backgroundColor = colors.bg.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!isGiulioColaizzi && order.stato !== 'PRONTO' && !isSelected) {
          e.currentTarget.style.borderTopColor = colors.border.secondary;
          e.currentTarget.style.borderRightColor = colors.border.secondary;
          e.currentTarget.style.borderLeftColor = colors.border.secondary;
          e.currentTarget.style.borderBottomColor = cardIndex < totalCards - 1 && isSelected ? 'transparent' : colors.border.secondary;
          e.currentTarget.style.backgroundColor = colors.bg.card;
        }
      }}
    >
      {isGiulioColaizzi && <div className="holographic-sparkles" />}
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div 
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl font-bold ${
                getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO' ? 'animate-pulse' : ''
              } ${isGiulioColaizzi ? 'golden-number' : ''}`}
              style={{
                backgroundColor: isGiulioColaizzi 
                  ? 'transparent'
                  : getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                    ? colors.text.error
                    : order.stato === 'PRONTO' 
                      ? 'white' 
                      : position === 1 
                        ? colors.button.success 
                        : colors.bg.hover,
                color: isGiulioColaizzi
                  ? '#FFD700'
                  : getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                    ? 'white'
                    : order.stato === 'PRONTO' 
                      ? colors.button.success 
                      : position === 1 
                        ? colors.button.successText 
                        : colors.text.primary,
                animation: getTimeElapsed(order.timestamp).minutes > 10 && order.stato !== 'PRONTO'
                  ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  : 'none'
              }}>
              {typeof order.tavolo === 'string' ? order.tavolo.toUpperCase() : order.tavolo}
            </div>
            <div>
              <div className={`font-medium ${isGiulioColaizzi ? 'golden-text' : ''}`} style={{ 
                color: isGiulioColaizzi ? undefined : order.stato === 'PRONTO' ? 'white' : colors.text.primary 
              }}>
                {order.nomeCliente || 'Cliente'}
              </div>
              <div className="text-xs" style={{ 
                color: isGiulioColaizzi ? '#FFD700' : order.stato === 'PRONTO' ? 'rgba(255,255,255,0.8)' : colors.text.muted 
              }}>
                {getTimeElapsed(order.timestamp).text} fa
              </div>
              {order.cameriere && (
                <div className="text-xs" style={{ 
                  color: isGiulioColaizzi ? '#DAA520' : order.stato === 'PRONTO' ? 'rgba(255,255,255,0.7)' : colors.text.muted,
                  fontStyle: 'italic',
                  opacity: 0.8,
                  marginTop: '2px'
                }}>
                  {order.cameriere}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            {isGiulioColaizzi ? (
              <div className="font-semibold text-lg">
                <MatrixPrice price={Number(order.totaleCosto)} />
              </div>
            ) : (
              <div className="font-semibold text-lg" style={{ 
                color: order.stato === 'PRONTO' ? 'white' : colors.text.primary 
              }}>
                €{Number(order.totaleCosto).toFixed(2)}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-end text-sm">
          {order.stato === 'PRONTO' ? (
            <div className="flex gap-2">
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const result = await sollecitaOrdinePronto(order.id);
                    if (result.success) {
                      toast.success('Sollecito inviato al cameriere');
                    } else {
                      toast.error(result.error || 'Errore durante il sollecito');
                    }
                  } catch (error) {
                    toast.error('Errore durante il sollecito');
                  }
                }}
                className="px-3 py-1 text-xs rounded-md transition-colors font-medium"
                style={{
                  backgroundColor: colors.text.accent,
                  color: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.text.accent + 'CC';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.text.accent;
                }}
              >
                Sollecita
              </button>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    // Se l'ordine non è segnato come PRONTO nel database, aggiornalo prima
                    if (order.stato !== 'PRONTO') {
                      const transitionKey = `${order.id}:PRONTO`;
                      if (ongoingTransitions.has(transitionKey)) {
                        console.log('[Prepara] Transition already in progress, skipping');
                        return;
                      }
                      
                      setOngoingTransitions(prev => new Set(prev).add(transitionKey));
                      
                      const updateResult = await aggiornaStatoOrdinazione(order.id, 'PRONTO');
                      if (!updateResult.success) {
                        setOngoingTransitions(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(transitionKey);
                          return newSet;
                        });
                        toast.error('Errore nell\'aggiornamento dello stato dell\'ordine');
                        return;
                      }
                      // Aspetta un attimo per permettere al backend di aggiornarsi
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      // Clean up transition key
                      setOngoingTransitions(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(transitionKey);
                        return newSet;
                      });
                    }
                    
                    console.log('[Prepara] Chiamando segnaOrdineRitirato da lista per ordine:', order.id);
                    console.log('[Prepara] Stato ordine prima del ritiro:', order.stato);
                    console.log('[Prepara] Stati items:', order.items.map(i => ({ id: i.id, stato: i.stato })));
                    
                    const result = await segnaOrdineRitirato(order.id);
                    console.log('[Prepara] Risultato segnaOrdineRitirato da lista:', result);
                    
                    if (result.success) {
                      toast.success('Ordine segnato come ritirato');
                      // Ricarica gli ordini per aggiornare la lista
                      onOrderRetired();
                    } else {
                      toast.error(result.error || 'Errore durante il ritiro');
                    }
                  } catch (error) {
                    toast.error('Errore durante il ritiro');
                  }
                }}
                className="px-3 py-1 text-xs rounded-md transition-colors font-medium"
                style={{
                  backgroundColor: colors.button.primary,
                  color: colors.button.primaryText
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.button.primary;
                }}
              >
                Ritirato
              </button>
            </div>
          ) : (
            order.hasKitchenItems && (
              <div className="flex items-center gap-1" style={{ color: colors.text.accent }}>
                <ChefHat className="h-3 w-3" />
                <span className="text-xs">+ Cucina</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

export default OrderListCard;