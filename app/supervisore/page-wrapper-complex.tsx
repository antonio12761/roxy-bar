"use client";

import { useState, useEffect } from "react";
import { Shield, Users, Activity, TrendingUp, Coffee, ClipboardList, Clock, User, AlertCircle, ChevronDown, ChevronUp, Utensils, CreditCard, ChefHat, X, Search, Filter } from "lucide-react";
import { useSSE } from "@/contexts/sse-context";
import { toast } from "sonner";
import { getSupervisoreStats, getSupervisoreUsers, getSupervisoreOrders } from "@/lib/actions/supervisore";

export default function SupervisorePageWrapper() {
  const [stats, setStats] = useState({
    ordiniAttivi: 0,
    utentiOnline: 0,
    incassoGiornaliero: 0,
    ordiniTotali: 0,
    scontrinoMedio: 0,
    tavoliServiti: 0,
    tempoMedio: 0
  });
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // SSE subscription for real-time updates
  const { subscribe } = useSSE();

  // Filter users based on search term and role filter
  const filteredUsers = users.filter((user: any) => {
    const matchesSearch = user.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.ruolo === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Function to load users
  const loadUsers = async () => {
    try {
      const data = await getSupervisoreUsers();
      setUsers(data);
      // Update online users count
      const onlineCount = data.filter((u: any) => u.online).length;
      setStats(prev => ({ ...prev, utentiOnline: onlineCount }));
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
    }
  };
  
  // Function to load stats
  const loadStats = async () => {
    try {
      const data = await getSupervisoreStats();
      setStats(data);
    } catch (err) {
      console.error('Errore caricamento stats:', err);
    }
  };

  useEffect(() => {
    // Get current user from localStorage or session
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }

    // Carica statistiche reali dal server
    loadStats();

    // Carica utenti reali
    loadUsers();

    // Carica ordinazioni attive using server actions
    const loadOrders = async () => {
      try {
        console.log('📋 Caricamento ordinazioni...');
        const data = await getSupervisoreOrders();
        console.log('📋 Ordinazioni caricate:', data.length);
        setOrders(data);
      } catch (err) {
        console.error('Errore caricamento ordinazioni:', err);
      }
    };
    
    loadOrders();
    
    // Subscribe to user presence updates
    const unsubscribePresence = subscribe('user:presence', (data) => {
      console.log('User presence update:', data);
      // Reload users when someone logs in/out
      loadUsers();
    });

    // Subscribe to notifications
    const unsubscribeNotifications = subscribe('notification:new', (data) => {
      if (data.targetRoles?.includes('SUPERVISORE')) {
        toast.success(data.message, {
          duration: 4000,
        });
      }
    });
    
    // Subscribe to order events
    const unsubscribeOrderNew = subscribe('order:new', (data) => {
      console.log('🎉 SUPERVISORE: Ricevuto evento order:new:', data);
      toast.success('Nuova ordinazione ricevuta!', {
        duration: 3000,
      });
      loadOrders(); // Ricarica ordini quando arriva una nuova ordinazione
      loadStats();  // Aggiorna anche le statistiche
    });
    
    const unsubscribeOrderUpdate = subscribe('order:update', (data) => {
      console.log('Aggiornamento ordinazione:', data);
      loadOrders(); // Ricarica ordini quando un ordine viene aggiornato
      loadStats();  // Aggiorna anche le statistiche
    });
    
    // Aggiorna ordinazioni ogni 30 secondi
    const interval = setInterval(loadOrders, 30000);
    
    return () => {
      clearInterval(interval);
      unsubscribePresence();
      unsubscribeNotifications();
      unsubscribeOrderNew();
      unsubscribeOrderUpdate();
    };
  }, [subscribe]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Shield className="h-6 w-6 text-purple-400" />
              <h1 className="text-xl font-bold text-foreground">Pannello Supervisore</h1>
            </div>
            <div className="text-xs text-muted-foreground">
              Gestione e monitoraggio del sistema Bar Roxy
            </div>
          </div>
          {currentUser && (
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">{currentUser.nome}</div>
              <div className="text-xs text-muted-foreground">{currentUser.ruolo}</div>
            </div>
          )}
        </div>
      </div>

      {/* Panoramic Overview - Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Utenti Online</h3>
            <Users className="h-4 w-4 text-white/60" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.utentiOnline}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Utenti attualmente connessi
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Ordini Attivi</h3>
            <Coffee className="h-4 w-4 text-white/70" />
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.ordiniAttivi}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Ordini in lavorazione
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Incasso Giornaliero</h3>
            <TrendingUp className="h-4 w-4 text-white/60" />
          </div>
          <div className="text-2xl font-bold text-foreground">€ {(stats.incassoGiornaliero || 0).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Incasso di oggi
          </div>
        </div>
      </div>

      {/* Users Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowUsersModal(true)}
          className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors w-full text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-white/60" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Visualizza Utenti</h3>
                <p className="text-xs text-muted-foreground">
                  {stats.utentiOnline} online • {users.length - stats.utentiOnline} offline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white/8 rounded-full animate-pulse" />
                <span className="text-xs font-medium">{stats.utentiOnline}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </button>
      </div>

      {/* Active Orders */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Ordinazioni Attive
          </h2>
          <div className="text-xs text-muted-foreground">
            Aggiornamento ogni 30 secondi
          </div>
        </div>
        
        {orders.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessuna ordinazione attiva</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {orders.map((order: any) => (
              <div
                key={order.id}
                className="bg-card border border-border rounded-lg p-3 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {order.tavolo ? `Tavolo ${order.tavolo.numero}` : order.tipo}
                    </span>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      order.stato === "APERTA" ? "bg-yellow-100 text-yellow-800" :
                      order.stato === "INVIATA" ? "bg-blue-100 text-blue-800" :
                      order.stato === "IN_PREPARAZIONE" ? "bg-orange-100 text-orange-800" :
                      order.stato === "PRONTA" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {order.stato.replace("_", " ")}
                    </div>
                  </div>
                  <div className="font-medium text-sm">€{Number(order.totale).toFixed(2)}</div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Clock className="h-3 w-3" />
                  {new Date(order.dataApertura).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {order.cameriere && (
                    <>
                      <span>•</span>
                      <span>{order.cameriere.nome}</span>
                    </>
                  )}
                </div>
                
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {order.righe.map((riga: any) => (
                    <div
                      key={riga.id}
                      className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{riga.quantita}x</span>
                        <span className="truncate">{riga.prodotto.nome}</span>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded text-xs ${
                        riga.stato === "INSERITO" ? "bg-gray-100 text-gray-700" :
                        riga.stato === "IN_LAVORAZIONE" ? "bg-blue-100 text-blue-700" :
                        riga.stato === "PRONTO" ? "bg-green-100 text-green-700" :
                        riga.stato === "CONSEGNATO" ? "bg-purple-100 text-purple-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {riga.destinazione}
                      </div>
                    </div>
                  ))}
                </div>
                
                {order.note && (
                  <div className="mt-2 text-xs text-white/90 bg-amber-50 border border-white/20-200 rounded px-2 py-1">
                    Note: {order.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible Statistics */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Statistiche Dettagliate
          </h2>
          {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {showStats && (
          <div className="p-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.ordiniTotali}</div>
                <div className="text-xs text-muted-foreground">Ordini Totali</div>
                <div className="text-xs text-white/60">+12% rispetto a ieri</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">€ {(stats.scontrinoMedio || 0).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Scontrino Medio</div>
                <div className="text-xs text-white/60">+5% rispetto a ieri</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{stats.tavoliServiti}</div>
                <div className="text-xs text-muted-foreground">Tavoli Serviti</div>
                <div className="text-xs text-white/50">-3% rispetto a ieri</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{(stats.tempoMedio || 0).toFixed(1)} min</div>
                <div className="text-xs text-muted-foreground">Tempo Medio Servizio</div>
                <div className="text-xs text-white/60">-2 min rispetto a ieri</div>
              </div>
            </div>
            
            {/* Additional Stats */}
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="font-semibold text-sm mb-3">Prestazioni per Reparto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Cucina</span>
                    <span className="text-xs font-medium">87%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-white/8 h-1.5 rounded-full" style={{width: '87%'}} />
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Bar</span>
                    <span className="text-xs font-medium">92%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-white/8 h-1.5 rounded-full" style={{width: '92%'}} />
                  </div>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Servizio</span>
                    <span className="text-xs font-medium">78%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-white/10 h-1.5 rounded-full" style={{width: '78%'}} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Users Modal */}
      {showUsersModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowUsersModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Enhanced Modal Header */}
            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border-b border-border">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Gestione Staff</h2>
                    <p className="text-sm text-muted-foreground">
                      Monitoraggio in tempo reale del personale
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Quick Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-white/10 rounded-full animate-pulse" />
                      <span className="font-medium">{users.filter((u: any) => u.online).length} Online</span>
                    </div>
                    <div className="flex items-center gap-2 bg-red-100 text-red-800 px-3 py-1 rounded-full">
                      <div className="w-2 h-2 bg-white/8 rounded-full" />
                      <span className="font-medium">{users.filter((u: any) => !u.online).length} Offline</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUsersModal(false);
                      setSearchTerm("");
                      setRoleFilter("ALL");
                    }}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Search and Filter Bar */}
              <div className="px-6 pb-4">
                <div className="flex gap-4">
                  {/* Search Input */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cerca utente per nome..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  
                  {/* Role Filter */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="pl-10 pr-8 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none min-w-[140px]"
                    >
                      <option value="ALL">Tutti i ruoli</option>
                      <option value="CAMERIERE">Cameriere</option>
                      <option value="BAR">Bar</option>
                      <option value="PREPARA">Prepara</option>
                      <option value="CASSA">Cassa</option>
                      <option value="CUCINA">Cucina</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Role Legend - More compact */}
              <div className="bg-muted/30 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center flex-wrap gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-600 rounded-full" />
                    <span className="font-medium">Cameriere</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white/20 rounded-full" />
                    <span className="font-medium">Bar/Prepara</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-600 rounded-full" />
                    <span className="font-medium">Cassa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full" />
                    <span className="font-medium">Cucina</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Utenti Online */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-3">
                      <div className="w-3 h-3 bg-white/8 rounded-full animate-pulse" />
                      Staff Online
                    </h3>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      {filteredUsers.filter((u: any) => u.online).length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {filteredUsers
                      .filter((user: any) => user.online)
                      .map((user: any, index) => {
                        const getRoleStyle = (ruolo: string) => {
                          switch(ruolo?.toUpperCase()) {
                            case 'CAMERIERE':
                              return { bg: 'bg-blue-600', border: 'border-white/15-200', textColor: 'text-blue-700' };
                            case 'PREPARA':
                            case 'BAR':
                              return { bg: 'bg-white/20', border: 'border-white/20-200', textColor: 'text-amber-700' };
                            case 'CASSA':
                              return { bg: 'bg-green-600', border: 'border-white/15-200', textColor: 'text-green-700' };
                            case 'CUCINA':
                              return { bg: 'bg-red-600', border: 'border-white/10-200', textColor: 'text-red-700' };
                            default:
                              return { bg: 'bg-purple-600', border: 'border-purple-200', textColor: 'text-purple-700' };
                          }
                        };
                        
                        const roleStyle = getRoleStyle(user.ruolo);
                        const Icon = user.ruolo?.toUpperCase() === 'CAMERIERE' ? User :
                                   user.ruolo?.toUpperCase() === 'PREPARA' || user.ruolo?.toUpperCase() === 'BAR' ? Coffee :
                                   user.ruolo?.toUpperCase() === 'CASSA' ? CreditCard :
                                   user.ruolo?.toUpperCase() === 'CUCINA' ? ChefHat : User;
                        
                        return (
                          <div
                            key={index}
                            className={`bg-white border-2 ${roleStyle.border} rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 ${roleStyle.bg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-foreground truncate">{user.nome}</h4>
                                  <div className="w-3 h-3 bg-white/8 rounded-full animate-pulse flex-shrink-0" />
                                </div>
                                <div className={`text-sm font-medium ${roleStyle.textColor} mb-2`}>
                                  {user.ruolo}
                                </div>
                                {user.lastActivity && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(user.lastActivity).toLocaleString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: '2-digit'
                                    })}
                                  </div>
                                )}
                                {user.currentTable && (
                                  <div className="mt-2 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs inline-block">
                                    📍 Tavolo #{user.currentTable}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    {filteredUsers.filter((u: any) => u.online).length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">
                          {searchTerm || roleFilter !== "ALL" ? "Nessun utente online trovato" : "Nessun utente online"}
                        </p>
                        {(searchTerm || roleFilter !== "ALL") && (
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setRoleFilter("ALL");
                            }}
                            className="text-blue-600 hover:underline text-xs mt-1"
                          >
                            Rimuovi filtri
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Utenti Offline */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-3">
                      <div className="w-3 h-3 bg-white/5 rounded-full" />
                      Staff Offline
                    </h3>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      {filteredUsers.filter((u: any) => !u.online).length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {filteredUsers
                      .filter((user: any) => !user.online)
                      .map((user: any, index) => {
                        const getRoleStyle = (ruolo: string) => {
                          switch(ruolo?.toUpperCase()) {
                            case 'CAMERIERE':
                              return { bg: 'bg-blue-600', textColor: 'text-blue-600' };
                            case 'PREPARA':
                            case 'BAR':
                              return { bg: 'bg-white/20', textColor: 'text-white/90' };
                            case 'CASSA':
                              return { bg: 'bg-green-600', textColor: 'text-green-600' };
                            case 'CUCINA':
                              return { bg: 'bg-red-600', textColor: 'text-red-600' };
                            default:
                              return { bg: 'bg-purple-600', textColor: 'text-purple-600' };
                          }
                        };
                        
                        const roleStyle = getRoleStyle(user.ruolo);
                        const Icon = user.ruolo?.toUpperCase() === 'CAMERIERE' ? User :
                                   user.ruolo?.toUpperCase() === 'PREPARA' || user.ruolo?.toUpperCase() === 'BAR' ? Coffee :
                                   user.ruolo?.toUpperCase() === 'CASSA' ? CreditCard :
                                   user.ruolo?.toUpperCase() === 'CUCINA' ? ChefHat : User;
                        
                        return (
                          <div
                            key={index}
                            className="bg-muted/30 border border-border rounded-xl p-4 opacity-70"
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 ${roleStyle.bg} rounded-xl flex items-center justify-center flex-shrink-0 opacity-60`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold text-foreground truncate">{user.nome}</h4>
                                  <div className="w-3 h-3 bg-white/5 rounded-full flex-shrink-0" />
                                </div>
                                <div className={`text-sm font-medium ${roleStyle.textColor} mb-2`}>
                                  {user.ruolo}
                                </div>
                                {user.lastActivity && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(user.lastActivity).toLocaleString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      day: '2-digit',
                                      month: '2-digit'
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    {filteredUsers.filter((u: any) => !u.online).length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">
                          {searchTerm || roleFilter !== "ALL" ? "Nessun utente offline trovato" : "Tutti gli utenti sono online! 🎉"}
                        </p>
                        {(searchTerm || roleFilter !== "ALL") && (
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setRoleFilter("ALL");
                            }}
                            className="text-blue-600 hover:underline text-xs mt-1"
                          >
                            Rimuovi filtri
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}