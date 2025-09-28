import React from 'react';
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { OutOfStockBadge } from './OutOfStockBadge';

interface OrderItemProps {
  item: {
    id: string;
    prodotto: {
      nome: string;
      categoria: string;
    };
    quantita: number;
    stato: string;
    postazione: string;
    esaurito?: boolean;
  };
  isUpdating: boolean;
  onStatusUpdate: (newStatus: string) => void;
}

export const OrderItem: React.FC<OrderItemProps> = ({ item, isUpdating, onStatusUpdate }) => {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const getStatoBadge = (stato: string) => {
    const stateMap = {
      "INSERITO": { label: "In attesa", color: colors.bg.hover, textColor: colors.text.secondary, icon: '⏳' },
      "IN_LAVORAZIONE": { label: "In preparazione", color: colors.button.primary, textColor: 'white', icon: '👨‍🍳' },
      "PRONTO": { label: "Pronto", color: colors.button.success, textColor: 'white', icon: '✅' },
      "CONSEGNATO": { label: "Consegnato", color: colors.text.muted, textColor: 'white', icon: '✓' },
      "ANNULLATO": { label: "Annullato", color: colors.text.error, textColor: 'white', icon: '✗' }
    };
    
    const config = stateMap[stato as keyof typeof stateMap] || { 
      label: stato, 
      color: colors.text.muted, 
      textColor: 'white',
      icon: '•' 
    };
    
    return (
      <span 
        className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
        style={{ 
          backgroundColor: config.color,
          color: config.textColor
        }}
      >
        <span className="text-xs">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg ${item.esaurito ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
      style={{ backgroundColor: item.esaurito ? `${colors.bg.hover}20` : colors.bg.hover }}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-medium" style={{ color: item.esaurito ? colors.text.error : colors.text.primary }}>
            {item.quantita}x {item.prodotto.nome}
          </span>
          {item.esaurito && <OutOfStockBadge size="sm" />}
          {getStatoBadge(item.stato)}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {item.postazione}
          </span>
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {item.prodotto.categoria}
          </span>
        </div>
      </div>
      
      {/* Action buttons */}
      {item.stato === "PRONTO" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusUpdate("CONSEGNATO");
          }}
          disabled={isUpdating}
          className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          style={{
            backgroundColor: colors.button.success,
            color: colors.button.successText
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.button.successHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.button.success;
          }}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Consegnato
        </button>
      )}
    </div>
  );
};