'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Check, Split, Lock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface OrderItem {
  id: string;
  prodottoId: number | null;
  prodotto: string;
  quantita: number;
  prezzo: number;
  stato: string;
  postazione?: string | null;
  note?: string | null;
}

interface MultiOutOfStockSelectorProps {
  orderItems: OrderItem[];
  onConfirm: (selectedItems: { itemId: string; productId: number; productName: string; quantity: number; maxQuantity: number }[], shouldSplit: boolean) => void;
}

export default function MultiOutOfStockSelector({ orderItems, onConfirm }: MultiOutOfStockSelectorProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
  const [showSplitChoice, setShowSplitChoice] = useState(false);
  const [selectedSplitOption, setSelectedSplitOption] = useState<boolean | null>(null);

  // Debug logging for state changes
  useEffect(() => {
    console.log('[MultiOutOfStockSelector] State updated:', {
      selectedItems: Array.from(selectedItems),
      quantities,
      showSplitChoice
    });
  }, [selectedItems, quantities, showSplitChoice]);

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Remove quantity when deselecting
      setQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[itemId];
        console.log('[toggleItem] Removed quantity for', itemId, newQuantities);
        return newQuantities;
      });
    } else {
      newSelected.add(itemId);
      // Set initial quantity to max when selecting
      const item = orderItems.find(i => i.id === itemId);
      if (item) {
        // Check if we already have a quantity stored, if not use the max
        setQuantities(prev => {
          const existingQuantity = prev[itemId];
          const newQuantity = existingQuantity !== undefined ? existingQuantity : item.quantita;
          const newQuantities = { ...prev, [itemId]: newQuantity };
          console.log('[toggleItem] Set quantity for', itemId, 'to', newQuantity, newQuantities);
          return newQuantities;
        });
      }
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, value: number, maxQuantity: number) => {
    console.log('[MultiOutOfStockSelector] Changing quantity:', { itemId, value, maxQuantity, current: quantities[itemId] });
    if (value >= 1 && value <= maxQuantity) {
      setQuantities(prev => {
        const newQuantities = { ...prev, [itemId]: value };
        console.log('[MultiOutOfStockSelector] New quantities state:', newQuantities);
        return newQuantities;
      });
    }
  };

  const handleNext = () => {
    console.log('[handleNext] Called with state:', { selectedItems: Array.from(selectedItems), quantities });
    
    const selected = Array.from(selectedItems).map(itemId => {
      const item = orderItems.find(i => i.id === itemId);
      if (!item || !item.prodottoId) return null;
      
      // Use the quantity from state, or item quantity as fallback
      const currentQuantity = quantities[itemId] !== undefined ? quantities[itemId] : item.quantita;
      
      console.log(`[handleNext] Item ${item.prodotto}: using quantity ${currentQuantity} (max: ${item.quantita})`);
      
      return {
        itemId: item.id,
        productId: item.prodottoId,
        productName: item.prodotto,
        quantity: currentQuantity,
        maxQuantity: item.quantita
      };
    }).filter(Boolean) as any[];

    if (selected.length > 0) {
      // Calcola se ci sono altri prodotti disponibili nell'ordine
      let hasOtherAvailableProducts = false;
      
      // Controlla prodotti non selezionati
      const selectedItemIds = new Set(selected.map(item => item.itemId));
      const otherItems = orderItems.filter(item => 
        item.prodottoId && !selectedItemIds.has(item.id) && 
        item.stato !== 'ANNULLATO' && item.stato !== 'CONSEGNATO'
      );
      
      if (otherItems.length > 0) {
        hasOtherAvailableProducts = true;
      }
      
      // Controlla anche se ci sono quantità parziali (non tutto esaurito)
      for (const selectedItem of selected) {
        if (selectedItem.quantity < selectedItem.maxQuantity) {
          hasOtherAvailableProducts = true;
          break;
        }
      }
      
      if (hasOtherAvailableProducts) {
        // Mostra le opzioni split/blocca
        setShowSplitChoice(true);
      } else {
        // Non ci sono altri prodotti disponibili, procedi con split=true
        onConfirm(selected, true);
        resetAndClose();
      }
    }
  };

  const handleSplitChoice = (shouldSplit: boolean) => {
    console.log('[handleSplitChoice] Called with shouldSplit:', shouldSplit, 'state:', { selectedItems: Array.from(selectedItems), quantities });
    
    const selected = Array.from(selectedItems).map(itemId => {
      const item = orderItems.find(i => i.id === itemId);
      if (!item || !item.prodottoId) return null;
      
      // Use the quantity from state, or item quantity as fallback
      const currentQuantity = quantities[itemId] !== undefined ? quantities[itemId] : item.quantita;
      
      console.log(`[handleSplitChoice] Item ${item.prodotto}: using quantity ${currentQuantity} (max: ${item.quantita})`);
      
      return {
        itemId: item.id,
        productId: item.prodottoId,
        productName: item.prodotto,
        quantity: currentQuantity,
        maxQuantity: item.quantita
      };
    }).filter(Boolean) as any[];

    onConfirm(selected, shouldSplit);
    resetAndClose();
  };

  const resetAndClose = () => {
    setIsExpanded(false);
    setSelectedItems(new Set());
    setQuantities({});  // Reset also quantities
    setShowSplitChoice(false);
    setSelectedSplitOption(null);
  };

  // Filter only items that can be marked as out of stock
  const availableItems = orderItems.filter(item => 
    item.prodottoId && item.stato !== 'ANNULLATO' && item.stato !== 'CONSEGNATO'
  );

  if (availableItems.length === 0) return null;

  return (
    <>
      {/* Floating triangle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute top-4 right-4 p-2 rounded-lg transition-all hover:scale-110 z-20"
        style={{
          backgroundColor: selectedItems.size > 0 ? colors.button.danger : colors.button.warning || '#f59e0b',
          color: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}
        title="Seleziona prodotti esauriti"
      >
        <div className="relative">
          <AlertTriangle className="h-5 w-5" />
          {selectedItems.size > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {selectedItems.size}
            </span>
          )}
        </div>
      </button>

      {/* Expandable selection panel */}
      {isExpanded && (
        <div 
          className="absolute top-14 right-4 w-80 rounded-lg shadow-xl z-30 max-h-[70vh] overflow-hidden flex flex-col"
          style={{
            backgroundColor: colors.bg.card,
            border: `2px solid ${colors.border.primary}`
          }}
        >
          {/* Header */}
          <div 
            className="p-3 flex items-center justify-between sticky top-0"
            style={{ 
              backgroundColor: colors.bg.hover,
              borderBottom: `1px solid ${colors.border.primary}`
            }}
          >
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: colors.text.primary }}>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Seleziona Prodotti Esauriti
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
            >
              <ChevronUp className="h-4 w-4" style={{ color: colors.text.muted }} />
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {availableItems.map(item => {
              const isSelected = selectedItems.has(item.id);
              // Get quantity from state, defaulting to item quantity only if not set
              const quantity = quantities[item.id] !== undefined ? quantities[item.id] : item.quantita;
              
              return (
                <div
                  key={item.id}
                  className="rounded-lg p-2 transition-all cursor-pointer select-none"
                  style={{
                    backgroundColor: isSelected ? colors.button.danger + '15' : colors.bg.hover,
                    border: `1px solid ${isSelected ? colors.button.danger : colors.border.secondary}`
                  }}
                  onClick={(e) => {
                    // Only toggle if we're not clicking on the quantity controls
                    if (!(e.target as HTMLElement).closest('.quantity-controls')) {
                      toggleItem(item.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
                    <div 
                      className="w-5 h-5 rounded border-2 flex items-center justify-center"
                      style={{
                        borderColor: isSelected ? colors.button.danger : colors.border.primary,
                        backgroundColor: isSelected ? colors.button.danger : 'transparent'
                      }}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    
                    {/* Product info */}
                    <div className="flex-1">
                      <div className="font-medium text-sm" style={{ color: colors.text.primary }}>
                        {item.prodotto}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.secondary }}>
                        Quantità: {item.quantita}
                        {isSelected && quantities[item.id] !== undefined && quantities[item.id] !== item.quantita && (
                          <span className="ml-2 text-amber-600 font-medium">
                            (Selezionate: {quantities[item.id]})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity selector for selected items */}
                    {isSelected && item.quantita > 1 && (
                      <div 
                        className="quantity-controls flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentQty = quantities[item.id] !== undefined ? quantities[item.id] : item.quantita;
                            const newValue = currentQty - 1;
                            console.log('[Decrement] Current:', currentQty, 'New:', newValue);
                            if (newValue >= 1) {
                              handleQuantityChange(item.id, newValue, item.quantita);
                            }
                          }}
                          disabled={quantity <= 1}
                          className="px-2 py-1 text-xs rounded disabled:opacity-50 select-none"
                          style={{
                            backgroundColor: colors.bg.card,
                            color: colors.text.primary
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.quantita}
                          value={quantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            if (value >= 1 && value <= item.quantita) {
                              handleQuantityChange(item.id, value, item.quantita);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          className="w-12 text-sm font-medium text-center border-0 bg-transparent outline-none"
                          style={{ color: colors.text.primary }}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentQty = quantities[item.id] !== undefined ? quantities[item.id] : item.quantita;
                            const newValue = currentQty + 1;
                            console.log('[Increment] Current:', currentQty, 'New:', newValue);
                            if (newValue <= item.quantita) {
                              handleQuantityChange(item.id, newValue, item.quantita);
                            }
                          }}
                          disabled={quantity >= item.quantita}
                          className="px-2 py-1 text-xs rounded disabled:opacity-50 select-none"
                          style={{
                            backgroundColor: colors.bg.card,
                            color: colors.text.primary
                          }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with confirm button or split choice */}
          {selectedItems.size > 0 && (
            <div 
              className="p-3 sticky bottom-0"
              style={{ 
                backgroundColor: colors.bg.hover,
                borderTop: `1px solid ${colors.border.primary}`
              }}
            >
              {!showSplitChoice ? (
                <button
                  onClick={handleNext}
                  className="w-full py-2 px-4 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Segna {selectedItems.size} prodott{selectedItems.size === 1 ? 'o' : 'i'} come esaurit{selectedItems.size === 1 ? 'o' : 'i'}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-center" style={{ color: colors.text.primary }}>
                    Come gestire l'ordine?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSplitChoice(true)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105"
                      style={{
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        color: colors.text.primary
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.button.primary;
                        e.currentTarget.style.backgroundColor = colors.button.primary + '10';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border.primary;
                        e.currentTarget.style.backgroundColor = colors.bg.card;
                      }}
                    >
                      <Split className="h-6 w-6" style={{ color: colors.button.primary }} />
                      <span className="text-xs font-medium">Dividi ordine</span>
                      <span className="text-xs opacity-75">I prodotti disponibili continuano</span>
                    </button>
                    
                    <button
                      onClick={() => handleSplitChoice(false)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105"
                      style={{
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        color: colors.text.primary
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = colors.button.warning || colors.button.primary;
                        e.currentTarget.style.backgroundColor = (colors.button.warning || colors.button.primary) + '10';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = colors.border.primary;
                        e.currentTarget.style.backgroundColor = colors.bg.card;
                      }}
                    >
                      <Lock className="h-6 w-6" style={{ color: colors.button.warning }} />
                      <span className="text-xs font-medium">Blocca intero</span>
                      <span className="text-xs opacity-75">Attendi gestione cameriere</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setShowSplitChoice(false)}
                    className="w-full py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Indietro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}