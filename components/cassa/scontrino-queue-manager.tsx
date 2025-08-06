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
import { useTheme } from "@/contexts/ThemeContext";

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
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  
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

  const getPriorityStyle = (priorita: string) => {
    const baseStyle = {
      backgroundColor: colors.bg.hover,
      color: colors.text.primary,
      borderColor: colors.border.primary,
      borderWidth: '1px',
      borderStyle: 'solid' as const
    };
    
    switch (priorita) {
      case "URGENTE": 
        return { ...baseStyle, color: colors.text.error, borderColor: colors.border.error };
      case "ALTA": 
        return { ...baseStyle, color: colors.text.success };
      case "NORMALE": 
        return baseStyle;
      case "BASSA": 
        return { ...baseStyle, color: colors.text.muted };
      default: 
        return baseStyle;
    }
  };

  const getStatoIcon = (stato: string) => {
    switch (stato) {
      case "IN_CODA": return <Clock className="h-4 w-4" style={{ color: colors.text.secondary }} />;
      case "IN_STAMPA": return <Printer className="h-4 w-4 animate-pulse" style={{ color: colors.button.primary }} />;
      case "STAMPATO": return <CheckCircle className="h-4 w-4" style={{ color: colors.text.success }} />;
      case "ERRORE": return <XCircle className="h-4 w-4" style={{ color: colors.text.error }} />;
      case "ANNULLATO": return <Trash2 className="h-4 w-4" style={{ color: colors.text.muted }} />;
      default: return <AlertTriangle className="h-4 w-4" style={{ color: colors.text.muted }} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.border.primary }}>
          <div className="flex items-center gap-3">
            <Printer className="h-6 w-6" style={{ color: colors.text.primary }} />
            <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>Gestione Queue Scontrini</h2>
            {stats && (
              <div className="flex gap-4 text-sm">
                <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                  In coda: {stats.inCoda}
                </span>
                <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.button.primary, color: colors.button.primaryText }}>
                  In stampa: {stats.inStampa}
                </span>
                <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.button.success, color: colors.button.successText }}>
                  Stampati oggi: {stats.stampatiOggi}
                </span>
                {stats.errori > 0 && (
                  <span className="px-2 py-1 rounded" style={{ backgroundColor: colors.bg.hover, color: colors.text.error, borderColor: colors.border.error, borderWidth: '1px', borderStyle: 'solid' }}>
                    Errori: {stats.errori}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="px-3 py-1 rounded text-sm transition-colors duration-200"
              style={{ 
                backgroundColor: autoRefresh ? colors.button.success : colors.bg.hover,
                color: autoRefresh ? colors.button.successText : colors.text.primary
              }}
            >
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={loadScontrini}
              disabled={isLoading}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = colors.bg.hover)}
              onMouseLeave={(e) => !isLoading && (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} style={{ color: colors.text.secondary }} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ color: colors.text.secondary }}>✕</span>
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Lista Scontrini */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-lg font-medium mb-4" style={{ color: colors.text.primary }}>Scontrini in Coda</h3>
            
            {scontrini.length === 0 ? (
              <div className="text-center py-12">
                <Printer className="h-16 w-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
                <p style={{ color: colors.text.secondary }}>Nessuno scontrino in coda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scontrini.map(scontrino => (
                  <div
                    key={scontrino.id}
                    onClick={() => setSelectedScontrino(scontrino)}
                    className={`rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-105 ${
                      selectedScontrino?.id === scontrino.id ? 'ring-2' : ''
                    }`}
                    style={{ 
                      backgroundColor: colors.bg.darker,
                      borderColor: selectedScontrino?.id === scontrino.id ? colors.border.primary : colors.border.secondary,
                      borderWidth: selectedScontrino?.id === scontrino.id ? '2px' : '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatoIcon(scontrino.stato)}
                        <div>
                          <div className="font-medium" style={{ color: colors.text.primary }}>
                            {scontrino.tipo} - {scontrino.tavoloNumero || 'Asporto'}
                          </div>
                          <div className="text-sm" style={{ color: colors.text.secondary }}>
                            {new Date(scontrino.timestampCreazione).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs" style={getPriorityStyle(scontrino.priorita)}>
                          {scontrino.priorita}
                        </span>
                        <span className="font-semibold" style={{ color: colors.text.primary }}>
                          €{scontrino.totale.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm" style={{ color: colors.text.secondary }}>
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
                          className="flex items-center gap-1 px-3 py-1 rounded transition-colors duration-200"
                          style={{ 
                            backgroundColor: colors.button.primary,
                            color: colors.button.primaryText
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
                        >
                          <Play className="h-3 w-3" />
                          Stampa
                        </button>
                      )}
                      
                      {scontrino.stato === "ERRORE" && (
                        <div className="text-xs" style={{ color: colors.text.error }}>
                          Tentativo {scontrino.tentativiStampa}/3
                        </div>
                      )}
                    </div>

                    {scontrino.messaggioErrore && (
                      <div className="mt-2 text-sm p-2 rounded" style={{ color: colors.text.error, backgroundColor: colors.bg.hover, borderColor: colors.border.error, borderWidth: '1px', borderStyle: 'solid' }}>
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
            <div className="w-1/3 border-l p-6 overflow-y-auto" style={{ backgroundColor: colors.bg.darker, borderColor: colors.border.primary }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium" style={{ color: colors.text.primary }}>Anteprima Scontrino</h3>
                <button
                  onClick={() => setSelectedScontrino(null)}
                  className="p-1 rounded transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span style={{ color: colors.text.secondary }}>✕</span>
                </button>
              </div>

              <div className="rounded p-4 font-mono text-sm" style={{ backgroundColor: colors.bg.card, borderColor: colors.border.primary, borderWidth: '1px', borderStyle: 'solid' }}>
                <div className="text-center border-b pb-2 mb-3" style={{ borderColor: colors.border.secondary }}>
                  <div className="font-bold" style={{ color: colors.text.primary }}>Roxy Bar</div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>Via Example 123, Città</div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>Tel: 123-456-7890</div>
                </div>

                <div className="mb-3" style={{ color: colors.text.primary }}>
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

                <div className="border-t border-b py-2" style={{ borderColor: colors.border.secondary }}>
                  {Array.isArray(selectedScontrino.righe) && selectedScontrino.righe.map((riga: any, index: number) => (
                    <div key={index} className="flex justify-between" style={{ color: colors.text.primary }}>
                      <span>{riga.quantita}x {riga.prodotto}</span>
                      <span>€{riga.totaleRiga.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="flex justify-between font-bold" style={{ color: colors.text.primary }}>
                    <span>TOTALE:</span>
                    <span>€{selectedScontrino.totale.toFixed(2)}</span>
                  </div>
                  {selectedScontrino.modalitaPagamento && (
                    <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                      Pagamento: {selectedScontrino.modalitaPagamento}
                    </div>
                  )}
                </div>

                <div className="text-center text-xs mt-3 pt-2 border-t" style={{ borderColor: colors.border.secondary, color: colors.text.muted }}>
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