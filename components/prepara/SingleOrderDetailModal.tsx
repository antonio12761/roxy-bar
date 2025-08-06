'use client';

import React from 'react';
import { X, User, Clock, Package, Coffee } from 'lucide-react';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useTheme } from '@/contexts/ThemeContext';

interface OrderItem {
  id: string;
  prodotto: string;
  quantita: number;
  prezzo: number;
  note?: string;
}

interface SingleOrderDetail {
  id: string;
  cliente: string;
  cameriere: string;
  timestamp: string;
  items: OrderItem[];
  totale: number;
}

interface SingleOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetail: SingleOrderDetail | null;
}

export default function SingleOrderDetailModal({ 
  isOpen, 
  onClose, 
  orderDetail 
}: SingleOrderDetailModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  console.log('[SingleOrderModal] isOpen:', isOpen);
  console.log('[SingleOrderModal] orderDetail:', orderDetail);
  console.log('[SingleOrderModal] items:', orderDetail?.items);

  // Mostra sempre il modal se è aperto, anche senza dettagli (per debug)
  if (!isOpen) return null;

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Dettaglio Ordine Singolo"
      size="lg"
    >
      <div className="space-y-4">
        {!orderDetail ? (
          <div className="text-center py-8">
            <p style={{ color: colors.text.muted }}>
              Nessun dettaglio disponibile per questo ordine
            </p>
          </div>
        ) : (
          <>
            {/* Header con informazioni ordine */}
            <div className="flex items-center justify-between p-4 rounded-lg" 
              style={{ backgroundColor: colors.bg.hover }}
            >
              <div className="flex items-center gap-3">
                {/* Badge Cliente */}
                <div 
                  className="px-3 py-1.5 rounded-full flex items-center gap-2"
                  style={{ 
                    backgroundColor: colors.button.primary + '20',
                    color: colors.button.primary
                  }}
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium text-sm">{orderDetail.cliente}</span>
                </div>
                
                {/* Badge Cameriere */}
                <div 
                  className="px-3 py-1.5 rounded-full flex items-center gap-2"
                  style={{ 
                    backgroundColor: colors.text.accent + '20',
                    color: colors.text.accent
                  }}
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium text-sm">{orderDetail.cameriere}</span>
                </div>
              </div>
              
              {/* Orario */}
              <div className="flex items-center gap-2 text-sm" 
                style={{ color: colors.text.muted }}
              >
                <Clock className="h-4 w-4" />
                <span>{orderDetail.timestamp}</span>
              </div>
            </div>

            {/* Lista prodotti */}
            {orderDetail.items && orderDetail.items.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4" style={{ color: colors.text.primary }} />
                  <h3 className="font-medium" style={{ color: colors.text.primary }}>
                    Prodotti Ordinati ({orderDetail.items.length})
                  </h3>
                </div>
                
                <div className="space-y-2">
                  {orderDetail.items.map((item, index) => (
                    <div 
                      key={`${item.id}-${index}`}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ backgroundColor: colors.bg.hover }}
                    >
                      <div className="flex items-center gap-3">
                        <Coffee className="h-4 w-4" style={{ color: colors.text.muted }} />
                        <span className="font-bold" style={{ color: colors.text.primary }}>
                          {item.quantita}x
                        </span>
                        <div>
                          <p className="font-medium" style={{ color: colors.text.primary }}>
                            {item.prodotto}
                          </p>
                          {item.note && (
                            <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
                              Note: {item.note}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <span className="font-medium" style={{ color: colors.text.accent }}>
                        €{(item.prezzo * item.quantita).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p style={{ color: colors.text.muted }}>
                  Nessun prodotto disponibile per questo ordine
                </p>
                <p className="text-sm mt-2" style={{ color: colors.text.muted }}>
                  I dettagli dei prodotti potrebbero non essere stati salvati correttamente
                </p>
              </div>
            )}

            {/* Totale */}
            {orderDetail.totale > 0 && (
              <div className="pt-3 border-t" style={{ borderColor: colors.border.primary }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: colors.text.primary }}>
                    Totale Ordine
                  </span>
                  <span className="text-xl font-bold" style={{ color: colors.text.accent }}>
                    €{orderDetail.totale.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ThemedModal>
  );
}