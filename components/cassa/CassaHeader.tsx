import React from 'react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  Users,
  RefreshCw,
  Receipt,
  Layers,
  Bluetooth
} from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { SSEConnectionStatus } from "@/components/SSEConnectionStatus";
import { ThemeSelector } from "@/components/ui/ThemeSelector";

interface CassaHeaderProps {
  stats: {
    daPagere: number;
    pagando: number;
    pagati: number;
    debiti: number;
  };
  onRefresh: () => void;
  onShowHistory: () => void;
  onShowScontrinoQueue: () => void;
  onShowMultiPayment?: () => void;
  onShowBluetoothPanel?: () => void;
  showHistory: boolean;
  showScontrinoQueue: boolean;
}

export default function CassaHeader({ 
  stats, 
  onRefresh, 
  onShowHistory, 
  onShowScontrinoQueue,
  onShowMultiPayment,
  onShowBluetoothPanel,
  showHistory,
  showScontrinoQueue
}: CassaHeaderProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  return (
    <div className="px-4 py-3 border-b" 
      style={{ 
        borderColor: colors.border.primary, 
        backgroundColor: colors.bg.card 
      }}
    >
      <div className="flex items-center gap-4">
        <CreditCard className="h-5 w-5" style={{ color: colors.text.secondary }} />
        <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
          Postazione Cassa
        </h1>
        <span className="text-base" style={{ color: colors.text.secondary }}>
          {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: colors.text.secondary }} />
            <span className="text-base" style={{ color: colors.text.primary }}>
              {stats.daPagere + stats.pagando} da pagare
            </span>
          </div>
          <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />
            <span className="text-base" style={{ color: colors.text.primary }}>
              {stats.pagati} pagati
            </span>
          </div>
          <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: colors.text.warning || colors.text.accent }} />
            <span className="text-base" style={{ color: colors.text.primary }}>
              {stats.debiti} debiti
            </span>
          </div>
        </div>
        
        <div className="flex-1" />
          
        {/* Connection Status */}
        <SSEConnectionStatus 
          compact={true}
          showLatency={true}
          showReconnectAttempts={false}
        />

        {/* Theme Selector */}
        <ThemeSelector />
            
        {/* Actions */}
        {onShowMultiPayment && (
          <button
            onClick={onShowMultiPayment}
            className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.button.success,
              color: colors.button.successText
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
          >
            <Layers className="h-4 w-4" />
            Pagamento Multi-Tavolo
          </button>
        )}

        {onShowBluetoothPanel && (
          <button
            onClick={onShowBluetoothPanel}
            className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.button?.secondary || '#f3f4f6',
              color: colors.button?.secondaryText || '#374151'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button?.secondaryHover || colors.button?.secondary || '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button?.secondary || '#f3f4f6'}
          >
            <Bluetooth className="h-4 w-4" />
            Stampante
          </button>
        )}
        
        <button
          onClick={onShowHistory}
          className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          style={{ 
            backgroundColor: showHistory ? colors.bg.darker : colors.bg.hover,
            color: colors.text.primary
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showHistory ? colors.bg.darker : colors.bg.hover}
        >
          <Clock className="h-4 w-4" />
          Storico
        </button>
            
        <button
          onClick={onShowScontrinoQueue}
          className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          style={{ 
            backgroundColor: showScontrinoQueue ? colors.button.primaryHover : colors.button.primary,
            color: colors.button.primaryText
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showScontrinoQueue ? colors.button.primaryHover : colors.button.primary}
        >
          <Receipt className="h-4 w-4" />
          Queue Scontrini
        </button>
            
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <RefreshCw className="h-5 w-5" style={{ color: colors.text.secondary }} />
        </button>
      </div>
    </div>
  );
}