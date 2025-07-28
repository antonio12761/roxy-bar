"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Euro,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  PieChart,
  Activity
} from "lucide-react";
import Link from "next/link";
import { getProductStatistics } from "@/lib/actions/statistics";

interface Statistics {
  totalProducts: number;
  availableProducts: number;
  unavailableProducts: number;
  terminatedProducts: number;
  totalValue: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  categoriesCount: number;
  topCategories: {
    nome: string;
    count: number;
    value: number;
  }[];
  priceDistribution: {
    range: string;
    count: number;
  }[];
  destinationStats: {
    bar: number;
    cucina: number;
  };
}

export default function StatistichePage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const data = await getProductStatistics();
      setStats(data);
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20-400 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Caricamento statistiche...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!stats) {
    return (
      <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
          <p className="text-center text-white/50">Errore nel caricamento delle statistiche</p>
        </div>
      </AuthGuard>
    );
  }

  const availabilityPercentage = stats.totalProducts > 0 ? (stats.availableProducts / stats.totalProducts) * 100 : 0;
  const terminatedPercentage = stats.totalProducts > 0 ? (stats.terminatedProducts / stats.totalProducts) * 100 : 0;

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-white/70" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Statistiche Prodotti</h1>
              <p className="text-muted-foreground">Analisi completa del catalogo prodotti</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Package className="h-8 w-8 text-white/60" />
              <span className="text-2xl font-bold text-foreground">{stats.totalProducts}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Prodotti Totali</h3>
            <p className="text-xs text-muted-foreground mt-1">{stats.categoriesCount} categorie</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Euro className="h-8 w-8 text-white/60" />
              <span className="text-2xl font-bold text-foreground">€{stats.totalValue.toFixed(2)}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Valore Totale</h3>
            <p className="text-xs text-muted-foreground mt-1">Media: €{stats.averagePrice.toFixed(2)}</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
              <span className="text-2xl font-bold text-foreground">{stats.availableProducts}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Disponibili</h3>
            <div className="mt-2 bg-slate-900 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${availabilityPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{availabilityPercentage.toFixed(1)}%</p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="h-8 w-8 text-orange-400" />
              <span className="text-2xl font-bold text-foreground">{stats.terminatedProducts}</span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">Terminati</h3>
            <div className="mt-2 bg-slate-900 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-orange-400 transition-all duration-500"
                style={{ width: `${terminatedPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{terminatedPercentage.toFixed(1)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Categories */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Categorie per Numero Prodotti
            </h2>
            <div className="space-y-3">
              {stats.topCategories.slice(0, 10).map((category, index) => (
                <div key={category.nome} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-foreground">{category.nome}</span>
                      <span className="text-sm text-muted-foreground">{category.count} prodotti</span>
                    </div>
                    <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-white/10 to-amber-600 transition-all duration-500"
                        style={{ width: `${(category.count / Math.max(...stats.topCategories.map(c => c.count))) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valore: €{category.value.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Distribution */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribuzione Prezzi
            </h2>
            <div className="space-y-3">
              {stats.priceDistribution.map((range) => (
                <div key={range.range} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-foreground">{range.range}</span>
                      <span className="text-sm text-muted-foreground">{range.count} prodotti</span>
                    </div>
                    <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                        style={{ width: `${stats.totalProducts > 0 ? (range.count / stats.totalProducts) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.totalProducts > 0 ? ((range.count / stats.totalProducts) * 100).toFixed(1) : 0}% del totale
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Price Range Info */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Prezzo Minimo</p>
                  <p className="text-xl font-bold text-white/60">€{stats.priceRange.min.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Prezzo Massimo</p>
                  <p className="text-xl font-bold text-white/50">€{stats.priceRange.max.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Destination Stats */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Distribuzione per Destinazione
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${stats.totalProducts > 0 ? (stats.destinationStats.bar / stats.totalProducts) * 352 : 0} 352`}
                      className="text-white/70"
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold text-foreground">
                    {stats.destinationStats.bar}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">Bar</p>
                <p className="text-xs text-muted-foreground">
                  {stats.totalProducts > 0 ? ((stats.destinationStats.bar / stats.totalProducts) * 100).toFixed(1) : 0}%
                </p>
              </div>
              
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${stats.totalProducts > 0 ? (stats.destinationStats.cucina / stats.totalProducts) * 352 : 0} 352`}
                      className="text-white/60"
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold text-foreground">
                    {stats.destinationStats.cucina}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">Cucina</p>
                <p className="text-xs text-muted-foreground">
                  {stats.totalProducts > 0 ? ((stats.destinationStats.cucina / stats.totalProducts) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Azioni Rapide</h2>
            <div className="space-y-3">
              <Link
                href="/dashboard/categorie"
                className="block p-4 bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Gestione Categorie</p>
                    <p className="text-sm text-muted-foreground">Organizza prodotti e categorie</p>
                  </div>
                  <Package className="h-5 w-5 text-white/70" />
                </div>
              </Link>
              
              <Link
                href="/dashboard/prodotti"
                className="block p-4 bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Tutti i Prodotti</p>
                    <p className="text-sm text-muted-foreground">Visualizza e modifica prodotti</p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-white/60" />
                </div>
              </Link>
              
              {stats.terminatedProducts > 0 && (
                <div className="p-4 bg-orange-900/20 border border-orange-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-orange-400">Prodotti Terminati</p>
                      <p className="text-sm text-orange-300">{stats.terminatedProducts} prodotti da riordinare</p>
                    </div>
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}