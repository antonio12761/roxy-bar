"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Users, Activity, TrendingUp, Coffee, ClipboardList, Clock, User, AlertCircle, ChevronDown, ChevronUp, Utensils, CreditCard, ChefHat, X, Search, Filter, RefreshCw } from "lucide-react";
import { useSSE } from "@/contexts/sse-context";
import { toast } from "sonner";
import { getSupervisoreStats, getSupervisoreUsers, getSupervisoreOrders, toggleUserBlock, syncOrphansOrders } from "@/lib/actions/supervisore";
import UserDisplay from "@/components/UserDisplay";

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
  const [activeOrders, setActiveOrders] = useState([]);
  const [paidOrders, setPaidOrders] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingUserAction, setPendingUserAction] = useState<{user: any, action: 'block' | 'unblock'} | null>(null);
  
  // Card states for open/closed strategy
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['overview', 'orders'])); // Default open cards (orders attivi, paid-orders chiusi)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedPaidOrders, setExpandedPaidOrders] = useState<Set<string>>(new Set());
  
  // Helper functions for card management
  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const togglePaidOrder = (orderId: string) => {
    setExpandedPaidOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);
  const isOrderExpanded = (orderId: string) => expandedOrders.has(orderId);
  const isPaidOrderExpanded = (orderId: string) => expandedPaidOrders.has(orderId);
  
  // SSE subscription for real-time updates
  const { subscribe } = useSSE();

  // Conferma azione utente
  const confirmUserAction = (user: any) => {
    const shouldBlock = !user.bloccato;
    const isCurrentUser = currentUser && user.id === currentUser.id;
    
    if (shouldBlock) {
      const message = isCurrentUser 
        ? `Vuoi fare logout forzato?` 
        : `Vuoi bloccare ${user.nome}?`;
      
      // Mostra toast di conferma
      toast(message, {
        duration: 5000,
        action: {
          label: "Conferma",
          onClick: () => {
            executeUserAction(user, shouldBlock);
          },
        },
        cancel: {
          label: "Annulla",
          onClick: () => {
            console.log("Azione annullata");
          }
        }
      });
    } else {
      // Per sbloccare, esegui direttamente
      executeUserAction(user, shouldBlock);
    }
  };

  // Esegui azione utente
  const executeUserAction = async (user: any, shouldBlock: boolean) => {
    try {
      const result = await toggleUserBlock(user.id, shouldBlock);
      
      if (result.success) {
        // Se il supervisore si sta facendo logout da solo
        if (shouldBlock && currentUser && user.id === currentUser.id) {
          console.log('🔄 Supervisore auto-logout, eseguendo logout...');
          
          // Elimina i dati client-side
          localStorage.clear();
          sessionStorage.clear();
          
          // Auto-logout in corso
          
          // Mostra toast e reindirizza immediatamente
          toast.success('Logout forzato eseguito', {
            duration: 2000,
          });
          
          // Reindirizza immediatamente senza aspettare
          console.log('🔄 Eseguendo redirect al login...');
          window.location.href = '/login';
          return;
        }
        
        toast.success(result.message);
        // Ricarica la lista utenti dopo 1 secondo
        setTimeout(() => loadUsers(), 1000);
      } else {
        toast.error(result.error || 'Errore durante l\'operazione');
      }
    } catch (error) {
      console.error('Errore:', error);
      toast.error('Errore durante l\'operazione');
    }
  };

  // Function to load users
  const loadUsers = async () => {
    try {
      console.log('🔄 Caricamento utenti...');
      const data = await getSupervisoreUsers();
      console.log('👥 Utenti caricati:', data);
      setUsers(data);
      // Update online users count
      const onlineCount = data.filter((u: any) => u.online).length;
      setStats(prev => ({ ...prev, utentiOnline: onlineCount }));
      console.log(`📊 Aggiornamento conteggio utenti - Online: ${onlineCount}, Totali: ${data.length}`);
    } catch (err) {
      console.error('❌ Errore caricamento utenti:', err);
    }
  };
  
  // Function to load stats
  const loadStats = async () => {
    try {
      const data = await getSupervisoreStats();
      
      // Ensure all numeric values are actually numbers, but preserve current utentiOnline count
      setStats(prev => ({
        ordiniAttivi: Number(data.ordiniAttivi) || 0,
        utentiOnline: prev.utentiOnline, // Preserve current online users count
        incassoGiornaliero: Number(data.incassoGiornaliero) || 0,
        ordiniTotali: Number(data.ordiniTotali) || 0,
        scontrinoMedio: Number(data.scontrinoMedio) || 0,
        tavoliServiti: Number(data.tavoliServiti) || 0,
        tempoMedio: Number(data.tempoMedio) || 0
      }));
    } catch (err) {
      console.error('Errore caricamento stats:', err);
      // Set default values on error, but preserve utentiOnline
      setStats(prev => ({
        ordiniAttivi: 0,
        utentiOnline: prev.utentiOnline, // Preserve current online users count
        incassoGiornaliero: 0,
        ordiniTotali: 0,
        scontrinoMedio: 0,
        tavoliServiti: 0,
        tempoMedio: 0
      }));
    }
  };

  // Function to sync orphaned orders
  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      const result = await syncOrphansOrders();
      
      if (result.success) {
        if (result.orphanedOrders > 0) {
          toast.warning(result.message, {
            duration: 5000,
          });
          
          // Show details of orphaned orders
          if (result.issues && result.issues.length > 0) {
            console.log('Ordini orfani trovati:', result.issues);
          }
        } else {
          toast.success('Sincronizzazione completata: nessun ordine orfano trovato', {
            duration: 3000,
          });
        }
        
        // Reload orders and stats after sync
        loadOrders();
        loadStats();
        loadUsers();
      } else {
        toast.error(result.error || 'Errore durante la sincronizzazione');
      }
    } catch (error) {
      console.error('Errore sync:', error);
      toast.error('Errore durante la sincronizzazione');
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to load orders with debounce using server actions
  const lastLoadRef = useRef<number>(0);
  const loadOrders = async () => {
    // Debounce rapid calls
    const now = Date.now();
    if (now - lastLoadRef.current < 2000) {
      return; // Skip if called within 2 seconds
    }
    lastLoadRef.current = now;
    
    try {
      console.log('📋 Caricamento ordinazioni...');
      const data = await getSupervisoreOrders();
      console.log('📋 SUPERVISORE - Ordinazioni caricate:', data.length);
      
      // Separa ordini attivi da quelli pagati
      const activeOrdersList = data.filter((order: any) => order.stato !== 'PAGATA');
      const paidOrdersList = data.filter((order: any) => order.stato === 'PAGATA');
      
      console.log(`📋 SUPERVISORE - Ordini attivi: ${activeOrdersList.length}, Pagati: ${paidOrdersList.length}`);
      
      // Debug: Log dei dati degli ordini pagati per verificare la struttura
      if (paidOrdersList.length > 0) {
        console.log('💰 DEBUG ORDINI PAGATI:', paidOrdersList.map(order => ({
          id: order.id,
          tavolo: order.tavolo?.numero,
          tavoloCompleto: order.tavolo,
          tipo: order.tipo,
          cliente: order.cliente?.nome,
          nomeCliente: order.nomeCliente,
          clientePagatore: order.clientePagatore,
          totale: order.totale,
          modalitaPagamento: order.modalitaPagamento,
          stato: order.stato,
          dataPagamento: order.dataPagamento
        })));
      }
      
      // Debug: Log ordini senza tavolo
      const ordiniSenzaTavoloNumero = paidOrdersList.filter(order => !order.tavolo?.numero);
      if (ordiniSenzaTavoloNumero.length > 0) {
        console.log('⚠️ ORDINI SENZA NUMERO TAVOLO:', ordiniSenzaTavoloNumero.map(order => ({
          id: order.id,
          tipo: order.tipo,
          tavolo: order.tavolo,
          cliente: order.cliente?.nome || order.nomeCliente,
          stato: order.stato
        })));
      }
      
      setOrders(data); // Manteniamo tutti gli ordini per compatibilità
      setActiveOrders(activeOrdersList);
      setPaidOrders(paidOrdersList);
    } catch (err) {
      console.error('Errore caricamento ordinazioni:', err);
    }
  };

  useEffect(() => {
    // Get current user from localStorage or session
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }

    // Carica utenti reali prima (per avere il conteggio online corretto)
    loadUsers().then(() => {
      // Carica statistiche dopo che gli utenti sono stati caricati
      setTimeout(() => loadStats(), 100);
    });

    // Carica ordinazioni attive
    loadOrders();
    
    // Check for orphaned orders on initial load
    handleSyncOrders();
    
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
    
    // Subscribe to specific order status changes
    const unsubscribeOrderSent = subscribe('order:sent', (data) => {
      console.log('📤 SUPERVISORE: Ordine inviato:', data);
      loadOrders();
      loadStats();
    });
    
    const unsubscribeOrderStatusChange = subscribe('order:status-change', (data) => {
      console.log('🔄 SUPERVISORE: Cambio stato ordine:', data);
      loadOrders();
      loadStats();
    });
    
    // Aggiorna ordinazioni ogni 10 secondi
    const ordersInterval = setInterval(loadOrders, 10000);
    
    // Aggiorna stats e utenti ogni 30 secondi (prima utenti, poi stats con delay)
    const statsInterval = setInterval(() => {
      loadUsers().then(() => {
        setTimeout(() => loadStats(), 100);
      });
    }, 30000);
    
    return () => {
      clearInterval(ordersInterval);
      clearInterval(statsInterval);
      unsubscribePresence();
      unsubscribeNotifications();
      unsubscribeOrderNew();
      unsubscribeOrderUpdate();
    };
  }, [subscribe]);

  // Helper function to format table numbers with uppercase letters
  const formatTableNumber = (order: any) => {
    if (!order.tavolo?.numero) {
      // If no table, show order type (ASPORTO, CONSUMAZIONE, etc.)
      return order.tipo || 'ORDINE';
    }
    
    const numero = order.tavolo.numero;
    // Uppercase any letters in the table number
    return numero.toUpperCase();
  };

  // Funzione per ordinare gli ordini per numero tavolo
  const sortOrdersByTable = (orders: any[]) => {
    return [...orders].sort((a, b) => {
      const getTavoloNumber = (order: any) => {
        if (!order.tavolo?.numero) return 9999; // Ordini senza tavolo vanno alla fine
        
        const numero = order.tavolo.numero;
        const match = numero.match(/^([TMP])?(\d+)$/);
        
        if (!match) return 9999;
        
        const prefix = match[1] || '';
        const num = parseInt(match[2]);
        
        // Ordinamento: T1-T7, M1-M7, 11-16, 21-26, 31-36, P1-P4
        if (prefix === 'T' && num >= 1 && num <= 7) return 1000 + num;
        if (prefix === 'M' && num >= 1 && num <= 7) return 2000 + num;
        if (prefix === '' && num >= 11 && num <= 16) return 3000 + num;
        if (prefix === '' && num >= 21 && num <= 26) return 4000 + num;
        if (prefix === '' && num >= 31 && num <= 36) return 5000 + num;
        if (prefix === 'P' && num >= 1 && num <= 4) return 6000 + num;
        
        return 10000 + num;
      };
      
      return getTavoloNumber(a) - getTavoloNumber(b);
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      
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
          <UserDisplay />
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
          {stats.ordiniAttivi > 0 && stats.utentiOnline === 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-white/90">
              <AlertCircle className="h-3 w-3" />
              Ordini senza utenti attivi!
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Incasso Giornaliero</h3>
            <TrendingUp className="h-4 w-4 text-white/60" />
          </div>
          <div className="text-2xl font-bold text-foreground">€ {(Number(stats.incassoGiornaliero) || 0).toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Incasso di oggi
          </div>
        </div>
      </div>

      {/* Users Card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => toggleCard('users')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-white/60" />
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Gestione Utenti</h3>
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
            {isCardExpanded('users') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        
        {isCardExpanded('users') && (
          <div className="border-t border-border p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Staff Online */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  Staff Online ({users.filter((u: any) => u.online).length})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {users
                    .filter((user: any) => user.online)
                    .map((user: any, index) => {
                      const getRoleColor = (ruolo: string) => {
                        switch(ruolo?.toUpperCase()) {
                          case 'CAMERIERE': return 'bg-blue-600';
                          case 'PREPARA':
                          case 'BAR': return 'bg-amber-600';
                          case 'CASSA': return 'bg-green-600';
                          case 'CUCINA': return 'bg-red-600';
                          default: return 'bg-purple-600';
                        }
                      };
                      
                      const getRoleIcon = (ruolo: string) => {
                        switch(ruolo?.toUpperCase()) {
                          case 'CAMERIERE': return User;
                          case 'PREPARA':
                          case 'BAR': return Coffee;
                          case 'CASSA': return CreditCard;
                          case 'CUCINA': return ChefHat;
                          default: return User;
                        }
                      };
                      
                      const bgColor = getRoleColor(user.ruolo);
                      const Icon = getRoleIcon(user.ruolo);
                      
                      return (
                        <div
                          key={index}
                          className={`bg-muted border border-border rounded-lg p-3 hover:bg-muted/80 transition-all ${
                            user.bloccato ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-white truncate">{user.nome}</h4>
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                              </div>
                              <p className="text-sm text-slate-300">{user.ruolo}</p>
                              {user.lastActivity && (
                                <p className="text-xs text-slate-400 mt-1">
                                  {new Date(user.lastActivity).toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            {/* Switch per escludere utente */}
                            <div className="flex flex-col items-center gap-1">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!user.bloccato}
                                  onChange={() => confirmUserAction(user)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                              </label>
                              <span className="text-xs text-slate-400">
                                {user.bloccato ? 'Bloccato' : 'Attivo'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                  {users.filter((u: any) => u.online).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nessun utente online</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Offline */}
              <div>
                <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-500 rounded-full" />
                  Staff Offline ({users.filter((u: any) => !u.online).length})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {users
                    .filter((user: any) => !user.online)
                    .map((user: any, index) => {
                      const getRoleColor = (ruolo: string) => {
                        switch(ruolo?.toUpperCase()) {
                          case 'CAMERIERE': return 'bg-blue-600';
                          case 'PREPARA':
                          case 'BAR': return 'bg-amber-600';
                          case 'CASSA': return 'bg-green-600';
                          case 'CUCINA': return 'bg-red-600';
                          default: return 'bg-purple-600';
                        }
                      };
                      
                      const getRoleIcon = (ruolo: string) => {
                        switch(ruolo?.toUpperCase()) {
                          case 'CAMERIERE': return User;
                          case 'PREPARA':
                          case 'BAR': return Coffee;
                          case 'CASSA': return CreditCard;
                          case 'CUCINA': return ChefHat;
                          default: return User;
                        }
                      };
                      
                      const bgColor = getRoleColor(user.ruolo);
                      const Icon = getRoleIcon(user.ruolo);
                      
                      return (
                        <div
                          key={index}
                          className="bg-card border border-slate-700 rounded-lg p-3 opacity-60"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0 opacity-50`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-slate-300 truncate">{user.nome}</h4>
                                <div className="w-2 h-2 bg-slate-500 rounded-full flex-shrink-0" />
                              </div>
                              <p className="text-sm text-slate-400">{user.ruolo}</p>
                              {user.lastActivity && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Ultimo: {new Date(user.lastActivity).toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                  {users.filter((u: any) => !u.online).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{users.length > 0 ? 'Tutti online! 🎉' : 'Nessun utente caricato'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Orders */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => toggleCard('orders')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-purple-400" />
            <div className="text-left">
              <h2 className="text-sm font-semibold">Ordinazioni Attive</h2>
              <p className="text-xs text-muted-foreground">
                {activeOrders.length} attivi • Aggiornamento ogni 10s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSyncOrders();
              }}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizzazione...' : 'Sincronizza'}
            </button>
            {isCardExpanded('orders') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        
        {isCardExpanded('orders') && (
          <div className="border-t border-border">
            {activeOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessuna ordinazione attiva</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sortOrdersByTable(activeOrders).map((order: any) => (
                    <div
                      key={order.id}
                      className="bg-muted/30 border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {order.tavolo ? `Tavolo ${formatTableNumber(order)}` : formatTableNumber(order)}
                            </span>
                            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              order.stato === "APERTA" ? "bg-yellow-100 text-yellow-800" :
                              order.stato === "INVIATA" ? "bg-blue-100 text-blue-800" :
                              order.stato === "IN_PREPARAZIONE" ? "bg-orange-100 text-orange-800" :
                              order.stato === "PRONTA" ? "bg-green-100 text-green-800" :
                              order.stato === "CONSEGNATA" ? "bg-purple-100 text-purple-800" :
                              order.stato === "PAGATA" ? "bg-emerald-100 text-emerald-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {order.stato.replace("_", " ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">€{Number(order.totale).toFixed(2)}</div>
                          {isOrderExpanded(order.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      
                      {isOrderExpanded(order.id) && (
                        <div className="border-t border-border p-3">
                          <div className="space-y-2">
                            {order.righe.map((riga: any) => (
                              <div
                                key={riga.id}
                                className="flex items-center justify-between bg-background rounded px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{riga.quantita}x</span>
                                  <span className="text-sm truncate">{riga.prodotto.nome}</span>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-medium ${
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
                            <div className="mt-3 text-sm text-amber-300 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                              <strong>Note:</strong> {order.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paid Orders */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => toggleCard('paid-orders')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
              <div className="h-2 w-2 bg-white rounded-full" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-semibold">Ordini Pagati</h2>
              <p className="text-xs text-muted-foreground">
                {paidOrders.length} completati • Ultimi ordini processati
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full">
              <span>€</span>
              <span>{paidOrders.reduce((sum, order) => sum + Number(order.totale), 0).toFixed(2)}</span>
            </div>
            {isCardExpanded('paid-orders') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        
        {isCardExpanded('paid-orders') && (
          <div className="border-t border-border">
            {paidOrders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="h-8 w-8 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center opacity-50">
                  <div className="h-4 w-4 bg-green-500 rounded-full" />
                </div>
                <p className="text-sm">Nessun ordine pagato</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {sortOrdersByTable(paidOrders).map((order: any) => (
                    <div
                      key={order.id}
                      className="bg-green-50 border border-green-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => togglePaidOrder(order.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-green-100 transition-colors"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-green-900">
                              {formatTableNumber(order)} - {order.cliente?.nome || order.nomeCliente || order.clientePagatore}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                PAGATO
                              </div>
                              {order.clientePagatore && order.clientePagatore !== (order.cliente?.nome || order.nomeCliente) && (
                                <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  PER ALTRI
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs text-green-600">
                              <Clock className="h-3 w-3" />
                              {order.dataPagamento ? new Date(order.dataPagamento).toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : new Date(order.dataApertura).toLocaleTimeString('it-IT', {
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
                            {/* Informazioni pagamento se diverso dal cliente dell'ordine */}
                            {order.clientePagatore && order.clientePagatore !== (order.cliente?.nome || order.nomeCliente) && (
                              <div className="flex items-center gap-2 text-xs">
                                <User className="h-3 w-3 text-green-600" />
                                <span className="text-green-800 font-bold">
                                  Pagato da: {order.clientePagatore}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm text-green-900">€{Number(order.totale).toFixed(2)}</div>
                          {isPaidOrderExpanded(order.id) ? <ChevronUp className="h-4 w-4 text-green-600" /> : <ChevronDown className="h-4 w-4 text-green-600" />}
                        </div>
                      </button>
                      
                      {isPaidOrderExpanded(order.id) && (
                        <div className="border-t border-green-200 p-3 bg-green-50">
                          <div className="space-y-2">
                            {order.righe.map((riga: any) => (
                              <div
                                key={riga.id}
                                className="flex items-center justify-between bg-white rounded px-3 py-2 border border-green-100"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-green-900">{riga.quantita}x</span>
                                  <span className="text-sm text-green-800 truncate">{riga.prodotto.nome}</span>
                                </div>
                                <div className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                  €{(riga.quantita * riga.prezzo).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Informazioni di pagamento */}
                          <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-medium text-green-900">Totale Pagato:</span>
                              <span className="font-bold text-green-900">€{Number(order.totale).toFixed(2)}</span>
                            </div>
                            
                            {/* Informazioni cliente e pagatore */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-green-700">
                                <span>Cliente ordine:</span>
                                <span className="font-medium">{order.cliente?.nome || order.nomeCliente}</span>
                              </div>
                              {order.clientePagatore && order.clientePagatore !== (order.cliente?.nome || order.nomeCliente) && (
                                <div className="flex items-center justify-between text-xs text-green-800">
                                  <span>Pagato da:</span>
                                  <span className="font-bold">{order.clientePagatore}</span>
                                </div>
                              )}
                              {order.modalitaPagamento && (
                                <div className="flex items-center justify-between text-xs text-green-700 mt-1">
                                  <span>Modalità:</span>
                                  <span className="font-medium">{order.modalitaPagamento}</span>
                                </div>
                              )}
                              {order.dataPagamento && (
                                <div className="flex items-center justify-between text-xs text-green-700">
                                  <span>Data pagamento:</span>
                                  <span className="font-medium">
                                    {new Date(order.dataPagamento).toLocaleDateString('it-IT')} alle {new Date(order.dataPagamento).toLocaleTimeString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Statistics */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleCard('stats')}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            <div className="text-left">
              <h2 className="text-sm font-semibold">Statistiche Dettagliate</h2>
              <p className="text-xs text-muted-foreground">
                Analisi prestazioni e metriche operative
              </p>
            </div>
          </div>
          {isCardExpanded('stats') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {isCardExpanded('stats') && (
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

    </div>
  );
}