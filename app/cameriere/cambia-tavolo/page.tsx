"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowLeftRight, MapPin, Users, Clock, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useCameriere } from "@/contexts/cameriere-context";
import { getTavoliLiberi, getActiveOrdersByTable, cambiaOrdineTavolo } from "@/lib/actions/cambio-tavolo";
import { toast } from "@/lib/toast";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";
import { StatoTavolo } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface Table {
  id: number;
  numero: string;
  stato: StatoTavolo;
  zona: string;
}

interface OrderInfo {
  id: string;
  tavolo: { numero: string };
  totale: Decimal;
  righe: number;
  dataOra: string;
  cameriere: string;
}

export default function CambiaTavoloPage() {
  const [sourceTable, setSourceTable] = useState<string>("");
  const [destinationTable, setDestinationTable] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<Table[]>([]);
  const [sourceOrders, setSourceOrders] = useState<OrderInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [searchSource, setSearchSource] = useState("");
  const [searchDest, setSearchDest] = useState("");
  
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const { setIsConnected } = useCameriere();

  // SSE for real-time updates
  const { isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-cambia-tavolo",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      if (notification.type === "table:updated" || notification.type === "order:updated") {
        loadAvailableTables();
        if (sourceTable) {
          loadSourceOrders(sourceTable);
        }
      }
    }
  });

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  useEffect(() => {
    loadAvailableTables();
  }, []);

  useEffect(() => {
    if (sourceTable) {
      loadSourceOrders(sourceTable);
    } else {
      setSourceOrders([]);
    }
  }, [sourceTable]);

  const loadAvailableTables = async () => {
    try {
      const tables = await getTavoliLiberi();
      setAvailableTables(tables);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast.error("Errore nel caricamento dei tavoli");
    }
  };

  const loadSourceOrders = async (tableNumber: string) => {
    setIsLoading(true);
    try {
      const orders = await getActiveOrdersByTable(tableNumber);
      setSourceOrders(orders);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Errore nel caricamento degli ordini");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableChange = async () => {
    if (!sourceTable || !destinationTable) {
      toast.error("Seleziona sia il tavolo di origine che quello di destinazione");
      return;
    }

    if (sourceTable === destinationTable) {
      toast.error("I tavoli di origine e destinazione devono essere diversi");
      return;
    }

    if (sourceOrders.length === 0) {
      toast.error("Nessun ordine attivo sul tavolo di origine");
      return;
    }

    setIsChanging(true);
    try {
      const result = await cambiaOrdineTavolo(sourceTable, destinationTable);
      
      if (result.success) {
        toast.success(`Ordini spostati dal Tavolo ${sourceTable} al Tavolo ${destinationTable}`);
        setSourceTable("");
        setDestinationTable("");
        setSourceOrders([]);
        await loadAvailableTables();
      } else {
        toast.error(result.error || "Errore durante lo spostamento degli ordini");
      }
    } catch (error) {
      console.error("Error changing table:", error);
      toast.error("Errore durante lo spostamento degli ordini");
    } finally {
      setIsChanging(false);
    }
  };

  const filteredSourceTables = availableTables.filter(table => 
    table.numero.toLowerCase().includes(searchSource.toLowerCase()) ||
    table.zona.toLowerCase().includes(searchSource.toLowerCase())
  );

  const filteredDestTables = availableTables.filter(table => 
    table.numero.toLowerCase().includes(searchDest.toLowerCase()) ||
    table.zona.toLowerCase().includes(searchDest.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cameriere" 
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Cambia Tavolo
            </h1>
          </div>
          <ConnectionStatusIndicator connectionHealth={connectionHealth} />
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Instructions */}
        <div className="mb-6 p-4 rounded-lg" style={{ 
          backgroundColor: colors.bg.card,
          borderColor: colors.border.primary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="h-5 w-5" style={{ color: colors.accent }} />
            <h2 className="font-medium" style={{ color: colors.text.primary }}>
              Sposta ordini tra tavoli
            </h2>
          </div>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Seleziona il tavolo di origine e quello di destinazione. Tutti gli ordini attivi verranno spostati.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Source Table Selection */}
          <div>
            <h3 className="text-lg font-medium mb-4" style={{ color: colors.text.primary }}>
              Tavolo di Origine
            </h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
              <input
                type="text"
                placeholder="Cerca tavolo..."
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>

            {/* Table List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredSourceTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSourceTable(table.numero)}
                  disabled={table.stato !== 'OCCUPATO'}
                  className={`w-full p-3 rounded-lg transition-colors text-left ${
                    sourceTable === table.numero ? '' : ''
                  } ${table.stato !== 'OCCUPATO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: sourceTable === table.numero ? colors.accent : colors.bg.card,
                    borderColor: sourceTable === table.numero ? colors.accent : colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: sourceTable === table.numero ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Tavolo {table.numero}</span>
                    </div>
                    <span className="text-sm" style={{ 
                      color: sourceTable === table.numero ? colors.button.primaryText : colors.text.muted 
                    }}>
                      {table.zona} - {table.stato}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Source Table Orders */}
            {sourceTable && sourceOrders.length > 0 && (
              <div className="mt-4 p-4 rounded-lg" style={{ 
                backgroundColor: colors.bg.darker,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}>
                <h4 className="font-medium mb-2" style={{ color: colors.text.primary }}>
                  Ordini attivi sul Tavolo {sourceTable}
                </h4>
                <div className="space-y-2">
                  {sourceOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between text-sm">
                      <div style={{ color: colors.text.secondary }}>
                        <span className="font-medium">{order.righe} prodotti</span>
                        <span className="mx-2">•</span>
                        <span>{order.cameriere}</span>
                      </div>
                      <span className="font-medium" style={{ color: colors.text.primary }}>
                        €{order.totale.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 flex justify-between font-medium" style={{ 
                    borderTop: `1px solid ${colors.border.secondary}` 
                  }}>
                    <span style={{ color: colors.text.primary }}>Totale</span>
                    <span style={{ color: colors.accent }}>
                      €{sourceOrders.reduce((sum, o) => sum + Number(o.totale), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Destination Table Selection */}
          <div>
            <h3 className="text-lg font-medium mb-4" style={{ color: colors.text.primary }}>
              Tavolo di Destinazione
            </h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: colors.text.muted }} />
              <input
                type="text"
                placeholder="Cerca tavolo..."
                value={searchDest}
                onChange={(e) => setSearchDest(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: colors.text.primary
                }}
              />
            </div>

            {/* Table List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredDestTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setDestinationTable(table.numero)}
                  disabled={table.numero === sourceTable}
                  className={`w-full p-3 rounded-lg transition-colors text-left ${
                    destinationTable === table.numero ? '' : ''
                  } ${table.numero === sourceTable ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: destinationTable === table.numero ? colors.accent : colors.bg.card,
                    borderColor: destinationTable === table.numero ? colors.accent : colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: destinationTable === table.numero ? colors.button.primaryText : colors.text.primary
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">Tavolo {table.numero}</span>
                    </div>
                    <span className="text-sm" style={{ 
                      color: destinationTable === table.numero ? colors.button.primaryText : colors.text.muted 
                    }}>
                      {table.zona} - {table.stato}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleTableChange}
            disabled={!sourceTable || !destinationTable || isChanging || sourceOrders.length === 0}
            className="px-8 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colors.accent,
              color: colors.button.primaryText
            }}
          >
            {isChanging ? (
              <>
                <Clock className="h-5 w-5 animate-spin" />
                Spostamento in corso...
              </>
            ) : (
              <>
                <ArrowLeftRight className="h-5 w-5" />
                Sposta Ordini
              </>
            )}
          </button>
        </div>

        {/* Summary */}
        {sourceTable && destinationTable && sourceOrders.length > 0 && (
          <div className="mt-6 p-4 rounded-lg text-center" style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}>
            <p style={{ color: colors.text.primary }}>
              <span className="font-medium">{sourceOrders.length}</span> ordini per un totale di{' '}
              <span className="font-medium" style={{ color: colors.accent }}>
                €{sourceOrders.reduce((sum, o) => sum + Number(o.totale), 0).toFixed(2)}
              </span>{' '}
              saranno spostati dal <span className="font-medium">Tavolo {sourceTable}</span> al{' '}
              <span className="font-medium">Tavolo {destinationTable}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}