"use client";

import { Plus, Minus, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  disponibile?: boolean;
  terminato?: boolean;
  ingredienti?: string | null;
}

interface ProductItemProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
  colors: any;
  onProductClick?: (product: Product) => void;
  availableQuantity?: number | null;  // Quantità disponibile dall'inventario
  orderedQuantity?: number;  // Quantità già ordinata
}

export function ProductItem({ product, onAdd, colors, onProductClick, availableQuantity, orderedQuantity = 0 }: ProductItemProps) {
  const [quantity, setQuantity] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [prevAvailability, setPrevAvailability] = useState(product.disponibile);
  
  // Calcola se il prodotto è disponibile basandosi su inventario e stato del prodotto
  const hasLimitedInventory = availableQuantity !== undefined && availableQuantity !== null;
  const inventoryExhausted = hasLimitedInventory && availableQuantity === 0;
  const isUnavailable = product.disponibile === false || product.terminato === true || inventoryExhausted;
  
  // Calcola quanti ne possiamo ancora ordinare
  const remainingAvailable = hasLimitedInventory 
    ? Math.max(0, (availableQuantity || 0) - orderedQuantity)
    : Infinity;
  
  const maxOrderable = hasLimitedInventory ? remainingAvailable : 999;

  // Detect availability changes and trigger skeleton effect
  useEffect(() => {
    if (prevAvailability !== product.disponibile) {
      setIsUpdating(true);
      setPrevAvailability(product.disponibile);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [product.disponibile, prevAvailability]);

  const handleAdd = () => {
    if (isUnavailable || remainingAvailable === 0) return;
    
    // Limita la quantità a quella disponibile
    const actualQuantity = Math.min(quantity, remainingAvailable);
    onAdd(product, actualQuantity);
    setQuantity(1); // Reset after adding
  };

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 cursor-pointer ${isUpdating ? 'animate-pulse' : ''} ${isUnavailable ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: colors.bg.card,
        borderColor: isUnavailable ? colors.border.secondary : colors.border.secondary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}
      onClick={() => {
        if (!isUnavailable && !isUpdating && remainingAvailable > 0) {
          onAdd(product, 1); // Aggiungi 1 prodotto quando si clicca sulla card
        }
      }}
    >
      <div 
        className="flex-1"
        onClick={(e) => {
          e.stopPropagation(); // Previeni l'aggiunta quando si clicca sulla parte informativa
          onProductClick && onProductClick(product);
        }}
      >
        <div className={`font-medium ${isUnavailable ? 'line-through' : ''}`} style={{ color: colors.text.primary }}>
          {product.nome}
        </div>
        <div className="text-sm flex items-center gap-2 mt-1" style={{ color: colors.text.secondary }}>
          <span>€{Number(product.prezzo).toFixed(2)}</span>
          {product.codice && <span>• #{product.codice}</span>}
          {hasLimitedInventory && !isUnavailable && (
            <span style={{ color: remainingAvailable <= 5 ? colors.button.warning : colors.text.muted }}>
              • {remainingAvailable} disponibili
            </span>
          )}
          {isUnavailable && (
            <span style={{ color: colors.button.danger }}>
              • {inventoryExhausted ? `Esaurito (0 disponibili)` : product.terminato ? 'Esaurito' : 'Non disponibile'}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              !isUnavailable && setQuantity(Math.max(1, quantity - 1));
            }}
            className={`p-1 rounded transition-colors ${isUnavailable || remainingAvailable === 0 ? 'cursor-not-allowed' : ''}`}
            disabled={isUnavailable || remainingAvailable === 0}
            style={{
              backgroundColor: isUnavailable || remainingAvailable === 0 ? colors.bg.card : colors.bg.hover,
              color: isUnavailable || remainingAvailable === 0 ? colors.text.muted : colors.text.primary
            }}
            onMouseEnter={(e) => {
              if (!isUnavailable && remainingAvailable > 0) e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              if (!isUnavailable && remainingAvailable > 0) e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span 
            className="w-8 text-center font-medium"
            style={{ color: isUnavailable || remainingAvailable === 0 ? colors.text.muted : colors.text.primary }}
          >
            {quantity}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isUnavailable && remainingAvailable > 0) {
                const newQuantity = Math.min(quantity + 1, maxOrderable);
                setQuantity(newQuantity);
              }
            }}
            className={`p-1 rounded transition-colors ${isUnavailable || quantity >= maxOrderable ? 'cursor-not-allowed' : ''}`}
            disabled={isUnavailable || quantity >= maxOrderable}
            style={{
              backgroundColor: isUnavailable || quantity >= maxOrderable ? colors.bg.card : colors.bg.hover,
              color: isUnavailable || quantity >= maxOrderable ? colors.text.muted : colors.text.primary
            }}
            onMouseEnter={(e) => {
              if (!isUnavailable && quantity < maxOrderable) e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              if (!isUnavailable && quantity < maxOrderable) e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          className={`px-3 py-1 rounded transition-colors font-medium text-sm ${isUnavailable || remainingAvailable === 0 ? 'cursor-not-allowed' : ''}`}
          disabled={isUnavailable || remainingAvailable === 0}
          style={{
            backgroundColor: isUnavailable || remainingAvailable === 0 ? colors.bg.hover : colors.button.primary,
            color: isUnavailable || remainingAvailable === 0 ? colors.text.muted : colors.button.primaryText
          }}
          onMouseEnter={(e) => {
            if (!isUnavailable && remainingAvailable > 0) e.currentTarget.style.backgroundColor = colors.button.primaryHover;
          }}
          onMouseLeave={(e) => {
            if (!isUnavailable && remainingAvailable > 0) e.currentTarget.style.backgroundColor = colors.button.primary;
          }}
        >
          {isUnavailable ? 'Esaurito' : remainingAvailable === 0 ? 'Max raggiunto' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}