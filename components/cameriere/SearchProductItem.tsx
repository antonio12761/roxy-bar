"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, AlertCircle } from "lucide-react";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  disponibile?: boolean;
}

interface SearchProductItemProps {
  product: Product;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onQuantityClick: () => void;
  onAdd: (product: Product, quantity: number) => void;
  colors: any;
}

export function SearchProductItem({ 
  product, 
  quantity, 
  onQuantityChange, 
  onQuantityClick,
  onAdd, 
  colors 
}: SearchProductItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [prevAvailability, setPrevAvailability] = useState(product.disponibile);
  const isAvailable = product.disponibile !== false;

  // Detect availability changes and trigger skeleton effect
  useEffect(() => {
    if (prevAvailability !== product.disponibile) {
      setIsUpdating(true);
      setPrevAvailability(product.disponibile);
      const timer = setTimeout(() => setIsUpdating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [product.disponibile, prevAvailability]);

  return (
    <div 
      className={`flex items-center justify-between p-3 transition-all duration-300 ${isUpdating ? 'animate-pulse' : ''} ${!isAvailable ? 'opacity-60' : ''}`}
      style={{
        borderBottom: `1px solid ${colors.border.secondary}`,
        backgroundColor: isUpdating ? colors.bg.hover : 'transparent'
      }}
      onMouseEnter={(e) => {
        if (!isUpdating && isAvailable) {
          e.currentTarget.style.backgroundColor = colors.bg.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!isUpdating) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <div className="flex-1">
        <div className={`font-medium flex items-center gap-2 ${!isAvailable ? 'line-through' : ''}`} style={{ color: !isAvailable ? colors.text.muted : colors.text.primary }}>
          {product.nome}
          {!isAvailable && (
            <AlertCircle className="h-4 w-4" style={{ color: colors.text.error }} />
          )}
        </div>
        <div className="text-sm" style={{ color: colors.text.secondary }}>
          €{product.prezzo.toFixed(2)} • {product.categoria}
          {product.codice && <span className="ml-2">#{product.codice}</span>}
          {!isAvailable && <span className="ml-2" style={{ color: colors.text.error }}>Non disponibile</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(Math.max(1, quantity - 1));
            }}
            className="p-1 rounded transition-colors"
            style={{
              backgroundColor: colors.bg.card,
              color: colors.text.primary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.card;
            }}
          >
            <Minus className="h-3 w-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityClick();
            }}
            className="w-8 text-center font-medium cursor-pointer hover:underline"
            style={{ color: colors.text.primary }}
          >
            {quantity}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuantityChange(quantity + 1);
            }}
            className="p-1 rounded transition-colors"
            style={{
              backgroundColor: colors.bg.card,
              color: colors.text.primary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.card;
            }}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isAvailable) {
              onAdd(product, quantity);
            }
          }}
          disabled={!isAvailable || isUpdating}
          className={`px-3 py-1 rounded transition-colors font-medium text-sm ${!isAvailable || isUpdating ? 'cursor-not-allowed' : ''}`}
          style={{
            backgroundColor: !isAvailable ? colors.bg.card : colors.button.primary,
            color: !isAvailable ? colors.text.muted : colors.button.primaryText,
            opacity: isUpdating ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (isAvailable && !isUpdating) {
              e.currentTarget.style.backgroundColor = colors.button.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            if (isAvailable && !isUpdating) {
              e.currentTarget.style.backgroundColor = colors.button.primary;
            }
          }}
        >
          {!isAvailable ? 'Non disp.' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}