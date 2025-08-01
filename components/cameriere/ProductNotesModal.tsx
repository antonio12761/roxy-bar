"use client";

import { useState } from "react";
import { X, StickyNote, Wine } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
  categoria: string;
  postazione?: string | null;
  codice?: number | null;
  requiresGlasses?: boolean;
  disponibile?: boolean;
  ingredienti?: string | null;
}

interface ProductNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAddNote?: (note: string) => void;
  onOpenGlassesModal?: () => void;
  existingNote?: string;
}

export function ProductNotesModal({ 
  isOpen, 
  onClose, 
  product, 
  onAddNote,
  onOpenGlassesModal,
  existingNote = ""
}: ProductNotesModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  const [note, setNote] = useState(existingNote);

  if (!isOpen || !product) return null;

  const handleClose = () => {
    setNote(existingNote);
    onClose();
  };

  const handleSaveNote = () => {
    if (onAddNote) {
      onAddNote(note);
      handleClose();
    }
  };

  const handleGlassesClick = () => {
    if (onOpenGlassesModal) {
      onOpenGlassesModal();
      handleClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-4 flex items-center justify-between sticky top-0"
          style={{ 
            borderBottom: `1px solid ${colors.border.primary}`,
            backgroundColor: colors.bg.card
          }}
        >
          <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
            {product.nome}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: 'transparent',
              color: colors.text.muted
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Glasses Card - Only if product requires glasses */}
          {product.requiresGlasses && (
            <div 
              className="p-4 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onClick={handleGlassesClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-3">
                <Wine className="h-6 w-6" style={{ color: colors.accent }} />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                    Gestisci Bicchieri
                  </h3>
                  <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                    Clicca per specificare il numero di bicchieri
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Note Card */}
          <div 
            className="p-4 rounded-lg transition-all"
            style={{
              backgroundColor: colors.bg.hover,
              borderColor: colors.border.secondary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <StickyNote className="h-6 w-6" style={{ color: colors.accent }} />
              <h3 className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                Nota per il Prodotto
              </h3>
            </div>
            
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Inserisci una nota per questo prodotto..."
                className="w-full p-3 rounded-lg resize-none"
                rows={3}
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
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
                  Salva Nota
                </button>
                <button
                  onClick={() => {
                    setNote(existingNote);
                  }}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: colors.text.primary
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}