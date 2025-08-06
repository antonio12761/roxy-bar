'use client';

import React, { useState } from 'react';
import { AlertTriangle, Split, Lock, Minus, Plus } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useTheme } from '@/contexts/ThemeContext';

interface OutOfStockQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  totalQuantity: number;
  hasOtherProducts: boolean;
  onConfirm: (quantity: number, shouldSplit: boolean) => void;
  multipleProducts?: Array<{
    itemId: string;
    productId: number;
    productName: string;
    quantity: number;
    maxQuantity: number;
  }>;
}

export default function OutOfStockQuantityModal({
  isOpen,
  onClose,
  productName,
  totalQuantity,
  hasOtherProducts,
  onConfirm,
  multipleProducts
}: OutOfStockQuantityModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [outOfStockQuantity, setOutOfStockQuantity] = useState(totalQuantity);
  const [splitChoice, setSplitChoice] = useState<boolean | null>(null);
  const [showSplitChoice, setShowSplitChoice] = useState(false);

  const handleQuantityChange = (value: number) => {
    if (value >= 1 && value <= totalQuantity) {
      setOutOfStockQuantity(value);
    }
  };

  const handleNext = () => {
    // Se ci sono altri prodotti, mostra sempre la scelta split/blocca
    // Anche se non tutte le quantità sono esaurite
    if (hasOtherProducts) {
      setShowSplitChoice(true);
    } else {
      // Se non ci sono altri prodotti, procedi direttamente con split=true
      onConfirm(outOfStockQuantity, true);
      onClose();
    }
  };

  const handleSplitChoice = (shouldSplit: boolean) => {
    onConfirm(outOfStockQuantity, shouldSplit);
    onClose();
  };

  const handleClose = () => {
    setOutOfStockQuantity(totalQuantity);
    setSplitChoice(null);
    setShowSplitChoice(false);
    onClose();
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={handleClose}
      title={showSplitChoice ? "Come gestire l'ordine?" : "Quantità esaurita"}
    >
      <div className="space-y-4">
        {!showSplitChoice ? (
          <>
            {/* Step 1: Selezione quantità */}
            <div className="text-center">
              {multipleProducts && multipleProducts.length > 1 ? (
                <>
                  <p className="text-base font-medium mb-3" style={{ color: colors.text.primary }}>
                    <span className="font-bold">Prodotti selezionati:</span>
                  </p>
                  <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                    {multipleProducts.map(product => (
                      <div key={product.itemId} className="text-sm px-3 py-1 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                        <span style={{ color: colors.text.primary }}>
                          {product.productName} - 
                        </span>
                        <span className="font-semibold" style={{ color: colors.text.accent }}>
                          {' '}{product.quantity}x
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base font-medium mb-2" style={{ color: colors.text.primary }}>
                    <span className="font-bold">{productName}</span>
                  </p>
                  <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
                    Quantità totale nell'ordine: <span className="font-semibold">{totalQuantity}</span>
                  </p>
                </>
              )}
            </div>

            {totalQuantity > 1 && (!multipleProducts || multipleProducts.length <= 1) && (
              <div className="space-y-3">
                <label className="block text-sm font-medium" style={{ color: colors.text.primary }}>
                  Quante porzioni sono esaurite?
                </label>
                
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleQuantityChange(outOfStockQuantity - 1)}
                    disabled={outOfStockQuantity <= 1}
                    className="p-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: colors.bg.hover,
                      color: outOfStockQuantity <= 1 ? colors.text.muted : colors.text.primary
                    }}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  
                  <div className="px-8 py-3 rounded-lg min-w-[100px] text-center" style={{
                    backgroundColor: colors.bg.card,
                    border: `2px solid ${colors.border.primary}`
                  }}>
                    <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                      {outOfStockQuantity}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleQuantityChange(outOfStockQuantity + 1)}
                    disabled={outOfStockQuantity >= totalQuantity}
                    className="p-2 rounded-lg transition-colors disabled:opacity-50"
                    style={{
                      backgroundColor: colors.bg.hover,
                      color: outOfStockQuantity >= totalQuantity ? colors.text.muted : colors.text.primary
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {outOfStockQuantity < totalQuantity && (
                  <p className="text-sm text-center" style={{ color: colors.text.accent }}>
                    ✓ {totalQuantity - outOfStockQuantity} porzioni proseguiranno normalmente
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.bg.card,
                  color: colors.text.secondary,
                  border: `1px solid ${colors.border.primary}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {hasOtherProducts ? 'Avanti' : 'Conferma'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: Scelta split/blocca (solo se necessario) */}
            <div className="text-center">
              <p className="text-base font-medium mb-2" style={{ color: colors.text.primary }}>
                {outOfStockQuantity === totalQuantity 
                  ? `Tutte le ${outOfStockQuantity} porzioni di` 
                  : `${outOfStockQuantity} su ${totalQuantity} porzioni di`} <span className="font-bold">{productName}</span> {outOfStockQuantity === 1 ? 'è esaurita' : 'sono esaurite'}
              </p>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                L'ordine contiene altri prodotti{outOfStockQuantity < totalQuantity ? ' e porzioni' : ''} disponibili. Come vuoi procedere?
              </p>
            </div>

            <div className="space-y-3">
              {/* Opzione Dividi */}
              <button
                onClick={() => handleSplitChoice(true)}
                className="w-full p-4 rounded-lg border-2 transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.secondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.button.success;
                  e.currentTarget.style.backgroundColor = colors.button.success + '10';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border.secondary;
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Split className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-base" style={{ color: colors.text.primary }}>
                      Dividi l'ordine
                    </h4>
                    <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                      I prodotti disponibili proseguono normalmente
                    </p>
                  </div>
                </div>
              </button>

              {/* Opzione Blocca */}
              <button
                onClick={() => handleSplitChoice(false)}
                className="w-full p-4 rounded-lg border-2 transition-all hover:scale-[1.02] hover:shadow-lg"
                style={{
                  backgroundColor: colors.bg.hover,
                  borderColor: colors.border.secondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.button.danger;
                  e.currentTarget.style.backgroundColor = colors.button.danger + '10';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border.secondary;
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Lock className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-base" style={{ color: colors.text.primary }}>
                      Blocca tutto l'ordine
                    </h4>
                    <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                      L'intero ordine attende la gestione del cameriere
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="pt-3 border-t" style={{ borderColor: colors.border.primary }}>
              <button
                onClick={() => setShowSplitChoice(false)}
                className="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: colors.bg.card,
                  color: colors.text.secondary,
                  border: `1px solid ${colors.border.primary}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.card;
                }}
              >
                Indietro
              </button>
            </div>
          </>
        )}
      </div>
    </ThemedModal>
  );
}