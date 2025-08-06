'use client';

import React, { useState } from 'react';
import { ClipboardList, RefreshCw, X, Package } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { makeAllProductsAvailable } from '@/lib/actions/prodotti';
import { toast } from '@/lib/toast';

interface PreparaHeaderProps {
  ordersCount: number;
  ordersCountRef: React.RefObject<HTMLSpanElement | null>;
  onRefresh: () => void;
  onDeleteAll: () => void;
}

export default function PreparaHeader({
  ordersCount,
  ordersCountRef,
  onRefresh,
  onDeleteAll
}: PreparaHeaderProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [isEnablingAll, setIsEnablingAll] = useState(false);

  const handleMakeAllAvailable = async () => {
    if (isEnablingAll) return;
    
    setIsEnablingAll(true);
    try {
      const result = await makeAllProductsAvailable();
      if (result.success) {
        toast.success(result.message || 'Tutti i prodotti sono ora disponibili');
        onRefresh();
      } else {
        toast.error(result.error || 'Errore nel rendere disponibili i prodotti');
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore nel rendere disponibili i prodotti');
    } finally {
      setIsEnablingAll(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 className="text-xl font-semibold flex items-center gap-2" 
        style={{ color: colors.text.primary }}>
        <ClipboardList className="h-5 w-5" style={{ color: colors.accent }} />
        Preparazione Ordini
        <span ref={ordersCountRef} className="text-sm font-normal" style={{ color: colors.text.muted }}>({ordersCount})</span>
      </h2>
      <div className="ml-auto flex items-center gap-4">
        <button
          onClick={() => {
            console.log('[Prepara] Manual refresh triggered');
            onRefresh();
          }}
          className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
          style={{ 
            backgroundColor: colors.bg.hover,
            color: colors.text.primary 
          }}
          title="Aggiorna manualmente"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Make All Products Available Button */}
        <button
          onClick={handleMakeAllAvailable}
          disabled={isEnablingAll}
          className="px-3 py-2 rounded-lg hover:bg-opacity-20 transition-colors flex items-center gap-2"
          style={{ 
            backgroundColor: colors.accent + '20',
            color: colors.accent,
            opacity: isEnablingAll ? 0.5 : 1
          }}
          title="Rendi disponibili tutti i prodotti"
        >
          <Package className="h-4 w-4" />
          {isEnablingAll ? 'Attivando...' : 'Rendi tutti disponibili'}
        </button>
        
        {/* Delete All Orders Button */}
        <button
          onClick={onDeleteAll}
          className="p-2 rounded-lg hover:bg-opacity-20 transition-colors"
          style={{ 
            backgroundColor: colors.text.error + '20',
            color: colors.text.error
          }}
          title="Cancella tutti gli ordini"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}