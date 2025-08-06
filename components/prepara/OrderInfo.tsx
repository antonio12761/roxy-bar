'use client';

import React from 'react';
import type { Ordinazione } from '@/app/prepara/types';

interface OrderInfoProps {
  order: Ordinazione;
  colors: any;
}

export default function OrderInfo({ order, colors }: OrderInfoProps) {
  const getTimeElapsed = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 60) return { text: `${minutes}m`, minutes };
    return { text: `${Math.floor(minutes / 60)}h ${minutes % 60}m`, minutes };
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
        Dettaglio Ordine
      </h2>
      
      <div className="flex justify-between items-start pb-4 mb-4 border-b" style={{ borderColor: colors.border.primary }}>
        <div>
          <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
            {order.tavolo ? `Tavolo ${order.tavolo}` : order.nomeCliente || 'Cliente'}
          </h3>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Ordine • {getTimeElapsed(order.timestamp).text} fa
          </p>
          {order.cameriere && (
            <p className="text-sm mt-1" style={{ 
              color: colors.text.muted, 
              fontStyle: 'italic',
              opacity: 0.8
            }}>
              {order.cameriere}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold" style={{ color: colors.text.accent }}>
            €{order.totaleCosto.toFixed(2)}
          </p>
        </div>
      </div>
    </>
  );
}