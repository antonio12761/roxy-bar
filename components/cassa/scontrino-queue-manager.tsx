"use client";

import { useState, useEffect } from "react";
import { 
  Printer, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  Eye,
  Play
} from "lucide-react";
import { 
  getProssimiScontrini, 
  marcaScontrinoStampato, 
  marcaScontrinoErrore,
  getStatisticheScontrini 
} from "@/lib/services/scontrino-queue";

interface ScontrinoQueue {
  id: string;
  tipo: "NON_FISCALE" | "FISCALE";
  stato: "IN_CODA" | "IN_STAMPA" | "STAMPATO" | "ERRORE" | "ANNULLATO";
  priorita: "BASSA" | "NORMALE" | "ALTA" | "URGENTE";
  tavoloNumero?: string;
  sessionePagamento?: string;
  righe: any[];
  totale: number;
  modalitaPagamento?: string;
  clienteNome?: string;
  cameriereNome?: string;
  timestampCreazione: string;
  timestampStampa?: string;
  messaggioErrore?: string;
  tentativiStampa: number;
  operatore?: { nome: string };
}

interface ScontrinoQueueManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScontrinoQueueManager({ isOpen, onClose }: ScontrinoQueueManagerProps) {
  const [scontrini, setScontrini] = useState<ScontrinoQueue[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedScontrino, setSelectedScontrino] = useState<ScontrinoQueue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Carica scontrini dalla queue
  const loadScontrini = async () => {
    setIsLoading(true);
    try {
      const [scontriniResult, statsResult] = await Promise.all([
        getProssimiScontrini(10),
        getStatisticheScontrini()
      ]);

      if (scontriniResult.success && scontriniResult.scontrini) {
        // Map null values to undefined for optional properties
        const mappedScontrini = scontriniResult.scontrini.map((s: any) => ({
          ...s,
          tavoloNumero: s.tavoloNumero || undefined,
          sessionePagamento: s.sessionePagamento || undefined,
          modalitaPagamento: s.modalitaPagamento || undefined,
          clienteNome: s.clienteNome || undefined,
          cameriereNome: s.cameriereNome || undefined,
          timestampStampa: s.timestampStampa || undefined,
          messaggioErrore: s.messaggioErrore || undefined,
          operatore: s.operatore || undefined
        }));
        setScontrini(mappedScontrini);
      }
      
      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error("Errore caricamento queue scontrini:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto refresh ogni 5 secondi
  useEffect(() => {
    if (!isOpen) return;

    loadScontrini();
    
    if (autoRefresh) {
      const interval = setInterval(loadScontrini, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh]);

  // Simula stampa (in un sistema reale, interfacciarsi con la stampante)
  const handleStampa = async (scontrino: ScontrinoQueue) => {
    try {
      // Simula tempo di stampa
      setScontrini(prev => prev.map(s => 
        s.id === scontrino.id ? { ...s, stato: "IN_STAMPA" as const } : s
      ));

      // Simula delay stampa
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simula risultato (95% successo)
      const successo = Math.random() > 0.05;
      
      if (successo) {
        await marcaScontrinoStampato(scontrino.id);
        setScontrini(prev => prev.map(s => 
          s.id === scontrino.id ? { ...s, stato: "STAMPATO" as const } : s
        ));
      } else {
        await marcaScontrinoErrore(scontrino.id, "Errore connessione stampante");
        setScontrini(prev => prev.map(s => 
          s.id === scontrino.id ? { 
            ...s, 
            stato: "ERRORE" as const,
            messaggioErrore: "Errore connessione stampante",
            tentativiStampa: s.tentativiStampa + 1
          } : s
        ));
      }

      loadScontrini(); // Refresh dopo operazione
    } catch (error) {
      console.error("Errore stampa:", error);
    }
  };

  const getPriorityColor = (priorita: string) => {
    switch (priorita) {
      case "URGENTE": return "text-red-600 bg-red-50";
      case "ALTA": return "text-orange-600 bg-orange-50";
      case "NORMALE": return "text-blue-600 bg-blue-50";
      case "BASSA": return "text-gray-600 bg-gray-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getStatoIcon = (stato: string) => {
    switch (stato) {
      case "IN_CODA": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "IN_STAMPA": return <Printer className="h-4 w-4 text-blue-500 animate-pulse" />;
      case "STAMPATO": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "ERRORE": return <XCircle className="h-4 w-4 text-red-500" />;
      case "ANNULLATO": return <Trash2 className="h-4 w-4 text-gray-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Printer className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold">Gestione Queue Scontrini</h2>
            {stats && (
              <div className="flex gap-4 text-sm">
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  In coda: {stats.inCoda}
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  In stampa: {stats.inStampa}
                </span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  Stampati oggi: {stats.stampatiOggi}
                </span>
                {stats.errori > 0 && (
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                    Errori: {stats.errori}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded text-sm ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={loadScontrini}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Lista Scontrini */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Scontrini in Coda</h3>
            
            {scontrini.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Printer className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Nessuno scontrino in coda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scontrini.map(scontrino => (
                  <div
                    key={scontrino.id}
                    onClick={() => setSelectedScontrino(scontrino)}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedScontrino?.id === scontrino.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatoIcon(scontrino.stato)}
                        <div>
                          <div className="font-medium">
                            {scontrino.tipo} - {scontrino.tavoloNumero || 'Asporto'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(scontrino.timestampCreazione).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(scontrino.priorita)}`}>
                          {scontrino.priorita}
                        </span>
                        <span className="font-semibold">
                          €{scontrino.totale.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {scontrino.clienteNome && `Cliente: ${scontrino.clienteNome} • `}
                        Cameriere: {scontrino.cameriereNome}
                        {scontrino.modalitaPagamento && ` • ${scontrino.modalitaPagamento}`}
                      </div>
                      
                      {scontrino.stato === "IN_CODA" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStampa(scontrino);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                        >
                          <Play className="h-3 w-3" />
                          Stampa
                        </button>
                      )}
                      
                      {scontrino.stato === "ERRORE" && (
                        <div className="text-xs text-red-600">
                          Tentativo {scontrino.tentativiStampa}/3
                        </div>
                      )}
                    </div>

                    {scontrino.messaggioErrore && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        {scontrino.messaggioErrore}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dettaglio Scontrino */}
          {selectedScontrino && (
            <div className="w-1/3 border-l bg-gray-50 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Anteprima Scontrino</h3>
                <button
                  onClick={() => setSelectedScontrino(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  ✕
                </button>
              </div>

              <div className="bg-white rounded border p-4 font-mono text-sm">
                <div className="text-center border-b pb-2 mb-3">
                  <div className="font-bold">BAR ROXY</div>
                  <div className="text-xs">Via Example 123, Città</div>
                  <div className="text-xs">Tel: 123-456-7890</div>
                </div>

                <div className="mb-3">
                  <div>Tipo: {selectedScontrino.tipo}</div>
                  <div>Data: {new Date(selectedScontrino.timestampCreazione).toLocaleString()}</div>
                  {selectedScontrino.tavoloNumero && (
                    <div>Tavolo: {selectedScontrino.tavoloNumero}</div>
                  )}
                  {selectedScontrino.clienteNome && (
                    <div>Cliente: {selectedScontrino.clienteNome}</div>
                  )}
                  <div>Cameriere: {selectedScontrino.cameriereNome}</div>
                </div>

                <div className="border-t border-b py-2">
                  {Array.isArray(selectedScontrino.righe) && selectedScontrino.righe.map((riga: any, index: number) => (
                    <div key={index} className="flex justify-between">
                      <span>{riga.quantita}x {riga.prodotto}</span>
                      <span>€{riga.totaleRiga.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="flex justify-between font-bold">
                    <span>TOTALE:</span>
                    <span>€{selectedScontrino.totale.toFixed(2)}</span>
                  </div>
                  {selectedScontrino.modalitaPagamento && (
                    <div className="text-xs mt-1">
                      Pagamento: {selectedScontrino.modalitaPagamento}
                    </div>
                  )}
                </div>

                <div className="text-center text-xs mt-3 pt-2 border-t">
                  Grazie per la visita!
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}