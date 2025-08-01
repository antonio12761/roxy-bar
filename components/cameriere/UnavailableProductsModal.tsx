"use client";

import { AlertTriangle, X } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: number;
  nome: string;
  prezzo: number;
}

interface UnavailableProduct {
  prodotto: Product;
  quantita: number;
}

interface UnavailableProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unavailableProducts: UnavailableProduct[];
  onRemoveProducts: () => void;
  onKeepProducts: () => void;
}

export function UnavailableProductsModal({
  isOpen,
  onClose,
  unavailableProducts,
  onRemoveProducts,
  onKeepProducts
}: UnavailableProductsModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const totalValue = unavailableProducts.reduce(
    (sum, item) => sum + (item.prodotto.prezzo * item.quantita), 
    0
  );

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Prodotti non disponibili"
      size="md"
    >
      <div className="space-y-4">
        {/* Alert Icon and Message */}
        <div className="flex items-start gap-3 p-4 rounded-lg" style={{ 
          backgroundColor: colors.button.danger + '10',
          borderColor: colors.button.danger + '40',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: colors.button.danger }} />
          <div>
            <p className="font-medium" style={{ color: colors.text.primary }}>
              Attenzione! {unavailableProducts.length === 1 ? 'Un prodotto è diventato' : `${unavailableProducts.length} prodotti sono diventati`} non disponibile
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              I seguenti prodotti nel tuo ordine non sono più disponibili:
            </p>
          </div>
        </div>

        {/* List of unavailable products */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {unavailableProducts.map((item, index) => (
            <div 
              key={index}
              className="p-3 rounded-lg flex items-center justify-between"
              style={{
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <div>
                <p className="font-medium line-through" style={{ color: colors.text.muted }}>
                  {item.quantita}x {item.prodotto.nome}
                </p>
                <p className="text-sm" style={{ color: colors.text.secondary }}>
                  €{(item.prodotto.prezzo * item.quantita).toFixed(2)}
                </p>
              </div>
              <AlertTriangle className="h-4 w-4" style={{ color: colors.button.danger }} />
            </div>
          ))}
        </div>

        {/* Total value */}
        <div 
          className="p-3 rounded-lg flex items-center justify-between"
          style={{
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <span className="font-medium" style={{ color: colors.text.primary }}>
            Valore totale prodotti non disponibili:
          </span>
          <span className="font-bold" style={{ color: colors.button.danger }}>
            €{totalValue.toFixed(2)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <p className="text-sm text-center" style={{ color: colors.text.muted }}>
            Cosa vuoi fare con questi prodotti?
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onRemoveProducts}
              className="p-3 rounded-lg transition-colors font-medium"
              style={{
                backgroundColor: colors.button.danger,
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Rimuovi dall'ordine
            </button>
            
            <button
              onClick={onKeepProducts}
              className="p-3 rounded-lg transition-colors font-medium"
              style={{
                backgroundColor: colors.bg.card,
                color: colors.text.primary,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.bg.card;
              }}
            >
              Mantieni (cercherò alternative)
            </button>
          </div>
        </div>
      </div>
    </ThemedModal>
  );
}