"use client";

import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { createProduct, updateProduct } from "@/lib/actions/products";

interface Category {
  id: number;
  name: string;
  icon?: string | null;
  subcategories: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
  categoryId: number;
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
  requiresGlasses?: boolean;
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  onSuccess: () => void;
}

export function ProductModal({ isOpen, onClose, product, categories, onSuccess }: ProductModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    categoryId: "",
    subcategoryId: "",
    available: true,
    requiresGlasses: false
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || "",
        price: product.price?.toString() || "",
        imageUrl: product.imageUrl || "",
        categoryId: product.categoryId?.toString() || "",
        subcategoryId: product.subcategoryId?.toString() || "",
        available: product.available,
        requiresGlasses: product.requiresGlasses || false
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
        imageUrl: "",
        categoryId: "",
        subcategoryId: "",
        available: true,
        requiresGlasses: false
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      price: formData.price ? parseFloat(formData.price) : undefined,
      imageUrl: formData.imageUrl || undefined,
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
      subcategoryId: formData.subcategoryId ? parseInt(formData.subcategoryId) : undefined,
      available: formData.available,
      requiresGlasses: formData.requiresGlasses
    };

    const result = product 
      ? await updateProduct(product.id, data)
      : await createProduct(data);

    if (result.success) {
      onSuccess();
      onClose();
      alert(`✅ Prodotto ${product ? 'aggiornato' : 'creato'} con successo!`);
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
            {product ? "Modifica Prodotto" : "Nuovo Prodotto"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.text.secondary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Nome *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Prezzo (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              URL Immagine
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
              Categoria
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                categoryId: e.target.value,
                subcategoryId: "" // Reset sottocategoria
              }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
            >
              <option value="">Seleziona categoria</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {formData.categoryId && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                Sottocategoria (opzionale)
              </label>
              <select
                value={formData.subcategoryId}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  subcategoryId: e.target.value,
                  categoryId: e.target.value ? "" : prev.categoryId // Reset categoria se si seleziona sottocategoria
                }))}
                className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: colors.bg.input, 
                  borderColor: colors.border.primary, 
                  color: colors.text.primary,
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
              >
                <option value="">Nessuna sottocategoria</option>
                {categories
                  .find(cat => cat.id === parseInt(formData.categoryId))
                  ?.subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))
                }
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="available"
              checked={formData.available}
              onChange={(e) => setFormData(prev => ({ ...prev, available: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="available" className="text-sm" style={{ color: colors.text.secondary }}>
              Prodotto disponibile
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresGlasses"
              checked={formData.requiresGlasses}
              onChange={(e) => setFormData(prev => ({ ...prev, requiresGlasses: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="requiresGlasses" className="text-sm" style={{ color: colors.text.secondary }}>
              Richiede bicchieri (per bottiglie)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg transition-colors duration-200"
              style={{ 
                backgroundColor: colors.bg.darker, 
                color: colors.text.secondary 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button.success, 
                color: colors.button.successText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
            >
              <Save className="h-4 w-4" />
              {product ? "Aggiorna" : "Crea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}