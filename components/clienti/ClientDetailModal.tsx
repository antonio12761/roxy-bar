"use client";

import { useState, useEffect } from "react";
import { X, User, ShoppingBag, CreditCard, Calendar, Package, Euro, Clock, FileText, Loader2 } from "lucide-react";
import { ThemedModal } from "@/components/ui/ThemedModal";
import { useTheme } from "@/contexts/ThemeContext";
import { getClienteDettaglio } from "@/lib/actions/clienti-stats";

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  onUpdate?: () => void;
}

export default function ClientDetailModal({ 
  isOpen, 
  onClose, 
  clienteId,
  onUpdate 
}: ClientDetailModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [cliente, setCliente] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'ordini' | 'debiti' | 'timeline'>('info');

  useEffect(() => {
    if (isOpen && clienteId) {
      loadClienteDetail();
    }
  }, [isOpen, clienteId]);

  const loadClienteDetail = async () => {
    setIsLoading(true);
    try {
      const result = await getClienteDettaglio(clienteId);
      if (result.success) {
        setCliente(result.cliente);
        setTimeline(result.timeline || []);
      }
    } catch (error) {
      console.error("Errore caricamento dettaglio cliente:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTimelineIcon = (tipo: string) => {
    switch (tipo) {
      case 'ordinazione':
        return ShoppingBag;
      case 'pagamento':
        return Euro;
      case 'debito':
        return CreditCard;
      case 'pagamento_debito':
        return Euro;
      default:
        return FileText;
    }
  };

  const getTimelineColor = (tipo: string) => {
    switch (tipo) {
      case 'ordinazione':
        return colors.text.info;
      case 'pagamento':
        return colors.text.success;
      case 'debito':
        return colors.text.warning;
      case 'pagamento_debito':
        return colors.text.accent;
      default:
        return colors.text.secondary;
    }
  };

  if (!isOpen) return null;

  return (
    <ThemedModal 
      isOpen={isOpen} 
      onClose={onClose} 
      showCloseButton={true}
      size="lg"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.text.accent }} />
        </div>
      ) : cliente ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="p-3 rounded-full"
                style={{ backgroundColor: colors.bg.hover }}
              >
                <User className="h-6 w-6" style={{ color: colors.text.accent }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                  {cliente.nome}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  {cliente.telefono && (
                    <span className="text-sm" style={{ color: colors.text.secondary }}>
                      📞 {cliente.telefono}
                    </span>
                  )}
                  {cliente.email && (
                    <span className="text-sm" style={{ color: colors.text.secondary }}>
                      ✉️ {cliente.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b" style={{ borderColor: colors.border.primary }}>
            {['info', 'ordini', 'debiti', 'timeline'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 font-medium capitalize transition-colors ${
                  activeTab === tab ? 'border-b-2' : ''
                }`}
                style={{
                  color: activeTab === tab ? colors.text.accent : colors.text.secondary,
                  borderColor: activeTab === tab ? colors.text.accent : 'transparent'
                }}
              >
                {tab === 'info' && 'Informazioni'}
                {tab === 'ordini' && `Ordini (${cliente.Ordinazioni?.length || 0})`}
                {tab === 'debiti' && `Debiti (${cliente.Debiti?.length || 0})`}
                {tab === 'timeline' && 'Cronologia'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="max-h-[60vh] overflow-y-auto">
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: colors.bg.hover }}
                  >
                    <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                      {cliente.Ordinazioni?.length || 0}
                    </div>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                      Ordini totali
                    </div>
                  </div>
                  
                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: colors.bg.hover }}
                  >
                    <div className="text-2xl font-bold" style={{ color: colors.text.success }}>
                      €{cliente.Ordinazioni?.reduce((sum: number, ord: any) => 
                        sum + ord.Righe.reduce((s: number, r: any) => 
                          s + (r.prezzo * r.quantita), 0
                        ), 0
                      ).toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                      Totale speso
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: colors.bg.hover }}
                  >
                    <div className="text-2xl font-bold" style={{ color: colors.text.warning }}>
                      {cliente.Debiti?.filter((d: any) => 
                        d.stato === 'APERTO' || d.stato === 'PARZIALMENTE_PAGATO'
                      ).length || 0}
                    </div>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                      Debiti aperti
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: colors.bg.hover }}
                  >
                    <div className="text-2xl font-bold" style={{ color: colors.text.info }}>
                      {new Date(cliente.dataCreazione).toLocaleDateString('it-IT')}
                    </div>
                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                      Cliente dal
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div>
                  <h3 className="font-semibold mb-3" style={{ color: colors.text.primary }}>
                    Informazioni Contatto
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: colors.text.secondary }}>Nome:</span>
                      <span style={{ color: colors.text.primary }}>{cliente.nome}</span>
                    </div>
                    {cliente.telefono && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: colors.text.secondary }}>Telefono:</span>
                        <span style={{ color: colors.text.primary }}>{cliente.telefono}</span>
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: colors.text.secondary }}>Email:</span>
                        <span style={{ color: colors.text.primary }}>{cliente.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ordini' && (
              <div className="space-y-3">
                {cliente.Ordinazioni?.map((ordine: any) => (
                  <div
                    key={ordine.id}
                    className="p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: colors.bg.hover,
                      borderColor: colors.border.primary
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="h-5 w-5" style={{ color: colors.text.info }} />
                        <div>
                          <span className="font-semibold" style={{ color: colors.text.primary }}>
                            Ordine #{ordine.numero}
                          </span>
                          {ordine.Tavolo && (
                            <span className="ml-2 text-sm" style={{ color: colors.text.secondary }}>
                              Tavolo {ordine.Tavolo.numero}
                            </span>
                          )}
                        </div>
                      </div>
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: ordine.stato === 'PAGATO' 
                            ? colors.text.success + '20' 
                            : colors.text.warning + '20',
                          color: ordine.stato === 'PAGATO' 
                            ? colors.text.success 
                            : colors.text.warning
                        }}
                      >
                        {ordine.stato}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-1" style={{ color: colors.text.secondary }}>
                      <div>Data: {new Date(ordine.dataApertura).toLocaleString('it-IT')}</div>
                      <div>Cameriere: {ordine.Cameriere?.nome}</div>
                      <div className="font-semibold" style={{ color: colors.text.primary }}>
                        Totale: €{ordine.Righe.reduce((sum: number, r: any) => 
                          sum + (r.prezzo * r.quantita), 0
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
                {(!cliente.Ordinazioni || cliente.Ordinazioni.length === 0) && (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-3" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessun ordine trovato</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'debiti' && (
              <div className="space-y-3">
                {cliente.Debiti?.map((debito: any) => {
                  const totalePagato = debito.PagamentiDebito?.reduce(
                    (sum: number, p: any) => sum + p.importo, 0
                  ) || 0;
                  const rimanente = debito.importo - totalePagato;

                  return (
                    <div
                      key={debito.id}
                      className="p-4 rounded-lg border"
                      style={{ 
                        backgroundColor: colors.bg.hover,
                        borderColor: debito.stato === 'PAGATO' 
                          ? colors.border.primary 
                          : colors.text.warning
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5" style={{ color: colors.text.warning }} />
                          <div>
                            <span className="font-semibold" style={{ color: colors.text.primary }}>
                              {debito.Ordinazione 
                                ? `Debito ordine #${debito.Ordinazione.numero}`
                                : 'Debito diretto'}
                            </span>
                          </div>
                        </div>
                        <span 
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: debito.stato === 'PAGATO' 
                              ? colors.text.success + '20' 
                              : colors.text.warning + '20',
                            color: debito.stato === 'PAGATO' 
                              ? colors.text.success 
                              : colors.text.warning
                          }}
                        >
                          {debito.stato}
                        </span>
                      </div>
                      
                      <div className="text-sm space-y-1" style={{ color: colors.text.secondary }}>
                        <div>Data: {new Date(debito.dataCreazione).toLocaleDateString('it-IT')}</div>
                        <div>Importo: €{debito.importo.toFixed(2)}</div>
                        {totalePagato > 0 && (
                          <div>Pagato: €{totalePagato.toFixed(2)}</div>
                        )}
                        {debito.stato !== 'PAGATO' && (
                          <div className="font-semibold" style={{ color: colors.text.warning }}>
                            Rimanente: €{rimanente.toFixed(2)}
                          </div>
                        )}
                        {debito.note && (
                          <div className="italic">Note: {debito.note}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!cliente.Debiti || cliente.Debiti.length === 0) && (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto mb-3" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessun debito trovato</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-3">
                {timeline.map((evento, index) => {
                  const Icon = getTimelineIcon(evento.tipo);
                  const color = getTimelineColor(evento.tipo);

                  return (
                    <div key={index} className="flex gap-3">
                      <div 
                        className="p-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: colors.text.primary }}>
                          {evento.descrizione}
                        </div>
                        <div className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                          {new Date(evento.data).toLocaleString('it-IT')}
                        </div>
                        {evento.dettagli && (
                          <div className="text-sm mt-2 space-y-1">
                            {evento.dettagli.totale && (
                              <div>Totale: €{evento.dettagli.totale.toFixed(2)}</div>
                            )}
                            {evento.dettagli.importo && (
                              <div>Importo: €{evento.dettagli.importo.toFixed(2)}</div>
                            )}
                            {evento.dettagli.modalita && (
                              <div>Modalità: {evento.dettagli.modalita}</div>
                            )}
                            {evento.dettagli.operatore && (
                              <div>Operatore: {evento.dettagli.operatore}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {timeline.length === 0 && (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-3" style={{ color: colors.text.muted }} />
                    <p style={{ color: colors.text.secondary }}>Nessuna attività trovata</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p style={{ color: colors.text.secondary }}>Cliente non trovato</p>
        </div>
      )}
    </ThemedModal>
  );
}