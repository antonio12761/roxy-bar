"use client";

import { User, ShoppingBag, CreditCard, Calendar, TrendingUp, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface Cliente {
  id: string;
  nome: string;
  telefono?: string;
  email?: string;
  dataCreazione: string;
  ultimaAttivita: string;
  stats: {
    ordiniTotali: number;
    ordiniInCorso: number;
    ordiniCompletati: number;
    totaleSpeso: number;
    mediaSpesa: number;
    debitiTotali: number;
    debitiAperti: number;
    totaleDebiti: number;
    prodottiPreferiti: Array<{
      nome: string;
      quantita: number;
      totale: number;
    }>;
  };
}

interface ClientListProps {
  clienti: Cliente[];
  onClienteClick: (cliente: Cliente) => void;
}

export default function ClientList({ clienti, onClienteClick }: ClientListProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Oggi";
    if (diffDays === 1) return "Ieri";
    if (diffDays < 7) return `${diffDays} giorni fa`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mesi fa`;
    return `${Math.floor(diffDays / 365)} anni fa`;
  };

  const getClientStatus = (cliente: Cliente) => {
    const daysSinceLastActivity = Math.floor(
      (new Date().getTime() - new Date(cliente.ultimaAttivita).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActivity <= 7) return { label: "Attivo", color: colors.text.success };
    if (daysSinceLastActivity <= 30) return { label: "Regolare", color: colors.text.info };
    if (daysSinceLastActivity <= 90) return { label: "Inattivo", color: colors.text.warning };
    return { label: "Dormiente", color: colors.text.muted };
  };

  if (clienti.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
        <p className="text-lg" style={{ color: colors.text.secondary }}>
          Nessun cliente trovato
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clienti.map((cliente) => {
        const status = getClientStatus(cliente);
        const hasDebts = cliente.stats.debitiAperti > 0;

        return (
          <div
            key={cliente.id}
            onClick={() => onClienteClick(cliente)}
            className="rounded-lg p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            style={{
              backgroundColor: colors.bg.card,
              borderColor: hasDebts ? colors.text.warning : colors.border.primary,
              borderWidth: hasDebts ? '2px' : '1px',
              borderStyle: 'solid'
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-full"
                  style={{ backgroundColor: colors.bg.hover }}
                >
                  <User className="h-5 w-5" style={{ color: colors.text.accent }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: colors.text.primary }}>
                    {cliente.nome}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ 
                        backgroundColor: status.color + '20',
                        color: status.color
                      }}
                    >
                      {status.label}
                    </span>
                    {hasDebts && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: colors.text.warning + '20',
                          color: colors.text.warning
                        }}
                      >
                        Debitore
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5" style={{ color: colors.text.muted }} />
            </div>

            {/* Contact Info */}
            {(cliente.telefono || cliente.email) && (
              <div className="mb-3 space-y-1">
                {cliente.telefono && (
                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                    📞 {cliente.telefono}
                  </div>
                )}
                {cliente.email && (
                  <div className="text-sm truncate" style={{ color: colors.text.secondary }}>
                    ✉️ {cliente.email}
                  </div>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" style={{ color: colors.text.muted }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                    {cliente.stats.ordiniTotali}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>
                    Ordini
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: colors.text.success }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                    €{cliente.stats.totaleSpeso.toFixed(2)}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>
                    Speso
                  </div>
                </div>
              </div>

              {cliente.stats.debitiAperti > 0 && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" style={{ color: colors.text.warning }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: colors.text.warning }}>
                      €{cliente.stats.totaleDebiti.toFixed(2)}
                    </div>
                    <div className="text-xs" style={{ color: colors.text.secondary }}>
                      Debiti
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" style={{ color: colors.text.muted }} />
                <div>
                  <div className="text-sm font-semibold" style={{ color: colors.text.primary }}>
                    {formatDate(cliente.ultimaAttivita)}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.secondary }}>
                    Ultima visita
                  </div>
                </div>
              </div>
            </div>

            {/* Prodotti Preferiti */}
            {cliente.stats.prodottiPreferiti.length > 0 && (
              <div 
                className="pt-3 border-t"
                style={{ borderColor: colors.border.secondary }}
              >
                <div className="text-xs font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Preferiti:
                </div>
                <div className="flex flex-wrap gap-1">
                  {cliente.stats.prodottiPreferiti.slice(0, 3).map((prodotto, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: colors.bg.hover,
                        color: colors.text.primary
                      }}
                    >
                      {prodotto.nome} ({prodotto.quantita})
                    </span>
                  ))}
                  {cliente.stats.prodottiPreferiti.length > 3 && (
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: colors.bg.hover,
                        color: colors.text.muted
                      }}
                    >
                      +{cliente.stats.prodottiPreferiti.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div 
              className="mt-3 pt-3 border-t flex items-center justify-between"
              style={{ borderColor: colors.border.secondary }}
            >
              <span className="text-xs" style={{ color: colors.text.muted }}>
                Cliente dal {new Date(cliente.dataCreazione).toLocaleDateString('it-IT')}
              </span>
              {cliente.stats.mediaSpesa > 0 && (
                <span className="text-xs font-medium" style={{ color: colors.text.accent }}>
                  Media: €{cliente.stats.mediaSpesa.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}