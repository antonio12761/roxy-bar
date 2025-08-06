"use client";

import { useState } from "react";
import { 
  User, Phone, Mail, Calendar, Euro, ShoppingBag, 
  AlertCircle, Edit, Trash2, Eye, MoreVertical,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { deleteCliente } from "@/lib/actions/clienti";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nome: string;
  cognome?: string | null;
  telefono?: string | null;
  email?: string | null;
  codiceFiscale?: string | null;
  partitaIva?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  dataNascita?: Date | null;
  tags?: string[];
  note?: string | null;
  attivo: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    ordiniTotali: number;
    debitiAperti: number;
    debitoTotale: number;
    totaleSpeso: number;
    mediaSpesa: number;
  };
}

interface ClientiTableProps {
  clienti: Cliente[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onEdit: (cliente: Cliente) => void;
  onView: (cliente: Cliente) => void;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
}

export default function ClientiTable({ 
  clienti, 
  pagination,
  onEdit, 
  onView,
  onPageChange,
  onRefresh 
}: ClientiTableProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleDelete = async (cliente: Cliente) => {
    if (!confirm(`Sei sicuro di voler eliminare il cliente ${cliente.nome} ${cliente.cognome || ''}?`)) {
      return;
    }

    setDeletingId(cliente.id);
    try {
      const result = await deleteCliente(cliente.id);
      if (result.success) {
        toast.success("Cliente eliminato con successo");
        onRefresh?.();
      } else {
        toast.error(result.error || "Errore nell'eliminazione");
      }
    } catch (error) {
      toast.error("Errore nell'eliminazione del cliente");
    } finally {
      setDeletingId(null);
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

  return (
    <div className="w-full">
      {/* Tabella */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: colors.border.primary }}>
        <table className="w-full">
          <thead style={{ backgroundColor: colors.bg.hover }}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.text.secondary }}>
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.text.secondary }}>
                Contatti
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: colors.text.secondary }}>
                Ordini
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: colors.text.secondary }}>
                Totale Speso
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: colors.text.secondary }}>
                Debiti
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: colors.text.secondary }}>
                Tags
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: colors.text.secondary }}>
                Stato
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: colors.text.secondary }}>
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: colors.border.primary }}>
            {clienti.map((cliente) => (
              <tr 
                key={cliente.id}
                className="hover:opacity-90 transition-opacity"
                style={{ backgroundColor: colors.bg.card }}
              >
                {/* Nome Cliente */}
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium" style={{ color: colors.text.primary }}>
                      {cliente.nome} {cliente.cognome}
                    </div>
                    {cliente.codiceFiscale && (
                      <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                        CF: {cliente.codiceFiscale}
                      </div>
                    )}
                    {cliente.partitaIva && (
                      <div className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                        P.IVA: {cliente.partitaIva}
                      </div>
                    )}
                  </div>
                </td>

                {/* Contatti */}
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {cliente.telefono && (
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.secondary }}>
                        <Phone className="h-3 w-3" />
                        {cliente.telefono}
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.secondary }}>
                        <Mail className="h-3 w-3" />
                        {cliente.email}
                      </div>
                    )}
                    {!cliente.telefono && !cliente.email && (
                      <span className="text-sm" style={{ color: colors.text.muted }}>-</span>
                    )}
                  </div>
                </td>

                {/* Ordini */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ShoppingBag className="h-4 w-4" style={{ color: colors.text.accent }} />
                    <span className="font-medium" style={{ color: colors.text.primary }}>
                      {cliente.stats?.ordiniTotali || 0}
                    </span>
                  </div>
                </td>

                {/* Totale Speso */}
                <td className="px-4 py-3 text-right">
                  <div className="font-medium" style={{ color: colors.text.success }}>
                    {formatCurrency(cliente.stats?.totaleSpeso || 0)}
                  </div>
                  {cliente.stats && cliente.stats.ordiniTotali > 0 && (
                    <div className="text-xs" style={{ color: colors.text.muted }}>
                      Media: {formatCurrency(cliente.stats.mediaSpesa)}
                    </div>
                  )}
                </td>

                {/* Debiti */}
                <td className="px-4 py-3 text-right">
                  {cliente.stats && cliente.stats.debitiAperti > 0 ? (
                    <div>
                      <div className="font-medium" style={{ color: colors.text.warning }}>
                        {formatCurrency(cliente.stats.debitoTotale)}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.muted }}>
                        {cliente.stats.debitiAperti} {cliente.stats.debitiAperti === 1 ? 'debito' : 'debiti'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: colors.text.muted }}>-</span>
                  )}
                </td>

                {/* Tags */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {cliente.tags && cliente.tags.length > 0 ? (
                      cliente.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{
                            backgroundColor: colors.bg.hover,
                            color: colors.text.secondary
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm" style={{ color: colors.text.muted }}>-</span>
                    )}
                  </div>
                </td>

                {/* Stato */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      cliente.attivo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {cliente.attivo ? 'Attivo' : 'Inattivo'}
                  </span>
                </td>

                {/* Azioni */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 relative">
                    <button
                      onClick={() => onView(cliente)}
                      className="p-1.5 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: colors.bg.hover }}
                      title="Visualizza dettagli"
                    >
                      <Eye className="h-4 w-4" style={{ color: colors.text.secondary }} />
                    </button>
                    <button
                      onClick={() => onEdit(cliente)}
                      className="p-1.5 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: colors.bg.hover }}
                      title="Modifica"
                    >
                      <Edit className="h-4 w-4" style={{ color: colors.text.accent }} />
                    </button>
                    <button
                      onClick={() => handleDelete(cliente)}
                      disabled={deletingId === cliente.id}
                      className="p-1.5 rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: colors.bg.hover }}
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: colors.text.error }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {clienti.length === 0 && (
          <div className="py-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4" style={{ color: colors.text.muted }} />
            <p style={{ color: colors.text.secondary }}>Nessun cliente trovato</p>
          </div>
        )}
      </div>

      {/* Paginazione */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm" style={{ color: colors.text.secondary }}>
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} di {pagination.total} clienti
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: colors.bg.hover }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: colors.text.secondary }} />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`px-3 py-1 rounded text-sm ${
                      pageNum === pagination.page ? 'font-medium' : ''
                    }`}
                    style={{
                      backgroundColor: pageNum === pagination.page ? colors.button.primary : colors.bg.hover,
                      color: pageNum === pagination.page ? colors.button.primaryText : colors.text.secondary
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded disabled:opacity-50 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: colors.bg.hover }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: colors.text.secondary }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}