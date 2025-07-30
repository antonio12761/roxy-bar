/**
 * Componente OrderCard ottimizzato con virtualizzazione e lazy loading
 * Riduce re-renders per liste grandi di ordini
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { 
  Clock, Users, Euro, ChevronDown, ChevronUp, 
  AlertCircle, CheckCircle, CreditCard, Loader2 
} from 'lucide-react';
import OptimizedOrderItem from './OptimizedOrderItem';

interface OrderData {
  id: string;
  tavolo?: {
    numero: string;
    zona?: string;
    posti: number;
  } | null;
  stato: 'APERTA' | 'INVIATA' | 'IN_PREPARAZIONE' | 'PRONTA' | 'CONSEGNATA';
  tipo: 'TAVOLO' | 'ASPORTO' | 'BANCONE';
  dataApertura: string;
  totale: number;
  note?: string | null;
  nomeCliente?: string | null;
  cameriere?: {
    nome: string;
  };
  righe: Array<{
    id: string;
    prodotto: {
      nome: string;
      categoria?: string;
    };
    quantita: number;
    stato: 'INSERITO' | 'IN_LAVORAZIONE' | 'PRONTO' | 'CONSEGNATO' | 'ANNULLATO';
    postazione: 'BAR' | 'CUCINA' | 'PREPARA';
    timestampOrdine: string;
    timestampInizio?: string | null;
    timestampPronto?: string | null;
    note?: string | null;
  }>;
}

interface OptimizedOrderCardProps {
  order: OrderData;
  
  /**
   * Callback per aggiornamento stato item
   */
  onItemStatusUpdate?: (itemId: string, orderId: string, newStatus: string) => Promise<boolean>;
  
  /**
   * Callback per azioni ordine
   */
  onOrderAction?: (orderId: string, action: 'ready' | 'delivered' | 'cancel') => Promise<boolean>;
  
  /**
   * Stati loading
   */
  updatingItems?: Set<string>;
  isUpdatingOrder?: boolean;
  
  /**
   * Configurazione vista
   */
  showItemDetails?: boolean;
  defaultExpanded?: boolean;
  compactMode?: boolean;
  
  /**
   * Filtri
   */
  filterDestination?: string;
  highlightUrgent?: boolean;
  
  /**
   * Styling
   */
  className?: string;
}

