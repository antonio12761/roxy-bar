"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Shield, 
  Users, 
  Activity, 
  TrendingUp, 
  Coffee, 
  ClipboardList, 
  Clock, 
  User, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Utensils, 
  CreditCard, 
  ChefHat, 
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react";
import { toast } from "sonner";
import { 
  getSupervisoreStats, 
  getSupervisoreUsers, 
  getSupervisoreOrders, 
  toggleUserBlock, 
  syncOrphansOrders 
} from "@/lib/actions/supervisore";
import { useStationSSE } from "@/hooks/useStationSSE";
import { StationType } from "@/lib/sse/station-filters";
import UserDisplay from "@/components/UserDisplay";
import { serializeDecimalData } from "@/lib/utils/decimal-serializer";

interface SupervisoreStats {
  ordiniAttivi: number;
  utentiOnline: number;
  incassoGiornaliero: number;
  ordiniTotali: number;
  scontrinoMedio: number;
  tavoliServiti: number;
  tempoMedio: number;
}

interface UserData {
  id: string;
  nome: string;
  ruolo: string;
  online: boolean;
  bloccato: boolean;
  lastActivity?: string;
}

interface OrderData {
  id: string;
  tavolo?: {
    numero: string;
  } | null;
  cameriere: {
    nome: string;
  };
  tipo: string;
  stato: string;
  note?: string | null;
  nomeCliente?: string | null;
  clientePagatore?: string | null;
  dataApertura: string;
  dataPagamento?: string | null;
  totale: number;
  modalitaPagamento?: string | null;
  righe: Array<{
    id: string;
    quantita: number;
    prezzo: number;
    stato: string;
    postazione: string;
    prodotto: {
      nome: string;
    };
  }>;
}

