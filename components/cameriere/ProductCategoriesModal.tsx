"use client";

import { ArrowLeft } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

interface ProductCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSelectCategory: (category: string) => void;
}

export function ProductCategoriesModal({
  isOpen,
  onClose,
  categories,
  onSelectCategory
}: ProductCategoriesModalProps) {
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
      title="Menu Categorie"
      size="lg"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className="p-4 rounded-lg transition-all duration-200 hover:scale-105 text-center"
            style={{
              backgroundColor: colors.bg.hover,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.darker;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <div className="text-3xl mb-2">{getCategoryEmoji(category)}</div>
            <div className="font-medium" style={{ color: colors.text.primary }}>
              {category}
            </div>
          </button>
        ))}
      </div>
    </ThemedModal>
  );
}