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

export default function DashboardPage() {
  // Dati di esempio per le statistiche
  const stats = [
    {
      title: "Ordini Oggi",
      value: "45",
      change: "+12%",
      icon: ShoppingCart,
      color: "bg-blue-500"
    },
    {
      title: "Incasso Giornaliero",
      value: "€1,234",
      change: "+8%",
      icon: Euro,
      color: "bg-green-500"
    },
    {
      title: "Prodotti Attivi",
      value: "128",
      change: "+3",
      icon: Package,
      color: "bg-purple-500"
    },
    {
      title: "Tempo Medio Servizio",
      value: "12 min",
      change: "-2 min",
      icon: Clock,
      color: "bg-orange-500"
    }
  ];

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>
        
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} text-white p-3 rounded-lg`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <span className={`text-sm font-medium ${
                  stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-gray-600 text-sm font-medium">{stat.title}</h3>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Sezioni Rapide */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ordini Recenti */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Ordini Recenti</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Tavolo 5</p>
                  <p className="text-sm text-gray-600">2 Cappuccini, 1 Cornetto</p>
                </div>
                <span className="text-sm font-medium text-blue-600">In corso</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Tavolo 12</p>
                  <p className="text-sm text-gray-600">3 Caffè, 2 Brioche</p>
                </div>
                <span className="text-sm font-medium text-green-600">Completato</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Tavolo 3</p>
                  <p className="text-sm text-gray-600">1 Spremuta, 1 Toast</p>
                </div>
                <span className="text-sm font-medium text-yellow-600">In preparazione</span>
              </div>
            </div>
          </div>

          {/* Avvisi */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Avvisi e Notifiche</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Scorte in esaurimento</p>
                  <p className="text-sm text-yellow-700">5 prodotti sotto la soglia minima</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Coffee className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Manutenzione macchina caffè</p>
                  <p className="text-sm text-blue-700">Programmata per domani alle 14:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grafico vendite (placeholder) */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Vendite Settimanali</h2>
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Grafico vendite (da implementare)</p>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}