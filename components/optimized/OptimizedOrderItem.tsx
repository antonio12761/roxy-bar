/**
 * Componente OrderItem ottimizzato con React.memo e aggiornamenti granulari
 * Riduce re-renders e migliora performance lista ordini
 */

import React, { useCallback, memo } from 'react';
import { Clock, Coffee, ChefHat, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface OptimizedOrderItemProps {
  item: {
    id: string;
    prodotto: {
      nome: string;
      categoria?: string;
    };
    quantita: number;
    stato: 'INSERITO' | 'IN_LAVORAZIONE' | 'PRONTO' | 'CONSEGNATO' | 'ANNULLATO';
    destinazione: 'BAR' | 'CUCINA' | 'PREPARA';
    timestampOrdine: string;
    timestampInizio?: string | null;
    timestampPronto?: string | null;
    note?: string | null;
  };
  
  orderId: string;
  
  /**
   * Callback per aggiornamento stato
   */
  onStatusUpdate?: (itemId: string, orderId: string, newStatus: string) => Promise<boolean>;
  
  /**
   * Stati loading per ottimizzazioni UI
   */
  isUpdating?: boolean;
  
  /**
   * Mostra controlli per cambio stato
   */
  showControls?: boolean;
  
  /**
   * Modalità compatta per liste dense
   */
  compact?: boolean;
  
  /**
   * Evidenzia item urgenti
   */
  highlightUrgent?: boolean;
  
  /**
   * Classe CSS aggiuntiva
   */
  className?: string;
}

const OptimizedOrderItem = memo<OptimizedOrderItemProps>(({
  item,
  orderId,
  onStatusUpdate,
  isUpdating = false,
  showControls = true,
  compact = false,
  highlightUrgent = true,
  className = ''
}) => {
  
  // Memoized callbacks per evitare re-renders
  const handleStatusUpdate = useCallback(async (newStatus: string) => {
    if (onStatusUpdate && !isUpdating) {
      return await onStatusUpdate(item.id, orderId, newStatus);
    }
    return false;
  }, [onStatusUpdate, item.id, orderId, isUpdating]);

  const handleMarkReady = useCallback(() => {
    handleStatusUpdate('PRONTO');
  }, [handleStatusUpdate]);

  const handleMarkDelivered = useCallback(() => {
    handleStatusUpdate('CONSEGNATO');
  }, [handleStatusUpdate]);

  const handleStartWork = useCallback(() => {
    handleStatusUpdate('IN_LAVORAZIONE');
  }, [handleStatusUpdate]);

  // Memoized computed values
  const isUrgent = React.useMemo(() => {
    if (!highlightUrgent) return false;
    
    const orderTime = new Date(item.timestampOrdine).getTime();
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;
    
    return orderTime < thirtyMinutesAgo && !['CONSEGNATO', 'ANNULLATO'].includes(item.stato);
  }, [item.timestampOrdine, item.stato, highlightUrgent]);

  const elapsedTime = React.useMemo(() => {
    const referenceTime = item.timestampInizio || item.timestampOrdine;
    const elapsed = Math.floor((Date.now() - new Date(referenceTime).getTime()) / 1000);
    
    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m`;
    return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
  }, [item.timestampOrdine, item.timestampInizio]);

  const statusConfig = React.useMemo(() => {
    const configs = {
      'INSERITO': {
        label: 'Da iniziare',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        actionColor: 'bg-blue-600 hover:bg-blue-700',
        actionLabel: 'Inizia',
        actionIcon: Clock,
        canAction: true
      },
      'IN_LAVORAZIONE': {
        label: 'In lavorazione',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        actionColor: 'bg-green-600 hover:bg-green-700',
        actionLabel: 'Pronto',
        actionIcon: CheckCircle,
        canAction: true
      },
      'PRONTO': {
        label: 'Pronto',
        color: 'bg-green-100 text-green-700 border-green-200',
        actionColor: 'bg-purple-600 hover:bg-purple-700',
        actionLabel: 'Consegnato',
        actionIcon: CheckCircle,
        canAction: true
      },
      'CONSEGNATO': {
        label: 'Consegnato',
        color: 'bg-gray-100 text-gray-500 border-gray-200',
        actionColor: '',
        actionLabel: '',
        actionIcon: CheckCircle,
        canAction: false
      },
      'ANNULLATO': {
        label: 'Annullato',
        color: 'bg-red-100 text-red-700 border-red-200',
        actionColor: '',
        actionLabel: '',
        actionIcon: AlertCircle,
        canAction: false
      }
    };
    
    return configs[item.stato] || configs['INSERITO'];
  }, [item.stato]);

  const DestinationIcon = item.destinazione === 'CUCINA' ? ChefHat : Coffee;
  const ActionIcon = statusConfig.actionIcon;

  return (
    <div 
      className={`
        ${compact ? 'p-2' : 'p-3'} 
        rounded-lg border transition-all duration-200
        ${isUrgent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}
        ${isUpdating ? 'opacity-70' : ''}
        ${className}
      `}
    >
      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        
        {/* Quantity e Product */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`font-bold ${compact ? 'text-lg' : 'text-xl'} text-gray-900`}>
            {item.quantita}x
          </span>
          
          <div className="min-w-0 flex-1">
            <div className={`font-medium ${compact ? 'text-sm' : 'text-base'} text-gray-900 truncate`}>
              {item.prodotto.nome}
            </div>
            
            {!compact && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <DestinationIcon className="h-3 w-3" />
                <span>{item.destinazione}</span>
                <span>•</span>
                <span>{elapsedTime}</span>
                {isUrgent && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-medium">URGENTE</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
          {statusConfig.label}
        </div>

        {/* Action Button */}
        {showControls && statusConfig.canAction && !isUpdating && (
          <button
            onClick={() => {
              if (item.stato === 'INSERITO') handleStartWork();
              else if (item.stato === 'IN_LAVORAZIONE') handleMarkReady();
              else if (item.stato === 'PRONTO') handleMarkDelivered();
            }}
            className={`
              ${compact ? 'p-1.5' : 'p-2'} 
              ${statusConfig.actionColor} 
              text-white rounded-lg transition-colors
              flex items-center justify-center
            `}
            title={statusConfig.actionLabel}
          >
            <ActionIcon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          </button>
        )}
        
        {/* Loading State */}
        {isUpdating && (
          <div className={compact ? 'p-1.5' : 'p-2'}>
            <Loader2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} animate-spin text-gray-400`} />
          </div>
        )}
      </div>

      {/* Note */}
      {item.note && !compact && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
          <strong>Note:</strong> {item.note}
        </div>
      )}
    </div>
  );
});

OptimizedOrderItem.displayName = 'OptimizedOrderItem';

export default OptimizedOrderItem;