"use client";

import { useEffect } from 'react';
import { printerService } from '@/lib/bluetooth/printer-service';

/**
 * Componente per inizializzare la stampa rapida
 * Pre-carica impostazioni e tenta auto-connessione
 */
export function FastPrintInitializer() {
  useEffect(() => {
    // Inizializza in background
    const initialize = async () => {
      try {
        // Pre-carica impostazioni (già fatto nel costruttore di printerService)
        console.log('🚀 Inizializzazione stampa rapida...');
        
        // Verifica se c'è un dispositivo salvato nel localStorage
        const savedDevice = localStorage.getItem('lastPrinterDevice');
        if (savedDevice) {
          console.log('📱 Tentativo riconnessione automatica a:', savedDevice);
          // Tenta riconnessione automatica (non blocca UI)
          printerService.connectPrinter().catch(err => {
            console.log('⚠️ Riconnessione automatica fallita:', err.message);
          });
        }
        
        // Pre-carica impostazioni (forza refresh)
        await printerService.loadReceiptSettings(false);
        console.log('✅ Impostazioni pre-caricate');
        
      } catch (error) {
        console.log('⚠️ Errore inizializzazione stampa rapida:', error);
      }
    };
    
    // Esegui inizializzazione con delay minimo
    const timer = setTimeout(initialize, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Questo componente non renderizza nulla
  return null;
}