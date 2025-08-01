"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import { Coffee, Gift, Folder, Home, Utensils, Trees, Sun, Moon, Star, Wine, Beer, Martini, Users, Store, Building, Palmtree, Umbrella, Mountain, Waves, Filter, Search, Grid3x3, ClipboardList, UserPlus, Square } from "lucide-react";
// Removed old useSSE import - now using SSE context
import { getTavoli, getCustomerNamesForTable, getProdotti } from "@/lib/actions/ordinazioni";
import { creaOrdinazionePerAltri } from "@/lib/actions/ordinaPerAltri";
import Link from "next/link";
import { ClientClock } from "@/components/ClientClock";
import { OrdinaPerAltriModal } from "@/components/cameriere/OrdinaPerAltriModal";
import { TableOperationsModal } from "@/components/cameriere/TableOperationsModal";
import { TableCard } from "@/components/cameriere/TableCard";
import { toast } from "@/lib/toast";
import { useTheme } from "@/contexts/ThemeContext";

// Cache per evitare ricaricamenti
const tablesCache = new Map<string, { data: Table[], timestamp: number }>();
const CACHE_DURATION = 30000; // 30 secondi

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  attivo: boolean;
  clienteNome?: string | null;
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
  
  // Connection status will be shown from context
  const isConnected = true; // Temporary - will be replaced with context
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

    // Group tables by GruppoTavoli or zona
    const tablesByGroup = filteredTables.reduce((acc, table: any) => {
      // Use GruppoTavoli if available, otherwise fallback to zona
      const groupName = table.GruppoTavoli?.nome || table.zona || 'Senza Gruppo';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(table);
      return acc;
    }, {} as Record<string, any[]>);
    
    // Get all unique groups, putting "Senza Gruppo" first if it exists
    const allGroups = Object.keys(tablesByGroup).sort((a, b) => {
      if (a === 'Senza Gruppo') return -1;
      if (b === 'Senza Gruppo') return 1;
      return a.localeCompare(b);
    });
    
    const result: React.JSX.Element[] = [];
    
    // Render each group with fused card style
    allGroups.forEach((groupName, groupIndex) => {
      const tavoliGruppo = tablesByGroup[groupName];
      
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
      const isLast = groupIndex === allGroups.length - 1;
      
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
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {tavoliGruppo.map((table) => (
              <TableCard
                key={table.id}
                table={table}
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
                        {/* Arrow pointing down */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20"></div>
                      </div>
                    </div>
                  )
                }
              />
            ))}
          </div>
        </div>
      );
    });
    
    return result;
  }, [tables, hoveredTable, tableCustomers, isGiftMode, filterMode]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log("🔄 Caricamento tavoli...");
      
      // Check cache first
      const cacheKey = 'tables-products';
      const cached = tablesCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log("✅ Using cached data");
        setTables(cached.data);
        setIsLoading(false);
        return;
      }
      
      // Load from API only if not cached
      const [tavoliData, prodottiData] = await Promise.all([
        getTavoli(),
        getProdotti()
      ]);
      
      console.log("✅ Tavoli caricati dal server:", tavoliData?.length || 0);
      
      if (Array.isArray(tavoliData) && tavoliData.length > 0) {
        setTables(tavoliData);
        setProducts(prodottiData || []);
        
        // Count orders
        const activeOrders = tavoliData.filter(t => t.stato === 'OCCUPATO' && t.Ordinazione && t.Ordinazione.length > 0).length;
        setOrdersCount(activeOrders);
        
        // Cache the data
        tablesCache.set(cacheKey, {
          data: tavoliData,
          timestamp: now
        });
        
        console.log("💾 Data cached for future use");
      } else {
        console.error("❌ Nessun dato tavoli");
        setTables([]);
      }
    } catch (error) {
      console.error("❌ Errore caricamento tavoli:", error);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Carica tavoli dal database
  useEffect(() => {
    loadData();
  }, []);

  // Debug: monitora cambiamenti ai tavoli
  useEffect(() => {
    console.log("🔄 Tables state updated:", tables);
    console.log("📊 Number of tables in state:", tables.length);
    if (tables.length > 0) {
      console.log("🏠 First table in state:", tables[0]);
    }
  }, [tables]);

  // Ricarica automaticamente ogni 30 secondi
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

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
        
        // Ricarica i dati per aggiornare la lista tavoli
        loadData();
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
          <h1 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
            Seleziona un Tavolo
          </h1>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
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
        {isGiftMode && (
          <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/40 text-yellow-200 rounded-xl text-center font-medium shadow-lg backdrop-blur-sm animate-pulse">
            🎁 Modalità Regalo Attiva - Seleziona un tavolo per il destinatario
          </div>
        )}
        {isLoading ? (
          // Skeleton Loader
          <div className="space-y-0">
            {[1, 2, 3].map((groupIndex) => (
              <div 
                key={groupIndex}
                className={`p-6 border-2 border-l-2 border-r-2 animate-pulse ${
                  groupIndex === 0 ? 'rounded-t-2xl border-t-2' : 'border-t-0'
                } ${
                  groupIndex === 2 ? 'rounded-b-2xl border-b-2' : 'border-b-0'
                }`}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: colors.border.secondary
                }}
              >
                {/* Group Header Skeleton */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: colors.bg.hover }}></div>
                  <div className="h-5 w-32 rounded" style={{ backgroundColor: colors.bg.hover }}></div>
                  <div className="h-4 w-8 rounded" style={{ backgroundColor: colors.bg.hover }}></div>
                </div>
                
                {/* Tables Grid Skeleton */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {[...Array(groupIndex === 0 ? 8 : groupIndex === 1 ? 6 : 4)].map((_, tableIndex) => (
                    <div 
                      key={tableIndex}
                      className="aspect-square rounded-lg border-2 p-2"
                      style={{
                        backgroundColor: colors.bg.hover,
                        borderColor: colors.border.secondary
                      }}
                    >
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <div className="w-8 h-5 rounded" style={{ backgroundColor: colors.bg.dark }}></div>
                        <div className="w-4 h-3 rounded" style={{ backgroundColor: colors.bg.dark }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
      />

      {/* Fixed Bottom Stats Bar */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md shadow-lg"
        style={{ 
          backgroundColor: colors.bg.dark + 'f2',
          borderTop: `1px solid ${colors.border.primary}`,
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="px-4 py-3">
          <div className="flex justify-center">
            <div className="flex items-center gap-6 text-sm">
              {/* Occupied Tables */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: colors.text.secondary }} />
                <span style={{ color: colors.text.secondary }}>{occupiedTables} Occupati</span>
              </div>
              
              {/* Orders Stats */}
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" style={{ color: colors.text.secondary }} />
                <span style={{ color: colors.text.secondary }}>{ordersCount} Ordini</span>
              </div>

              {/* Free Tables */}
              <div className="flex items-center gap-2">
                <Square className="w-4 h-4" style={{ color: colors.text.secondary }} />
                <span style={{ color: colors.text.secondary }}>{totalTables - occupiedTables} liberi</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}