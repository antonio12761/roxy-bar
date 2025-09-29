"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import { Coffee, Gift, Folder, Home, Utensils, Trees, Sun, Moon, Star, Wine, Beer, Martini, Users, Store, Building, Palmtree, Umbrella, Mountain, Waves, Filter, RefreshCw } from "lucide-react";
// Removed old useSSE import - now using SSE context
import { getCustomerNamesForTable, getProdotti } from "@/lib/actions/ordinazioni";
import { creaOrdinazionePerAltri } from "@/lib/actions/ordinaPerAltri";
import { getTablesWithOutOfStockOrders } from "@/lib/actions/gestione-esauriti";
import { getUnifiedTavoliList } from "@/lib/actions/unified-tavoli-reader";
import Link from "next/link";
import { ClientClock } from "@/components/ClientClock";
import { OrdinaPerAltriModal } from "@/components/cameriere/OrdinaPerAltriModal";
import { TableOperationsModal } from "@/components/cameriere/TableOperationsModal";
import { TableCard } from "@/components/cameriere/TableCard";
import { toast } from "@/lib/toast";
import { useTheme } from "@/contexts/ThemeContext";
import { GiftModeAlert } from "@/components/cameriere/GiftModeAlert";
import { StatsBar } from "@/components/cameriere/StatsBar";
import { TableSkeletonLoader } from "@/components/cameriere/TableSkeletonLoader";
import { FireworksAnimation } from "@/components/ui/FireworksAnimation";
import { HeartsAnimation } from "@/components/ui/HeartsAnimation";
import { useSSE } from "@/contexts/sse-context";

// Cache per evitare ricaricamenti
const tablesCache = new Map<string, { data: Table[], timestamp: number, version?: string }>();
const CACHE_DURATION = 30000; // 30 secondi
const CACHE_VERSION = '1.0.1'; // Incrementa quando cambia l'ordinamento dei gruppi

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  attivo: boolean;
  clienteNome?: string | null;
  hasOutOfStockOrder?: boolean;
  outOfStockHandledBy?: string | null;
  outOfStockOrders?: string[];
  Ordinazione?: Array<{
    id: string;
    stato: string;
    numero: number;
    dataApertura?: string | null;
  }>;
  GruppoTavoli?: {
    id: number;
    nome: string;
    colore?: string | null;
    icona?: string | null;
  } | null;
}

