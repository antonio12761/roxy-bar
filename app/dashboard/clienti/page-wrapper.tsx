"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Users, Plus, Search, Filter, Download, Upload, 
  TrendingUp, Euro, CreditCard, UserPlus 
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { getClienti, exportClienti } from "@/lib/actions/clienti";
import ClientiTable from "@/components/clienti/ClientiTable";
import ClienteFormModal from "@/components/clienti/ClienteFormModal";
import ClienteDetailModal from "@/components/clienti/ClienteDetailModal";
import { toast } from "sonner";

export default function ClientiPageWrapper() {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  const [clienti, setClienti] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterAttivo, setFilterAttivo] = useState<boolean | undefined>(undefined);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDebiti, setFilterDebiti] = useState(false);
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");

  // Stats
  const [stats, setStats] = useState({
    totaleClienti: 0,
    clientiAttivi: 0,
    totaleDebiti: 0,
    nuoviQuestoMese: 0
  });

  const loadClienti = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = {
        attivo: filterAttivo,
        tags: filterTags.length > 0 ? filterTags : undefined,
        conDebiti: filterDebiti || undefined
      };

      const result = await getClienti(currentPage, 20, searchQuery, filters);
      
      if (result.success && result.data) {
        setClienti(result.data.clienti);
        setPagination(result.data.pagination);
        
        // Calcola statistiche
        const totaleDebiti = result.data.clienti.reduce((sum: number, c: any) => 
          sum + (c.stats?.debitoTotale || 0), 0
        );
        
        setStats({
          totaleClienti: result.data.pagination.total,
          clientiAttivi: result.data.clienti.filter((c: any) => c.attivo).length,
          totaleDebiti,
          nuoviQuestoMese: result.data.clienti.filter((c: any) => {
            const createdDate = new Date(c.createdAt);
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return createdDate > monthAgo;
          }).length
        });
      }
    } catch (error) {
      console.error("Errore caricamento clienti:", error);
      toast.error("Errore nel caricamento dei clienti");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, filterAttivo, filterTags, filterDebiti]);

  useEffect(() => {
    loadClienti();
  }, [loadClienti]);

  const handleEdit = (cliente: any) => {
    setSelectedCliente(cliente);
    setShowFormModal(true);
  };

  const handleView = (cliente: any) => {
    setSelectedClienteId(cliente.id);
    setShowDetailModal(true);
  };

  const handleCreate = () => {
    setSelectedCliente(null);
    setShowFormModal(true);
  };

  const handleExport = async () => {
    try {
      const filters = {
        attivo: filterAttivo,
        tags: filterTags.length > 0 ? filterTags : undefined,
        conDebiti: filterDebiti || undefined
      };

      const result = await exportClienti(filters);
      
      if (result.success && result.data) {
        // Converti in CSV
        const headers = Object.keys(result.data[0] || {});
        const csv = [
          headers.join(','),
          ...result.data.map((row: any) => 
            headers.map(h => `"${row[h] || ''}"`).join(',')
          )
        ].join('\n');

        // Download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `clienti_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        toast.success("Export completato");
      }
    } catch (error) {
      toast.error("Errore nell'export dei clienti");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.dark }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.card }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8" style={{ color: colors.text.accent }} />
                <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                  Gestione Clienti
                </h1>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
                  style={{
                    backgroundColor: colors.bg.hover,
                    color: colors.text.secondary
                  }}
                >
                  <Download className="h-4 w-4" />
                  Esporta
                </button>
                
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity flex items-center gap-2"
                  style={{
                    backgroundColor: colors.button.primary,
                    color: colors.button.primaryText
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nuovo Cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.card }}>
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5" style={{ color: colors.text.accent }} />
              <span className="text-xs" style={{ color: colors.text.muted }}>Totale</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {stats.totaleClienti}
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              Clienti registrati
            </p>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.card }}>
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5" style={{ color: colors.text.success }} />
              <span className="text-xs" style={{ color: colors.text.muted }}>Attivi</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {stats.clientiAttivi}
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              Clienti attivi
            </p>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.card }}>
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="h-5 w-5" style={{ color: colors.text.warning }} />
              <span className="text-xs" style={{ color: colors.text.muted }}>Debiti</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {formatCurrency(stats.totaleDebiti)}
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              Totale da incassare
            </p>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bg.card }}>
            <div className="flex items-center justify-between mb-2">
              <UserPlus className="h-5 w-5" style={{ color: colors.text.accent }} />
              <span className="text-xs" style={{ color: colors.text.muted }}>Nuovi</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: colors.text.primary }}>
              {stats.nuoviQuestoMese}
            </p>
            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
              Questo mese
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="p-4 rounded-lg space-y-4" style={{ backgroundColor: colors.bg.card }}>
          {/* Search */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" 
                style={{ color: colors.text.muted }} 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cerca per nome, telefono, email, CF o P.IVA..."
                className="w-full pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              <select
                value={filterAttivo === undefined ? 'tutti' : filterAttivo ? 'attivi' : 'inattivi'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterAttivo(value === 'tutti' ? undefined : value === 'attivi');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-lg focus:outline-none"
                style={{
                  backgroundColor: colors.bg.input,
                  borderColor: colors.border.primary,
                  color: colors.text.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
              >
                <option value="tutti">Tutti</option>
                <option value="attivi">Solo Attivi</option>
                <option value="inattivi">Solo Inattivi</option>
              </select>

              <button
                onClick={() => {
                  setFilterDebiti(!filterDebiti);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterDebiti ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor: filterDebiti ? colors.button.primary : colors.bg.hover,
                  color: filterDebiti ? colors.button.primaryText : colors.text.secondary,
                  outline: filterDebiti ? `2px solid ${colors.button.primary}` : undefined
                }}
              >
                Con Debiti
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {(searchQuery || filterAttivo !== undefined || filterDebiti || filterTags.length > 0) && (
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: colors.text.secondary }}>Filtri attivi:</span>
              <div className="flex flex-wrap gap-2">
                {searchQuery && (
                  <span className="px-2 py-1 rounded-full text-xs flex items-center gap-1" 
                    style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                    Ricerca: {searchQuery}
                    <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }}>×</button>
                  </span>
                )}
                {filterAttivo !== undefined && (
                  <span className="px-2 py-1 rounded-full text-xs flex items-center gap-1" 
                    style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                    {filterAttivo ? 'Attivi' : 'Inattivi'}
                    <button onClick={() => { setFilterAttivo(undefined); setCurrentPage(1); }}>×</button>
                  </span>
                )}
                {filterDebiti && (
                  <span className="px-2 py-1 rounded-full text-xs flex items-center gap-1" 
                    style={{ backgroundColor: colors.bg.hover, color: colors.text.secondary }}>
                    Con debiti
                    <button onClick={() => { setFilterDebiti(false); setCurrentPage(1); }}>×</button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-lg" style={{ backgroundColor: colors.bg.card }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                  style={{ borderColor: colors.text.accent }}
                />
                <p style={{ color: colors.text.secondary }}>Caricamento clienti...</p>
              </div>
            </div>
          ) : (
            <ClientiTable
              clienti={clienti}
              pagination={pagination}
              onEdit={handleEdit}
              onView={handleView}
              onPageChange={setCurrentPage}
              onRefresh={loadClienti}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <ClienteFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedCliente(null);
        }}
        onSuccess={loadClienti}
        cliente={selectedCliente}
      />

      {selectedClienteId && (
        <ClienteDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedClienteId("");
          }}
          clienteId={selectedClienteId}
        />
      )}
    </div>
  );
}