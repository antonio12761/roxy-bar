"use client";

import { Edit2, Trash2, FileText } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// Import the Product type from parent component or define a shared type
interface Category {
  id: number;
  name: string;
  icon?: string | null;
  order: number;
  productsCount: number;
  subcategories?: any[];
}

interface Subcategory {
  id: number;
  name: string;
  order: number;
  categoryId: number;
  productsCount?: number;
  category?: Category;
}

interface Product {
  id: number;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  available: boolean;
  categoryId?: number;
  subcategoryId?: number;
  category?: Category;
  subcategory?: Subcategory;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onEditProcedure?: (product: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete, onEditProcedure }: ProductCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  const getProductLocation = () => {
    if (product.subcategory) {
      return `${product.subcategory.category?.name} > ${product.subcategory.name}`;
    } else if (product.category) {
      return product.category.name;
    }
    return "Senza categoria";
  };

  return (
    <div
      className="rounded-lg p-4 transition-all duration-200 hover:scale-105"
      style={{ 
        backgroundColor: colors.bg.card, 
        borderColor: colors.border.primary, 
        borderWidth: '1px', 
        borderStyle: 'solid' 
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.border.secondary}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border.primary}
    >
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-32 object-cover rounded-lg mb-3"
        />
      )}
      
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold" style={{ color: colors.text.primary }}>
            {product.name}
          </h3>
          <div className="px-2 py-1 rounded text-xs" 
            style={{ 
              backgroundColor: product.available ? colors.border.success : colors.bg.darker,
              color: product.available ? colors.text.success : colors.text.error,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: product.available ? colors.border.success : colors.border.error
            }}
          >
            {product.available ? "Disponibile" : "Non disponibile"}
          </div>
        </div>

        {product.description && (
          <p className="text-sm line-clamp-2" style={{ color: colors.text.secondary }}>
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold" 
            style={{ 
              color: product.price ? colors.text.primary : colors.text.error 
            }}
          >
            {product.price ? `€${product.price.toFixed(2)}` : "⚠️ Da completare"}
          </span>
          <span className="text-xs" 
            style={{ 
              color: getProductLocation() === "Senza categoria" 
                ? colors.text.error 
                : colors.text.muted 
            }}
          >
            {getProductLocation()}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => onEdit(product)}
            className="flex-1 px-3 py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors duration-200"
            style={{ 
              backgroundColor: colors.button.primary, 
              color: colors.button.primaryText 
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            <Edit2 className="h-3 w-3" />
            Modifica
          </button>
          {onEditProcedure && (
            <button
              onClick={() => onEditProcedure(product)}
              className="px-3 py-2 rounded text-sm transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.success, 
                color: colors.button.successText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
              title="Procedura di preparazione"
            >
              <FileText className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onDelete(product)}
            className="px-3 py-2 rounded text-sm transition-colors duration-200"
            style={{ 
              backgroundColor: colors.text.error, 
              color: 'white' 
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}