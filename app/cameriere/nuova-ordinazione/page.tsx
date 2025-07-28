"use client";

import { useState, useEffect } from "react";
import { Coffee, Bell, ArrowLeft, Gift, User } from "lucide-react";
import { useSSE } from "@/lib/hooks/useSSE";
import { getTavoli, getCustomerNamesForTable, getProdotti } from "@/lib/actions/ordinazioni";
import { creaOrdinazionePerAltri } from "@/lib/actions/ordinaPerAltri";
import Link from "next/link";
import { ClientClock } from "@/components/ClientClock";
import { OrdinaPerAltriModal } from "@/components/cameriere/OrdinaPerAltriModal";
import { toast } from "@/lib/toast";

interface Table {
  id: number;
  numero: string;
  stato: "LIBERO" | "OCCUPATO" | "RISERVATO" | "IN_PULIZIA";
  posti: number;
  zona?: string | null;
  attivo: boolean;
  clienteNome?: string | null;
}

export default function NuovaOrdinazionePage() {
  // SSE notifications
  const { isConnected, notifications } = useSSE({
    clientId: "cameriere-1",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      console.log("Notifica ricevuta:", notification);
      // Ricarica i tavoli quando arriva una notifica
      loadData();
    }
  });
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalitaOrdinazione, setModalitaOrdinazione] = useState<'normale' | 'per-altri'>('normale');
  const [clienteOrdinante, setClienteOrdinante] = useState<string>("");
  const [hoveredTable, setHoveredTable] = useState<number | null>(null);
  const [tableCustomers, setTableCustomers] = useState<{[key: number]: string[]}>({});
  const [showOrdinaPerAltriModal, setShowOrdinaPerAltriModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log("🔄 Caricamento tavoli...");
      
      // Verifica la presenza del cookie di sessione
      const cookies = document.cookie;
      console.log("🍪 Cookies disponibili:", cookies);
      const hasSession = cookies.includes('bar-roxy-session');
      console.log("🔐 Sessione presente:", hasSession);
      
      // Aggiungi un piccolo delay per assicurarsi che i cookie siano pronti
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const [tavoliData, prodottiData] = await Promise.all([
        getTavoli(),
        getProdotti()
      ]);
      console.log("✅ Tavoli caricati:", tavoliData);
      console.log("📊 Numero tavoli:", tavoliData?.length || 0);
      console.log("🔍 Tipo di dato ricevuto:", typeof tavoliData);
      console.log("📦 È un array?", Array.isArray(tavoliData));
      
      if (Array.isArray(tavoliData) && tavoliData.length > 0) {
        console.log("✅ Using authenticated data");
        setTables(tavoliData);
        setProducts(prodottiData || []);
      } else {
        console.error("❌ Nessun dato tavoli - array vuoto");
        console.error("📊 Dettagli:", { 
          tavoliData, 
          length: tavoliData?.length,
          isArray: Array.isArray(tavoliData)
        });
        // Temporaneamente disabilitato il redirect per debug
        // alert("Sessione scaduta. Effettua nuovamente il login.");
        // window.location.href = "/login";
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

  const getTableStatusColor = (stato: string) => {
    switch(stato) {
      case "LIBERO": return "bg-white/10 border-white/20 text-white/70";
      case "OCCUPATO": return "bg-white/5 border-white/15 text-white/30";
      case "RISERVATO": return "bg-white/8 border-white/15 text-white/50";
      case "IN_PULIZIA": return "bg-white/8 border-white/18 text-white/50";
      default: return "bg-white/5 border-white/10 text-white/30";
    }
  };

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

  const handleOrdinaPerAltri = async (orderData: any) => {
    try {
      console.log("Creazione ordine per altri:", orderData);
      
      const result = await creaOrdinazionePerAltri(orderData);
      
      if (result.success) {
        setShowOrdinaPerAltriModal(false);
        
        // Mostra messaggio di successo personalizzato
        if (result.pagamentoImmediato) {
          toast.success(`✅ ${result.message}`);
        } else {
          toast.success(`💳 ${result.message}\nSaldo rimanente: €${result.saldoRimanente?.toFixed(2)}`);
        }
        
        // Ricarica i dati per aggiornare la lista tavoli
        loadData();
      } else {
        toast.error(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error("Errore creazione ordine per altri:", error);
      toast.error("Errore imprevisto durante la creazione dell'ordine");
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/cameriere" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="h-6 w-6 text-white/70" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Nuova Ordinazione</h1>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <ClientClock />
          </div>

          {/* Modalità Ordinazione buttons - now inline */}
          <div className="flex gap-2">
            <button
              onClick={() => setModalitaOrdinazione('normale')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                modalitaOrdinazione === 'normale'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <User className="h-4 w-4" />
              Normale
            </button>
            <button
              onClick={() => setShowOrdinaPerAltriModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors bg-white/90 text-black border-white/90 hover:bg-white"
            >
              <Gift className="h-4 w-4" />
              Ordina per Altri
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">        
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Seleziona un Tavolo
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-muted-foreground">Caricamento tavoli...</div>
          </div>
        ) : tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-muted-foreground mb-2">Nessun tavolo trovato</div>
            <div className="text-sm text-muted-foreground">Controlla la console per maggiori dettagli</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group tables by zone */}
            {["Dentro", "Marciapiede", "Prima Fila", "Seconda Fila", "Terza Fila", "Piazza"].map((zona) => {
              const tavoliZona = tables.filter(table => table.zona === zona);
              if (tavoliZona.length === 0) return null;
              
              const getZoneEmoji = (zona: string) => {
                switch(zona) {
                  case "Dentro": return "🏠";
                  case "Marciapiede": return "🚶";
                  case "Prima Fila": return "🥇";
                  case "Seconda Fila": return "🥈";
                  case "Terza Fila": return "🥉";
                  case "Piazza": return "🅿️";
                  default: return "📍";
                }
              };

              const getZoneColor = (zona: string) => {
                switch(zona) {
                  case "Dentro": return "bg-white/8 border-white/18";
                  case "Marciapiede": return "bg-white/10 border-white/20";
                  case "Prima Fila": return "bg-white/7 border-white/17";
                  case "Seconda Fila": return "bg-white/6 border-white/16";
                  case "Terza Fila": return "bg-white/5 border-white/15";
                  case "Piazza": return "bg-white/9 border-white/19";
                  default: return "bg-white/5 border-white/10";
                }
              };

              return (
                <div key={zona} className={`p-4 rounded-lg border ${getZoneColor(zona)}`}>
                  <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <span>{getZoneEmoji(zona)}</span>
                    <span>{zona}</span>
                    <span className="text-xs text-muted-foreground">({tavoliZona.length})</span>
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {tavoliZona.map((table) => (
                      <div key={table.id} className="relative">
                        <Link
                          href={`/cameriere/tavolo/${table.id}`}
                          className={`aspect-square p-2 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center ${
                            getTableStatusColor(table.stato)
                          } hover:ring-2 hover:ring-white/50 hover:scale-105`}
                          onMouseEnter={() => handleTableHover(table.id)}
                          onMouseLeave={handleTableLeave}
                        >
                        <div className="text-lg font-bold">{table.numero}</div>
                        <div className="text-xs">{table.posti}</div>
                        {table.stato === "OCCUPATO" && (
                          <div className="text-[10px] bg-white/10 text-white/60 px-1 rounded mt-1">
                            +Ordine
                          </div>
                        )}
                        {table.clienteNome && (
                          <div className="text-[10px] text-foreground mt-1 truncate w-full text-center">
                            {table.clienteNome}
                          </div>
                        )}
                        </Link>
                        
                        {/* Tooltip with customer names */}
                        {hoveredTable === table.id && tableCustomers[table.id] && tableCustomers[table.id].length > 0 && (
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
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal per Ordina per Altri */}
      <OrdinaPerAltriModal
        isOpen={showOrdinaPerAltriModal}
        onClose={() => setShowOrdinaPerAltriModal(false)}
        onConfirm={handleOrdinaPerAltri}
        products={products}
        tables={tables}
      />
    </>
  );
}