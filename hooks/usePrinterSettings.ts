"use client";

import { useState, useEffect } from 'react';

export interface PrinterSettings {
  autoprint: boolean;
  defaultEnabled: boolean;
  showConfirmDialog: boolean;
}

const STORAGE_KEY = 'bar-roxy-printer-settings';

const defaultSettings: PrinterSettings = {
  autoprint: false, // Default: chiedi sempre
  defaultEnabled: true, // Default: checkbox checked
  showConfirmDialog: true, // Mostra sempre la checkbox
};

export function usePrinterSettings() {
  const [settings, setSettings] = useState<PrinterSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Carica impostazioni da localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.warn('Errore caricamento impostazioni stampante:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Salva impostazioni in localStorage
  const updateSettings = (newSettings: Partial<PrinterSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Errore salvataggio impostazioni stampante:', error);
    }
  };

  return {
    settings,
    updateSettings,
    isLoaded
  };
}