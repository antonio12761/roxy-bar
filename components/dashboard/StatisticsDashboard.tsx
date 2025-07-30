"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Clock,
  Coffee,
  UtensilsCrossed,
  AlertCircle,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface DashboardStats {
  today: {
    revenue: number;
    orders: number;
    customers: number;
    avgOrderValue: number;
    growth: {
      revenue: number;
      orders: number;
      customers: number;
    };
  };
  realTime: {
    activeOrders: number;
    pendingPayments: number;
    waitingItems: number;
    averageWaitTime: number;
  };
  performance: {
    topProducts: Array<{
      name: string;
      sales: number;
      revenue: number;
    }>;
    stationStats: Array<{
      station: string;
      orders: number;
      avgTime: number;
      efficiency: number;
    }>;
    paymentMethods: Array<{
      method: string;
      amount: number;
      percentage: number;
    }>;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
}

interface StatisticsDashboardProps {
  userRole: 'MANAGER' | 'SUPERVISORE' | 'ADMIN';
  className?: string;
}

export default function StatisticsDashboard({ userRole, className }: StatisticsDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30); // secondi
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Carica statistiche dal server
  const loadStats = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/statistics/dashboard?period=${selectedPeriod}`);
      
      if (!response.ok) {
        throw new Error('Errore caricamento statistiche');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      console.error('Errore caricamento statistiche:', err);
    } finally {
      setLoading(false);
    }
  };

  // Effetto per caricamento iniziale e refresh automatico
  useEffect(() => {
    loadStats();
    
    if (autoRefresh) {
      const interval = setInterval(loadStats, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [selectedPeriod, refreshInterval, autoRefresh]);

  // Refresh manuale
  const handleRefresh = () => {
    setLoading(true);
    loadStats();
  };

  // Formatta valuta
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Formatta percentuale
  const formatPercentage = (value: number, showSign: boolean = true) => {
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Ottieni colore trend
  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  // Ottieni icona trend
  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4" />;
    if (value < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  if (loading && !stats) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Caricamento statistiche...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <AlertCircle className="h-8 w-8 text-red-500 mr-2" />
              <div className="text-center">
                <p className="text-red-600 font-medium">Errore caricamento statistiche</p>
                <p className="text-gray-500 text-sm mt-1">{error}</p>
                <Button onClick={handleRefresh} className="mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Riprova
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con controlli */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Statistiche</h2>
          <p className="text-gray-500 mt-1">
            Aggiornato: {new Date().toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="today">Oggi</option>
            <option value="week">Settimana</option>
            <option value="month">Mese</option>
            <option value="year">Anno</option>
          </select>
          
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Alert */}
      {stats.alerts && stats.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Avvisi</h3>
              <div className="mt-2 space-y-1">
                {stats.alerts.slice(0, 3).map((alert, index) => (
                  <p key={index} className="text-sm text-yellow-700">
                    {alert.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metriche principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incassi Giornalieri</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.today.revenue)}
            </div>
            <div className={`flex items-center text-xs ${getTrendColor(stats.today.growth.revenue)}`}>
              {getTrendIcon(stats.today.growth.revenue)}
              <span className="ml-1">
                {formatPercentage(stats.today.growth.revenue)} da ieri
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today.orders}</div>
            <div className={`flex items-center text-xs ${getTrendColor(stats.today.growth.orders)}`}>
              {getTrendIcon(stats.today.growth.orders)}
              <span className="ml-1">
                {formatPercentage(stats.today.growth.orders)} da ieri
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clienti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today.customers}</div>
            <div className={`flex items-center text-xs ${getTrendColor(stats.today.growth.customers)}`}>
              {getTrendIcon(stats.today.growth.customers)}
              <span className="ml-1">
                {formatPercentage(stats.today.growth.customers)} da ieri
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scontrino Medio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.today.avgOrderValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per ordine completato
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metriche real-time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Stato Real-Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.realTime.activeOrders}
              </div>
              <p className="text-sm text-gray-500">Ordini Attivi</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.realTime.pendingPayments}
              </div>
              <p className="text-sm text-gray-500">Pagamenti Sospesi</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.realTime.waitingItems}
              </div>
              <p className="text-sm text-gray-500">Prodotti in Attesa</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.realTime.averageWaitTime}m
              </div>
              <p className="text-sm text-gray-500">Tempo Medio Attesa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top prodotti */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Coffee className="h-5 w-5 mr-2" />
              Top Prodotti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.performance.topProducts.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="ml-3 font-medium">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(product.revenue)}</div>
                    <div className="text-sm text-gray-500">{product.sales} vendite</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance postazioni */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <UtensilsCrossed className="h-5 w-5 mr-2" />
              Performance Postazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.performance.stationStats.map((station, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{station.station}</span>
                    <Badge 
                      variant={station.efficiency >= 90 ? "default" : station.efficiency >= 70 ? "secondary" : "destructive"}
                    >
                      {station.efficiency}% efficienza
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{station.orders} ordini</span>
                    <span>{station.avgTime}m tempo medio</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        station.efficiency >= 90 ? 'bg-green-500' : 
                        station.efficiency >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${station.efficiency}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modalità di pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            Modalità di Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.performance.paymentMethods.map((method, index) => (
              <div key={index} className="text-center">
                <div className="text-lg font-bold">
                  {formatCurrency(method.amount)}
                </div>
                <div className="text-sm text-gray-500">{method.method}</div>
                <div className="text-xs text-gray-400">
                  {formatPercentage(method.percentage, false)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controlli refresh */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoRefresh" className="text-sm">
                  Aggiornamento automatico
                </label>
              </div>
              
              {autoRefresh && (
                <select
                  value={refreshInterval.toString()}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="15">15s</option>
                  <option value="30">30s</option>
                  <option value="60">1m</option>
                  <option value="300">5m</option>
                </select>
              )}
            </div>
            
            <div className="text-sm text-gray-500">
              {loading && <span className="flex items-center"><RefreshCw className="h-3 w-3 animate-spin mr-1" />Aggiornamento...</span>}
              {!loading && autoRefresh && <span>Prossimo aggiornamento in {refreshInterval}s</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
