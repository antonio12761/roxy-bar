"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Clock, User } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";

interface AffectedOrder {
  orderId: string;
  orderNumber: number;
  tableNumber?: string;
  itemId: string;
  quantity: number;
  status: string;
  waiterName?: string;
}

interface ActiveOrdersUnavailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  affectedOrders: AffectedOrder[];
  isUrgent: boolean;
}

export function ActiveOrdersUnavailableModal({
  isOpen,
  onClose,
  productName,
  affectedOrders,
  isUrgent
}: ActiveOrdersUnavailableModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [playSound] = useState(() => {
    if (isUrgent && typeof window !== 'undefined') {
      // Create a simple beep sound for urgent notifications
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Frequency in Hz
      gainNode.gain.value = 0.1; // Volume
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2); // Play for 200ms
      
      return true;
    }
    return false;
  });

  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title={isUrgent ? "⚠️ URGENTE: Prodotto non disponibile" : "Prodotto non disponibile in ordini attivi"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Alert Header */}
        <div 
          className={`flex items-start gap-3 p-4 rounded-lg ${isUrgent ? 'animate-pulse' : ''}`}
          style={{ 
            backgroundColor: isUrgent ? colors.button.danger + '20' : colors.accent + '10',
            borderColor: isUrgent ? colors.button.danger : colors.accent,
            borderWidth: '2px',
            borderStyle: 'solid'
          }}
        >
          {isUrgent ? (
            <Bell className="h-6 w-6 flex-shrink-0 mt-0.5 animate-bounce" style={{ color: colors.button.danger }} />
          ) : (
            <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: colors.accent }} />
          )}
          <div>
            <p className="font-bold text-lg" style={{ color: colors.text.primary }}>
              {productName} è diventato non disponibile
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              {isUrgent 
                ? "Ordini già IN PREPARAZIONE - Azione immediata richiesta!"
                : "I seguenti ordini contengono questo prodotto:"}
            </p>
          </div>
        </div>

        {/* Affected Orders List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {affectedOrders.map((order, index) => (
            <div 
              key={`${order.orderId}-${order.itemId}`}
              className={`p-4 rounded-lg ${isUrgent && order.status === 'IN_LAVORAZIONE' ? 'ring-2' : ''}`}
              style={{
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid',
                ...(isUrgent && order.status === 'IN_LAVORAZIONE' && {
                  ringColor: colors.button.danger
                })
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg" style={{ color: colors.text.primary }}>
                      Ordine #{order.orderNumber}
                    </span>
                    {order.tableNumber && (
                      <span className="px-2 py-1 rounded text-sm font-medium" style={{ 
                        backgroundColor: colors.accent + '20',
                        color: colors.accent
                      }}>
                        Tavolo {order.tableNumber}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span style={{ color: colors.text.secondary }}>Quantità:</span>
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        {order.quantity}x {productName}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" style={{ color: colors.text.muted }} />
                      <span style={{ color: colors.text.secondary }}>
                        Stato: {order.status === 'IN_LAVORAZIONE' ? 'IN PREPARAZIONE' : 'ORDINATO'}
                      </span>
                    </div>
                    
                    {order.waiterName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4" style={{ color: colors.text.muted }} />
                        <span style={{ color: colors.text.secondary }}>
                          Cameriere: {order.waiterName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {order.status === 'IN_LAVORAZIONE' && (
                  <div 
                    className="px-3 py-1 rounded-full text-sm font-bold animate-pulse"
                    style={{ 
                      backgroundColor: colors.button.danger,
                      color: 'white'
                    }}
                  >
                    IN PREP.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Instructions */}
        <div 
          className="p-4 rounded-lg"
          style={{
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <p className="font-medium mb-2" style={{ color: colors.text.primary }}>
            Azioni richieste:
          </p>
          <ul className="space-y-2 text-sm" style={{ color: colors.text.secondary }}>
            {isUrgent ? (
              <>
                <li>• Contatta IMMEDIATAMENTE la postazione di preparazione</li>
                <li>• Informa il cliente e proponi alternative</li>
                <li>• Aggiorna l'ordine con il prodotto sostitutivo concordato</li>
              </>
            ) : (
              <>
                <li>• Gli ordini sono stati notificati alla postazione di preparazione</li>
                <li>• Preparati a proporre alternative ai clienti</li>
                <li>• Monitora lo stato degli ordini per eventuali aggiornamenti</li>
              </>
            )}
          </ul>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg transition-colors font-medium"
            style={{
              backgroundColor: isUrgent ? colors.button.danger : colors.button.primary,
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Ho capito
          </button>
        </div>
      </div>
    </ThemedModal>
  );
}