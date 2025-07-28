"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
  ChefHat, 
  Clock, 
  RefreshCw, 
  Bell, 
  Check, 
  AlertCircle, 
  Coffee,
  User,
  Euro,
  Package,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff
} from "lucide-react";
import { getOrdinazioniAperte, aggiornaStatoRiga, aggiornaStatoOrdinazione } from "@/lib/actions/ordinazioni";
import { useSSE, useOrderUpdates, useNotifications } from "@/contexts/sse-context";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatus";
import { notifyOrderUpdate, notifyOrderReady, sendNotification } from "@/lib/actions/notifications";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";

interface OrderItem {
  id: string;
  ordinazioneId: string;
  prodotto: string;
  quantita: number;
  prezzo: number;
  stato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO";
  timestamp: string;
  destinazione: string;
  note?: string | null;
}

interface Ordinazione {
  id: string;
  tavolo?: string | number;
  cliente?: string;
  nomeCliente?: string;
  timestamp: string;
  items: OrderItem[];
  totaleCosto: number;
  stato: "APERTA" | "INVIATA" | "IN_PREPARAZIONE" | "PRONTA" | "CONSEGNATA";
  hasKitchenItems: boolean;
  cameriere?: string;
  note?: string;
}

export default function PreparaPageWrapper() {
  const [ordinazioni, setOrdinazioni] = useState<Ordinazione[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoOpenedRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  
  // Use new SSE hooks
  const { connected, quality, latency, subscribe } = useSSE();
  
  // Subscribe to order updates
  useOrderUpdates({
    onNewOrder: (data) => {
      playNotificationSound();
      // Debounce rapid updates
      const now = Date.now();
      if (now - lastUpdateRef.current > 500) {
        lastUpdateRef.current = now;
        loadOrders();
      }
    },
    onOrderUpdate: (data) => {
      // Update specific order without full reload
      if (data.orderId) {
        updateOrderLocally(data.orderId, data.status);
      }
    },
    onOrderReady: (data) => {
      playNotificationSound();
      loadOrders();
    }
  });
  
  // Subscribe to order status changes
  useEffect(() => {
    const unsubscribe = subscribe('order:status-change', (data) => {
      console.log('[Prepara] Order status change:', data);
      // Ricarica gli ordini quando lo stato cambia
      loadOrders();
    });
    
    return () => unsubscribe();
  }, [subscribe]);
  
  // Subscribe to notifications
  useNotifications((notification) => {
    // Handle notifications (could show toast, etc.)
    console.log('[Prepara] Notification:', notification);
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      playNotificationSound();
    }
  });

  // Update order locally without full reload
  const updateOrderLocally = useCallback((orderId: string, status: string) => {
    setOrdinazioni(prev => prev.map(ord => {
      if (ord.id === orderId) {
        return { ...ord, stato: status as Ordinazione['stato'] };
      }
      return ord;
    }));
  }, []);

  // Inizializza audio per notifiche
  useEffect(() => {
    // audioRef.current = new Audio('/notification-sound.mp3'); // TODO: Add notification sound file
  }, []);

  // Carica ordini dal database
  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const ordinazioniData = await getOrdinazioniAperte();
      
      console.log('🔍 DEBUG PREPARA: Dati grezzi dal database:', ordinazioniData);
      console.log('🔍 DEBUG PREPARA: Primo ordine tavolo:', ordinazioniData[0]?.tavolo);
      
      const ordinazioniProcessed: Ordinazione[] = [];
      
      ordinazioniData.forEach(ord => {
        const items: OrderItem[] = [];
        let totaleCosto = 0;
        let hasKitchenItems = false;
        
        ord.righe.forEach(riga => {
          // Include tutti i prodotti per avere visione completa
          items.push({
            id: riga.id,
            ordinazioneId: ord.id,
            prodotto: riga.prodotto.nome,
            quantita: riga.quantita,
            prezzo: riga.prodotto.prezzo,
            stato: riga.stato,
            timestamp: riga.timestampOrdine.toISOString(),
            destinazione: riga.destinazione,
            note: riga.note
          });
          
          totaleCosto += riga.prodotto.prezzo * riga.quantita;
          
          if (riga.destinazione === "CUCINA") {
            hasKitchenItems = true;
          }
        });
        
        // Solo ordinazioni con items per BAR/PREPARA
        const hasBarItems = items.some(item => 
          item.destinazione === "BAR" || item.destinazione === "PREPARA"
        );
        
        if (hasBarItems) {
          // Estrai nome cliente dalle note
          let nomeCliente = ord.nomeCliente;
          if (!nomeCliente && ord.note) {
            const match = ord.note.match(/Cliente:\s*([^-]+)/);
            if (match && match[1]) {
              nomeCliente = match[1].trim();
            }
          }
          
          // Usa la stessa logica del supervisore: ord.tavolo.numero direttamente
          const tavoloNumero = ord.tavolo ? ord.tavolo.numero : undefined;
          console.log('🔍 DEBUG: Processando ordine', ord.id, 'tavolo obj:', ord.tavolo, 'numero:', tavoloNumero);
          
          ordinazioniProcessed.push({
            id: ord.id,
            tavolo: tavoloNumero,
            cliente: ord.clienteId || undefined,
            nomeCliente: nomeCliente,
            timestamp: ord.dataApertura.toISOString(),
            items: items, // Tutti gli items per mostrare anche quelli della cucina
            totaleCosto,
            stato: ord.stato as Ordinazione["stato"],
            hasKitchenItems,
            cameriere: ord.cameriere?.nome,
            note: ord.note
          });
        }
      });
      
      // Ordina per timestamp (più vecchie prima)
      ordinazioniProcessed.sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      console.log('🔍 DEBUG: Ordini processati:', ordinazioniProcessed);
      console.log('🔍 DEBUG: Primo ordine processato tavolo:', ordinazioniProcessed[0]?.tavolo);
      
      setOrdinazioni(ordinazioniProcessed);
      
      console.log("Ordini caricati:", ordinazioniProcessed.length);
      console.log("Ordini pronti:", ordinazioniProcessed.filter(o => o.stato === "PRONTA").length);
      console.log("Ordini aperti:", ordinazioniProcessed.filter(o => o.stato === "APERTA").length);
      
      // Gestione selezione automatica
      if (selectedOrderId) {
        // Se l'ordine selezionato esiste ancora ed è APERTA, mantienilo
        const currentOrder = ordinazioniProcessed.find(o => o.id === selectedOrderId);
        if (currentOrder && currentOrder.stato === "APERTA") {
          console.log("Mantengo selezione corrente:", selectedOrderId);
          // Mantieni la selezione corrente
          return;
        }
        console.log("Ordine selezionato non più aperto o non trovato");
      }
      
      // Altrimenti seleziona la prima ordinazione aperta
      const primaAperta = ordinazioniProcessed.find(o => o.stato === "APERTA");
      if (primaAperta) {
        console.log("Seleziono nuova ordinazione:", primaAperta.id);
        setSelectedOrderId(primaAperta.id);
        // Solo se è la prima volta
        if (!hasAutoOpenedRef.current) {
          hasAutoOpenedRef.current = true;
          // Invia notifica inizio preparazione
          setTimeout(() => notifyOrderOpened(primaAperta), 500);
        }
      } else {
        console.log("Nessuna ordinazione aperta, deseleziono");
        // Se non ci sono ordini aperti, deseleziona
        setSelectedOrderId(null);
      }
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    
    // Sottoscrizione agli eventi SSE come nel supervisore
    const unsubscribeOrderNew = subscribe('order:new', (data) => {
      console.log('🎉 PREPARA: Ricevuto evento order:new:', data);
      playNotificationSound();
      loadOrders(); // Ricarica ordini quando arriva una nuova ordinazione
    });
    
    const unsubscribeOrderUpdate = subscribe('order:update', (data) => {
      console.log('📝 PREPARA: Ricevuto evento order:update:', data);
      loadOrders(); // Ricarica ordini quando un ordine viene aggiornato
    });
    
    // Aggiorna ordinazioni ogni 10 secondi
    const ordersInterval = setInterval(loadOrders, 10000);
    
    return () => {
      clearInterval(ordersInterval);
      unsubscribeOrderNew();
      unsubscribeOrderUpdate();
    };
  }, [subscribe]);

  // Notifica apertura ordinazione
  const notifyOrderOpened = async (ordinazione: Ordinazione) => {
    // Use new SSE service to emit events
    if (typeof window !== 'undefined') {
      notifyOrderUpdate(
        ordinazione.id, 
        'IN_PREPARAZIONE',
        'APERTA',
        'PREPARA'
      );
      
      sendNotification(
        'Preparazione iniziata',
        `Tavolo ${ordinazione.tavolo || 'N/A'} - Preparazione in corso`,
        'normal',
        ['CAMERIERE', 'SUPERVISORE']
      );
    }
  };

  // Aggiorna stato singolo prodotto con optimistic update
  const updateOrderStatus = async (itemId: string, newStatus: OrderItem["stato"]) => {
    const itemKey = `item_${itemId}`;
    
    // Apply optimistic update
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(itemKey, newStatus);
      return newMap;
    });

    try {
      const result = await aggiornaStatoRiga(itemId, newStatus);
      
      if (!result.success) {
        // Rollback on failure
        setOptimisticUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemKey);
          return newMap;
        });
        
        toast.error(`Errore: ${result.error}`);
        return false; // Indica fallimento
      } else if (newStatus === "PRONTO") {
        // Suona notifica per stato pronto
        playNotificationSound();
      }
      
      // Clear optimistic update after success
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemKey);
        return newMap;
      });
      
      return true; // Indica successo
    } catch (error) {
      // Rollback on error
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(itemKey);
        return newMap;
      });
      
      console.error("Errore aggiornamento stato:", error);
      toast.error("Errore durante l'aggiornamento dello stato");
      return false; // Indica fallimento
    }
  };

  // Marca l'ordinazione come pronta per il ritiro
  const marcaOrdinePronto = async (ordinazione: Ordinazione) => {
    console.log("Marcando ordine come pronto:", ordinazione.id);
    
    // Inizia la transizione
    setIsTransitioning(true);
    
    try {
      // Aggiorna lo stato dell'ordinazione nel database
      const result = await aggiornaStatoOrdinazione(ordinazione.id, "PRONTA");
      
      if (!result.success) {
        toast.error(`Errore: ${result.error}`);
        setIsTransitioning(false);
        return;
      }
      
      // Suona notifica
      playNotificationSound();
      
      // Invia notifiche in parallelo per maggiore velocità
      console.log("Invio notifiche...");
      try {
        await Promise.all([
          notifyOrderReady(
            ordinazione.id,
            ordinazione.tavolo,
            ordinazione.items.map(item => item.id)
          ),
          sendNotification(
            'Ordinazione Pronta',
            `Tavolo ${ordinazione.tavolo || 'N/A'} - Ordinazione pronta per il ritiro`,
            'high',
            ['CAMERIERE', 'SUPERVISORE'],
            true
          )
        ]);
        console.log("Notifiche inviate in parallelo");
      } catch (error) {
        console.error("Errore invio notifiche:", error);
      }
      
      // Prima deseleziona per permettere alla logica di selezione automatica di funzionare
      setSelectedOrderId(null);
      
      // Ricarica gli ordini in background senza bloccare l'UI
      loadOrders().catch(console.error);
      
    } catch (error) {
      console.error("Errore in marcaOrdinePronto:", error);
      setIsTransitioning(false);
    } finally {
      // Termina la transizione dopo un breve delay per mostrare lo skeleton
      setTimeout(() => {
        setIsTransitioning(false);
      }, 200);
    }
  };

  // Riproduci suono notifica
  const playNotificationSound = () => {
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play().catch(e => console.log("Errore riproduzione audio:", e));
    }
  };

  // Sollecita cameriere
  const sollecitiaCameriere = async (ordinazione: Ordinazione) => {
    playNotificationSound();
    
    if (typeof window !== 'undefined') {
      sendNotification(
        'Sollecito Ritiro',
        `Tavolo ${ordinazione.tavolo || 'N/A'} - Ordinazione pronta da ritirare!`,
        'urgent',
        ['CAMERIERE'],
        true
      );
    }
  };

  // Marca come consegnato
  const marcaConsegnato = async (ordinazione: Ordinazione) => {
    try {
      // Aggiorna lo stato dell'ordinazione nel database
      const result = await aggiornaStatoOrdinazione(ordinazione.id, "CONSEGNATA");
      
      if (!result.success) {
        toast.error(`Errore: ${result.error}`);
        return;
      }
      
      // Invia notifica
      if (typeof window !== 'undefined') {
        notifyOrderUpdate(
          ordinazione.id,
          'CONSEGNATA',
          ordinazione.stato,
          'PREPARA'
        );
        
        sendNotification(
          'Ordinazione Consegnata',
          `Tavolo ${ordinazione.tavolo || 'N/A'} - Ordinazione consegnata`,
          'high',
          ['SUPERVISORE', 'CAMERIERE', 'CASSA']
        );
      }
      
      // Ricarica gli ordini per rimuovere l'ordinazione consegnata dalla lista
      await loadOrders();
    } catch (error) {
      console.error("Errore in marcaConsegnato:", error);
      toast.error("Errore durante l'aggiornamento dello stato");
    }
  };

  const getStatusColor = (stato: OrderItem["stato"], itemId?: string) => {
    // Check if there's an optimistic update for this item
    const isOptimistic = itemId ? optimisticUpdates.has(`item_${itemId}`) : false;
    
    const baseColors = {
      "INSERITO": "bg-white/10/20 border-white/15-500 text-white/60",
      "IN_LAVORAZIONE": "bg-white/10/20 border-white/15-500 text-white/60",
      "PRONTO": "bg-white/10/20 border-white/15-500 text-white/60",
      "CONSEGNATO": "bg-gray-500/20 border-gray-500 text-gray-400"
    };
    
    const color = baseColors[stato] || "bg-gray-500/20 border-gray-500 text-gray-400";
    return isOptimistic ? `${color} opacity-70` : color;
  };

  const getStatusText = (stato: OrderItem["stato"]) => {
    switch(stato) {
      case "INSERITO": return "Da preparare";
      case "IN_LAVORAZIONE": return "In preparazione";
      case "PRONTO": return "Pronto";
      case "CONSEGNATO": return "Consegnato";
      default: return stato;
    }
  };

  const selectedOrder = ordinazioni.find(o => o.id === selectedOrderId);

  return (
    <div className="min-h-screen bg-background p-6">
      
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-orange-400" />
            <h1 className="text-2xl font-bold text-foreground">Postazione Prepara</h1>
          </div>
          <UserDisplay />
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <Wifi className="h-4 w-4 text-white/70" />
                <span className="text-white/70">Connesso</span>
                {quality && (
                  <span className="text-xs text-muted-foreground">
                    ({quality}{latency && `, ${latency}ms`})
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-white/60" />
                <span className="text-white/60">Disconnesso</span>
              </>
            )}
          </div>
          
          <button
            onClick={loadOrders}
            disabled={isLoading}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Layout - Split View */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Left Column - Order Cards */}
        <div className="col-span-4 space-y-4">
          {/* Sezione Da Ritirare */}
          {ordinazioni.some(o => o.stato === "PRONTA") && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-3 text-white/60">Da Ritirare</h2>
              <div className="space-y-3">
                {ordinazioni.filter(o => o.stato === "PRONTA").map((ordinazione) => {
              const isSelected = selectedOrderId === ordinazione.id;
              const isReady = ordinazione.stato === "PRONTA";
              
              return (
                <div
                  key={ordinazione.id}
                  onClick={() => {
                    setSelectedOrderId(ordinazione.id);
                    // Se è la prima volta che apriamo questa ordinazione APERTA, invia notifica
                    if (ordinazione.stato === "APERTA" && !isSelected) {
                      notifyOrderOpened(ordinazione);
                    }
                  }}
                  className={`
                    bg-card border rounded-lg p-4 cursor-pointer transition-all
                    ${isSelected ? 'border-white/20-500 shadow-lg' : 'border-border hover:border-white/20-500/50'}
                    ${isReady ? 'bg-white/10/10 border-white/15-500' : ''}
                  `}
                >
                  {/* Layout semplificato per ordini pronti */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-foreground">
                        Tavolo {ordinazione.tavolo || "N/A"}
                      </div>
                      {ordinazione.nomeCliente && (
                        <div className="text-sm font-medium text-foreground">
                          {ordinazione.nomeCliente}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons for Ready Orders */}
                  {isReady && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await sollecitiaCameriere(ordinazione);
                        }}
                        className="flex-1 px-3 py-2 bg-white/15 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <Bell className="h-3 w-3" />
                        Sollecita
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await marcaConsegnato(ordinazione);
                        }}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <Check className="h-3 w-3" />
                        Ritirato
                      </button>
                    </div>
                  )}
                </div>
              );
                })}
              </div>
            </>
          )}
          
          {/* Sezione Da Preparare */}
          <h2 className="text-lg font-semibold text-foreground mb-3">Da Preparare</h2>
          
          {ordinazioni.filter(o => o.stato === "APERTA").length === 0 && ordinazioni.filter(o => o.stato === "PRONTA").length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Coffee className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nessuna ordinazione da preparare</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordinazioni.filter(o => o.stato === "APERTA").map((ordinazione) => {
                const isSelected = selectedOrderId === ordinazione.id;
                const isReady = ordinazione.stato === "PRONTA";
                
                return (
                  <div
                    key={ordinazione.id}
                    onClick={() => {
                      setSelectedOrderId(ordinazione.id);
                      // Se è la prima volta che apriamo questa ordinazione, invia notifica
                      if (ordinazione.stato === "APERTA" && !isSelected) {
                        notifyOrderOpened(ordinazione);
                      }
                    }}
                    className={`
                      bg-card border rounded-lg p-4 cursor-pointer transition-all
                      ${isSelected ? 'border-white/20-500 shadow-lg' : 'border-border hover:border-white/20-500/50'}
                      ${isReady ? 'bg-white/10/10 border-white/15-500' : ''}
                    `}
                  >
                    {/* Layout per ordini da preparare */}
                    <div className="space-y-2">
                      {/* Prima riga: Tavolo e Cliente */}
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-foreground">
                          Tavolo {ordinazione.tavolo || "N/A"}
                        </div>
                        {ordinazione.nomeCliente && (
                          <div className="text-sm font-medium text-foreground">
                            {ordinazione.nomeCliente}
                          </div>
                        )}
                      </div>
                      
                      {/* Seconda riga: Orario e Importo */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(ordinazione.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="font-medium text-foreground">
                          €{ordinazione.totaleCosto.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Right Column - Order Details */}
        <div className="col-span-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Dettaglio Ordinazione</h2>
          
          {isTransitioning ? (
            // Skeleton Loader durante la transizione
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="animate-pulse">
                {/* Header Skeleton */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="h-7 bg-muted rounded w-32 mb-2"></div>
                      <div className="h-4 bg-muted rounded w-48"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-8 bg-muted rounded w-24 mb-1"></div>
                      <div className="h-4 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                </div>
                
                {/* Items Skeleton */}
                <div className="space-y-3 mb-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-8 w-12 bg-muted rounded"></div>
                          <div>
                            <div className="h-5 bg-muted rounded w-48 mb-2"></div>
                            <div className="h-4 bg-muted rounded w-32"></div>
                          </div>
                        </div>
                        <div className="h-6 bg-muted rounded w-24"></div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Button Skeleton */}
                <div className="h-12 bg-muted rounded-lg"></div>
              </div>
            </div>
          ) : selectedOrder ? (
            <div className="bg-card border border-border rounded-lg p-6">
              {/* Order Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      Tavolo {selectedOrder.tavolo || "N/A"}
                    </h3>
                    {selectedOrder.nomeCliente && (
                      <p className="text-muted-foreground">Cliente: {selectedOrder.nomeCliente}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">
                      €{selectedOrder.totaleCosto.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(selectedOrder.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                
                {selectedOrder.cameriere && (
                  <div className="text-sm text-muted-foreground">
                    Cameriere: {selectedOrder.cameriere}
                  </div>
                )}
              </div>
              
              {/* Items List */}
              <div className="space-y-3 mb-6">
                {selectedOrder.items.map((item) => {
                  const isBarItem = item.destinazione === "BAR" || item.destinazione === "PREPARA";
                  
                  return (
                    <div
                      key={item.id}
                      className={`
                        border rounded-lg p-4
                        ${isBarItem ? getStatusColor(item.stato, item.id) : 'bg-gray-500/10 border-gray-500 text-gray-400'}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold">{item.quantita}x</span>
                          <div>
                            <div className="font-medium text-lg">{item.prodotto}</div>
                          </div>
                        </div>
                        
                      </div>
                      
                      {item.note && (
                        <div className="mt-2 text-sm text-muted-foreground bg-white/10/10 border border-white/15-500/20 rounded p-2">
                          Note: {item.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Action Button */}
              {selectedOrder.stato === "APERTA" && (
                <button
                  onClick={() => {
                    console.log("Pulsante Pronto cliccato", selectedOrder);
                    marcaOrdinePronto(selectedOrder);
                  }}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium"
                >
                  <Check className="h-5 w-5" />
                  Pronto
                </button>
              )}
              
              {/* Note Ordine */}
              {selectedOrder.note && (
                <div className="mt-4 p-3 bg-white/10/10 border border-white/15-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-white/60 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-white/60">
                      <div className="font-medium mb-1">Note ordine:</div>
                      <div>{selectedOrder.note}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Seleziona un'ordinazione per vedere i dettagli</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}