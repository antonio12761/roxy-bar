import React, { memo } from 'react';
import { Users, Package, Clock, ChevronRight, CheckCircle } from 'lucide-react';
import { useTheme } from "@/contexts/ThemeContext";
import { PWAClickable } from "@/components/ui/PWAButton";

interface TableGroup {
  tavoloNumero: string;
  ordinazioni: any[];
  totaleComplessivo: number;
  totalePagatoComplessivo: number;
  rimanenteComplessivo: number;
  numeroClienti: number;
  clientiNomi: string[];
  primaDaApertura: string;
}

interface TableCardProps {
  table: TableGroup;
  onClick: () => void;
  variant?: 'default' | 'paid' | 'paying';
}

const TableCard = memo(function TableCard({ table, onClick, variant = 'default' }: TableCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const getOrderTime = (date: string) => {
    return new Date(date).toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isPaid = variant === 'paid';
  const isPaying = variant === 'paying';
  
  // Determina automaticamente se è in pagamento basandosi sui dati
  const hasPartialPayment = (table.totalePagatoComplessivo || 0) > 0 && 
                           table.rimanenteComplessivo > 0 && !isPaid;
  
  // Controlla se è completamente pagato (rimanente = 0)
  const isFullyPaid = table.rimanenteComplessivo === 0 && table.totalePagatoComplessivo > 0;
  
  // Controlla se è nel box pagato ma non completamente pagato
  const isPartiallyPaid = isPaid && table.rimanenteComplessivo > 0;

  return (
    <PWAClickable
      onPWAClick={onClick}
      className={`rounded-lg p-3 sm:p-4 cursor-pointer transition-all duration-200 relative ${
        isPaid && !isPartiallyPaid ? 'opacity-75 hover:opacity-100' : 'hover:scale-[1.02] sm:hover:scale-105 active:scale-[0.98]'
      }`}
      style={{ 
        backgroundColor: isPartiallyPaid ? colors.bg.hover : colors.bg.card, 
        borderColor: isPartiallyPaid 
          ? colors.text.warning || colors.text.accent 
          : isPaid 
            ? colors.text.success 
            : hasPartialPayment 
              ? colors.text.warning || colors.text.accent 
              : colors.border.primary, 
        borderWidth: isPartiallyPaid || hasPartialPayment ? '2px' : '1px', 
        borderStyle: 'solid',
        cursor: 'pointer' 
      }}
    >
      {/* Badge per stato pagamento */}
      {hasPartialPayment && !isPaid && (
        <div className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: colors.text.warning || colors.text.accent,
            color: colors.bg.card
          }}
        >
          In pagamento
        </div>
      )}
      
      {/* Badge per completamente pagato quando rimanente = 0 */}
      {isFullyPaid && !isPaid && (
        <div className="absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: colors.text.success,
            color: colors.bg.card
          }}
        >
          Pagato ✓
        </div>
      )}
      
      {/* Badge per pagamento parziale nel box pagato */}
      {isPartiallyPaid && (
        <div className="absolute -top-2 -right-2 px-3 py-1 rounded-full text-xs font-medium shadow-md"
          style={{ 
            backgroundColor: colors.text.warning || '#f59e0b',
            color: colors.bg.card || '#ffffff'
          }}
        >
          Parzialmente pagato
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {table.tavoloNumero === 'Asporto' ? (
            <>
              <Package className="h-5 w-5" style={{ color: isPaid ? colors.text.success : colors.text.secondary }} />
              <span className="font-medium" style={{ color: colors.text.primary }}>Asporto</span>
            </>
          ) : (
            <>
              <Users className="h-5 w-5" style={{ color: isPaid ? colors.text.success : colors.text.secondary }} />
              <span className="font-medium" style={{ color: colors.text.primary }}>Tavolo {table.tavoloNumero}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPaid && <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />}
          <span className="text-sm" style={{ color: colors.text.secondary }}>
            {getOrderTime(table.primaDaApertura)}
          </span>
          {!isPaid && <ChevronRight className="h-4 w-4" style={{ color: colors.text.muted }} />}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-sm">
          <span style={{ color: colors.text.secondary }}>Ordinazioni: </span>
          <span className="font-medium" style={{ color: colors.text.primary }}>{table.ordinazioni?.length || 0}</span>
        </div>
        <div className="text-sm">
          <span style={{ color: colors.text.secondary }}>Clienti: </span>
          <span className="font-medium" style={{ color: colors.text.primary }}>{table.numeroClienti}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: colors.text.secondary }}>
          {table.clientiNomi?.length > 0 ? 
            table.clientiNomi.slice(0, 2).join(', ') + 
            (table.clientiNomi.length > 2 ? ` +${table.clientiNomi.length - 2}` : '') 
            : 'Nessun nome cliente'
          }
        </div>
        <div className="text-lg font-semibold" style={{ 
          color: isPartiallyPaid ? colors.text.warning || colors.text.accent : isPaid ? colors.text.success : colors.text.primary 
        }}>
          {isPartiallyPaid ? (
            <>
              <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                €{table.totaleComplessivo.toFixed(2)}
              </span>
              {' '}
              <span>€{table.rimanenteComplessivo.toFixed(2)}</span>
            </>
          ) : (
            <>
              €{(isPaid ? table.totaleComplessivo : table.rimanenteComplessivo || 0).toFixed(2)}
              {isPaid && !isPartiallyPaid && ' ✓'}
            </>
          )}
        </div>
      </div>
      
      {!isPaid && (table.totalePagatoComplessivo || 0) > 0 && (
        <div className="mt-2 text-sm" style={{ color: colors.text.success }}>
          Pagato parzialmente: €{table.totalePagatoComplessivo.toFixed(2)}
        </div>
      )}
      
      {isPartiallyPaid && (
        <div className="mt-2 space-y-1">
          <div className="text-sm" style={{ color: colors.text.success }}>
            Pagato: €{table.totalePagatoComplessivo.toFixed(2)}
          </div>
          <div className="text-sm font-medium" style={{ color: colors.text.warning || colors.text.accent }}>
            Ancora da pagare: €{table.rimanenteComplessivo.toFixed(2)}
          </div>
        </div>
      )}
    </PWAClickable>
  );
}, (prevProps, nextProps) => {
  // Custom comparison per evitare re-render inutili
  return (
    prevProps.table.rimanenteComplessivo === nextProps.table.rimanenteComplessivo &&
    prevProps.table.totaleComplessivo === nextProps.table.totaleComplessivo &&
    prevProps.table.totalePagatoComplessivo === nextProps.table.totalePagatoComplessivo &&
    prevProps.table.ordinazioni.length === nextProps.table.ordinazioni.length &&
    prevProps.variant === nextProps.variant &&
    JSON.stringify(prevProps.table.ordinazioni.map(o => o.id)) === JSON.stringify(nextProps.table.ordinazioni.map(o => o.id))
  );
});

export default TableCard;