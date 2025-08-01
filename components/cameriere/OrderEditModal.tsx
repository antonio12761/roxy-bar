"use client";

import { useState } from "react";
import { Trash2, Edit3, Plus, Minus, X } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { cancellaOrdinazione, cancellaRigaOrdinazione, modificaQuantitaRiga } from "@/lib/actions/ordinazioni";
import { toast } from "@/lib/toast";
import { useTheme } from "@/contexts/ThemeContext";

interface OrderItem {
  id: string;
  prodottoId: number;
  prodotto?: {
    id: number;
    nome: string;
    prezzo: number;
  };
  quantita: number;
  stato: string;
  postazione?: string | null;
}

interface OrderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: number;
  tableNumber?: string;
  items: OrderItem[];
  orderStatus: string;
  onUpdate: () => void;
}

export function OrderEditModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  tableNumber,
  items,
  orderStatus,
  onUpdate
}: OrderEditModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [modifyingItems, setModifyingItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<{[key: string]: number}>(() => {
    const initialQuantities: {[key: string]: number} = {};
    items.forEach(item => {
      initialQuantities[item.id] = item.quantita;
    });
    return initialQuantities;
  });

  // Solo ordini ORDINATO possono essere modificati
  const canEdit = orderStatus === 'ORDINATO';

  const handleDeleteOrder = async () => {
    if (!confirm(`Sei sicuro di voler cancellare l'ordine #${orderNumber}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await cancellaOrdinazione(orderId);
      if (result.success) {
        toast.success("Ordine cancellato con successo");
        onUpdate();
        onClose();
      } else {
        toast.error(result.error || "Errore durante la cancellazione");
      }
    } catch (error) {
      toast.error("Errore durante la cancellazione dell'ordine");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteItem = async (itemId: string, productName?: string) => {
    if (!confirm(`Sei sicuro di voler rimuovere ${productName || 'questo prodotto'}?`)) {
      return;
    }

    setDeletingItems(prev => new Set(prev).add(itemId));
    try {
      const result = await cancellaRigaOrdinazione(itemId);
      if (result.success) {
        toast.success("Prodotto rimosso dall'ordine");
        onUpdate();
        
        // Se era l'ultimo prodotto, chiudi il modal
        if (items.length === 1) {
          onClose();
        }
      } else {
        toast.error(result.error || "Errore durante la rimozione");
      }
    } catch (error) {
      toast.error("Errore durante la rimozione del prodotto");
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setModifyingItems(prev => new Set(prev).add(itemId));
    try {
      const result = await modificaQuantitaRiga(itemId, newQuantity);
      if (result.success) {
        setQuantities(prev => ({ ...prev, [itemId]: newQuantity }));
        toast.success("Quantità aggiornata");
        onUpdate();
      } else {
        toast.error(result.error || "Errore durante la modifica");
      }
    } catch (error) {
      toast.error("Errore durante la modifica della quantità");
    } finally {
      setModifyingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  // Filtra solo i prodotti che possono essere modificati
  const editableItems = items.filter(item => item.stato === 'ORDINATO');
  const nonEditableItems = items.filter(item => item.stato !== 'ORDINATO');

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modifica Ordine #${orderNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Info ordine */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm" style={{ color: colors.text.secondary }}>
                {tableNumber ? `Tavolo ${tableNumber}` : 'Ordine al banco'}
              </p>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                Stato: {orderStatus}
              </p>
            </div>
            {canEdit && (
              <button
                onClick={handleDeleteOrder}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: colors.text.error,
                  color: 'white',
                  opacity: isDeleting ? 0.5 : 1
                }}
                onMouseEnter={(e) => !isDeleting && (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => !isDeleting && (e.currentTarget.style.opacity = '1')}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Cancellazione...' : 'Cancella ordine'}
              </button>
            )}
          </div>
        </div>

        {/* Lista prodotti modificabili */}
        {editableItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: colors.text.primary }}>
              Prodotti modificabili
            </h3>
            {editableItems.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm" style={{ color: colors.text.primary }}>
                    {item.prodotto?.nome || `Prodotto #${item.prodottoId}`}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    €{item.prodotto?.prezzo.toFixed(2)} cad.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Controlli quantità */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuantityChange(item.id, quantities[item.id] - 1)}
                      disabled={quantities[item.id] <= 1 || modifyingItems.has(item.id)}
                      className="p-1 rounded transition-colors"
                      style={{
                        backgroundColor: colors.bg.darker,
                        color: colors.text.primary,
                        opacity: (quantities[item.id] <= 1 || modifyingItems.has(item.id)) ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (quantities[item.id] > 1 && !modifyingItems.has(item.id)) {
                          e.currentTarget.style.backgroundColor = colors.bg.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = colors.bg.darker;
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    
                    <span className="w-8 text-center text-sm font-medium" style={{ color: colors.text.primary }}>
                      {modifyingItems.has(item.id) ? '...' : quantities[item.id]}
                    </span>
                    
                    <button
                      onClick={() => handleQuantityChange(item.id, quantities[item.id] + 1)}
                      disabled={modifyingItems.has(item.id)}
                      className="p-1 rounded transition-colors"
                      style={{
                        backgroundColor: colors.bg.darker,
                        color: colors.text.primary,
                        opacity: modifyingItems.has(item.id) ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!modifyingItems.has(item.id)) {
                          e.currentTarget.style.backgroundColor = colors.bg.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = colors.bg.darker;
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  
                  {/* Pulsante elimina */}
                  <button
                    onClick={() => handleDeleteItem(item.id, item.prodotto?.nome)}
                    disabled={deletingItems.has(item.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: colors.text.error,
                      color: 'white',
                      opacity: deletingItems.has(item.id) ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => !deletingItems.has(item.id) && (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => !deletingItems.has(item.id) && (e.currentTarget.style.opacity = '1')}
                    title="Rimuovi prodotto"
                  >
                    {deletingItems.has(item.id) ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista prodotti non modificabili */}
        {nonEditableItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
              Prodotti già in preparazione
            </h3>
            <p className="text-xs" style={{ color: colors.text.muted }}>
              Questi prodotti non possono essere modificati
            </p>
            {nonEditableItems.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg opacity-60"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.secondary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: colors.text.primary }}>
                    {item.prodotto?.nome || `Prodotto #${item.prodottoId}`}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.secondary }}>
                    Quantità: {item.quantita} - Stato: {item.stato}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pulsante chiudi */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors font-medium"
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
            Chiudi
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}