export default function SupervisorePageOptimized() {
  const [stats, setStats] = useState<SupervisoreStats>({
    ordiniAttivi: 0,
    utentiOnline: 0,
    incassoGiornaliero: 0,
    ordiniTotali: 0,
    scontrinoMedio: 0,
    tavoliServiti: 0,
    tempoMedio: 0
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeOrders, setActiveOrders] = useState<OrderData[]>([]);
  const [paidOrders, setPaidOrders] = useState<OrderData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  
  // Card states
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(['overview', 'orders']));
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedPaidOrders, setExpandedPaidOrders] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Use optimized SSE hook
  const {
    connectionHealth,
    eventQueue,
    getCachedData,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    clearEventQueue
  } = useStationSSE({
    stationType: StationType.SUPERVISORE,
    userId: currentUser?.id || '',
    enableCache: true,
    enableOptimisticUpdates: true,
    autoReconnect: true
  });

  // Process SSE events
  useEffect(() => {
    eventQueue.forEach(({ event, data }) => {
      console.log(`[Supervisore] Processing event: ${event}`, data);
      
      switch (event) {
        case 'order:new':
          handleNewOrder(data);
          break;
          
        case 'order:update':
        case 'order:status-change':
          handleOrderUpdate(data);
          break;
          
        case 'order:ready':
          handleOrderReady(data);
          break;
          
        case 'order:delivered':
        case 'order:paid':
          handleOrderCompleted(data);
          break;
          
        case 'user:presence':
          handleUserPresence(data);
          break;
          
        case 'notification:new':
          if (data.targetRoles?.includes('SUPERVISORE')) {
            toast.success(data.message, { duration: 4000 });
          }
          break;
      }
    });
    
    clearEventQueue();
  }, [eventQueue]);

  // Handle new order event
  const handleNewOrder = useCallback((data: any) => {
    toast.success('Nuova ordinazione ricevuta!', { duration: 3000 });
    loadOrders();
    loadStats();
  }, []);

  // Handle order update
  const handleOrderUpdate = useCallback((data: any) => {
    console.log('[Supervisore] Order update:', data);
    loadOrders();
    loadStats();
  }, []);

  // Handle order ready
  const handleOrderReady = useCallback((data: any) => {
    console.log('[Supervisore] Order ready:', data);
    toast.success(`Ordine pronto! ${data.tableNumber ? `Tavolo ${data.tableNumber}` : 'Asporto'}`, { 
      duration: 5000,
      icon: '🔔'
    });
    loadOrders();
  }, []);

  // Handle order completed
  const handleOrderCompleted = useCallback((data: any) => {
    console.log('[Supervisore] Order completed:', data);
    loadOrders();
    loadStats();
  }, []);

  // Handle user presence update
  const handleUserPresence = useCallback((data: any) => {
    console.log('[Supervisore] User presence update:', data);
    loadUsers();
  }, []);

  // Load stats with cache support
  const loadStats = useCallback(async () => {
    try {
      // Check cache first
      const cachedStats = getCachedData<SupervisoreStats>('stats:daily');
      if (cachedStats) {
        console.log('[Supervisore] Using cached stats');
        setStats(prev => ({
          ...cachedStats,
          utentiOnline: prev.utentiOnline // Preserve online count
        }));
      }

      // Fetch fresh data
      const data = await getSupervisoreStats();
      const serializedData = serializeDecimalData(data);
      
      setStats(prev => ({
        ordiniAttivi: Number(serializedData.ordiniAttivi) || 0,
        utentiOnline: prev.utentiOnline, // Preserve current online users count
        incassoGiornaliero: Number(serializedData.incassoGiornaliero) || 0,
        ordiniTotali: Number(serializedData.ordiniTotali) || 0,
        scontrinoMedio: Number(serializedData.scontrinoMedio) || 0,
        tavoliServiti: Number(serializedData.tavoliServiti) || 0,
        tempoMedio: Number(serializedData.tempoMedio) || 0
      }));
      
      setIsLoadingStats(false);
    } catch (err) {
      console.error('Errore caricamento stats:', err);
      setIsLoadingStats(false);
    }
  }, [getCachedData]);

  // Load users with cache support
  const loadUsers = useCallback(async () => {
    try {
      // Check cache first
      const cachedUsers = getCachedData<UserData[]>('users:all');
      if (cachedUsers && cachedUsers.length > 0) {
        console.log('[Supervisore] Using cached users');
        setUsers(cachedUsers);
        const onlineCount = cachedUsers.filter(u => u.online).length;
        setStats(prev => ({ ...prev, utentiOnline: onlineCount }));
        setIsLoadingUsers(false);
      }

      // Fetch fresh data
      const data = await getSupervisoreUsers();
      // Convert Date to string for lastActivity
      const mappedData = data.map((user: any) => ({
        ...user,
        lastActivity: user.lastActivity ? new Date(user.lastActivity).toISOString() : undefined
      }));
      setUsers(mappedData);
      
      // Update online users count
      const onlineCount = data.filter((u: any) => u.online).length;
      setStats(prev => ({ ...prev, utentiOnline: onlineCount }));
      
      setIsLoadingUsers(false);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
      setIsLoadingUsers(false);
    }
  }, [getCachedData]);

  // Load orders with cache support
  const loadOrders = useCallback(async () => {
    try {
      // Check cache first
      const cachedOrders = getCachedData<OrderData[]>('orders:all');
      if (cachedOrders && cachedOrders.length > 0) {
        console.log('[Supervisore] Using cached orders');
        const activeOrdersList = cachedOrders.filter(order => order.stato !== 'PAGATO');
        const paidOrdersList = cachedOrders.filter(order => order.stato === 'PAGATO');
        setActiveOrders(activeOrdersList);
        setPaidOrders(paidOrdersList);
        setIsLoadingOrders(false);
      }

      // Fetch fresh data
      const data = await getSupervisoreOrders();
      const serializedData = serializeDecimalData(data);
      
      // Separate active from paid orders
      const activeOrdersList = serializedData.filter((order: any) => order.stato !== 'PAGATO');
      const paidOrdersList = serializedData.filter((order: any) => order.stato === 'PAGATO');
      
      setActiveOrders(activeOrdersList);
      setPaidOrders(paidOrdersList);
      setIsLoadingOrders(false);
      
    } catch (err) {
      console.error('Errore caricamento ordinazioni:', err);
      setIsLoadingOrders(false);
    }
  }, [getCachedData]);

  // Handle user block/unblock with optimistic updates
  const handleUserAction = useCallback(async (user: UserData, shouldBlock: boolean) => {
    // Apply optimistic update
    const updateId = applyOptimisticUpdate(
      'user',
      user.id,
      { bloccato: shouldBlock },
      { bloccato: user.bloccato }
    );

    // Update UI immediately
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, bloccato: shouldBlock } : u
    ));

    try {
      const result = await toggleUserBlock(user.id, shouldBlock);
      
      if (!result.success) {
        // Rollback on failure
        if (updateId) rollbackOptimisticUpdate(updateId);
        setUsers(prev => prev.map(u => 
          u.id === user.id ? { ...u, bloccato: user.bloccato } : u
        ));
        toast.error(result.error || 'Errore durante l\'operazione');
      } else {
        toast.success(result.message);
        
        // If supervisor blocked themselves, redirect
        if (shouldBlock && currentUser && user.id === currentUser.id) {
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = '/login';
          return;
        }
        
        // Reload users after a delay
        setTimeout(() => loadUsers(), 1000);
      }
    } catch (error) {
      // Rollback on error
      if (updateId) rollbackOptimisticUpdate(updateId);
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, bloccato: user.bloccato } : u
      ));
      console.error('Errore:', error);
      toast.error('Errore durante l\'operazione');
    }
  }, [applyOptimisticUpdate, rollbackOptimisticUpdate, currentUser, loadUsers]);

  // Confirm user action
  const confirmUserAction = useCallback((user: UserData) => {
    const shouldBlock = !user.bloccato;
    const isCurrentUser = currentUser && user.id === currentUser.id;
    
    if (shouldBlock) {
      const message = isCurrentUser 
        ? `Vuoi fare logout forzato?` 
        : `Vuoi bloccare ${user.nome}?`;
      
      toast(message, {
        duration: 5000,
        action: {
          label: "Conferma",
          onClick: () => handleUserAction(user, shouldBlock),
        },
        cancel: {
          label: "Annulla",
          onClick: () => console.log("Azione annullata")
        }
      });
    } else {
      handleUserAction(user, shouldBlock);
    }
  }, [currentUser, handleUserAction]);

  // Sync orphaned orders
  const handleSyncOrders = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncOrphansOrders();
      
      if (result.success) {
        if (result.orphanedOrders && result.orphanedOrders > 0) {
          toast.warning(result.message, { duration: 5000 });
        } else {
          toast.success('Sincronizzazione completata: nessun ordine orfano trovato', {
            duration: 3000,
          });
        }
        
        // Reload data after sync
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
  }, [loadOrders, loadStats, loadUsers]);

  // Helper functions
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

  const formatTableNumber = (order: OrderData) => {
    if (!order.tavolo?.numero) {
      return order.tipo || 'ORDINE';
    }
    return order.tavolo.numero.toUpperCase();
  };

  const sortOrdersByTable = (orders: OrderData[]) => {
    return [...orders].sort((a, b) => {
      const getTavoloNumber = (order: OrderData) => {
        if (!order.tavolo?.numero) return 9999;
        
        const numero = order.tavolo.numero;
        const match = numero.match(/^([TMP])?(\d+)$/);
        
        if (!match) return 9999;
        
        const prefix = match[1] || '';
        const num = parseInt(match[2]);
        
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

  const getRoleColor = (ruolo: string) => {
    switch(ruolo?.toUpperCase()) {
      case 'CAMERIERE': return 'bg-blue-600';
      case 'PREPARA': return 'bg-amber-600';
      case 'BANCO': return 'bg-indigo-600';
      case 'CASSA': return 'bg-green-600';
      case 'CUCINA': return 'bg-red-600';
      default: return 'bg-purple-600';
    }
  };
  
  const getRoleIcon = (ruolo: string) => {
    switch(ruolo?.toUpperCase()) {
      case 'CAMERIERE': return User;
      case 'PREPARA': return Coffee;
      case 'BANCO': return Coffee;
      case 'CASSA': return CreditCard;
      case 'CUCINA': return ChefHat;
      default: return User;
    }
  };

  // Connection quality indicator
  const getConnectionIcon = () => {
    switch (connectionHealth.status) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
      case 'error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionHealth.quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-green-400';
      case 'fair':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
    }
  };

  // Load current user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Initial load
  useEffect(() => {
    // Load users first to get online count
    loadUsers().then(() => {
      setTimeout(() => loadStats(), 100);
    });
    loadOrders();
    
    // Initial sync check
    handleSyncOrders();

    // Set up periodic updates
    const ordersInterval = setInterval(loadOrders, 10000);
    const statsInterval = setInterval(() => {
      loadUsers().then(() => {
        setTimeout(() => loadStats(), 100);
      });
    }, 30000);
    
    return () => {
      clearInterval(ordersInterval);
      clearInterval(statsInterval);
    };
  }, [loadUsers, loadStats, loadOrders, handleSyncOrders]);

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);
  const isOrderExpanded = (orderId: string) => expandedOrders.has(orderId);
  const isPaidOrderExpanded = (orderId: string) => expandedPaidOrders.has(orderId);

  if (isLoadingStats && isLoadingUsers && isLoadingOrders) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {getConnectionIcon()}
              <span className={`text-sm ${getConnectionColor()}`}>
                {connectionHealth.latency}ms
              </span>
            </div>
            <UserDisplay />
          </div>
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
                  Staff Online ({users.filter(u => u.online).length})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {users
                    .filter(user => user.online)
                    .map((user, index) => {
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
                  
                  {users.filter(u => u.online).length === 0 && (
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
                  Staff Offline ({users.filter(u => !u.online).length})
                </h3>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {users
                    .filter(user => !user.online)
                    .map((user, index) => {
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
                  
                  {users.filter(u => !u.online).length === 0 && (
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
            
            {/* Fix Destinazioni Button - Only for first-time setup */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const response = await fetch('/api/fix-destinations');
                  const result = await response.json();
                  if (result.success) {
                    toast.success(`Fix completato! ${result.righeAggiornate} righe aggiornate.`);
                    loadOrders(); // Ricarica gli ordini
                  } else {
                    toast.error('Errore durante il fix: ' + (result.error || 'Errore sconosciuto'));
                  }
                } catch (error) {
                  toast.error('Errore di connessione');
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg transition-colors"
              title="Aggiorna destinazioni BAR → PREPARA (solo prima volta)"
            >
              <AlertCircle className="h-3 w-3" />
              Fix Destinazioni
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
                  {sortOrdersByTable(activeOrders).map(order => (
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
                              order.stato === "ORDINATO" ? "bg-yellow-100 text-yellow-800" :
                              order.stato === "IN_PREPARAZIONE" ? "bg-orange-100 text-orange-800" :
                              order.stato === "PRONTO" ? "bg-green-100 text-green-800" :
                              order.stato === "CONSEGNATO" ? "bg-purple-100 text-purple-800" :
                              order.stato === "RICHIESTA_CONTO" ? "bg-blue-100 text-blue-800" :
                              order.stato === "PAGATO" ? "bg-emerald-100 text-emerald-800" :
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
                            {order.righe.map(riga => (
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
                                  {riga.postazione}
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
                  {sortOrdersByTable(paidOrders).map(order => (
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
                              {formatTableNumber(order)} - {order.nomeCliente || order.clientePagatore || 'Cliente'}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                PAGATO
                              </div>
                              {order.clientePagatore && order.clientePagatore !== order.nomeCliente && (
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
                            {order.clientePagatore && order.clientePagatore !== order.nomeCliente && (
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
                            {order.righe.map(riga => (
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
                          
                          {/* Payment Information */}
                          <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="font-medium text-green-900">Totale Pagato:</span>
                              <span className="font-bold text-green-900">€{Number(order.totale).toFixed(2)}</span>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-green-700">
                                <span>Cliente ordine:</span>
                                <span className="font-medium">{order.nomeCliente || 'N/A'}</span>
                              </div>
                              {order.clientePagatore && order.clientePagatore !== order.nomeCliente && (
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

      {/* Statistics */}
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