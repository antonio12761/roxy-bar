"use client";

import { useState, useEffect } from "react";
import { 
  X, User, Phone, Mail, MapPin, Calendar, Euro, 
  ShoppingBag, CreditCard, Clock, FileText, Tag,
  TrendingUp, AlertCircle
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getCliente } from "@/lib/actions/clienti";
import { toast } from "sonner";

interface ClienteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
}

export default function ClienteDetailModal({
  isOpen,
  onClose,
  clienteId
}: ClienteDetailModalProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [cliente, setCliente] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'ordini' | 'debiti' | 'stats'>('info');

  useEffect(() => {
    if (isOpen && clienteId) {
      loadCliente();
    }
  }, [isOpen, clienteId]);

  const loadCliente = async () => {
    setIsLoading(true);
    try {
      const result = await getCliente(clienteId);
      if (result.success) {
        setCliente(result.data);
      } else {
        toast.error("Errore nel caricamento del cliente");
        onClose();
      }
    } catch (error) {
      toast.error("Errore nel caricamento del cliente");
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-xl flex flex-col"
        style={{ backgroundColor: colors.bg.card }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: colors.border.primary }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
              <User className="h-5 w-5" style={{ color: colors.text.accent }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
                {cliente ? `${cliente.nome} ${cliente.cognome || ''}` : 'Dettagli Cliente'}
              </h2>
              {cliente?.email && (
                <p className="text-sm" style={{ color: colors.text.secondary }}>{cliente.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:opacity-80 transition-opacity"
            style={{ backgroundColor: colors.bg.hover }}
          >
            <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                style={{ borderColor: colors.text.accent }}
              />
              <p style={{ color: colors.text.secondary }}>Caricamento...</p>
            </div>
          </div>
        ) : cliente ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b" style={{ borderColor: colors.border.primary }}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <ShoppingBag className="h-4 w-4" style={{ color: colors.text.accent }} />
                  <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    {cliente.stats?.ordiniTotali || 0}
                  </span>
                </div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>Ordini Totali</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Euro className="h-4 w-4" style={{ color: colors.text.success }} />
                  <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    {formatCurrency(cliente.stats?.totaleSpeso || 0)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>Totale Speso</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4" style={{ color: colors.text.warning }} />
                  <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    {formatCurrency(cliente.stats?.debitoTotale || 0)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>Debiti Aperti</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4" style={{ color: colors.text.info }} />
                  <span className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                    {formatCurrency(cliente.stats?.mediaSpesa || 0)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: colors.text.secondary }}>Media Ordine</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: colors.border.primary }}>
              {[
                { id: 'info', label: 'Informazioni', icon: User },
                { id: 'ordini', label: `Ordini (${cliente.Ordinazione?.length || 0})`, icon: ShoppingBag },
                { id: 'debiti', label: `Debiti (${cliente.Debiti?.length || 0})`, icon: CreditCard },
                { id: 'stats', label: 'Statistiche', icon: TrendingUp }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                    activeTab === tab.id ? 'border-b-2' : ''
                  }`}
                  style={{
                    color: activeTab === tab.id ? colors.text.accent : colors.text.secondary,
                    borderColor: activeTab === tab.id ? colors.text.accent : 'transparent'
                  }}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Contatti */}
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                      Contatti
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cliente.telefono && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4" style={{ color: colors.text.muted }} />
                          <span style={{ color: colors.text.primary }}>{cliente.telefono}</span>
                        </div>
                      )}
                      {cliente.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4" style={{ color: colors.text.muted }} />
                          <span style={{ color: colors.text.primary }}>{cliente.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indirizzo */}
                  {(cliente.indirizzo || cliente.citta) && (
                    <div>
                      <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Indirizzo
                      </h3>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-0.5" style={{ color: colors.text.muted }} />
                        <div style={{ color: colors.text.primary }}>
                          {cliente.indirizzo && <p>{cliente.indirizzo}</p>}
                          {(cliente.cap || cliente.citta || cliente.provincia) && (
                            <p>
                              {cliente.cap} {cliente.citta} {cliente.provincia && `(${cliente.provincia})`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dati Fiscali */}
                  {(cliente.codiceFiscale || cliente.partitaIva) && (
                    <div>
                      <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Dati Fiscali
                      </h3>
                      <div className="space-y-2">
                        {cliente.codiceFiscale && (
                          <p style={{ color: colors.text.primary }}>
                            <span style={{ color: colors.text.secondary }}>CF:</span> {cliente.codiceFiscale}
                          </p>
                        )}
                        {cliente.partitaIva && (
                          <p style={{ color: colors.text.primary }}>
                            <span style={{ color: colors.text.secondary }}>P.IVA:</span> {cliente.partitaIva}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {cliente.tags && cliente.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {cliente.tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1 rounded-full text-sm"
                            style={{
                              backgroundColor: colors.bg.hover,
                              color: colors.text.secondary
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {cliente.note && (
                    <div>
                      <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Note
                      </h3>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                        <p style={{ color: colors.text.primary }}>{cliente.note}</p>
                      </div>
                    </div>
                  )}

                  {/* Info Sistema */}
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                      Informazioni Sistema
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p style={{ color: colors.text.primary }}>
                        <span style={{ color: colors.text.secondary }}>Registrato il:</span> {formatDateTime(cliente.createdAt)}
                      </p>
                      <p style={{ color: colors.text.primary }}>
                        <span style={{ color: colors.text.secondary }}>Ultima modifica:</span> {formatDateTime(cliente.updatedAt)}
                      </p>
                      <p style={{ color: colors.text.primary }}>
                        <span style={{ color: colors.text.secondary }}>Stato:</span>{' '}
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          cliente.attivo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {cliente.attivo ? 'Attivo' : 'Inattivo'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ordini' && (
                <div className="space-y-4">
                  {cliente.Ordinazione && cliente.Ordinazione.length > 0 ? (
                    cliente.Ordinazione.map((ordine: any) => (
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
                            <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                              #{ordine.numeroOrdine}
                            </span>
                            <span 
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                ordine.stato === 'PAGATO' ? 'bg-green-100 text-green-800' :
                                ordine.stato === 'ANNULLATO' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {ordine.stato}
                            </span>
                          </div>
                          <span className="text-sm" style={{ color: colors.text.muted }}>
                            {formatDateTime(ordine.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm" style={{ color: colors.text.secondary }}>
                            Tavolo: {ordine.Tavolo?.numero || '-'} • Cameriere: {ordine.User?.firstName || ordine.User?.username}
                          </div>
                          <span className="font-medium" style={{ color: colors.text.primary }}>
                            {formatCurrency(ordine.totale?.toNumber() || 0)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <ShoppingBag className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
                      <p style={{ color: colors.text.secondary }}>Nessun ordine trovato</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'debiti' && (
                <div className="space-y-4">
                  {cliente.Debiti && cliente.Debiti.length > 0 ? (
                    cliente.Debiti.map((debito: any) => (
                      <div
                        key={debito.id}
                        className="p-4 rounded-lg border"
                        style={{ 
                          backgroundColor: colors.bg.hover,
                          borderColor: colors.border.primary 
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span 
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              debito.stato === 'APERTO' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}
                          >
                            {debito.stato}
                          </span>
                          <span className="text-sm" style={{ color: colors.text.muted }}>
                            {formatDate(debito.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm" style={{ color: colors.text.secondary }}>
                            {debito.descrizione || 'Debito'}
                          </p>
                          <span className="font-medium text-lg" style={{ color: colors.text.warning }}>
                            {formatCurrency(debito.importo?.toNumber() || 0)}
                          </span>
                        </div>
                        {debito.note && (
                          <p className="text-sm mt-2" style={{ color: colors.text.muted }}>
                            {debito.note}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
                      <p style={{ color: colors.text.secondary }}>Nessun debito trovato</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                      <h4 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Riepilogo Ordini
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Totali:</span>
                          <span style={{ color: colors.text.primary }}>{cliente.stats?.ordiniTotali || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>In corso:</span>
                          <span style={{ color: colors.text.primary }}>{cliente.stats?.ordiniInCorso || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Completati:</span>
                          <span style={{ color: colors.text.primary }}>{cliente.stats?.ordiniCompletati || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.hover }}>
                      <h4 className="text-sm font-medium mb-3" style={{ color: colors.text.secondary }}>
                        Riepilogo Finanziario
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Totale speso:</span>
                          <span style={{ color: colors.text.success }}>{formatCurrency(cliente.stats?.totaleSpeso || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Media ordine:</span>
                          <span style={{ color: colors.text.primary }}>{formatCurrency(cliente.stats?.mediaSpesa || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: colors.text.muted }}>Debiti aperti:</span>
                          <span style={{ color: colors.text.warning }}>{formatCurrency(cliente.stats?.debitoTotale || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {cliente.stats?.contiScalariAperti > 0 && (
                    <div className="p-4 rounded-lg border" style={{ 
                      backgroundColor: colors.bg.hover,
                      borderColor: colors.border.primary 
                    }}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4" style={{ color: colors.text.warning }} />
                        <h4 className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                          Conti Scalari Aperti
                        </h4>
                      </div>
                      <p style={{ color: colors.text.primary }}>
                        Il cliente ha {cliente.stats.contiScalariAperti} {cliente.stats.contiScalariAperti === 1 ? 'conto scalare aperto' : 'conti scalari aperti'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <p style={{ color: colors.text.secondary }}>Cliente non trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}