const OptimizedOrderCard = memo<OptimizedOrderCardProps>(({
  order,
  onItemStatusUpdate,
  onOrderAction,
  updatingItems = new Set(),
  isUpdatingOrder = false,
  showItemDetails = true,
  defaultExpanded = false,
  compactMode = false,
  filterDestination,
  highlightUrgent = true,
  className = ''
}) => {
  
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Memoized computed values
  const orderStats = useMemo(() => {
    const stats = {
      totalItems: order.righe.length,
      readyItems: order.righe.filter(item => item.stato === 'PRONTO').length,
      completedItems: order.righe.filter(item => item.stato === 'CONSEGNATO').length,
      inProgressItems: order.righe.filter(item => item.stato === 'IN_LAVORAZIONE').length,
      isUrgent: false,
      elapsedTime: ''
    };
    
    // Calcola se urgente (>30 min)
    const orderTime = new Date(order.dataApertura).getTime();
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    stats.isUrgent = highlightUrgent && orderTime < thirtyMinutesAgo && 
                     !['CONSEGNATA', 'PAGATA'].includes(order.stato);
    
    // Calcola tempo trascorso
    const elapsed = Math.floor((Date.now() - orderTime) / 1000);
    if (elapsed < 60) stats.elapsedTime = `${elapsed}s`;
    else if (elapsed < 3600) stats.elapsedTime = `${Math.floor(elapsed / 60)}m`;
    else stats.elapsedTime = `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
    
    return stats;
  }, [order.righe, order.dataApertura, order.stato, highlightUrgent]);

  const statusConfig = useMemo(() => {
    const configs = {
      'APERTA': {
        label: 'Da preparare',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        cardBorder: 'border-yellow-300',
        cardBg: 'bg-yellow-50'
      },
      'INVIATA': {
        label: 'Inviata',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        cardBorder: 'border-blue-300',
        cardBg: 'bg-blue-50'
      },
      'IN_PREPARAZIONE': {
        label: 'In preparazione',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        cardBorder: 'border-orange-300',
        cardBg: 'bg-orange-50'
      },
      'PRONTA': {
        label: 'Pronta',
        color: 'bg-green-100 text-green-800 border-green-200',
        cardBorder: 'border-green-300',
        cardBg: 'bg-green-50'
      },
      'CONSEGNATA': {
        label: 'Consegnata',
        color: 'bg-gray-100 text-gray-600 border-gray-200',
        cardBorder: 'border-gray-300',
        cardBg: 'bg-gray-50'
      }
    };
    
    return configs[order.stato] || configs['APERTA'];
  }, [order.stato]);

  // Filtra items per postazione se specificato
  const filteredItems = useMemo(() => {
    if (!filterDestination) return order.righe;
    return order.righe.filter(item => item.postazione === filterDestination);
  }, [order.righe, filterDestination]);

  // Callbacks memoizzati
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleOrderReady = useCallback(async () => {
    if (onOrderAction && !isUpdatingOrder) {
      return await onOrderAction(order.id, 'ready');
    }
    return false;
  }, [onOrderAction, order.id, isUpdatingOrder]);

  const handleOrderDelivered = useCallback(async () => {
    if (onOrderAction && !isUpdatingOrder) {
      return await onOrderAction(order.id, 'delivered');
    }
    return false;
  }, [onOrderAction, order.id, isUpdatingOrder]);

  // Ottieni nome cliente pulito
  const cleanClientName = useMemo(() => {
    if (order.nomeCliente) return order.nomeCliente;
    if (!order.note) return '';
    
    return order.note
      .replace(/cliente:\s*/i, '')
      .replace(/\s*-\s*posti:\s*\d+/i, '')
      .trim();
  }, [order.nomeCliente, order.note]);

  return (
    <div 
      className={`
        rounded-lg border-2 transition-all duration-200 shadow-sm
        ${orderStats.isUrgent ? 'border-red-400 bg-red-100' : statusConfig.cardBorder + ' ' + statusConfig.cardBg}
        ${isUpdatingOrder ? 'opacity-70' : ''}
        ${compactMode ? 'p-3' : 'p-4'}
        ${className}
      `}
    >
      
      {/* Header - Always Visible */}
      <div 
        className={`cursor-pointer ${showItemDetails ? '' : 'pointer-events-none'}`}
        onClick={showItemDetails ? toggleExpanded : undefined}
      >
        <div className="flex items-center justify-between">
          
          {/* Left: Table & Client Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <CreditCard className="h-5 w-5 text-gray-600 flex-shrink-0" />
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-gray-900">
                  {order.tavolo ? `Tavolo ${order.tavolo.numero}` : order.tipo}
                </span>
                
                {cleanClientName && (
                  <span className="text-sm text-gray-600 truncate">
                    {cleanClientName}
                  </span>
                )}
              </div>
              
              {!compactMode && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3" />
                  <span>{orderStats.elapsedTime} fa</span>
                  
                  {order.cameriere && (
                    <>
                      <span>•</span>
                      <span>{order.cameriere.nome}</span>
                    </>
                  )}
                  
                  {orderStats.isUrgent && (
                    <>
                      <span>•</span>
                      <AlertCircle className="h-3 w-3 text-red-600" />
                      <span className="text-red-600 font-medium">URGENTE</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            
            {/* Progress Indicator */}
            {!compactMode && (
              <div className="text-xs text-gray-500">
                {orderStats.completedItems}/{orderStats.totalItems}
                {orderStats.readyItems > 0 && (
                  <span className="text-green-600 ml-1">
                    ({orderStats.readyItems} pronti)
                  </span>
                )}
              </div>
            )}

            {/* Status Badge */}
            <div className={`px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
              {statusConfig.label}
            </div>

            {/* Order Total */}
            <div className="font-medium text-gray-900">
              €{order.totale.toFixed(2)}
            </div>

            {/* Order Actions */}
            {order.stato === 'APERTA' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOrderReady();
                }}
                disabled={isUpdatingOrder}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                {isUpdatingOrder ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Pronto
              </button>
            )}

            {order.stato === 'PRONTA' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOrderDelivered();
                }}
                disabled={isUpdatingOrder}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                {isUpdatingOrder ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Consegnato
              </button>
            )}

            {/* Expand Toggle */}
            {showItemDetails && (
              <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {showItemDetails && isExpanded && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          
          {/* Items List */}
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <OptimizedOrderItem
                key={item.id}
                item={item}
                orderId={order.id}
                onStatusUpdate={onItemStatusUpdate}
                isUpdating={updatingItems.has(item.id)}
                compact={compactMode}
                highlightUrgent={highlightUrgent}
              />
            ))}
          </div>

          {/* Order Notes */}
          {order.note && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">Note ordine:</div>
                  <div>{order.note}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

OptimizedOrderCard.displayName = 'OptimizedOrderCard';

export default OptimizedOrderCard;