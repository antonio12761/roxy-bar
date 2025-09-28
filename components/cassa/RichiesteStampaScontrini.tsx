"use client";

import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, X, Clock, Euro, CreditCard, Receipt } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useEnhancedSSE } from '@/hooks/useEnhancedSSE';
import { confermaStampaScontrini } from '@/lib/actions/conferma-stampa-scontrini';
import { toast } from '@/lib/toast';

interface RichiestaScontrino {
  ordinazioneId: string;
  tavoloNumero?: string;
  totale: number;
  modalitaPagamento: 'CONTANTI' | 'POS' | 'MISTO';
  clienteNome?: string;
  cameriereNome: string;
  timestamp: string;
  datiScontrino: any;
}

export function RichiesteStampaScontrini() {
  const [richieste, setRichieste] = useState<RichiestaScontrino[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];

  // SSE per ricevere richieste in tempo reale
  const { isConnected } = useEnhancedSSE({
    clientId: "cassa-richieste-scontrini",
    userRole: "CASSA",
    onNotification: (notification) => {
      if (notification.type === "prepayment:requested") {
        const data = notification.data as any;
        const nuovaRichiesta: RichiestaScontrino = {
          ordinazioneId: data.orderId,
          tavoloNumero: data.tableNumber,
          totale: data.amount,
          modalitaPagamento: data.paymentMethod,
          clienteNome: data.customerName,
          cameriereNome: data.waiterName,
          timestamp: data.timestamp,
          datiScontrino: data.details?.datiScontrino || {}
        };
        setRichieste(prev => [nuovaRichiesta, ...prev]);
        
        // Notifica sonora/visiva
        toast.info(`Nuova richiesta scontrino da ${data.waiterName}`);
      }
    }
  });

  const handleConfermaStampa = async (richiesta: RichiestaScontrino) => {
    setIsProcessing(richiesta.ordinazioneId);
    
    try {
      const result = await confermaStampaScontrini(
        richiesta.ordinazioneId,
        richiesta.modalitaPagamento,
        {
          righe: richiesta.datiScontrino.righe || [],
          totale: richiesta.totale,
          tavoloNumero: richiesta.tavoloNumero,
          clienteNome: richiesta.clienteNome,
          cameriereNome: richiesta.cameriereNome
        }
      );

      if (result.success) {
        toast.success(
          `✅ Scontrino non fiscale stampato!\n` +
          `📋 Emettere ora lo scontrino fiscale ${richiesta.modalitaPagamento}`
        );
        
        // Rimuovi dalla lista
        setRichieste(prev => prev.filter(r => r.ordinazioneId !== richiesta.ordinazioneId));
      } else {
        toast.error(result.error || 'Errore nella stampa');
      }
    } catch (error) {
      console.error('Errore conferma stampa:', error);
      toast.error('Errore durante la conferma');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRifiuta = (ordinazioneId: string) => {
    setRichieste(prev => prev.filter(r => r.ordinazioneId !== ordinazioneId));
    toast.info('Richiesta annullata');
  };

  const getPaymentIcon = (modalita: string) => {
    switch (modalita) {
      case 'CONTANTI':
        return <Euro className="h-4 w-4" />;
      case 'POS':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getPaymentColor = (modalita: string) => {
    switch (modalita) {
      case 'CONTANTI':
        return colors.status?.warning || '#FFA500';
      case 'POS':
        return colors.text.info;
      default:
        return colors.text.secondary;
    }
  };

  if (richieste.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-md">
      <div className="rounded-lg shadow-lg overflow-hidden" style={{
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}>
        <div className="p-3 border-b flex items-center justify-between" style={{
          backgroundColor: colors.bg.darker,
          borderColor: colors.border.primary
        }}>
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5" style={{ color: colors.text.primary }} />
            <span className="font-medium" style={{ color: colors.text.primary }}>
              Richieste Scontrini ({richieste.length})
            </span>
          </div>
          {isConnected && (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {richieste.map((richiesta) => (
            <div
              key={richiesta.ordinazioneId}
              className="p-4 border-b transition-all"
              style={{
                borderColor: colors.border.secondary,
                backgroundColor: isProcessing === richiesta.ordinazioneId ? colors.bg.hover : 'transparent'
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg" style={{ color: colors.text.primary }}>
                      {richiesta.tavoloNumero ? `Tavolo ${richiesta.tavoloNumero}` : 'Asporto'}
                    </span>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
                      backgroundColor: getPaymentColor(richiesta.modalitaPagamento) + '20',
                      color: getPaymentColor(richiesta.modalitaPagamento)
                    }}>
                      {getPaymentIcon(richiesta.modalitaPagamento)}
                      <span className="text-xs font-medium">{richiesta.modalitaPagamento}</span>
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                    {richiesta.clienteNome && `${richiesta.clienteNome} • `}
                    {richiesta.cameriereNome}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold" style={{ color: colors.accent }}>
                    €{richiesta.totale.toFixed(2)}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(richiesta.timestamp).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleConfermaStampa(richiesta)}
                  disabled={isProcessing === richiesta.ordinazioneId}
                  className="flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: colors.text.success,
                    color: 'white',
                    opacity: isProcessing === richiesta.ordinazioneId ? 0.5 : 1
                  }}
                >
                  {isProcessing === richiesta.ordinazioneId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Stampa...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Conferma Stampa
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleRifiuta(richiesta.ordinazioneId)}
                  disabled={isProcessing === richiesta.ordinazioneId}
                  className="px-3 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.darker,
                    color: colors.text.secondary
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}