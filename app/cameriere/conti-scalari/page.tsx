"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, CreditCard, Euro, Clock, User, MapPin, Plus, Minus } from "lucide-react";
import Link from "next/link";
import { getTuttiContiScalari, saldaContoParziale } from "@/lib/actions/ordinaPerAltri";
import { toast } from "@/lib/toast";

interface ContoScalareData {
  id: string;
  tavoloId?: number | null;
  clienteId?: string | null;
  nomeCliente?: string | null;
  totaleOrdinato: number;
  totalePagato: number;
  saldoRimanente: number;
  dataApertura: Date;
  movimenti: MovimentoContoData[];
}

interface MovimentoContoData {
  id: string;
  tipo: string;
  importo: number;
  descrizione: string;
  timestamp: Date;
  nomeClientePagatore?: string | null;
}

interface RiepilogoConti {
  contiAperti: number;
  totaleOrdinato: number;
  totalePagato: number;
  saldoRimanente: number;
  dettagliConti: ContoScalareData[];
}

export default function ContiScalariPage() {
  const [riepilogo, setRiepilogo] = useState<RiepilogoConti | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConto, setSelectedConto] = useState<ContoScalareData | null>(null);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [importoPagamento, setImportoPagamento] = useState("");
  const [modalitaPagamento, setModalitaPagamento] = useState("CONTANTI");

  useEffect(() => {
    loadConti();
  }, []);

  const loadConti = async () => {
    setIsLoading(true);
    try {
      console.log("Caricamento conti scalari...");
      const result = await getTuttiContiScalari();
      
      if (result.success) {
        setRiepilogo(result.riepilogo);
        console.log("✅ Conti caricati:", result.riepilogo);
      } else {
        console.error("❌ Errore caricamento conti:", result.error);
        toast.error(result.error || "Errore nel caricamento dei conti");
        setRiepilogo(null);
      }
    } catch (error) {
      console.error("❌ Errore caricamento conti:", error);
      toast.error("Errore nel caricamento dei conti");
      setRiepilogo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePagamento = async () => {
    if (!selectedConto || !importoPagamento) return;

    const importo = parseFloat(importoPagamento);
    if (isNaN(importo) || importo <= 0) {
      toast.error("Inserire un importo valido");
      return;
    }

    try {
      const result = await saldaContoParziale(
        selectedConto.id,
        importo,
        undefined, // clientePagatoreId - per ora undefined
        modalitaPagamento
      );

      if (result.success) {
        toast.success(result.message);
        setShowPagamentoModal(false);
        setImportoPagamento("");
        setSelectedConto(null);
        loadConti();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("Errore pagamento:", error);
      toast.error("Errore durante il pagamento");
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoMovimentoColor = (tipo: string) => {
    switch (tipo) {
      case 'ORDINE': return 'text-white/50';
      case 'PAGAMENTO': return 'text-white/60';
      case 'STORNO': return 'text-white/60';
      default: return 'text-gray-400';
    }
  };

  const getTipoMovimentoIcon = (tipo: string) => {
    switch (tipo) {
      case 'ORDINE': return <Plus className="h-4 w-4" />;
      case 'PAGAMENTO': return <Minus className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/cameriere" className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="h-6 w-6 text-white/70" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Conti Scalari</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-muted-foreground">Caricamento conti...</div>
        </div>
      ) : !riepilogo || riepilogo.dettagliConti.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-lg">Nessun conto scalare aperto</p>
          <p className="text-sm text-muted-foreground mt-2">
            I conti scalari vengono creati automaticamente quando si ordinano prodotti per altri
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Riepilogo generale */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="text-sm text-muted-foreground">Conti Aperti</div>
              <div className="text-2xl font-bold text-foreground">{riepilogo.contiAperti}</div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="text-sm text-muted-foreground">Totale Ordinato</div>
              <div className="text-2xl font-bold text-foreground">€{riepilogo.totaleOrdinato.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="text-sm text-muted-foreground">Totale Pagato</div>
              <div className="text-2xl font-bold text-white/60">€{riepilogo.totalePagato.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="text-sm text-muted-foreground">Saldo Rimanente</div>
              <div className="text-2xl font-bold text-white/50">€{riepilogo.saldoRimanente.toFixed(2)}</div>
            </div>
          </div>

          {/* Lista conti */}
          <div className="space-y-4">
            {riepilogo.dettagliConti.map((conto) => (
              <div key={conto.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {conto.tavoloId ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-white/60" />
                        <span className="font-medium text-foreground">Tavolo {conto.tavoloId}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-white/60" />
                        <span className="font-medium text-foreground">{conto.nomeCliente}</span>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {formatDate(conto.dataApertura)}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Saldo rimanente</div>
                      <div className="text-lg font-bold text-white/50">€{conto.saldoRimanente.toFixed(2)}</div>
                    </div>
                    {conto.saldoRimanente > 0 && (
                      <button
                        onClick={() => {
                          setSelectedConto(conto);
                          setShowPagamentoModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Incassa
                      </button>
                    )}
                  </div>
                </div>

                {/* Dettagli conto */}
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Ordinato: </span>
                    <span className="text-foreground">€{conto.totaleOrdinato.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pagato: </span>
                    <span className="text-white/60">€{conto.totalePagato.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Movimenti: </span>
                    <span className="text-foreground">{conto.movimenti.length}</span>
                  </div>
                </div>

                {/* Ultimi movimenti */}
                {conto.movimenti.length > 0 && (
                  <div className="border-t border-slate-700 pt-3">
                    <div className="text-sm text-muted-foreground mb-2">Ultimi movimenti:</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {conto.movimenti.slice(0, 3).map((movimento) => (
                        <div key={movimento.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={getTipoMovimentoColor(movimento.tipo)}>
                              {getTipoMovimentoIcon(movimento.tipo)}
                            </span>
                            <span className="text-foreground">{movimento.descrizione}</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-medium ${
                              movimento.tipo === 'ORDINE' ? 'text-white/50' : 'text-white/60'
                            }`}>
                              {movimento.tipo === 'ORDINE' ? '+' : ''}€{Math.abs(movimento.importo).toFixed(2)}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(movimento.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal per pagamento */}
      {showPagamentoModal && selectedConto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-foreground">Registra Pagamento</h3>
              <button 
                onClick={() => {
                  setShowPagamentoModal(false);
                  setImportoPagamento("");
                }}
                className="p-2 hover:bg-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Conto:</div>
                <div className="text-foreground font-medium">
                  {selectedConto.tavoloId ? `Tavolo ${selectedConto.tavoloId}` : selectedConto.nomeCliente}
                </div>
                <div className="text-sm text-muted-foreground">
                  Saldo rimanente: €{selectedConto.saldoRimanente.toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Importo da incassare</label>
                <input
                  type="number"
                  step="0.01"
                  value={importoPagamento}
                  onChange={(e) => setImportoPagamento(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">Modalità di pagamento</label>
                <select
                  value={modalitaPagamento}
                  onChange={(e) => setModalitaPagamento(e.target.value)}
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="CONTANTI">Contanti</option>
                  <option value="CARTA">Carta</option>
                  <option value="BANCOMAT">Bancomat</option>
                  <option value="SATISPAY">Satispay</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowPagamentoModal(false);
                    setImportoPagamento("");
                  }}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                >
                  Annulla
                </button>
                <button
                  onClick={handlePagamento}
                  disabled={!importoPagamento || parseFloat(importoPagamento) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Incassa €{importoPagamento || "0.00"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}