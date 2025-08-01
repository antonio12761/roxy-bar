import React, { memo } from 'react';
import { Gift } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface TableCardProps {
  table: {
    id: number;
    numero: string;
    stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
    posti: number;
    clienteNome?: string | null;
  };
  isGiftMode: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  showTooltip?: boolean;
  tooltipContent?: React.ReactNode;
}

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

  // CSS classes based on state - computed once
  const stateClasses = {
    LIBERO: `table-card-free`,
    OCCUPATO: `table-card-occupied`,
    RISERVATO: `table-card-reserved`,
    IN_PULIZIA: `table-card-cleaning`
  };

  const baseClasses = `
    aspect-square p-2 rounded-lg border-2 transition-all duration-200 
    flex flex-col items-center justify-center hover:scale-105 w-full
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
              <div className="text-xs">{table.posti}</div>
              {table.stato === "OCCUPATO" && (
                <div className="text-[10px] bg-white/10 text-white/60 px-1 rounded mt-1">
                  +Ordine
                </div>
              )}
              {table.clienteNome && (
                <div className="text-[10px] text-foreground mt-1 truncate w-full text-center">
                  {table.clienteNome}
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