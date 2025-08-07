'use client';

import React from 'react';
import { Loader2, Check, XCircle } from 'lucide-react';
import type { OrderItem, Ordinazione } from '@/app/prepara/types';

interface OrderItemsListProps {
  order: Ordinazione;
  items: OrderItem[];
  processingItems: Set<string>;
  onStatusChange: (item: OrderItem, newStatus: any) => void;
  onProductClick?: (item: OrderItem) => void;
  onOutOfStockClick?: (item: OrderItem) => void;
  productProcedureCache?: Map<number, boolean>;
  orders?: Ordinazione[];
  colors: any;
}

export default function OrderItemsList({
  order,
  items,
  processingItems,
  onStatusChange,
  onProductClick,
  onOutOfStockClick,
  productProcedureCache = new Map(),
  orders = [],
  colors
}: OrderItemsListProps) {
  console.log('[OrderItemsList] Component rendered with:', {
    orderStato: order.stato,
    itemsCount: items.length,
    items: items.map(i => ({ 
      id: i.id, 
      stato: i.stato, 
      prodotto: i.prodotto,
      note: i.note,
      glassesCount: i.glassesCount
    }))
  });
  
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium" style={{ color: colors.text.primary }}>
          Prodotti da preparare:
        </h4>
        <span className="text-sm" style={{ color: colors.text.muted }}>
          {items.filter(i => i.stato === 'PRONTO').length}/{items.length} completati
        </span>
      </div>
      
      {items.map((item) => {
        const isProcessing = processingItems.has(item.id);
        const isReady = item.stato === 'PRONTO';
        const isOutOfStock = false; // ESAURITO non è un stato valido per OrderItem
        const canStart = item.stato === 'INSERITO';
        const isInProgress = item.stato === 'IN_LAVORAZIONE';
        
        const shouldShowOutOfStockButton = !isOutOfStock && !isReady && order.stato !== 'CONSEGNATO';
        console.log('[OrderItemsList] Item:', item.prodotto, {
          isOutOfStock,
          isReady,
          orderStato: order.stato,
          shouldShowButton: shouldShowOutOfStockButton
        });
        
        return (
          <div 
            key={item.id} 
            className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
              isReady ? 'opacity-60' : isOutOfStock ? 'opacity-50' : ''
            }`}
            style={{ 
              backgroundColor: isOutOfStock ? colors.text.muted + '10' : isReady ? colors.button.success + '10' : colors.bg.hover,
              borderLeft: `4px solid ${isOutOfStock ? colors.text.muted : isReady ? colors.button.success : isInProgress ? colors.text.accent : 'transparent'}`,
              transform: isProcessing ? 'scale(0.98)' : 'scale(1)',
              boxShadow: isProcessing ? `0 0 0 2px ${colors.text.accent}30` : 'none'
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-lg font-bold" style={{ 
                color: isOutOfStock ? colors.text.muted : isReady ? colors.text.muted : colors.text.primary,
                textDecoration: isReady || isOutOfStock ? 'line-through' : 'none'
              }}>
                {item.quantita}x
              </span>
              
              <div className="flex-1">
                <p 
                  className={`font-medium transition-all ${
                    isReady || isOutOfStock ? 'line-through' : ''
                  } ${
                    item.prodottoId && productProcedureCache.get(item.prodottoId) === false 
                      ? 'cursor-default opacity-75' 
                      : 'cursor-pointer hover:underline'
                  }`}
                  style={{ 
                    color: isOutOfStock ? colors.text.muted : isReady ? colors.text.muted : colors.text.primary 
                  }}
                  onClick={() => !isOutOfStock && item.prodottoId && onProductClick?.(item)}
                  title={isOutOfStock ? "Prodotto esaurito" : "Clicca per gestire disponibilità e procedure"}
                >
                  {item.prodotto}
                  {item.glassesCount && item.glassesCount > 0 && (
                    <span className="ml-2 text-sm italic" style={{ color: colors.text.muted }}>
                      ({item.glassesCount} bicchier{item.glassesCount === 1 ? 'e' : 'i'})
                    </span>
                  )}
                  {item.postazione === 'BANCO' && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded" 
                      style={{ backgroundColor: colors.text.accent + '20', color: colors.text.accent }}>
                      Banco
                    </span>
                  )}
                  {item.postazione === 'CUCINA' && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded" 
                      style={{ backgroundColor: colors.text.error + '20', color: colors.text.error }}>
                      Cucina
                    </span>
                  )}
                </p>
                
                {/* Mostra ingredienti per miscelati */}
                {item.configurazione?.selezioni && (
                  <div className="mt-2 p-2 rounded text-sm" 
                    style={{ 
                      backgroundColor: colors.bg.card, 
                      border: `1px solid ${colors.border.primary}` 
                    }}>
                    <div className="font-medium mb-1" style={{ color: colors.text.accent }}>
                      🍸 Ingredienti:
                    </div>
                    {item.configurazione.selezioni.map((sel: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 mb-1" style={{ color: colors.text.secondary }}>
                        <span className="font-medium">{sel.categoriaNome}:</span>
                        <span>
                          {sel.bottiglie.map((b: any, bidx: number) => (
                            <span key={bidx}>
                              {b.nome}
                              {b.marca && ` (${b.marca})`}
                              {bidx < sel.bottiglie.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {item.note && (
                  <p className="text-sm mt-1 italic" style={{ color: colors.text.secondary }}>
                    📝 {item.note}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              {isProcessing && (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.text.muted }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}