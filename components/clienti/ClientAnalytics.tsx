"use client";

import { BarChart3, TrendingUp, Users, Euro, Calendar } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ClientAnalyticsProps {
  analytics: any;
  periodo: 'settimana' | 'mese' | 'anno';
  onPeriodoChange: (periodo: 'settimana' | 'mese' | 'anno') => void;
  isLoading: boolean;
}

export default function ClientAnalytics({ 
  analytics, 
  periodo, 
  onPeriodoChange,
  isLoading 
}: ClientAnalyticsProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: colors.text.accent }}
          />
          <p style={{ color: colors.text.secondary }}>Caricamento analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
        <p style={{ color: colors.text.secondary }}>Nessun dato disponibile</p>
      </div>
    );
  }

  // Calcola il valore massimo per il grafico
  const maxValue = Math.max(...(analytics.chartData?.map((d: any) => d.vendite) || [0]));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
          Analytics Clienti
        </h2>
        <div className="flex gap-2">
          {(['settimana', 'mese', 'anno'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodoChange(p)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                periodo === p ? 'ring-2' : ''
              }`}
              style={{
                backgroundColor: periodo === p ? colors.button.primary : colors.bg.hover,
                color: periodo === p ? colors.button.primaryText : colors.text.primary,
                outlineColor: periodo === p ? colors.button.primary : undefined
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {analytics.periodo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Euro className="h-5 w-5" style={{ color: colors.text.success }} />
              <span className="text-xs" style={{ color: colors.text.secondary }}>
                Periodo
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              €{analytics.periodo.totaleVendite.toFixed(2)}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Vendite Totali
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5" style={{ color: colors.text.info }} />
              <span className="text-xs" style={{ color: colors.text.secondary }}>
                Periodo
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {analytics.periodo.clientiUnici}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Clienti Unici
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-5 w-5" style={{ color: colors.text.accent }} />
              <span className="text-xs" style={{ color: colors.text.secondary }}>
                Periodo
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {analytics.periodo.ordiniTotali}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Ordini Totali
            </div>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5" style={{ color: colors.text.warning }} />
              <span className="text-xs" style={{ color: colors.text.secondary }}>
                Media
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              €{analytics.periodo.mediaOrdine.toFixed(2)}
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              Valore Medio
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {analytics.chartData && analytics.chartData.length > 0 && (
        <div 
          className="p-6 rounded-lg"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>
            Andamento Vendite
          </h3>
          
          <div className="space-y-2">
            {analytics.chartData.map((data: any, index: number) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm" style={{ color: colors.text.secondary }}>
                  {new Date(data.data).toLocaleDateString('it-IT', { 
                    day: '2-digit', 
                    month: 'short' 
                  })}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-8 rounded transition-all duration-300"
                      style={{
                        width: `${(data.vendite / maxValue) * 100}%`,
                        backgroundColor: colors.text.accent,
                        minWidth: '2px'
                      }}
                    />
                    <span className="text-sm font-medium" style={{ color: colors.text.primary }}>
                      €{data.vendite.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: colors.text.muted }}>
                    {data.clienti} clienti
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Clients */}
      {analytics.topClienti && analytics.topClienti.length > 0 && (
        <div 
          className="p-6 rounded-lg"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>
            Top 10 Clienti per Fatturato
          </h3>
          
          <div className="space-y-3">
            {analytics.topClienti.map((cliente: any, index: number) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.bg.hover }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ 
                      backgroundColor: index < 3 ? colors.text.warning + '20' : colors.bg.input,
                      color: index < 3 ? colors.text.warning : colors.text.primary
                    }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: colors.text.primary }}>
                      {cliente.nome}
                    </div>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                      {cliente.ordini} ordini
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ color: colors.text.success }}>
                    €{cliente.totale.toFixed(2)}
                  </div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                    Media: €{(cliente.totale / cliente.ordini).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}