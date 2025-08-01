"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  ChefHat, 
  Clock, 
  RefreshCw, 
  Bell, 
  Check, 
  AlertCircle, 
  Coffee,
  User,
  Package,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  ClipboardList,
  ArrowLeft,
  X
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  getOrdinazioniAperte, 
  aggiornaStatoRiga, 
  aggiornaStatoOrdinazione, 
  sollecitaOrdinePronto, 
  segnaOrdineRitirato, 
  cancellaOrdiniAttivi 
} from "@/lib/actions/ordinazioni";
import { useRealTime } from "@/hooks/use-real-time";
import { toast } from "@/lib/toast";
import UserDisplay from "@/components/UserDisplay";
import { ParticleEffect } from "@/components/ui/ParticleEffect";
import { ProcedureViewModal } from "@/components/prepara/ProcedureViewModal";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemedModal } from "@/components/ui/ThemedModal";

interface OrderItem {
  id: string;
  ordinazioneId: string;
  prodotto: string;
  prodottoId?: number;
  quantita: number;
  prezzo: number;
  stato: "INSERITO" | "IN_LAVORAZIONE" | "PRONTO" | "CONSEGNATO";
  timestamp: string;
  postazione: string;
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
  stato: "ORDINATO" | "IN_PREPARAZIONE" | "PRONTO" | "CONSEGNATO";
  hasKitchenItems: boolean;
  cameriere?: string;
  note?: string;
}

