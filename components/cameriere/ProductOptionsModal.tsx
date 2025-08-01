"use client";

import { useState } from "react";
import { X, Coffee, AlertCircle, StickyNote } from "lucide-react";
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

interface ProductOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onToggleAvailability?: (productId: number, available: boolean) => void;
  onAddNote?: (note: string) => void;
  existingNote?: string;
}

export function ProductOptionsModal({ 
  isOpen, 
  onClose, 
  product, 
  onToggleAvailability,
  onAddNote,
  existingNote = ""
}: ProductOptionsModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [note, setNote] = useState(existingNote);
  const [showNoteInput, setShowNoteInput] = useState(false);

  if (!isOpen || !product) return null;

  const handleClose = () => {
    setShowNoteInput(false);
    setNote(existingNote);
    onClose();
  };

  const handleToggleAvailability = () => {
    if (onToggleAvailability && product) {
      onToggleAvailability(product.id, !product.disponibile);
      handleClose();
    }
  };

  const handleSaveNote = () => {
    if (onAddNote) {
      onAddNote(note);
      handleClose();
    }
  };

  const hasRecipe = product.ingredienti && product.ingredienti.trim() !== "";

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
          {/* Recipe Card */}
          {hasRecipe && (
            <div 
              className="p-4 rounded-lg cursor-pointer transition-all"
              style={{
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Coffee className="h-6 w-6" style={{ color: colors.accent }} />
                <h3 className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                  Ricetta
                </h3>
              </div>
              <div className="text-sm" style={{ color: colors.text.secondary }}>
                {product.ingredienti}
              </div>
            </div>
          )}

          {/* Out of Stock Card */}
          <div 
            className="p-4 rounded-lg cursor-pointer transition-all"
            style={{
              backgroundColor: product.disponibile === false ? colors.status?.error || '#ef4444' + '20' : colors.bg.hover,
              borderColor: product.disponibile === false ? colors.status?.error || '#ef4444' : colors.border.secondary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            onClick={handleToggleAvailability}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.status?.error || '#ef4444'}20`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6" style={{ color: colors.status?.error || '#ef4444' }} />
              <div className="flex-1">
                <h3 className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                  {product.disponibile === false ? 'Prodotto Esaurito' : 'Segna come Esaurito'}
                </h3>
                <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                  {product.disponibile === false 
                    ? 'Clicca per rendere nuovamente disponibile' 
                    : 'Clicca per segnare il prodotto come non disponibile'}
                </p>
              </div>
            </div>
          </div>

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
            <div 
              className="flex items-center gap-3 mb-3 cursor-pointer"
              onClick={() => setShowNoteInput(!showNoteInput)}
            >
              <StickyNote className="h-6 w-6" style={{ color: colors.accent }} />
              <h3 className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                Aggiungi Nota
              </h3>
            </div>
            
            {showNoteInput && (
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
                      setShowNoteInput(false);
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}