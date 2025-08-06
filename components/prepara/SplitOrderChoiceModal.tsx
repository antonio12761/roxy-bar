'use client';

import React from 'react';
import { AlertTriangle, Split, Lock } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useTheme } from '@/contexts/ThemeContext';

interface SplitOrderChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  onChoice: (shouldSplit: boolean) => void;
}

export default function SplitOrderChoiceModal({
  isOpen,
  onClose,
  productName,
  onChoice
}: SplitOrderChoiceModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const handleSplit = () => {
    onChoice(true);
    onClose();
  };

  const handleBlock = () => {
    onChoice(false);
    onClose();
  };

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Come gestire l'ordine?"
    >
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-base font-medium mb-2" style={{ color: colors.text.primary }}>
            Il prodotto <span className="font-bold">{productName}</span> è esaurito
          </p>
          <p className="text-sm" style={{ color: colors.text.secondary }}>
            L'ordine contiene altri prodotti disponibili. Come vuoi procedere?
          </p>
        </div>

        <div className="space-y-3">
          {/* Opzione Dividi */}
          <button
            onClick={handleSplit}
            className="w-full p-4 rounded-lg border-2 transition-all hover:scale-[1.02] hover:shadow-lg"
            style={{
              backgroundColor: colors.bg.hover,
              borderColor: colors.border.secondary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.button.success;
              e.currentTarget.style.backgroundColor = colors.button.success + '10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border.secondary;
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Split className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-base" style={{ color: colors.text.primary }}>
                  Dividi l'ordine
                </h4>
                <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                  I prodotti disponibili proseguono normalmente in cucina
                </p>
              </div>
            </div>
          </button>

          {/* Opzione Blocca */}
          <button
            onClick={handleBlock}
            className="w-full p-4 rounded-lg border-2 transition-all hover:scale-[1.02] hover:shadow-lg"
            style={{
              backgroundColor: colors.bg.hover,
              borderColor: colors.border.secondary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.button.danger;
              e.currentTarget.style.backgroundColor = colors.button.danger + '10';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border.secondary;
              e.currentTarget.style.backgroundColor = colors.bg.hover;
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-base" style={{ color: colors.text.primary }}>
                  Blocca tutto l'ordine
                </h4>
                <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                  L'intero ordine attende la gestione del cameriere
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: colors.border.primary }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: colors.bg.card,
              color: colors.text.secondary,
              border: `1px solid ${colors.border.primary}`
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
    </ThemedModal>
  );
}