export default function PreparaPageServerActions({ currentUser }: { currentUser: any }) {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [orders, setOrders] = useState<Ordinazione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Ordinazione | null>(null);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'attesa' | 'preparazione' | 'pronti' | 'ritirati'>('attesa');
  const [isStartingPreparation, setIsStartingPreparation] = useState(false);
  
  // Procedure modal state
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [selectedProductForProcedure, setSelectedProductForProcedure] = useState<{ name: string; id: number | null; quantity: number } | null>(null);
  
  // Delete all orders modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Particle effect state
  const [particleKey, setParticleKey] = useState(0);
  const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });
  const ordersCountRef = useRef<HTMLElement>(null);
  
  // Use real-time hook con server actions
  const { 
    orders: realtimeOrders, 
    counts, 
    connectionStatus, 
    refresh 
  } = useRealTime({
    stationType: "PREPARA",
    onNewOrder: (order) => {
      toast.success(`Nuovo ordine dal tavolo ${order.tableNumber || 'N/A'}`);
      // Trigger particle effect
      if (ordersCountRef.current) {
        const rect = ordersCountRef.current.getBoundingClientRect();
        setParticlePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        setParticleKey(prev => prev + 1);
      }
    },
    onOrderUpdate: (order) => {
      // Gestisci aggiornamenti ordini
      loadOrders();
    }
  });
  
  const loadOrders = useCallback(async () => {
    try {
      const res = await getOrdinazioniAperte();
      
      if (res && Array.isArray(res)) {
        const mappedOrders: Ordinazione[] = res.map((ordine: any) => ({
          id: ordine.id,
          tavolo: ordine.tavoloNumero || ordine.tavolo?.numero,
          cliente: ordine.clienteNome || ordine.nomeCliente,
          nomeCliente: ordine.clienteNome || ordine.nomeCliente,
          timestamp: ordine.timestamp || ordine.creato,
          items: ordine.items || ordine.RigaOrdinazione?.map((item: any) => ({
            id: item.id,
            ordinazioneId: ordine.id,
            prodotto: item.prodotto?.nome || item.prodottoNome,
            prodottoId: item.prodotto?.id || item.prodottoId,
            quantita: item.quantita,
            prezzo: item.prezzo,
            stato: item.stato,
            timestamp: item.timestamp || item.creato,
            postazione: item.postazione || item.prodotto?.postazione || "N/A",
            note: item.note
          })) || [],
          totaleCosto: ordine.totale || ordine.costoTotale,
          stato: ordine.stato,
          hasKitchenItems: ordine.hasKitchenItems !== undefined ? ordine.hasKitchenItems :
            (ordine.items || ordine.RigaOrdinazione || []).some((item: any) =>
              (item.postazione || item.prodotto?.postazione) === "CUCINA"
            ),
          cameriere: ordine.cameriere || ordine.utente?.nome,
          note: ordine.note
        }));
        
        // Filtra solo ordini che hanno items PREPARA o BANCO
        const filtered = mappedOrders.filter(order => {
          const hasPreparaOrBancoItems = order.items.some(item => 
            item.postazione === "PREPARA" || item.postazione === "BANCO"
          );
          return hasPreparaOrBancoItems && order.stato !== "CONSEGNATO";
        });
        
        setOrders(filtered);
      }
    } catch (error) {
      console.error("Errore caricamento ordini:", error);
      toast.error("Errore nel caricamento degli ordini");
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  
  const handleStartPreparation = async (orderId: string) => {
    if (isStartingPreparation) return;
    
    setIsStartingPreparation(true);
    try {
      const result = await aggiornaStatoOrdinazione(orderId, "IN_PREPARAZIONE");
      if (result.success) {
        await loadOrders();
        toast.success("Preparazione iniziata");
      } else {
        toast.error(result.error || "Errore nell'avvio della preparazione");
      }
    } catch (error) {
      toast.error("Errore nell'avvio della preparazione");
    } finally {
      setIsStartingPreparation(false);
    }
  };
  
  const updateItemStatus = async (itemId: string, newStatus: "IN_LAVORAZIONE" | "PRONTO") => {
    setProcessingItems(prev => new Set(prev).add(itemId));
    
    try {
      const result = await aggiornaStatoRiga(itemId, newStatus);
      if (result.success) {
        await loadOrders();
        
        if (newStatus === "PRONTO") {
          toast.success("Articolo pronto!");
        }
      } else {
        toast.error(result.error || "Errore nell'aggiornamento");
      }
    } catch (error) {
      toast.error("Errore nell'aggiornamento dello stato");
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };
  
  const handleDeleteAllOrders = async () => {
    setIsDeletingAll(true);
    try {
      const result = await cancellaOrdiniAttivi();
      if (result.success) {
        toast.success("Tutti gli ordini sono stati cancellati");
        setShowDeleteAllModal(false);
        await loadOrders();
      } else {
        toast.error(result.error || "Errore nella cancellazione");
      }
    } catch (error) {
      toast.error("Errore nella cancellazione degli ordini");
    } finally {
      setIsDeletingAll(false);
    }
  };
  
  const filteredOrders = orders.filter(order => {
    switch (activeTab) {
      case 'attesa': return order.stato === "ORDINATO";
      case 'preparazione': return order.stato === "IN_PREPARAZIONE";
      case 'pronti': return order.stato === "PRONTO";
      case 'ritirati': return order.stato === "CONSEGNATO";
      default: return false;
    }
  });
  
  const tabCounts = {
    attesa: orders.filter(o => o.stato === "ORDINATO").length,
    preparazione: orders.filter(o => o.stato === "IN_PREPARAZIONE").length,
    pronti: orders.filter(o => o.stato === "PRONTO").length,
    ritirati: orders.filter(o => o.stato === "CONSEGNATO").length
  };
  
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: colors.bg.dark }}>
      {/* Header */}
      <div className="flex-none">
        <div className="px-4 py-3 flex items-center justify-between" style={{ 
          backgroundColor: colors.bg.card,
          borderBottom: `1px solid ${colors.border.primary}`
        }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="lg:hidden p-2 rounded-lg hover:opacity-80 transition-opacity" style={{ backgroundColor: colors.bg.hover }}>
              <ArrowLeft className="w-5 h-5" style={{ color: colors.text.primary }} />
            </Link>
            <div className="flex items-center gap-2">
              <ChefHat className="w-7 h-7" style={{ color: colors.text.accent }} />
              <h1 className="text-xl font-bold" style={{ color: colors.text.primary }}>
                Prepara
              </h1>
              <span ref={ordersCountRef} className="px-2 py-1 rounded-full text-sm font-medium" style={{ 
                backgroundColor: colors.text.accent + '20',
                color: colors.text.accent
              }}>
                {counts.ordersToProcess || filteredOrders.length}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ 
              backgroundColor: connectionStatus.connected ? colors.text.success + '20' : colors.text.error + '20' 
            }}>
              {connectionStatus.connected ? (
                <Wifi className="w-4 h-4" style={{ color: colors.text.success }} />
              ) : (
                <WifiOff className="w-4 h-4" style={{ color: colors.text.error }} />
              )}
              <span className="text-xs font-medium" style={{ 
                color: connectionStatus.connected ? colors.text.success : colors.text.error 
              }}>
                {connectionStatus.connected ? 'Online' : 'Offline'}
              </span>
              {connectionStatus.connected && connectionStatus.latency > 0 && (
                <span className="text-xs opacity-70" style={{ color: colors.text.secondary }}>
                  {connectionStatus.latency}ms
                </span>
              )}
            </div>
            
            <button 
              onClick={refresh}
              disabled={isLoading}
              className="p-2 rounded-lg hover:opacity-80 transition-all disabled:opacity-50"
              style={{ backgroundColor: colors.bg.hover }}
            >
              <RefreshCw 
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
                style={{ color: colors.text.primary }} 
              />
            </button>
            
            <button 
              onClick={() => setShowDeleteAllModal(true)}
              className="p-2 rounded-lg hover:opacity-80 transition-all"
              style={{ backgroundColor: colors.text.error }}
            >
              <X className="w-5 h-5" style={{ color: 'white' }} />
            </button>
            
            <UserDisplay />
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2 px-4 py-2" style={{ backgroundColor: colors.bg.card }}>
          {[
            { id: 'attesa', label: 'In Attesa', icon: Clock },
            { id: 'preparazione', label: 'In Preparazione', icon: Coffee },
            { id: 'pronti', label: 'Pronti', icon: Check },
            { id: 'ritirati', label: 'Ritirati', icon: Package }
          ].map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.id as keyof typeof tabCounts];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: activeTab === tab.id ? colors.text.accent : colors.bg.dark,
                  color: activeTab === tab.id ? 'white' : colors.text.secondary
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
                {count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{
                    backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : colors.text.accent + '20',
                    color: activeTab === tab.id ? 'white' : colors.text.accent
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.text.accent }} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <ChefHat className="w-16 h-16" style={{ color: colors.text.secondary }} />
            <p className="text-lg" style={{ color: colors.text.secondary }}>
              Nessun ordine {activeTab === 'attesa' ? 'in attesa' : 
                          activeTab === 'preparazione' ? 'in preparazione' :
                          activeTab === 'pronti' ? 'pronto' : 'ritirato'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {filteredOrders.map((order) => (
              <div key={order.id} 
                className="rounded-lg overflow-hidden transition-all hover:shadow-lg"
                style={{ 
                  backgroundColor: colors.bg.card,
                  border: `1px solid ${colors.border.primary}`
                }}
              >
                {/* Order Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => {
                    const newExpanded = new Set(expandedOrders);
                    if (newExpanded.has(order.id)) {
                      newExpanded.delete(order.id);
                    } else {
                      newExpanded.add(order.id);
                    }
                    setExpandedOrders(newExpanded);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: colors.text.accent + '20' }}>
                        {order.tavolo ? (
                          <span className="font-bold text-lg" style={{ color: colors.text.accent }}>
                            T{order.tavolo}
                          </span>
                        ) : (
                          <User className="w-5 h-5" style={{ color: colors.text.accent }} />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: colors.text.primary }}>
                          {order.tavolo ? `Tavolo ${order.tavolo}` : order.nomeCliente || 'Cliente'}
                        </div>
                        <div className="text-sm opacity-70" style={{ color: colors.text.secondary }}>
                          {new Date(order.timestamp).toLocaleTimeString('it-IT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                          {order.cameriere && ` • ${order.cameriere}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {order.stato === "ORDINATO" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartPreparation(order.id);
                          }}
                          disabled={isStartingPreparation}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ 
                            backgroundColor: colors.status?.warning || colors.text.muted,
                            color: 'white'
                          }}
                        >
                          {isStartingPreparation ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Inizia Preparazione'
                          )}
                        </button>
                      )}
                      
                      <ChevronRight 
                        className={`w-5 h-5 transition-transform ${expandedOrders.has(order.id) ? 'rotate-90' : ''}`}
                        style={{ color: colors.text.secondary }}
                      />
                    </div>
                  </div>
                  
                  {order.note && (
                    <div className="mt-2 p-2 rounded-lg text-sm" style={{ 
                      backgroundColor: (colors.status?.warning || colors.text.muted) + '20',
                      color: colors.status?.warning || colors.text.muted
                    }}>
                      <span className="font-medium">Note:</span> {order.note}
                    </div>
                  )}
                </div>
                
                {/* Order Items */}
                {expandedOrders.has(order.id) && (
                  <div className="px-4 pb-4 space-y-2" style={{ 
                    borderTop: `1px solid ${colors.border.primary}`
                  }}>
                    {order.items.map((item) => (
                      <div key={item.id} 
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ backgroundColor: colors.bg.dark }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={item.stato === "PRONTO"}
                            disabled={item.stato === "PRONTO" || processingItems.has(item.id)}
                            onCheckedChange={(checked) => {
                              if (checked && item.stato !== "PRONTO") {
                                updateItemStatus(item.id, "PRONTO");
                              }
                            }}
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: colors.text.primary }}>
                                {item.quantita}x {item.prodotto}
                              </span>
                              {item.prodottoId && (
                                <button
                                  onClick={() => {
                                    setSelectedProductForProcedure({
                                      name: item.prodotto,
                                      id: item.prodottoId || null,
                                      quantity: item.quantita
                                    });
                                    setShowProcedureModal(true);
                                  }}
                                  className="p-1 rounded hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: colors.bg.hover }}
                                >
                                  <ClipboardList className="w-4 h-4" style={{ color: colors.text.primary }} />
                                </button>
                              )}
                            </div>
                            
                            {item.note && (
                              <div className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                {item.note}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {item.stato === "INSERITO" && (
                              <button
                                onClick={() => updateItemStatus(item.id, "IN_LAVORAZIONE")}
                                disabled={processingItems.has(item.id)}
                                className="px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                                style={{ 
                                  backgroundColor: colors.status?.info || colors.text.accent,
                                  color: 'white'
                                }}
                              >
                                In Lavorazione
                              </button>
                            )}
                            
                            {item.stato === "IN_LAVORAZIONE" && (
                              <span className="px-2 py-1 rounded text-xs font-medium animate-pulse" style={{ 
                                backgroundColor: (colors.status?.warning || colors.text.muted) + '20',
                                color: colors.status?.warning || colors.text.muted
                              }}>
                                In Lavorazione...
                              </span>
                            )}
                            
                            {item.stato === "PRONTO" && (
                              <span className="px-2 py-1 rounded text-xs font-medium" style={{ 
                                backgroundColor: colors.text.success + '20',
                                color: colors.text.success
                              }}>
                                ✓ Pronto
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Modals */}
      {showProcedureModal && selectedProductForProcedure && (
        <ProcedureViewModal
          isOpen={showProcedureModal}
          productName={selectedProductForProcedure.name}
          productId={selectedProductForProcedure.id}
          quantity={selectedProductForProcedure.quantity}
          onClose={() => {
            setShowProcedureModal(false);
            setSelectedProductForProcedure(null);
          }}
        />
      )}
      
      {showDeleteAllModal && (
        <ThemedModal
          isOpen={showDeleteAllModal}
          onClose={() => !isDeletingAll && setShowDeleteAllModal(false)}
          title="Cancella Tutti gli Ordini"
          size="sm"
        >
          <div className="space-y-4">
            <p style={{ color: colors.text.primary }}>
              Sei sicuro di voler cancellare tutti gli ordini attivi? Questa azione non può essere annullata.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingAll}
                className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                style={{ 
                  backgroundColor: colors.bg.hover,
                  color: colors.text.primary
                }}
              >
                Annulla
              </button>
              
              <button
                onClick={handleDeleteAllOrders}
                disabled={isDeletingAll}
                className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-2"
                style={{ 
                  backgroundColor: colors.text.error,
                  color: 'white'
                }}
              >
                {isDeletingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancellazione...
                  </>
                ) : (
                  'Cancella Tutto'
                )}
              </button>
            </div>
          </div>
        </ThemedModal>
      )}
      
      {/* Particle Effect */}
      <ParticleEffect 
        trigger={particleKey > 0}
        x={particlePos.x} 
        y={particlePos.y}
        colors={[colors.text.accent]}
      />
    </div>
  );
}