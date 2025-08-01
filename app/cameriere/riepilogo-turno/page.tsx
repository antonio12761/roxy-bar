"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, BarChart3, Clock, Euro, Package, Users, TrendingUp, Calendar, Coffee } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { getRiepilogoTurno } from "@/lib/actions/riepilogo-turno";
import { toast } from "@/lib/toast";

interface RiepilogoData {
  statistiche: {
    ordiniCompletati: number;
    ordiniInCorso: number;
    totaleIncassato: number;
    mediaOrdine: number;
    tavoliServiti: number;
    prodottiVenduti: number;
    tempoMedioServizio: number;
  };
  prodottiPiuVenduti: Array<{
    nome: string;
    quantita: number;
    ricavo: number;
  }>;
  ordiniRecenti: Array<{
    id: string;
    tavolo: string;
    totale: number;
    stato: string;
    ora: string;
    prodotti: number;
  }>;
  andamentoOrario: Array<{
    ora: string;
    ordini: number;
    ricavo: number;
  }>;
}

export default function RiepilogoTurnoPage() {
  const [riepilogo, setRiepilogo] = useState<RiepilogoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'oggi' | 'settimana' | 'mese'>('oggi');
  
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  useEffect(() => {
    loadRiepilogo();
  }, [timeRange]);

  const loadRiepilogo = async () => {
    setIsLoading(true);
    try {
      const data = await getRiepilogoTurno(timeRange);
      setRiepilogo(data as RiepilogoData);
    } catch (error) {
      console.error("Error loading summary:", error);
      toast.error("Errore nel caricamento del riepilogo");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cameriere" 
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Riepilogo Turno
            </h1>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['oggi', 'settimana', 'mese'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors`}
                style={{
                  backgroundColor: timeRange === range ? colors.accent : 'transparent',
                  color: timeRange === range ? colors.button.primaryText : colors.text.secondary,
                  border: `1px solid ${timeRange === range ? colors.accent : colors.border.primary}`
                }}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p style={{ color: colors.text.muted }}>Caricamento riepilogo...</p>
        </div>
      ) : riepilogo ? (
        <div className="p-6">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5" style={{ color: colors.accent }} />
                <span className="text-sm" style={{ color: colors.text.muted }}>Ordini Completati</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {riepilogo.statistiche.ordiniCompletati}
              </p>
              {riepilogo.statistiche.ordiniInCorso > 0 && (
                <p className="text-xs mt-1" style={{ color: colors.status?.warning || colors.text.accent }}>
                  +{riepilogo.statistiche.ordiniInCorso} in corso
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-3 mb-2">
                <Euro className="h-5 w-5" style={{ color: colors.text.success }} />
                <span className="text-sm" style={{ color: colors.text.muted }}>Totale Incassato</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                €{riepilogo.statistiche.totaleIncassato.toFixed(2)}
              </p>
              <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                Media: €{riepilogo.statistiche.mediaOrdine.toFixed(2)}
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-3 mb-2">
                <Users className="h-5 w-5" style={{ color: colors.status?.warning || colors.text.accent }} />
                <span className="text-sm" style={{ color: colors.text.muted }}>Tavoli Serviti</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {riepilogo.statistiche.tavoliServiti}
              </p>
            </div>

            <div className="p-4 rounded-lg" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5" style={{ color: colors.text.secondary }} />
                <span className="text-sm" style={{ color: colors.text.muted }}>Tempo Medio</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {formatTime(riepilogo.statistiche.tempoMedioServizio)}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Prodotti Più Venduti */}
            <div className="rounded-lg p-6" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5" style={{ color: colors.accent }} />
                <h2 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Prodotti Più Venduti
                </h2>
              </div>
              
              <div className="space-y-3">
                {riepilogo.prodottiPiuVenduti.map((prodotto, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span 
                        className="text-lg font-bold w-8" 
                        style={{ color: index < 3 ? colors.accent : colors.text.muted }}
                      >
                        {index + 1}°
                      </span>
                      <div>
                        <p className="font-medium" style={{ color: colors.text.primary }}>
                          {prodotto.nome}
                        </p>
                        <p className="text-sm" style={{ color: colors.text.muted }}>
                          {prodotto.quantita} venduti
                        </p>
                      </div>
                    </div>
                    <span className="font-medium" style={{ color: colors.text.success }}>
                      €{prodotto.ricavo.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ordini Recenti */}
            <div className="rounded-lg p-6" style={{
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5" style={{ color: colors.accent }} />
                <h2 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Ordini Recenti
                </h2>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {riepilogo.ordiniRecenti.map((ordine) => (
                  <div 
                    key={ordine.id}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: colors.bg.darker }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        Tavolo {ordine.tavolo}
                      </span>
                      <span className="text-sm" style={{ color: colors.text.muted }}>
                        {ordine.ora}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: colors.text.secondary }}>
                        {ordine.prodotti} prodotti
                      </span>
                      <span className="font-medium" style={{ color: colors.accent }}>
                        €{ordine.totale.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Andamento Orario */}
          <div className="mt-6 rounded-lg p-6" style={{
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5" style={{ color: colors.accent }} />
              <h2 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                Andamento Orario
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {riepilogo.andamentoOrario.map((ora) => {
                  const maxRicavo = Math.max(...riepilogo.andamentoOrario.map(o => o.ricavo));
                  const heightPercentage = (ora.ricavo / maxRicavo) * 100;
                  
                  return (
                    <div key={ora.ora} className="flex-1 min-w-[60px]">
                      <div className="flex flex-col items-center">
                        <div 
                          className="w-full rounded-t-lg transition-all duration-300"
                          style={{
                            height: `${Math.max(heightPercentage, 10)}px`,
                            backgroundColor: colors.accent,
                            opacity: 0.8
                          }}
                        />
                        <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
                          {ora.ora}
                        </p>
                        <p className="text-xs font-medium" style={{ color: colors.text.primary }}>
                          {ora.ordini}
                        </p>
                        <p className="text-xs" style={{ color: colors.text.success }}>
                          €{ora.ricavo}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64">
          <Coffee className="h-12 w-12 mb-4 opacity-50" style={{ color: colors.text.muted }} />
          <p style={{ color: colors.text.muted }}>Nessun dato disponibile per il periodo selezionato</p>
        </div>
      )}
    </div>
  );
}