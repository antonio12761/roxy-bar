"use client";

import { useState, useEffect } from "react";
import { Calendar, Coffee, Clock, Filter, Search, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { getOrdinazioniAperte } from "@/lib/actions/ordinazioni";
import Link from "next/link";

interface OrderItem {
  id: string;
  prodotto: {
    nome: string;
    categoria: string;
  };
  quantita: number;
  stato: string;
  prezzo: number;
}

interface Order {
  id: string;
  tavolo?: {
    id: number;
    numero: string;
    zona?: string | null;
    posti: number;
    stato: string;
    note?: string | null;
    attivo: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  cameriere: {
    nome: string;
  };
  tipo: string;
  stato: string;
  note?: string | null;
  dataApertura: Date;
  dataChiusura?: Date | null;
  totale: number;
  righe: OrderItem[];
}

export default function CronologiaPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"oggi" | "settimana" | "mese" | "tutti">("oggi");
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await getOrdinazioniAperte();
        // Include all orders for history, not just open ones
        setOrders(data.sort((a, b) => 
          new Date(b.dataApertura).getTime() - new Date(a.dataApertura).getTime()
        ));
      } catch (error) {
        console.error("Errore caricamento cronologia:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadOrders();
  }, []);

  const filterByDate = (order: Order) => {
    const orderDate = new Date(order.dataApertura);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (dateFilter) {
      case "oggi":
        return orderDate >= today;
      case "settimana":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      case "mese":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDate >= monthAgo;
      default:
        return true;
    }
  };

  const filterBySearch = (order: Order) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      order.tavolo?.numero.includes(query) ||
      order.cameriere.nome.toLowerCase().includes(query) ||
      order.note?.toLowerCase().includes(query) ||
      order.righe.some(item => item.prodotto.nome.toLowerCase().includes(query))
    );
  };

  const filteredOrders = orders
    .filter(filterByDate)
    .filter(filterBySearch)
    .filter(order => !showOnlyMine || order.cameriere.nome === "Tu"); // Replace with actual user check

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case "CONSEGNATA":
      case "PAGATA":
        return "text-white/60";
      case "ANNULLATA":
        return "text-white/50";
      case "IN_PREPARAZIONE":
      case "PRONTA":
        return "text-white/60";
      default:
        return "text-gray-400";
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Oggi ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return d.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const calculateDuration = (start: Date, end?: Date | null) => {
    const endTime = end ? new Date(end) : new Date();
    const duration = Math.floor((endTime.getTime() - new Date(start).getTime()) / 1000 / 60);
    
    if (duration < 60) return `${duration}m`;
    return `${Math.floor(duration / 60)}h ${duration % 60}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/cameriere" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-white/70" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Cronologia Ordini</h1>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per tavolo, cameriere o prodotto..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Date and other filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilter("oggi")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  dateFilter === "oggi" 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
                }`}
              >
                Oggi
              </button>
              <button
                onClick={() => setDateFilter("settimana")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  dateFilter === "settimana" 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
                }`}
              >
                Settimana
              </button>
              <button
                onClick={() => setDateFilter("mese")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  dateFilter === "mese" 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
                }`}
              >
                Mese
              </button>
              <button
                onClick={() => setDateFilter("tutti")}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  dateFilter === "tutti" 
                    ? "bg-white/20 text-white" 
                    : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
                }`}
              >
                Tutti
              </button>
            </div>
            
            <button
              onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showOnlyMine 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-700 text-muted-foreground hover:bg-slate-600"
              }`}
            >
              <Filter className="h-3 w-3 inline mr-1" />
              I miei ordini
            </button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-lg">Nessun ordine trovato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors">
              {/* Order Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {order.tavolo && (
                    <span className="font-bold text-foreground">
                      Tavolo {order.tavolo.numero}
                    </span>
                  )}
                  <span className={`text-sm font-medium ${getStatoColor(order.stato)}`}>
                    {order.stato === "CONSEGNATA" || order.stato === "PAGATA" ? (
                      <CheckCircle className="h-3 w-3 inline mr-1" />
                    ) : order.stato === "ANNULLATA" ? (
                      <XCircle className="h-3 w-3 inline mr-1" />
                    ) : null}
                    {order.stato}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(order.dataApertura)}
                </div>
              </div>

              {/* Order Details */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Cameriere: {order.cameriere.nome}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Prodotti:</span>{" "}
                    <span className="text-foreground">
                      {order.righe.slice(0, 3).map((item, i) => (
                        <span key={i}>
                          {item.quantita}x {item.prodotto.nome}
                          {i < Math.min(2, order.righe.length - 1) && ", "}
                        </span>
                      ))}
                      {order.righe.length > 3 && ` +${order.righe.length - 3} altri`}
                    </span>
                  </div>
                  {order.note && (
                    <div className="text-sm text-muted-foreground">
                      Note: {order.note}
                    </div>
                  )}
                </div>
                
                <div className="text-right space-y-1">
                  <div className="text-lg font-bold text-white/70">
                    €{order.totale.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {calculateDuration(order.dataApertura, order.dataChiusura)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}