export default function NuovaOrdinazionePage() {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  
  // SSE context for real-time updates
  const sseContext = useSSE();
  const isConnected = sseContext?.connected || false;
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGiftMode, setIsGiftMode] = useState(false);
  const [selectedTableForGift, setSelectedTableForGift] = useState<number | null>(null);
  const [clienteOrdinante, setClienteOrdinante] = useState<string>("");
  const [hoveredTable, setHoveredTable] = useState<number | null>(null);
  const [tableCustomers, setTableCustomers] = useState<{[key: number]: string[]}>({});
  const [showOrdinaPerAltriModal, setShowOrdinaPerAltriModal] = useState(false);
  const [showTableOperationsModal, setShowTableOperationsModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [ordersCount, setOrdersCount] = useState(0);
  const [filterMode, setFilterMode] = useState<'all' | 'occupied' | 'free'>('all');
  const [showFireworks, setShowFireworks] = useState(false);
  const [outOfStockTables, setOutOfStockTables] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Helper functions for table interactions

  const handleTableHover = async (tableId: number) => {
    setHoveredTable(tableId);
    
    // Load customer names if not already cached
    if (!tableCustomers[tableId]) {
      try {
        const result = await getCustomerNamesForTable(tableId);
        if (result.success && result.customerNames.length > 0) {
          setTableCustomers(prev => ({
            ...prev,
            [tableId]: result.customerNames
          }));
        }
      } catch (error) {
        console.error("Error loading customer names:", error);
      }
    }
  };

  const handleTableLeave = () => {
    setHoveredTable(null);
  };

  // Memoized zones rendering - must be at top level
  const zonesContent = useMemo(() => {
    // Filter tables based on filterMode
    let filteredTables = tables;
    if (filterMode === 'occupied') {
      filteredTables = tables.filter(table => table.stato === 'OCCUPATO');
    } else if (filterMode === 'free') {
      filteredTables = tables.filter(table => table.stato === 'LIBERO');
    }

    // Create groups array maintaining the order from database
    const groupsWithTables: Array<{name: string, tables: any[]}> = [];
    const groupsAdded = new Set<string>();
    
    // Process tables in order (they're already sorted by GruppoTavoli.ordinamento)
    filteredTables.forEach((table: any) => {
      const groupName = table.GruppoTavoli?.nome || table.zona || 'Senza Gruppo';
      
      if (!groupsAdded.has(groupName)) {
        groupsAdded.add(groupName);
        groupsWithTables.push({
          name: groupName,
          tables: []
        });
      }
      
      // Add table to the appropriate group
      const group = groupsWithTables.find(g => g.name === groupName);
      if (group) {
        group.tables.push(table);
      }
    });
    
    const result: React.JSX.Element[] = [];
    
    // Render each group with fused card style
    groupsWithTables.forEach((group, groupIndex) => {
      const groupName = group.name;
      const tavoliGruppo = group.tables;
      
      // Icon mapping for lucide-react icons
      const iconMap: Record<string, any> = {
        Folder, Home, Utensils, Coffee, Trees, Sun, Moon, Star, Wine, Beer, 
        Martini, Users, Store, Building, Palmtree, Umbrella, Mountain, Waves
      };
      
      // Check if this group has a custom icon from GruppoTavoli
      const groupIconName = tavoliGruppo[0]?.GruppoTavoli?.icona;
      const IconComponent = groupIconName ? iconMap[groupIconName] : null;

      // Check if this group has a custom color from GruppoTavoli
      const groupData = tavoliGruppo[0]?.GruppoTavoli;
      const hasCustomColor = groupData?.colore;
      
      const getZoneColor = (zona: string) => {
        // If the group has a custom color, use it with inline styles
        if (hasCustomColor && groupData?.colore) {
          // Return empty string as we'll use inline styles instead
          return '';
        }
        
        // Otherwise use predefined colors
        switch(zona) {
          case "Dentro": return "bg-blue-500/10 border-blue-400/30";
          case "Marciapiede": return "bg-purple-500/10 border-purple-400/30";
          case "Prima Fila": return "bg-emerald-500/10 border-emerald-400/30";
          case "Seconda Fila": return "bg-amber-500/10 border-amber-400/30";
          case "Terza Fila": return "bg-orange-500/10 border-orange-400/30";
          case "Piazza": return "bg-pink-500/10 border-pink-400/30";
          case "Senza Gruppo": return "bg-white/3 border-white/10";
          default: return "bg-gray-500/10 border-gray-400/30";
        }
      };
      
      const zoneColorClass = getZoneColor(groupName);
      const customStyle = hasCustomColor && groupData?.colore ? {
        backgroundColor: `${groupData.colore}15`, // 15 is hex for ~10% opacity
        borderColor: `${groupData.colore}4D`, // 4D is hex for ~30% opacity
      } : {};
      
      const isFirst = groupIndex === 0;
      const isLast = groupIndex === groupsWithTables.length - 1;
      
      result.push(
        <div 
          key={groupName} 
          className={`p-6 border-2 border-l-2 border-r-2 ${
            isFirst ? 'rounded-t-2xl border-t-2' : 'border-t-0'
          } ${
            isLast ? 'rounded-b-2xl border-b-2' : 'border-b-0'
          }`} 
          style={{
            backgroundColor: 'transparent',
            borderColor: colors.border.secondary
          }}
        >
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-3">
            {IconComponent ? (
              <IconComponent className="w-6 h-6" style={{ color: colors.text.primary }} />
            ) : (
              <span className="text-xl">📋</span>
            )}
            <span>{groupName}</span>
            <span className="text-sm font-normal text-muted-foreground">({tavoliGruppo.length})</span>
          </h3>
          {groupName === "Gazebo" ? (
            // Visualizzazione speciale per Gazebo con sottogruppi
            <div className="space-y-4">
              {/* Sottogruppo 11-15 */}
              {tavoliGruppo.filter(t => {
                const num = parseInt(t.numero);
                return num >= 11 && num <= 15;
              }).length > 0 && (
                <div>
                  <h5 className="text-xs font-medium mb-2 text-muted-foreground pl-2">
                    Tavoli 11-15
                  </h5>
                  <div className="grid grid-cols-5 gap-3">
                    {tavoliGruppo.filter(t => {
                      const num = parseInt(t.numero);
                      return num >= 11 && num <= 15;
                    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)).map((table) => {
                      const lastOrder = table.Ordinazione && table.Ordinazione.length > 0 
                        ? table.Ordinazione.sort((a: any, b: any) => b.numero - a.numero)[0]
                        : null;
                      
                      return (
                        <TableCard
                          key={table.id}
                          table={{
                            ...table,
                            lastOrderStatus: lastOrder?.stato || null,
                            lastOrderReadyTime: lastOrder?.stato === 'PRONTO' 
                              ? (lastOrder?.dataApertura || new Date().toISOString()) 
                              : null
                          }}
                          isGiftMode={isGiftMode}
                          onClick={() => {
                            if (isGiftMode) {
                              setSelectedTableForGift(table.id);
                              setShowOrdinaPerAltriModal(true);
                            } else {
                              setSelectedTable(table);
                              setShowTableOperationsModal(true);
                            }
                          }}
                          onMouseEnter={() => handleTableHover(table.id)}
                          onMouseLeave={handleTableLeave}
                          showTooltip={hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0}
                          tooltipContent={
                            hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-lg max-w-48">
                                  <div className="text-xs font-medium text-white/70 mb-2">Clienti recenti:</div>
                                  <div className="space-y-1">
                                    {tableCustomers[table.id].slice(0, 5).map((name, index) => (
                                      <div key={index} className="text-xs text-foreground">
                                        • {name}
                                      </div>
                                    ))}
                                    {tableCustomers[table.id].length > 5 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{tableCustomers[table.id].length - 5} altri...
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                                </div>
                              </div>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Sottogruppo 21-25 */}
              {tavoliGruppo.filter(t => {
                const num = parseInt(t.numero);
                return num >= 21 && num <= 25;
              }).length > 0 && (
                <div>
                  <h5 className="text-xs font-medium mb-2 text-muted-foreground pl-2">
                    Tavoli 21-25
                  </h5>
                  <div className="grid grid-cols-5 gap-3">
                    {tavoliGruppo.filter(t => {
                      const num = parseInt(t.numero);
                      return num >= 21 && num <= 25;
                    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)).map((table) => {
                      const lastOrder = table.Ordinazione && table.Ordinazione.length > 0 
                        ? table.Ordinazione.sort((a: any, b: any) => b.numero - a.numero)[0]
                        : null;
                      
                      return (
                        <TableCard
                          key={table.id}
                          table={{
                            ...table,
                            lastOrderStatus: lastOrder?.stato || null,
                            lastOrderReadyTime: lastOrder?.stato === 'PRONTO' 
                              ? (lastOrder?.dataApertura || new Date().toISOString()) 
                              : null
                          }}
                          isGiftMode={isGiftMode}
                          onClick={() => {
                            if (isGiftMode) {
                              setSelectedTableForGift(table.id);
                              setShowOrdinaPerAltriModal(true);
                            } else {
                              setSelectedTable(table);
                              setShowTableOperationsModal(true);
                            }
                          }}
                          onMouseEnter={() => handleTableHover(table.id)}
                          onMouseLeave={handleTableLeave}
                          showTooltip={hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0}
                          tooltipContent={
                            hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-lg max-w-48">
                                  <div className="text-xs font-medium text-white/70 mb-2">Clienti recenti:</div>
                                  <div className="space-y-1">
                                    {tableCustomers[table.id].slice(0, 5).map((name, index) => (
                                      <div key={index} className="text-xs text-foreground">
                                        • {name}
                                      </div>
                                    ))}
                                    {tableCustomers[table.id].length > 5 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{tableCustomers[table.id].length - 5} altri...
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                                </div>
                              </div>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Sottogruppo 31-35 */}
              {tavoliGruppo.filter(t => {
                const num = parseInt(t.numero);
                return num >= 31 && num <= 35;
              }).length > 0 && (
                <div>
                  <h5 className="text-xs font-medium mb-2 text-muted-foreground pl-2">
                    Tavoli 31-35
                  </h5>
                  <div className="grid grid-cols-5 gap-3">
                    {tavoliGruppo.filter(t => {
                      const num = parseInt(t.numero);
                      return num >= 31 && num <= 35;
                    }).sort((a, b) => parseInt(a.numero) - parseInt(b.numero)).map((table) => {
                      const lastOrder = table.Ordinazione && table.Ordinazione.length > 0 
                        ? table.Ordinazione.sort((a: any, b: any) => b.numero - a.numero)[0]
                        : null;
                      
                      return (
                        <TableCard
                          key={table.id}
                          table={{
                            ...table,
                            lastOrderStatus: lastOrder?.stato || null,
                            lastOrderReadyTime: lastOrder?.stato === 'PRONTO' 
                              ? (lastOrder?.dataApertura || new Date().toISOString()) 
                              : null
                          }}
                          isGiftMode={isGiftMode}
                          onClick={() => {
                            if (isGiftMode) {
                              setSelectedTableForGift(table.id);
                              setShowOrdinaPerAltriModal(true);
                            } else {
                              setSelectedTable(table);
                              setShowTableOperationsModal(true);
                            }
                          }}
                          onMouseEnter={() => handleTableHover(table.id)}
                          onMouseLeave={handleTableLeave}
                          showTooltip={hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0}
                          tooltipContent={
                            hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-lg max-w-48">
                                  <div className="text-xs font-medium text-white/70 mb-2">Clienti recenti:</div>
                                  <div className="space-y-1">
                                    {tableCustomers[table.id].slice(0, 5).map((name, index) => (
                                      <div key={index} className="text-xs text-foreground">
                                        • {name}
                                      </div>
                                    ))}
                                    {tableCustomers[table.id].length > 5 && (
                                      <div className="text-xs text-muted-foreground">
                                        +{tableCustomers[table.id].length - 5} altri...
                                      </div>
                                    )}
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                                </div>
                              </div>
                            )
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Visualizzazione normale per altri gruppi
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {tavoliGruppo.map((table) => {
                const lastOrder = table.Ordinazione && table.Ordinazione.length > 0 
                  ? table.Ordinazione.sort((a: any, b: any) => b.numero - a.numero)[0]
                  : null;
                
                return (
                  <TableCard
                    key={table.id}
                    table={{
                      ...table,
                      lastOrderStatus: lastOrder?.stato || null,
                      lastOrderReadyTime: lastOrder?.stato === 'PRONTO' 
                        ? (lastOrder?.dataApertura || new Date().toISOString()) 
                        : null
                    }}
                    isGiftMode={isGiftMode}
                    onClick={() => {
                      if (isGiftMode) {
                        setSelectedTableForGift(table.id);
                        setShowOrdinaPerAltriModal(true);
                      } else {
                        setSelectedTable(table);
                        setShowTableOperationsModal(true);
                      }
                    }}
                    onMouseEnter={() => handleTableHover(table.id)}
                    onMouseLeave={handleTableLeave}
                    showTooltip={hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0}
                    tooltipContent={
                      hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0 && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                          <div className="bg-black/90 border border-white/20 rounded-lg p-3 shadow-lg max-w-48">
                            <div className="text-xs font-medium text-white/70 mb-2">Clienti recenti:</div>
                            <div className="space-y-1">
                              {tableCustomers[table.id].slice(0, 5).map((name, index) => (
                                <div key={index} className="text-xs text-foreground">
                                  • {name}
                                </div>
                              ))}
                              {tableCustomers[table.id].length > 5 && (
                                <div className="text-xs text-muted-foreground">
                                  +{tableCustomers[table.id].length - 5} altri...
                                </div>
                              )}
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                          </div>
                        </div>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      );
    });
    
    return result;
  }, [tables, hoveredTable, tableCustomers, isGiftMode, filterMode]);

  const loadData = async (showLoader = true, forceRefresh = false) => {
    if (showLoader) {
      setIsLoading(true);
    }
    
    try {
      
      // Check cache first (skip if forceRefresh)
      const cacheKey = 'tables-products';
      const cached = tablesCache.get(cacheKey);
      const now = Date.now();
      
      if (!forceRefresh && cached && 
          (now - cached.timestamp) < CACHE_DURATION && 
          cached.version === CACHE_VERSION && 
          showLoader) {
        // console.log("[loadData] Using cached data");
        setTables(cached.data);
        if (showLoader) {
          setIsLoading(false);
        }
        return;
      }
      
      // Load from API only if not cached
      const [tavoliData, prodottiData, outOfStockData] = await Promise.all([
        getUnifiedTavoliList(),
        getProdotti(),
        getTablesWithOutOfStockOrders()
      ]);
      
      // console.log("[loadData] Received from getTavoli:", tavoliData);
      
      if (Array.isArray(tavoliData) && tavoliData.length > 0) {
        // Log the order of groups as received
        const groupsOrder: string[] = [];
        const seenGroups = new Set<string>();
        tavoliData.forEach((table: any) => {
          const groupName = table.gruppoNome || 'Senza Gruppo';
          if (!seenGroups.has(groupName)) {
            seenGroups.add(groupName);
            groupsOrder.push(groupName);
          }
        });
        // console.log("[loadData] Groups order from server:", groupsOrder);
        
        // Adapt unified data to match existing structure
        const adaptedTables = tavoliData.map(table => ({
          id: table.id,
          numero: String(table.numero),
          nome: table.nome,
          descrizione: table.descrizione,
          posizione: table.posizione,
          posti: table.posti,
          stato: table.stato,
          ordinamento: table.ordinamento,
          attivo: true,
          visibile: true,
          createdAt: null,
          updatedAt: null,
          clienteNome: table.clienteNome,
          GruppoTavoli: {
            id: table.gruppoId,
            nome: table.gruppoNome,
            colore: table.gruppoColore,
            icona: table.gruppoIcona,
            ordinamento: table.gruppoOrdinamento
          },
          Ordinazione: table.ordiniAttivi ? [{}] : []
        }));
        
        // Merge out of stock info with tables
        const tablesWithOutOfStock = adaptedTables.map(table => {
          const outOfStockInfo = outOfStockData?.success && outOfStockData.tables?.find(
            (ost: any) => ost.table.id === table.id
          );
          
          return {
            ...table,
            hasOutOfStockOrder: !!outOfStockInfo,
            outOfStockHandledBy: outOfStockInfo?.handledBy || null,
            outOfStockOrders: outOfStockInfo?.orders || []
          };
        });
        
        setTables(tablesWithOutOfStock);
        setProducts(prodottiData || []);
        
        // Store out of stock tables
        if (outOfStockData?.success) {
          setOutOfStockTables(outOfStockData.tables || []);
        }
        
        // Count orders
        const activeOrders = tavoliData.filter(t => t.stato === 'OCCUPATO' && t.Ordinazione && t.Ordinazione.length > 0).length;
        setOrdersCount(activeOrders);
        
        // Cache the data
        tablesCache.set(cacheKey, {
          data: tablesWithOutOfStock,
          timestamp: now,
          version: CACHE_VERSION
        });
        
        // Data cached for future use
      } else {
        // No tables returned from server
        setTables([]);
      }
    } catch (error) {
      console.error("❌ Errore caricamento tavoli:", error);
      setTables([]);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Clear cache to force fresh data
      tablesCache.clear();
      await loadData(false, true);
      toast.success('Tavoli aggiornati');
    } catch (error) {
      console.error('Error refreshing:', error);
      toast.error('Errore durante l\'aggiornamento');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check for fireworks continuation from order submission
  const [lastCustomerName, setLastCustomerName] = useState('');
  
  useEffect(() => {
    const shouldShowFireworks = sessionStorage.getItem('showFireworks');
    const customerName = sessionStorage.getItem('lastCustomerName') || '';
    
    if (shouldShowFireworks === 'true') {
      setLastCustomerName(customerName);
      setShowFireworks(true);
      sessionStorage.removeItem('showFireworks');
      sessionStorage.removeItem('lastCustomerName');
      
      // Hide animation after appropriate duration
      const duration = customerName.toLowerCase() === 'giulio colaizzi' ? 3000 : 500;
      setTimeout(() => {
        setShowFireworks(false);
        setLastCustomerName('');
      }, duration);
    }
  }, []);

  // Carica tavoli dal database
  useEffect(() => {
    loadData();
  }, []);


  // Rimuovo il refresh automatico per evitare il flickering dello skeleton
  // Gli aggiornamenti avverranno solo tramite SSE events

  // Sottoscrivi agli eventi SSE per ordini esauriti
  useEffect(() => {
    if (!sseContext?.subscribe) return;

    // Quando arriva un alert di ordine esaurito, aggiorna i tavoli
    const unsubAlert = sseContext.subscribe('order:esaurito:alert', async (data) => {
      console.log('[NuovaOrdinazione] Ricevuto alert ordine esaurito:', data);
      
      // Aggiorna immediatamente lo stato locale del tavolo
      if (data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            return {
              ...table,
              hasOutOfStockOrder: true,
              outOfStockHandledBy: data.takenBy || null,  // Potrebbe già essere preso in carico
              outOfStockOrders: [data.orderId]
            } as any;
          }
          return table;
        }));
      }
      
      // Ricarica i dati silenziosamente dopo aver aggiornato lo stato locale
      // per avere i dati aggiornati dal server ma senza mostrare lo skeleton
      setTimeout(() => loadData(false), 1000);
    });

    // Quando qualcuno prende in carico un ordine esaurito
    const unsubTaken = sseContext.subscribe('order:esaurito:taken', async (data) => {
      console.log('[NuovaOrdinazione] Ordine esaurito preso in carico:', data);
      
      // Aggiorna lo stato del tavolo mantenendo lo stato di esaurito
      if (data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            return {
              ...table,
              hasOutOfStockOrder: true,  // Mantieni lo stato di problema
              outOfStockHandledBy: data.takenBy,  // Mostra chi lo sta gestendo
              outOfStockOrders: [data.orderId]
            } as any;
          }
          return table;
        }));
      }
      
      // NON ricaricare i dati subito per evitare di sovrascrivere lo stato locale
      // Il reload avverrà quando l'ordine sarà risolto o rilasciato
    });

    // Quando viene rilasciato un ordine esaurito
    const unsubReleased = sseContext.subscribe('order:esaurito:released', async (data) => {
      console.log('[NuovaOrdinazione] Ordine esaurito rilasciato:', data);
      
      // Ricarica i dati silenziosamente
      await loadData(false);
    });

    // Quando un ordine esaurito viene risolto
    const unsubResolved = sseContext.subscribe('order:esaurito:resolved', async (data) => {
      console.log('[NuovaOrdinazione] Ordine esaurito risolto:', data);
      
      // Rimuovi lo stato di esaurito dal tavolo
      if (data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            // Controlla se ci sono altri ordini esauriti per questo tavolo
            const remainingOrders = table.outOfStockOrders?.filter((id: string) => id !== data.originalOrderId) || [];
            
            return {
              ...table,
              hasOutOfStockOrder: remainingOrders.length > 0,
              outOfStockHandledBy: remainingOrders.length > 0 ? table.outOfStockHandledBy : null,
              outOfStockOrders: remainingOrders
            } as any;
          }
          return table;
        }));
      }
      
      // Ricarica i dati silenziosamente dopo un breve delay per avere dati aggiornati
      setTimeout(() => loadData(false), 500);
    });

    // Subscribe to order:item:update event for IN_PREPARAZIONE status
    const unsubItemUpdate = sseContext.subscribe('order:item:update', (data: any) => {
      console.log('[NuovaOrdinazione] Item update ricevuto:', data);
      
      // Update table card when order goes to IN_PREPARAZIONE
      if (data.status === 'IN_LAVORAZIONE' && data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            // Update order status to IN_PREPARAZIONE
            const updatedOrdinazione = table.Ordinazione?.map(ord => 
              ord.id === data.orderId 
                ? { ...ord, stato: 'IN_PREPARAZIONE' } 
                : ord
            );
            return {
              ...table,
              Ordinazione: updatedOrdinazione
            };
          }
          return table;
        }));
      }
    });

    // Subscribe to order:delivered event to update table status
    const unsubDelivered = sseContext.subscribe('order:delivered', (data: any) => {
      console.log('[NuovaOrdinazione] Ordine consegnato:', data);
      
      // Update table card when order is delivered
      if (data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            // Update order status to CONSEGNATO
            const updatedOrdinazione = table.Ordinazione?.map(ord => 
              ord.id === data.orderId 
                ? { ...ord, stato: 'CONSEGNATO' } 
                : ord
            );
            
            // Check if all orders are delivered or paid to potentially free the table
            const hasActiveOrders = updatedOrdinazione?.some(ord => 
              ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO'].includes(ord.stato)
            );
            
            return {
              ...table,
              stato: hasActiveOrders ? 'OCCUPATO' : table.stato,
              Ordinazione: updatedOrdinazione
            };
          }
          return table;
        }));
      }
      
      // Reload data after a short delay to sync with server
      setTimeout(() => loadData(false), 1000);
    });

    // Sottoscrivi agli eventi tables:reordered per aggiornare l'ordine dei tavoli
    const unsubReordered = sseContext.subscribe('tables:reordered', (data: any) => {
      console.log('[NuovaOrdinazione] Ordine tavoli aggiornato:', data);
      
      // Ricarica i dati silenziosamente per riflettere il nuovo ordine
      setTimeout(() => {
        tablesCache.clear(); // Pulisci la cache per forzare il reload
        loadData(false);
        toast.info(`L'ordine dei tavoli è stato aggiornato da ${data.updatedBy}`);
      }, 500);
    });
    
    // Sottoscrivi agli eventi groups:reordered per aggiornare l'ordine dei gruppi
    const unsubGroupsReordered = sseContext.subscribe('groups:reordered', (data: any) => {
      console.log('[NuovaOrdinazione] Ordine gruppi aggiornato:', data);
      console.log('[NuovaOrdinazione] Nuovo ordine gruppi:', data.groups?.map((g: any) => `${g.nome} (ord=${g.ordinamento})`).join(', '));
      
      // Ricarica i dati silenziosamente per riflettere il nuovo ordine
      setTimeout(() => {
        tablesCache.clear(); // Pulisci la cache per forzare il reload
        loadData(false, true); // Force refresh
        toast.info('L\'ordine dei gruppi è stato aggiornato');
      }, 500);
    });
    
    // Sottoscrivi agli eventi di visibilità
    const unsubGroupsVisibility = sseContext.subscribe('groups:visibility:update', (data: any) => {
      console.log('[NuovaOrdinazione] Visibilità gruppo aggiornata:', data);
      
      setTimeout(() => {
        tablesCache.clear();
        loadData(false, true);
      }, 500);
    });
    
    const unsubTablesVisibility = sseContext.subscribe('tables:visibility:update', (data: any) => {
      console.log('[NuovaOrdinazione] Visibilità tavolo aggiornata:', data);
      
      setTimeout(() => {
        tablesCache.clear();
        loadData(false, true);
      }, 500);
    });

    // Sottoscrivi agli eventi order:ready per mostrare notifiche
    const unsubReady = sseContext.subscribe('order:ready', (data: any) => {
      console.log('[NuovaOrdinazione] Ordine pronto:', data);
      
      // Mostra notifica per ordine pronto
      const message = data.tableNumber 
        ? `🔔 Ordine #${data.orderNumber} - Tavolo ${data.tableNumber} PRONTO!`
        : `🔔 Ordine #${data.orderNumber} PRONTO!`;
      
      toast.success(message, {
        duration: 5000,
        style: {
          background: '#10b981',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold'
        }
      });
      
      // Aggiorna lo stato del tavolo per mostrare che l'ordine è pronto
      if (data.tableNumber) {
        setTables(prevTables => prevTables.map(table => {
          if (table.numero === data.tableNumber) {
            // Aggiorna l'ultimo stato dell'ordine più recente
            const updatedOrdinazione = table.Ordinazione?.map(ord => 
              ord.id === data.orderId 
                ? { ...ord, stato: 'PRONTO', dataApertura: new Date().toISOString() } 
                : ord
            );
            return {
              ...table,
              Ordinazione: updatedOrdinazione
            };
          }
          return table;
        }));
      }
      
      // Ricarica i dati dopo un breve delay
      setTimeout(() => loadData(false), 500);
    });

    return () => {
      unsubAlert();
      unsubTaken();
      unsubReleased();
      unsubResolved();
      unsubItemUpdate();
      unsubDelivered();
      unsubReordered();
      unsubGroupsReordered();
      unsubGroupsVisibility();
      unsubTablesVisibility();
      unsubReady();
    };
  }, [sseContext]);

  const handleOrdinaPerAltri = async (orderData: any) => {
    try {
      console.log("Creazione ordine per altri:", orderData);
      
      const result = await creaOrdinazionePerAltri(orderData);
      
      if (result.success) {
        setShowOrdinaPerAltriModal(false);
        
        // Mostra messaggio di successo personalizzato
        if ('pagamentoImmediato' in result && result.pagamentoImmediato) {
          toast.success(`✅ ${result.message}`);
        } else if ('saldoRimanente' in result) {
          toast.success(`💳 ${result.message}\nSaldo rimanente: €${result.saldoRimanente?.toFixed(2)}`);
        } else {
          toast.success('message' in result ? result.message : "Ordinazione creata con successo");
        }
        
        // Ricarica i dati silenziosamente per aggiornare la lista tavoli
        loadData(false);
      } else {
        toast.error(`❌ ${'error' in result ? result.error : 'Errore creazione ordine'}`);
      }
    } catch (error) {
      console.error("Errore creazione ordine per altri:", error);
      toast.error("Errore imprevisto durante la creazione dell'ordine");
    }
  };

  // Calculate statistics
  const occupiedTables = tables.filter(t => t.stato === 'OCCUPATO').length;
  const totalTables = tables.length;

  return (
    <div className="relative pb-20">
      {/* Enhanced Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-lg transition-all duration-200 hover:bg-white/10 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Aggiorna tavoli"
            >
              <RefreshCw className={`h-5 w-5 text-white/70 ${
                isRefreshing ? 'animate-spin' : ''
              }`} />
            </button>
            
            {/* Filter Tables */}
            <button
              onClick={() => {
                if (filterMode === 'all') {
                  setFilterMode('occupied');
                } else if (filterMode === 'occupied') {
                  setFilterMode('free');
                } else {
                  setFilterMode('all');
                }
              }}
              className={`p-2 rounded-lg transition-all duration-200 ${
                filterMode !== 'all' ? 'bg-blue-500/20 ring-2 ring-blue-400/40' : 'hover:bg-white/10'
              }`}
              title={
                filterMode === 'all' ? "Filtra tavoli" : 
                filterMode === 'occupied' ? "Solo tavoli occupati" : 
                "Solo tavoli liberi"
              }
            >
              <Filter className={`h-5 w-5 ${filterMode !== 'all' ? 'text-blue-400' : 'text-white/70'}`} />
            </button>
            
            {/* Gift Mode - Larger and Primary */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsGiftMode(prev => !prev);
              }}
              className={`p-3 rounded-lg transition-all duration-200 ${
                isGiftMode ? 'bg-yellow-400/20 ring-2 ring-yellow-400/40 scale-110' : 'hover:bg-white/10'
              }`}
              title={isGiftMode ? "Esci dalla modalità regalo" : "Ordina per Altri"}
            >
              <Gift className={`h-6 w-6 transition-colors duration-200 ${isGiftMode ? 'text-yellow-400' : 'text-white/70'}`} />
            </button>
          </div>
        </div>

      </div>

      <div className="space-y-4">
        {/* Gift Mode Info */}
        <GiftModeAlert isActive={isGiftMode} />
        {isLoading ? (
          <TableSkeletonLoader />
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-muted-foreground mb-2">Nessun tavolo trovato</div>
            <div className="text-sm text-muted-foreground">Controlla la console per maggiori dettagli</div>
          </div>
        ) : filterMode === 'occupied' && tables.filter(t => t.stato === 'OCCUPATO').length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-muted-foreground mb-2">Nessun tavolo occupato</div>
            <button 
              onClick={() => setFilterMode('all')}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2"
            >
              Mostra tutti i tavoli
            </button>
          </div>
        ) : filterMode === 'free' && tables.filter(t => t.stato === 'LIBERO').length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-muted-foreground mb-2">Nessun tavolo libero</div>
            <button 
              onClick={() => setFilterMode('all')}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2"
            >
              Mostra tutti i tavoli
            </button>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Group tables by zone with fused card style */}
            {zonesContent}
          </div>
        )}
      </div>

      {/* Modal per Ordina per Altri */}
      <OrdinaPerAltriModal
        isOpen={showOrdinaPerAltriModal}
        onClose={() => {
          setShowOrdinaPerAltriModal(false);
          setSelectedTableForGift(null);
          setIsGiftMode(false);
        }}
        onConfirm={handleOrdinaPerAltri}
        products={products}
        tables={tables}
        selectedTableId={selectedTableForGift}
      />

      {/* Modal per Operazioni Tavolo */}
      <TableOperationsModal
        isOpen={showTableOperationsModal}
        onClose={() => {
          setShowTableOperationsModal(false);
          setSelectedTable(null);
        }}
        table={selectedTable}
        onTableUpdate={() => {
          // Ricarica i tavoli silenziosamente quando viene aggiornato un ordine esaurito
          loadData(false);
        }}
      />

      {/* Fixed Bottom Stats Bar */}
      <StatsBar 
        occupiedTables={occupiedTables}
        totalTables={totalTables}
        ordersCount={ordersCount}
      />
      
      {/* Fireworks or Hearts Animation based on customer */}
      {showFireworks && (
        lastCustomerName.toLowerCase() === 'giulio colaizzi' ? (
          <HeartsAnimation
            duration={1500}
            showText={false}  // No text on transition page
            onComplete={() => {
              setShowFireworks(false);
              setLastCustomerName('');
            }}
          />
        ) : (
          <FireworksAnimation
            duration={500}
            onComplete={() => {
              setShowFireworks(false);
              setLastCustomerName('');
            }}
          />
        )
      )}
    </div>
  );
}