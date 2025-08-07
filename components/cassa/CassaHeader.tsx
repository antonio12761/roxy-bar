import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  Users,
  RefreshCw,
  Receipt,
  Layers,
  Bluetooth,
  Info,
  Menu,
  X,
  ShoppingBag
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
  onShowDirectReceipt?: () => void;
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
  onShowDirectReceipt,
  showHistory,
  showScontrinoQueue
}: CassaHeaderProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [showStatsPopup, setShowStatsPopup] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  
  // Close stats popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statsRef.current && !statsRef.current.contains(event.target as Node)) {
        setShowStatsPopup(false);
      }
    };
    
    if (showStatsPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStatsPopup]);

  return (
    <div className="px-4 py-3 border-b" 
      style={{ 
        borderColor: colors.border.primary, 
        backgroundColor: colors.bg.card 
      }}
    >
      <div className="flex items-center gap-2 md:gap-4">
        <CreditCard className="h-5 w-5" style={{ color: colors.text.secondary }} />
        <h1 className="text-base md:text-lg font-medium" style={{ color: colors.text.primary }}>
          Cassa
        </h1>
        <span className="hidden md:inline text-base" style={{ color: colors.text.secondary }}>
          {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
        
        {/* Compact Stats Button for Tablets/Mobile */}
        <div className="relative lg:hidden" ref={statsRef}>
          <button
            onClick={() => setShowStatsPopup(!showStatsPopup)}
            className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          >
            <Info className="h-4 w-4" />
            <div className="flex items-center gap-1">
              <span className="font-medium">{stats.daPagere + stats.pagando}</span>
              <span className="text-xs">/{stats.pagati}</span>
            </div>
          </button>
          
          {/* Stats Popup */}
          {showStatsPopup && (
            <div 
              className="absolute top-full mt-2 left-0 z-50 p-4 rounded-lg shadow-lg min-w-[240px]"
              style={{ 
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
                border: '1px solid'
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" style={{ color: colors.text.secondary }} />
                    <span style={{ color: colors.text.secondary }}>Da pagare</span>
                  </div>
                  <span className="font-medium" style={{ color: colors.text.primary }}>
                    {stats.daPagere + stats.pagando}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />
                    <span style={{ color: colors.text.secondary }}>Pagati</span>
                  </div>
                  <span className="font-medium" style={{ color: colors.text.success }}>
                    {stats.pagati}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: colors.text.warning || colors.text.accent }} />
                    <span style={{ color: colors.text.secondary }}>Debiti</span>
                  </div>
                  <span className="font-medium" style={{ color: colors.text.warning || colors.text.accent }}>
                    {stats.debiti}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Full Stats for Desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
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
          
        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Connection Status */}
          <SSEConnectionStatus 
            compact={true}
            showLatency={true}
            showReconnectAttempts={false}
          />

          {/* Theme Selector */}
          <ThemeSelector />
              
          {/* Actions */}
          {onShowDirectReceipt && (
            <button
              onClick={onShowDirectReceipt}
              className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              title="Scontrino Diretto"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden lg:inline">Scontrino Diretto</span>
            </button>
          )}

          {onShowMultiPayment && (
            <button
              onClick={onShowMultiPayment}
              className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: colors.button.success,
                color: colors.button.successText,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.successHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.success}
              title="Pagamento Multi-Tavolo"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden lg:inline">Multi-Tavolo</span>
            </button>
          )}

          {onShowBluetoothPanel && (
            <button
              onClick={onShowBluetoothPanel}
              className="p-1.5 rounded-lg transition-colors duration-200"
              style={{ 
                backgroundColor: colors.button?.secondary || '#f3f4f6',
                color: colors.button?.secondaryText || '#374151',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button?.secondaryHover || colors.button?.secondary || '#e5e7eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button?.secondary || '#f3f4f6'}
              title="Stampante Bluetooth"
            >
              <Bluetooth className="h-4 w-4" />
            </button>
          )}
          
          <button
            onClick={onShowHistory}
            className="p-1.5 rounded-lg transition-colors duration-200"
            style={{ 
              backgroundColor: showHistory ? colors.bg.darker : colors.bg.hover,
              color: colors.text.primary,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.darker}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showHistory ? colors.bg.darker : colors.bg.hover}
            title="Storico Pagamenti"
          >
            <Clock className="h-4 w-4" />
          </button>
              
          <button
            onClick={onShowScontrinoQueue}
            className="p-1.5 rounded-lg transition-colors duration-200"
            style={{ 
              backgroundColor: showScontrinoQueue ? colors.button.primaryHover : colors.button.primary,
              color: colors.button.primaryText,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = showScontrinoQueue ? colors.button.primaryHover : colors.button.primary}
            title="Queue Scontrini"
          >
            <Receipt className="h-4 w-4" />
          </button>
              
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Aggiorna"
          >
            <RefreshCw className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden p-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {showMobileMenu ? (
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          ) : (
            <Menu className="h-5 w-5" style={{ color: colors.text.secondary }} />
          )}
        </button>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div 
          className="md:hidden mt-3 pt-3 border-t flex flex-wrap gap-2"
          style={{ borderColor: colors.border.secondary }}
        >
          <SSEConnectionStatus 
            compact={true}
            showLatency={false}
            showReconnectAttempts={false}
          />
          
          <ThemeSelector />
          
          {onShowDirectReceipt && (
            <button
              onClick={() => {
                onShowDirectReceipt();
                setShowMobileMenu(false);
              }}
              className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText,
                cursor: 'pointer'
              }}
            >
              <ShoppingBag className="h-4 w-4" />
              Scontrino Diretto
            </button>
          )}
          
          {onShowMultiPayment && (
            <button
              onClick={() => {
                onShowMultiPayment();
                setShowMobileMenu(false);
              }}
              className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: colors.button.success,
                color: colors.button.successText,
                cursor: 'pointer'
              }}
            >
              <Layers className="h-4 w-4" />
              Multi-Tavolo
            </button>
          )}
          
          {onShowBluetoothPanel && (
            <button
              onClick={() => {
                onShowBluetoothPanel();
                setShowMobileMenu(false);
              }}
              className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
              style={{ 
                backgroundColor: colors.button?.secondary || '#f3f4f6',
                color: colors.button?.secondaryText || '#374151',
                cursor: 'pointer'
              }}
            >
              <Bluetooth className="h-4 w-4" />
              Stampante
            </button>
          )}
          
          <button
            onClick={() => {
              onShowHistory();
              setShowMobileMenu(false);
            }}
            className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
            style={{ 
              backgroundColor: showHistory ? colors.bg.darker : colors.bg.hover,
              color: colors.text.primary,
              cursor: 'pointer'
            }}
          >
            <Clock className="h-4 w-4" />
            Storico
          </button>
          
          <button
            onClick={() => {
              onShowScontrinoQueue();
              setShowMobileMenu(false);
            }}
            className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
            style={{ 
              backgroundColor: showScontrinoQueue ? colors.button.primaryHover : colors.button.primary,
              color: colors.button.primaryText,
              cursor: 'pointer'
            }}
          >
            <Receipt className="h-4 w-4" />
            Queue
          </button>
          
          <button
            onClick={() => {
              onRefresh();
              setShowMobileMenu(false);
            }}
            className="px-3 py-1.5 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </button>
        </div>
      )}
    </div>
  );
}