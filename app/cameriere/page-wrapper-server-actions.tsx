"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Coffee, 
  Users, 
  Clock, 
  Plus, 
  RefreshCw,
  Wifi,
  WifiOff,
  Package,
  Loader2,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { getTavoli } from "@/lib/actions/ordinazioni";
import { useRealTime } from "@/hooks/use-real-time";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";
import { ParticleEffect } from "@/components/ui/ParticleEffect";

interface Tavolo {
  id: number;
  numero: string;
  posti: number;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO";
  ordiniAttivi?: number;
  totaleOrdini?: number;
}

export default function CamerierePageServerActions({ currentUser }: { currentUser: any }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [tavoli, setTavoli] = useState<Tavolo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Particle effect state
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  
  // Use real-time hook con server actions
  const { 
    counts, 
    connectionStatus, 
    refresh 
  } = useRealTime({
    stationType: "CAMERIERE",
    onNewOrder: () => {
      loadTavoli();
    },
    onOrderUpdate: (order) => {
      if (order.status === "PRONTO") {
        toast.success(`Ordine pronto per il tavolo ${order.tableNumber || 'N/A'}`);
        // Trigger particle effect
        const rect = document.body.getBoundingClientRect();
        setParticlePos({ x: rect.width / 2, y: rect.height / 2 });
        setParticleKey(prev => prev + 1);
      }
      loadTavoli();
    }
  });
  
  const loadTavoli = useCallback(async () => {
    try {
      const result = await getTavoli();
      if (Array.isArray(result)) {
        setTavoli(result as any);
      } else {
        toast.error("Errore nel caricamento dei tavoli");
      }
    } catch (error) {
      toast.error("Errore nel caricamento dei tavoli");
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadTavoli();
  }, [loadTavoli]);
  
  const tavoliOccupati = tavoli.filter(t => t.stato === "OCCUPATO").length;
  const ordiniPronti = counts.ordersReady || 0;
  
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: colors.bg.dark }}>
      {/* Header */}
      <div className="flex-none">
        <div className="px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between" style={{ 
          backgroundColor: colors.bg.card,
          borderBottom: `1px solid ${colors.border.primary}`
        }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="lg:hidden p-2 rounded-lg hover:opacity-80 transition-opacity" style={{ backgroundColor: colors.bg.hover }}>
              <ArrowLeft className="w-5 h-5" style={{ color: colors.text.primary }} />
            </Link>
            <div className="flex items-center gap-2">
              <Coffee className="w-7 h-7" style={{ color: colors.text.accent }} />
              <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
                Sala
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ 
              backgroundColor: connectionStatus.connected ? colors.text.success + '20' : colors.text.error + '20' 
            }}>
              {connectionStatus.connected ? (
                <Wifi className="w-4 h-4" style={{ color: colors.text.success }} />
              ) : (
                <WifiOff className="w-4 h-4" style={{ color: colors.text.error }} />
              )}
              <span className="text-xs font-medium" style={{ 
                color: connectionStatus.connected ? colors.text.success : colors.text.error 
              }}>
                {connectionStatus.connected ? 'Online' : 'Offline'}
              </span>
            </div>
            
            <button 
              onClick={() => {
                refresh();
                loadTavoli();
              }}
              disabled={isLoading}
              className="p-2 rounded-lg hover:opacity-80 transition-all disabled:opacity-50"
              style={{ backgroundColor: colors.bg.hover }}
            >
              <RefreshCw 
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
                style={{ color: colors.text.primary }} 
              />
            </button>
            
            <UserDisplay />
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="px-3 sm:px-4 md:px-6 py-3 grid grid-cols-3 gap-3" style={{ backgroundColor: colors.bg.card }}>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
            <div className="text-2xl font-bold" style={{ color: colors.text.accent }}>
              {tavoliOccupati}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Tavoli Occupati
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: colors.bg.darker }}>
            <div className="text-2xl font-bold" style={{ color: colors.text.muted }}>
              {counts.ordersToProcess || 0}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              In Preparazione
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg animate-pulse" style={{ backgroundColor: ordiniPronti > 0 ? colors.text.success + '20' : colors.bg.darker }}>
            <div className="text-2xl font-bold" style={{ color: colors.text.success }}>
              {ordiniPronti}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Pronti
            </div>
          </div>
        </div>
      </div>
      
      {/* Tables Grid with responsive padding */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.text.accent }} />
          </div>
        ) : tavoli.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <Users className="w-16 h-16" style={{ color: colors.text.secondary }} />
            <p className="text-lg" style={{ color: colors.text.secondary }}>
              Nessun tavolo disponibile
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tavoli.map((tavolo) => (
              <Link
                key={tavolo.id}
                href={`/cameriere/tavoli/${tavolo.id}`}
                className="block"
              >
                <div 
                  className="p-4 rounded-lg border-2 hover:shadow-lg transition-all cursor-pointer"
                  style={{ 
                    backgroundColor: tavolo.stato === "OCCUPATO" ? colors.text.accent + '20' : colors.bg.card,
                    borderColor: tavolo.stato === "OCCUPATO" ? colors.text.accent : colors.border.primary
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xl font-bold" style={{ color: colors.text.primary }}>
                      Tavolo {tavolo.numero}
                    </div>
                    <div className="flex items-center gap-1 text-sm" style={{ color: colors.text.secondary }}>
                      <Users className="w-4 h-4" />
                      {tavolo.posti}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-sm font-medium px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: tavolo.stato === "OCCUPATO" ? colors.text.accent + '30' : colors.text.success + '20',
                        color: tavolo.stato === "OCCUPATO" ? colors.text.accent : colors.text.success
                      }}
                    >
                      {tavolo.stato === "OCCUPATO" ? "Occupato" : "Libero"}
                    </span>
                    
                    {tavolo.stato === "OCCUPATO" && tavolo.ordiniAttivi && tavolo.ordiniAttivi > 0 && (
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" style={{ color: colors.text.muted }} />
                        <span className="text-sm font-medium" style={{ color: colors.text.muted }}>
                          {tavolo.ordiniAttivi}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {tavolo.stato === "OCCUPATO" && tavolo.totaleOrdini && tavolo.totaleOrdini > 0 && (
                    <div className="mt-2 text-right">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        € {tavolo.totaleOrdini.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
            
            {/* Add Table Button */}
            <Link href="/cameriere/nuovo-ordine" className="block">
              <div 
                className="p-4 rounded-lg border-2 border-dashed hover:shadow-lg transition-all cursor-pointer flex flex-col items-center justify-center h-full min-h-[120px]"
                style={{ 
                  borderColor: colors.border.primary,
                  backgroundColor: colors.bg.card
                }}
              >
                <Plus className="w-8 h-8 mb-2" style={{ color: colors.text.accent }} />
                <span className="text-sm font-medium" style={{ color: colors.text.accent }}>
                  Nuovo Ordine
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>
      
      {/* Particle Effect */}
      {particleKey > 0 && (
        <ParticleEffect 
          trigger={particleKey > 0}
          x={particlePos.x} 
          y={particlePos.y}
          colors={[colors.text.success]}
        />
      )}
    </div>
  );
}