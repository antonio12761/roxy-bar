"use client";

import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { createSubcategory } from "@/lib/actions/products";

interface Category {
  id: number;
  name: string;
  icon?: string | null;
}

interface SubcategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

export function SubcategoryModal({ isOpen, onClose, categories, onSuccess }: SubcategoryModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    order: ""
  });

  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", categoryId: "", order: "" });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createSubcategory({
      name: formData.name,
      categoryId: parseInt(formData.categoryId),
      order: formData.order ? parseInt(formData.order) : undefined
    });

    if (result.success) {
      onSuccess();
      onClose();
      alert("✅ Sottocategoria creata con successo!");
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
        className="rounded-lg p-6 max-w-md w-full"
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
            Nuova Sottocategoria
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
              Categoria Padre *
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: colors.bg.input, 
                borderColor: colors.border.primary, 
                color: colors.text.primary,
                borderWidth: '1px', 
                borderStyle: 'solid' 
              }}
              required
            >
              <option value="">Seleziona categoria</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

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
              Ordine
            </label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData(prev => ({ ...prev, order: e.target.value }))}
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
                backgroundColor: colors.button.primary, 
                color: colors.button.primaryText 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            >
              <Save className="h-4 w-4" />
              Crea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}