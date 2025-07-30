"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  AlertTriangle, 
  Zap, 
  Timer,
  TrendingUp
} from "lucide-react";
import { OrderPriority, calculateOrderPriority, getPriorityHighlightClass, getPriorityWarningMessage } from "@/lib/services/priority-manager";

interface PriorityIndicatorProps {
  orderTimestamp: string;
  station: 'PREPARA' | 'CUCINA';
  className?: string;
  showWarning?: boolean;
  showAge?: boolean;
}

export default function PriorityIndicator({ 
  orderTimestamp, 
  station, 
  className = "", 
  showWarning = true,
  showAge = true 
}: PriorityIndicatorProps) {
  const [priority, setPriority] = useState<OrderPriority['priority']>('low');
  const [ageMinutes, setAgeMinutes] = useState(0);
  const [highlightClass, setHighlightClass] = useState('');
  const [warningMessage, setWarningMessage] = useState<string | undefined>();

  // Aggiorna priorità ogni minuto
  useEffect(() => {
    const updatePriority = () => {
      const now = new Date();
      const orderTime = new Date(orderTimestamp);
      const ageMs = now.getTime() - orderTime.getTime();
      const ageMin = Math.floor(ageMs / (1000 * 60));
      
      const newPriority = calculateOrderPriority(ageMin, station);
      const newHighlightClass = getPriorityHighlightClass(newPriority);
      const newWarningMessage = getPriorityWarningMessage(newPriority, ageMin, station);
      
      setAgeMinutes(ageMin);
      setPriority(newPriority);
      setHighlightClass(newHighlightClass);
      setWarningMessage(newWarningMessage);
    };

    updatePriority();
    const interval = setInterval(updatePriority, 60000); // Ogni minuto
    
    return () => clearInterval(interval);
  }, [orderTimestamp, station]);

  const getPriorityIcon = () => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <Zap className="h-4 w-4 text-orange-600" />;
      case 'normal':
        return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityBadge = () => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium";
    
    switch (priority) {
      case 'urgent':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800 border border-red-200 animate-pulse`}>
            <AlertTriangle className="h-3 w-3" />
            URGENTE
          </span>
        );
      case 'high':
        return (
          <span className={`${baseClasses} bg-orange-100 text-orange-800 border border-orange-200`}>
            <Zap className="h-3 w-3" />
            PRIORITARIO
          </span>
        );
      case 'normal':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`}>
            <TrendingUp className="h-3 w-3" />
            ATTENZIONE
          </span>
        );
      default:
        return showAge ? (
          <span className={`${baseClasses} bg-gray-100 text-gray-600 border border-gray-200`}>
            <Timer className="h-3 w-3" />
            {ageMinutes}m
          </span>
        ) : null;
    }
  };

  const formatAge = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className={`${className}`}>
      {/* Badge di priorità */}
      <div className="flex items-center gap-2">
        {getPriorityBadge()}
        
        {/* Età dell'ordine */}
        {showAge && priority === 'low' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatAge(ageMinutes)}
          </span>
        )}
      </div>

      {/* Messaggio di warning */}
      {showWarning && warningMessage && (
        <div className={`mt-1 text-xs p-2 rounded ${
          priority === 'urgent' ? 'bg-red-50 text-red-700 border border-red-200' :
          priority === 'high' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
          'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          {warningMessage}
        </div>
      )}
    </div>
  );
}

// Hook per ottenere la classe di evidenziazione
export function usePriorityHighlight(orderTimestamp: string, station: 'PREPARA' | 'CUCINA') {
  const [highlightClass, setHighlightClass] = useState('');
  
  useEffect(() => {
    const updateHighlight = () => {
      const now = new Date();
      const orderTime = new Date(orderTimestamp);
      const ageMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
      
      const priority = calculateOrderPriority(ageMinutes, station);
      const newHighlightClass = getPriorityHighlightClass(priority);
      
      setHighlightClass(newHighlightClass);
    };

    updateHighlight();
    const interval = setInterval(updateHighlight, 60000);
    
    return () => clearInterval(interval);
  }, [orderTimestamp, station]);
  
  return highlightClass;
}

// Componente per statistiche priorità
export function PriorityStats({ stats }: { stats: any }) {
  if (!stats) return null;
  
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-medium mb-3">Stato Priorità</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          <div className="text-xs text-red-600">Urgenti</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          <div className="text-xs text-orange-600">Prioritari</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.normal}</div>
          <div className="text-xs text-yellow-600">Attenzione</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.low}</div>
          <div className="text-xs text-gray-600">Normali</div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>Attesa media: {stats.avgWaitTime}m</span>
        <span>Attesa max: {stats.maxWaitTime}m</span>
      </div>
      
      {stats.maxWaitTime > 30 && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          ⚠️ Attenzione: ordine in attesa da oltre 30 minuti
        </div>
      )}
    </div>
  );
}