import React, { memo, useState, useEffect } from 'react';
import { Gift, AlertTriangle, User } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface TableCardProps {
  table: {
    id: number;
    numero: string;
    stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
    clienteNome?: string | null;
    hasOutOfStockOrder?: boolean;
    outOfStockHandledBy?: string | null;
    lastOrderStatus?: string | null;
    lastOrderReadyTime?: string | null;
  };
  isGiftMode: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  showTooltip?: boolean;
  tooltipContent?: React.ReactNode;
}

// Helper function to get order status label
const getOrderStatusLabel = (status: string): string => {
  switch (status) {
    case 'ORDINATO':
      return 'Ordinato';
    case 'IN_PREPARAZIONE':
      return 'In prep.';
    case 'PRONTO':
      return 'Pronto';
    case 'CONSEGNATO':
      return 'Consegnato';
    case 'RITIRATO':
      return 'Ritirato';
    case 'PAGATO':
      return 'Pagato';
    case 'ANNULLATO':
      return 'Annullato';
    default:
      return status;
  }
};

// Memoized component to prevent re-renders
export const TableCard = memo(function TableCard({
  table,
  isGiftMode,
  onClick,
  onMouseEnter,
  onMouseLeave,
  showTooltip,
  tooltipContent
}: TableCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const [, forceUpdate] = useState({});

  // Force re-render every 10 seconds to update colors for ready orders
  useEffect(() => {
    if (table.lastOrderStatus === 'PRONTO' && table.lastOrderReadyTime) {
      const interval = setInterval(() => {
        forceUpdate({});
      }, 10000); // Update every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [table.lastOrderStatus, table.lastOrderReadyTime]);

  // Calculate time elapsed for ready orders
  const getReadyStateClass = () => {
    if (table.lastOrderStatus !== 'PRONTO' || !table.lastOrderReadyTime) {
      return null;
    }
    
    const readyTime = new Date(table.lastOrderReadyTime).getTime();
    const now = Date.now();
    const minutesElapsed = (now - readyTime) / (1000 * 60);
    
    if (minutesElapsed < 1) {
      return 'table-card-ready-yellow';  // Yellow in first minute
    } else if (minutesElapsed < 2) {
      return 'table-card-ready-red';     // Red from 1-2 minutes
    } else {
      return 'table-card-ready-red-flash'; // Flashing red after 2 minutes
    }
  };

  const readyClass = getReadyStateClass();

  // CSS classes based on state - computed once
  const stateClasses = {
    LIBERO: `table-card-free`,
    OCCUPATO: table.hasOutOfStockOrder 
      ? `table-card-out-of-stock` 
      : readyClass 
        ? readyClass
        : `table-card-occupied`,
    RISERVATO: `table-card-reserved`,
    IN_PULIZIA: `table-card-cleaning`
  };

  const baseClasses = `
    aspect-square p-2 rounded-lg border-2 transition-all duration-200 
    flex flex-col items-center justify-center hover:scale-105 w-full relative
    ${stateClasses[table.stato]}
    ${isGiftMode ? 'cursor-pointer transform hover:-translate-y-1' : ''}
  `;

  return (
    <>
      {/* Dynamic styles for theme colors */}
      <style jsx>{`
        .table-card-free {
          background-color: ${colors.bg.card};
          border-color: ${colors.border.secondary};
          color: ${colors.text.primary};
        }
        .table-card-free:hover {
          opacity: 0.9;
          border-color: ${colors.accent};
        }
        
        .table-card-occupied {
          background-color: ${colors.table?.occupied || colors.button.success};
          border-color: ${colors.table?.occupied || colors.button.success};
          color: ${colors.table?.occupiedText || 'white'};
        }
        .table-card-occupied:hover {
          opacity: 0.9;
          border-color: ${colors.accent};
        }
        
        .table-card-out-of-stock {
          background-color: #ef4444;
          border-color: #dc2626;
          color: white;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .table-card-out-of-stock:hover {
          opacity: 0.9;
          border-color: #991b1b;
        }
        
        .table-card-ready-yellow {
          background-color: #fbbf24;
          border-color: #f59e0b;
          color: white;
        }
        .table-card-ready-yellow:hover {
          opacity: 0.9;
          border-color: #d97706;
        }
        
        .table-card-ready-red {
          background-color: #ef4444;
          border-color: #dc2626;
          color: white;
        }
        .table-card-ready-red:hover {
          opacity: 0.9;
          border-color: #b91c1c;
        }
        
        .table-card-ready-red-flash {
          background-color: #ef4444;
          border-color: #dc2626;
          color: white;
          animation: flash 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .table-card-ready-red-flash:hover {
          opacity: 0.9;
          border-color: #b91c1c;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        @keyframes flash {
          0%, 100% {
            opacity: 1;
            background-color: #ef4444;
          }
          50% {
            opacity: 0.7;
            background-color: #dc2626;
          }
        }
        
        .table-card-reserved {
          background-color: ${colors.accent};
          border-color: ${colors.accent};
          color: ${colors.text.primary};
        }
        .table-card-reserved:hover {
          opacity: 0.9;
        }
        
        .table-card-cleaning {
          background-color: ${colors.bg.hover};
          border-color: ${colors.border.secondary};
          color: ${colors.text.primary};
        }
        .table-card-cleaning:hover {
          opacity: 0.9;
          border-color: ${colors.accent};
        }
      `}</style>

      <div className="relative">
        <button
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={baseClasses}
        >
          <div className={`text-lg font-bold transition-all duration-200 ${
            isGiftMode ? 'transform -translate-y-1 scale-90' : ''
          }`}>
            {table.numero}
          </div>
          
          {isGiftMode ? (
            <Gift className="h-5 w-5 text-yellow-400 mt-1 animate-pulse" />
          ) : (
            <>
              {table.hasOutOfStockOrder && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <AlertTriangle className="h-4 w-4 text-white animate-bounce" />
                  <div className="text-[9px] text-white font-bold">
                    ESAURITO
                  </div>
                  {table.outOfStockHandledBy && (
                    <div className="text-[8px] text-white/80 flex items-center gap-0.5">
                      <User className="h-3 w-3" />
                      {table.outOfStockHandledBy}
                    </div>
                  )}
                </div>
              )}
              {!table.hasOutOfStockOrder && table.lastOrderStatus && (
                <div className="text-[10px] text-white/90 px-1 rounded mt-1">
                  {getOrderStatusLabel(table.lastOrderStatus)}
                </div>
              )}
            </>
          )}
        </button>
        
        {/* Tooltip */}
        {showTooltip && tooltipContent}
      </div>
    </>
  );
});