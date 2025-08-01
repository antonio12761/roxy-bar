"use client";

import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
}

interface ProductListModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: string;
  products: Product[];
  onAddProduct: (product: Product, quantity: number) => void;
  onBack: () => void;
}

function ProductRow({ product, onAdd }: { product: Product; onAdd: (product: Product, quantity: number) => void }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    onAdd(product, quantity);
    setQuantity(1); // Reset quantity after adding
  };

  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg transition-colors"
      style={{
        backgroundColor: colors.bg.hover,
        borderColor: colors.border.secondary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}
    >
      <div className="flex-1">
        <div className="font-medium" style={{ color: colors.text.primary }}>
          {product.nome}
        </div>
        <div className="text-sm flex items-center gap-2" style={{ color: colors.text.secondary }}>
          <span>€{product.prezzo.toFixed(2)}</span>
          {product.codice && <span>• #{product.codice}</span>}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
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
            <Minus className="h-4 w-4" />
          </button>
          <span 
            className="w-8 text-center font-medium"
            style={{ color: colors.text.primary }}
          >
            {quantity}
          </span>
          <button
            onClick={() => setQuantity(quantity + 1)}
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
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        <button
          onClick={handleAdd}
          className="px-3 py-1 rounded transition-colors font-medium"
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
          Aggiungi
        </button>
      </div>
    </div>
  );
}

export function ProductListModal({
  isOpen,
  onClose,
  category,
  products,
  onAddProduct,
  onBack
}: ProductListModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const getCategoryEmoji = (category: string) => {
    const emojiMap: { [key: string]: string } = {
      "Birre": "🍺",
      "Vini": "🍷",
      "Cocktails": "🍹",
      "Caffetteria": "☕",
      "Bibite": "🥤",
      "Panini": "🥪",
      "Pizze": "🍕",
      "Primi": "🍝",
      "Secondi": "🍖",
      "Dolci": "🍰",
      "Gelati": "🍨",
      "Aperitivi": "🥂",
      "Sfusi": "🍿",
      "default": "📋"
    };
    return emojiMap[category] || emojiMap.default;
  };

  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={onClose}
      size="lg"
    >
      {/* Custom Header with Back Button */}
      <div 
        className="flex items-center gap-3 pb-4 mb-4"
        style={{ borderBottom: `1px solid ${colors.border.secondary}` }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.bg.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft className="h-5 w-5" style={{ color: colors.text.muted }} />
        </button>
        <span className="text-xl">{getCategoryEmoji(category)}</span>
        <h2 className="text-lg font-bold" style={{ color: colors.text.primary }}>
          {category}
        </h2>
      </div>

      {/* Products List */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            onAdd={onAddProduct}
          />
        ))}
      </div>
    </ThemedModal>
  );
}