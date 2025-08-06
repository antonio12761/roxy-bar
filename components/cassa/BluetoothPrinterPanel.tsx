"use client";

import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  BluetoothConnected, 
  Printer, 
  Settings, 
  AlertCircle,
  CheckCircle,
  Loader2,
  X
} from 'lucide-react';
import { printerService, PrinterStatus } from '@/lib/bluetooth/printer-service';
import { useTheme } from '@/contexts/ThemeContext';
import { usePrinterSettings } from '@/hooks/usePrinterSettings';

interface BluetoothPrinterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothPrinterPanel({ isOpen, onClose }: BluetoothPrinterPanelProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { settings: printerSettings, updateSettings: updatePrinterSettings } = usePrinterSettings();
  
  const [status, setStatus] = useState<PrinterStatus>({ connected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Ottieni stato iniziale
    setStatus(printerService.getStatus());
    
    // Sottoscrivi agli aggiornamenti
    const unsubscribe = printerService.onStatusChange(setStatus);
    
    return unsubscribe;
  }, [isOpen]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const success = await printerService.connectPrinter();
      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await printerService.disconnectPrinter();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await printerService.printTest();
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  const isSupported = (printerService.constructor as any).isBluetoothSupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div 
        className="relative w-full max-w-md rounded-xl shadow-xl border"
        style={{ 
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary 
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.border.primary }}>
          <div className="flex items-center gap-3">
            <Bluetooth className="h-6 w-6" style={{ color: colors.button.primary }} />
            <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
              Stampante Bluetooth
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-opacity-80"
            style={{ backgroundColor: colors.bg.hover }}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Supporto Bluetooth */}
          {!isSupported && (
            <div 
              className="p-4 rounded-lg border flex items-center gap-3"
              style={{ 
                backgroundColor: (colors.status?.error || '#ef4444') + '10',
                borderColor: (colors.status?.error || '#ef4444') + '30'
              }}
            >
              <AlertCircle className="h-5 w-5" style={{ color: colors.status?.error || '#ef4444' }} />
              <div>
                <div className="font-medium" style={{ color: colors.status?.error || '#ef4444' }}>
                  Web Bluetooth non supportato
                </div>
                <div className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                  Usa Chrome/Edge su Android per accedere al Bluetooth
                </div>
              </div>
            </div>
          )}

          {/* Status stampante */}
          <div className="space-y-4">
            <h3 className="font-medium" style={{ color: colors.text.primary }}>
              Stato Connessione
            </h3>
            
            <div 
              className="p-4 rounded-lg border flex items-center gap-3"
              style={{ 
                backgroundColor: status.connected ? (colors.status?.success || '#10b981') + '10' : colors.bg.hover,
                borderColor: status.connected ? (colors.status?.success || '#10b981') + '30' : colors.border.secondary
              }}
            >
              {status.connected ? (
                <BluetoothConnected className="h-5 w-5" style={{ color: colors.status?.success || '#10b981' }} />
              ) : (
                <Bluetooth className="h-5 w-5" style={{ color: colors.text.muted }} />
              )}
              
              <div className="flex-1">
                <div className="font-medium" style={{ color: colors.text.primary }}>
                  {status.connected ? 'Connessa' : 'Disconnessa'}
                </div>
                {status.deviceName && (
                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                    {status.deviceName}
                  </div>
                )}
                {status.lastPrint && (
                  <div className="text-sm" style={{ color: colors.text.muted }}>
                    Ultima stampa: {status.lastPrint.toLocaleTimeString('it-IT')}
                  </div>
                )}
              </div>
            </div>

            {/* Errori */}
            {status.error && (
              <div 
                className="p-3 rounded-lg border flex items-center gap-2"
                style={{ 
                  backgroundColor: (colors.status?.warning || '#f59e0b') + '10',
                  borderColor: (colors.status?.warning || '#f59e0b') + '30'
                }}
              >
                <AlertCircle className="h-4 w-4" style={{ color: colors.status?.warning || '#f59e0b' }} />
                <span className="text-sm" style={{ color: colors.status?.warning || '#f59e0b' }}>
                  {status.error}
                </span>
              </div>
            )}

            {/* Messaggio successo */}
            {showSuccess && (
              <div 
                className="p-3 rounded-lg border flex items-center gap-2"
                style={{ 
                  backgroundColor: (colors.status?.success || '#10b981') + '10',
                  borderColor: (colors.status?.success || '#10b981') + '30'
                }}
              >
                <CheckCircle className="h-4 w-4" style={{ color: colors.status?.success || '#10b981' }} />
                <span className="text-sm" style={{ color: colors.status?.success || '#10b981' }}>
                  Stampante connessa con successo!
                </span>
              </div>
            )}
          </div>

          {/* Azioni */}
          <div className="space-y-3">
            {!status.connected ? (
              <button
                onClick={handleConnect}
                disabled={!isSupported || isConnecting}
                className="w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: colors.button.primary,
                  color: colors.button.primaryText
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && isSupported) {
                    e.currentTarget.style.backgroundColor = colors.button.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.button.primary;
                }}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connessione...
                  </>
                ) : (
                  <>
                    <Bluetooth className="h-4 w-4" />
                    Connetti Netum NT-1809
                  </>
                )}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: colors.button.secondary,
                    color: colors.button.secondaryText
                  }}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Test...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Test
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: colors.status?.error || '#ef4444',
                    color: colors.button.primaryText
                  }}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disconnessione...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Disconnetti
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Impostazioni Stampa */}
          <div className="space-y-4">
            <h3 className="font-medium" style={{ color: colors.text.primary }}>
              Impostazioni Stampa
            </h3>
            
            <div className="space-y-3">
              {/* Stampa automatica */}
              <label className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4" style={{ color: colors.text.secondary }} />
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                      Stampa sempre automaticamente
                    </span>
                    <p className="text-xs" style={{ color: colors.text.muted }}>
                      Salta la richiesta di conferma
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={printerSettings.autoprint}
                  onChange={(e) => updatePrinterSettings({ autoprint: e.target.checked })}
                  className="w-4 h-4 rounded border-2 transition-colors"
                  style={{
                    accentColor: colors.button.primary,
                    borderColor: colors.border.primary
                  }}
                />
              </label>
              
              {/* Default abilitato */}
              {!printerSettings.autoprint && (
                <label className="flex items-center justify-between ml-6">
                  <div>
                    <span className="text-sm" style={{ color: colors.text.primary }}>
                      Checkbox stampa attiva di default
                    </span>
                    <p className="text-xs" style={{ color: colors.text.muted }}>
                      La checkbox sarà pre-selezionata
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={printerSettings.defaultEnabled}
                    onChange={(e) => updatePrinterSettings({ defaultEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-2 transition-colors"
                    style={{
                      accentColor: colors.button.primary,
                      borderColor: colors.border.primary
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Info dispositivo */}
          <div 
            className="p-4 rounded-lg text-sm space-y-2"
            style={{ backgroundColor: colors.bg.hover }}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" style={{ color: colors.text.muted }} />
              <span className="font-medium" style={{ color: colors.text.secondary }}>
                Informazioni Dispositivo
              </span>
            </div>
            <div style={{ color: colors.text.muted }}>
              • Modello supportato: Netum NT-1809<br />
              • Carta termica: 58mm<br />
              • Connessione: Bluetooth 4.0<br />
              • Comandi: ESC/POS compatibili
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}