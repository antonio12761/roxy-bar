"use client";

import { 
  Package, 
  Users, 
  ShoppingCart, 
  TrendingUp,
  Coffee,
  Euro,
  Clock,
  AlertCircle
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";

export default function DashboardPage() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [loading, setLoading] = useState(true);
  
  // Simula caricamento dati
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  
  // Dati di esempio per le statistiche
  const stats = [
    {
      title: "Ordini Oggi",
      value: "45",
      change: "+12%",
      icon: ShoppingCart,
      color: "#3B82F6"
    },
    {
      title: "Incasso Giornaliero",
      value: "€1,234",
      change: "+8%",
      icon: Euro,
      color: "#10B981"
    },
    {
      title: "Prodotti Attivi",
      value: "128",
      change: "+3",
      icon: Package,
      color: "#8B5CF6"
    },
    {
      title: "Tempo Medio Servizio",
      value: "12 min",
      change: "-2 min",
      icon: Clock,
      color: "#F59E0B"
    }
  ];

  // Skeleton Loader Component
  const DashboardSkeleton = () => (
    <>
      {/* Skeleton Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className="rounded-lg p-6"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div 
                className="w-12 h-12 rounded-lg animate-pulse"
                style={{ backgroundColor: colors.bg.darker }}
              />
              <div 
                className="w-12 h-6 rounded animate-pulse"
                style={{ backgroundColor: colors.bg.darker }}
              />
            </div>
            <div 
              className="h-4 w-24 mb-2 rounded animate-pulse"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div 
              className="h-8 w-20 rounded animate-pulse"
              style={{ backgroundColor: colors.bg.darker }}
            />
          </div>
        ))}
      </div>

      {/* Skeleton Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((section) => (
          <div 
            key={section}
            className="rounded-lg p-6"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <div 
              className="h-6 w-32 mb-4 rounded animate-pulse"
              style={{ backgroundColor: colors.bg.darker }}
            />
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div 
                  key={item}
                  className="h-16 rounded-lg animate-pulse"
                  style={{ backgroundColor: colors.bg.darker }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton Chart */}
      <div 
        className="mt-6 rounded-lg p-6"
        style={{ 
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}
      >
        <div 
          className="h-6 w-40 mb-4 rounded animate-pulse"
          style={{ backgroundColor: colors.bg.darker }}
        />
        <div 
          className="h-64 rounded-lg animate-pulse"
          style={{ backgroundColor: colors.bg.darker }}
        />
      </div>
    </>
  );

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen p-6" style={{ backgroundColor: colors.bg.dark }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
            Dashboard
          </h1>
          <p style={{ color: colors.text.muted }}>Panoramica generale del locale</p>
        </div>
        
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
        
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className="rounded-lg p-6 transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: colors.bg.card,
                borderColor: colors.border.primary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: stat.color }}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <span 
                  className="text-sm font-medium"
                  style={{ 
                    color: stat.change.startsWith('+') ? colors.text.success : colors.text.error 
                  }}
                >
                  {stat.change}
                </span>
              </div>
              <h3 className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                {stat.title}
              </h3>
              <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Sezioni Rapide */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ordini Recenti */}
          <div 
            className="rounded-lg p-6"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <h2 className="text-xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Ordini Recenti
            </h2>
            <div className="space-y-3">
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.bg.darker }}
              >
                <div>
                  <p className="font-medium" style={{ color: colors.text.primary }}>Tavolo 5</p>
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    2 Cappuccini, 1 Cornetto
                  </p>
                </div>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                >
                  In corso
                </span>
              </div>
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.bg.darker }}
              >
                <div>
                  <p className="font-medium" style={{ color: colors.text.primary }}>Tavolo 12</p>
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    3 Caffè, 2 Brioche
                  </p>
                </div>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: colors.button.success,
                    color: colors.button.successText
                  }}
                >
                  Completato
                </span>
              </div>
              <div 
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ backgroundColor: colors.bg.darker }}
              >
                <div>
                  <p className="font-medium" style={{ color: colors.text.primary }}>Tavolo 3</p>
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    1 Spremuta, 1 Toast
                  </p>
                </div>
                <span 
                  className="text-sm font-medium px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: '#F59E0B',
                    color: 'white'
                  }}
                >
                  In preparazione
                </span>
              </div>
            </div>
          </div>

          {/* Avvisi */}
          <div 
            className="rounded-lg p-6"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary,
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
          >
            <h2 className="text-xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              Avvisi e Notifiche
            </h2>
            <div className="space-y-3">
              <div 
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: '#F59E0B',
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: '#F59E0B' }} />
                <div>
                  <p className="font-medium" style={{ color: colors.text.primary }}>
                    Scorte in esaurimento
                  </p>
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    5 prodotti sotto la soglia minima
                  </p>
                </div>
              </div>
              <div 
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.button.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <Coffee className="w-5 h-5 mt-0.5" style={{ color: colors.button.primary }} />
                <div>
                  <p className="font-medium" style={{ color: colors.text.primary }}>
                    Manutenzione macchina caffè
                  </p>
                  <p className="text-sm" style={{ color: colors.text.secondary }}>
                    Programmata per domani alle 14:00
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grafico vendite (placeholder) */}
        <div 
          className="mt-6 rounded-lg p-6"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: colors.text.primary }}>
            Vendite Settimanali
          </h2>
          <div 
            className="h-64 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: colors.bg.darker }}
          >
            <p style={{ color: colors.text.muted }}>Grafico vendite (da implementare)</p>
          </div>
        </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}