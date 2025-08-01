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
  ingredienti?: string | null;
}

interface ProductItemProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
  colors: any;
  onProductClick?: (product: Product) => void;
}

export function ProductItem({ product, onAdd, colors, onProductClick }: ProductItemProps) {
  const [quantity, setQuantity] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [prevAvailability, setPrevAvailability] = useState(product.disponibile);
  const isUnavailable = product.disponibile === false;

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
    if (isUnavailable) return;
    onAdd(product, quantity);
    setQuantity(1); // Reset after adding
  };

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${isUpdating ? 'animate-pulse' : ''} ${isUnavailable ? 'opacity-60' : ''}`}
      style={{
        backgroundColor: colors.bg.card,
        borderColor: isUnavailable ? colors.border.secondary : colors.border.secondary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}
    >
      <div 
        className="flex-1 cursor-pointer"
        onClick={() => onProductClick && onProductClick(product)}
      >
        <div className={`font-medium ${isUnavailable ? 'line-through' : ''}`} style={{ color: colors.text.primary }}>
          {product.nome}
        </div>
        <div className="text-sm flex items-center gap-2 mt-1" style={{ color: colors.text.secondary }}>
          <span>€{product.prezzo.toFixed(2)}</span>
          {product.codice && <span>• #{product.codice}</span>}
          {isUnavailable && <span style={{ color: colors.button.danger }}>• Non disponibile</span>}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => !isUnavailable && setQuantity(Math.max(1, quantity - 1))}
            className={`p-1 rounded transition-colors ${isUnavailable ? 'cursor-not-allowed' : ''}`}
            disabled={isUnavailable}
            style={{
              backgroundColor: isUnavailable ? colors.bg.card : colors.bg.hover,
              color: isUnavailable ? colors.text.muted : colors.text.primary
            }}
            onMouseEnter={(e) => {
              if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span 
            className="w-8 text-center font-medium"
            style={{ color: isUnavailable ? colors.text.muted : colors.text.primary }}
          >
            {quantity}
          </span>
          <button
            onClick={() => !isUnavailable && setQuantity(quantity + 1)}
            className={`p-1 rounded transition-colors ${isUnavailable ? 'cursor-not-allowed' : ''}`}
            disabled={isUnavailable}
            style={{
              backgroundColor: isUnavailable ? colors.bg.card : colors.bg.hover,
              color: isUnavailable ? colors.text.muted : colors.text.primary
            }}
            onMouseEnter={(e) => {
              if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        <button
          onClick={handleAdd}
          className={`px-3 py-1 rounded transition-colors font-medium text-sm ${isUnavailable ? 'cursor-not-allowed' : ''}`}
          disabled={isUnavailable}
          style={{
            backgroundColor: isUnavailable ? colors.bg.hover : colors.button.primary,
            color: isUnavailable ? colors.text.muted : colors.button.primaryText
          }}
          onMouseEnter={(e) => {
            if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.button.primaryHover;
          }}
          onMouseLeave={(e) => {
            if (!isUnavailable) e.currentTarget.style.backgroundColor = colors.button.primary;
          }}
        >
          {isUnavailable ? 'Esaurito' : 'Aggiungi'}
        </button>
      </div>
    </div>
  );
}