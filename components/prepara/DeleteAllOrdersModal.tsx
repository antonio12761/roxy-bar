'use client';

import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useTheme } from '@/contexts/ThemeContext';

interface DeleteAllOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteAllOrdersModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}: DeleteAllOrdersModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Conferma Cancellazione"
      size="md"
    >
      <div className="space-y-4">
        <p style={{ color: colors.text.primary }}>
          Sei sicuro di voler cancellare tutti gli ordini attivi?
        </p>
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Questa azione non può essere annullata. Tutti gli ordini in attesa, 
          in preparazione e pronti verranno eliminati definitivamente.
        </p>
        
        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: colors.bg.hover,
              color: colors.text.primary
            }}
            disabled={isDeleting}
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            style={{
              backgroundColor: colors.border.error,
              color: 'white'
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancellazione...
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                Cancella Tutto
              </>
            )}
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}