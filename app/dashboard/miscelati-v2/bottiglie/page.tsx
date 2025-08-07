'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Save, X, Wine, Droplet } from 'lucide-react';
import { getBottiglie, saveBottiglia, deleteBottiglia, getCategorieIngredienti } from '@/lib/actions/sistema-miscelati-semplificato';
import type { BottigliaData } from '@/lib/actions/sistema-miscelati-semplificato';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/auth-guard';

function BottiglieContent() {
  const [bottiglie, setBottiglie] = useState<any[]>([]);
  const [categorie, setCategorie] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [formData, setFormData] = useState<BottigliaData>({
    categoriaId: '',
    nome: '',
    marca: '',
    descrizione: '',
    gradazioneAlcolica: undefined,
    costoPorzione: 0,
    mlPorzione: 40,
    disponibile: true,
    ordinamento: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [bottiglieRes, categorieRes] = await Promise.all([
      getBottiglie(),
      getCategorieIngredienti()
    ]);
    
    if (bottiglieRes.success) {
      setBottiglie(bottiglieRes.data || []);
    }
    if (categorieRes.success) {
      setCategorie(categorieRes.data || []);
    }
    setLoading(false);
  };

  const handleEdit = (bottiglia: any) => {
    setFormData({
      id: bottiglia.id,
      categoriaId: bottiglia.categoriaId,
      nome: bottiglia.nome,
      marca: bottiglia.marca || '',
      descrizione: bottiglia.descrizione || '',
      gradazioneAlcolica: bottiglia.gradazioneAlcolica,
      costoPorzione: bottiglia.costoPorzione || 0,
      mlPorzione: bottiglia.mlPorzione || 40,
      disponibile: bottiglia.disponibile,
      ordinamento: bottiglia.ordinamento
    });
    setEditingId(bottiglia.id);
    setShowNewForm(true);  // Mostra il form principale per la modifica
  };

  const handleNew = () => {
    setFormData({
      categoriaId: selectedCategoria || categorie[0]?.id || '',
      nome: '',
      marca: '',
      descrizione: '',
      gradazioneAlcolica: undefined,
      costoPorzione: 0,
    mlPorzione: 40,
      disponibile: true,
      ordinamento: 0
    });
    setShowNewForm(true);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.categoriaId) {
      alert('Inserisci nome e categoria');
      return;
    }

    const result = await saveBottiglia(formData);
    if (result.success) {
      loadData();
      setEditingId(null);
      setShowNewForm(false);
      setFormData({
        categoriaId: '',
        nome: '',
        marca: '',
        descrizione: '',
        gradazioneAlcolica: undefined,
        costoPorzione: 0,
    mlPorzione: 40,
        disponibile: true,
        ordinamento: 0
      });
    } else {
      alert(result.error || 'Errore nel salvataggio');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowNewForm(false);
    setFormData({
      categoriaId: '',
      nome: '',
      marca: '',
      descrizione: '',
      gradazioneAlcolica: undefined,
      costoPorzione: 0,
      mlPorzione: 40,
      disponibile: true,
      ordinamento: 0
    });
  };

  const toggleDisponibilita = async (bottiglia: any) => {
    await saveBottiglia({
      id: bottiglia.id,
      categoriaId: bottiglia.categoriaId,
      nome: bottiglia.nome,
      disponibile: !bottiglia.disponibile
    });
    loadData();
  };

  const handleDelete = async (bottiglia: any) => {
    if (!confirm(`Eliminare la bottiglia "${bottiglia.nome}"?`)) {
      return;
    }
    
    const result = await deleteBottiglia(bottiglia.id);
    if (result.success) {
      loadData();
    } else {
      alert(result.error || 'Errore nell\'eliminazione');
    }
  };

  // Filtra bottiglie
  const filteredBottiglie = bottiglie.filter(b => {
    const matchCategoria = !selectedCategoria || b.categoriaId === selectedCategoria;
    const matchSearch = !searchTerm || 
      b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.marca?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategoria && matchSearch;
  });

  // Raggruppa per categoria e ordina
  const bottigliePerCategoria = filteredBottiglie.reduce((acc, bottiglia) => {
    const catKey = `${bottiglia.categoria?.ordinamento || 999}_${bottiglia.categoria?.nome || 'Senza Categoria'}`;
    if (!acc[catKey]) {
      acc[catKey] = {
        nome: bottiglia.categoria?.nome || 'Senza Categoria',
        icona: bottiglia.categoria?.icona || '📦',
        colore: bottiglia.categoria?.colore || '#6B7280',
        tipo: bottiglia.categoria?.tipo || 'ALTRO',
        bottiglie: []
      };
    }
    acc[catKey].bottiglie.push(bottiglia);
    return acc;
  }, {} as Record<string, { nome: string; icona: string; colore: string; tipo: string; bottiglie: any[] }>);

  // Ordina le categorie per ordinamento e le bottiglie all'interno di ogni categoria
  const categorieOrdinate = Object.keys(bottigliePerCategoria)
    .sort((a, b) => {
      const [ordA] = a.split('_').map(Number);
      const [ordB] = b.split('_').map(Number);
      return ordA - ordB;
    })
    .map(key => {
      const categoria = bottigliePerCategoria[key];
      // Ordina le bottiglie per ordinamento e poi per nome
      categoria.bottiglie.sort((a: any, b: any) => {
        if (a.ordinamento !== b.ordinamento) {
          return a.ordinamento - b.ordinamento;
        }
        return a.nome.localeCompare(b.nome);
      });
      return categoria;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl" style={{ color: colors.text.primary }}>Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
          Bottiglie e Ingredienti
        </h1>
        <p className="text-sm sm:text-base" style={{ color: colors.text.secondary }}>
          Gestisci le bottiglie disponibili per ogni categoria
        </p>
      </div>

      {/* Filtri e Ricerca */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" 
              style={{ color: colors.text.muted }} 
            />
            <input
              type="text"
              placeholder="Cerca bottiglia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              style={{ 
                backgroundColor: colors.bg.darker,
                borderColor: colors.border.primary,
                color: colors.text.primary
              }}
            />
          </div>
        </div>
        
        <select
          value={selectedCategoria}
          onChange={(e) => setSelectedCategoria(e.target.value)}
          className="px-4 py-2 border rounded-lg"
          style={{ 
            backgroundColor: colors.bg.darker,
            borderColor: colors.border.primary,
            color: colors.text.primary
          }}
        >
          <option value="">Tutte le categorie</option>
          {categorie.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.icona} {cat.nome}
            </option>
          ))}
        </select>

        <button
          onClick={handleNew}
          className="px-4 py-2 rounded-lg flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ 
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText
          }}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuova Bottiglia</span>
          <span className="sm:hidden">Nuova</span>
        </button>
      </div>

      {/* Form Nuova/Modifica Bottiglia */}
      {showNewForm && (
        <div 
          className="p-4 sm:p-6 rounded-lg shadow-lg mb-4 sm:mb-6 border-2"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.button.primary
          }}
        >
          <h2 className="text-lg sm:text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
            {editingId ? 'Modifica Bottiglia' : 'Nuova Bottiglia'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Categoria *
              </label>
              <select
                value={formData.categoriaId}
                onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
              >
                <option value="">Seleziona categoria</option>
                {categorie.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icona} {cat.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Nome *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Es. Bombay Sapphire"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Marca
              </label>
              <input
                type="text"
                value={formData.marca}
                onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Es. Bombay"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Gradazione (% vol)
              </label>
              <input
                type="number"
                value={formData.gradazioneAlcolica || ''}
                onChange={(e) => setFormData({ ...formData, gradazioneAlcolica: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Es. 47"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Costo per Porzione (€)
              </label>
              <input
                type="number"
                value={formData.costoPorzione}
                onChange={(e) => setFormData({ ...formData, costoPorzione: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="0.00"
                step="0.10"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                ML per Porzione
              </label>
              <input
                type="number"
                value={formData.mlPorzione}
                onChange={(e) => setFormData({ ...formData, mlPorzione: parseInt(e.target.value) || 40 })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="40"
                min="1"
                title="40ml per alcolici, 200ml per mixer, 1 per garnish"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Ordinamento
              </label>
              <input
                type="number"
                value={formData.ordinamento}
                onChange={(e) => setFormData({ ...formData, ordinamento: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                min="0"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Descrizione
              </label>
              <textarea
                value={formData.descrizione}
                onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                rows={2}
                placeholder="Descrizione opzionale..."
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.disponibile}
                  onChange={(e) => setFormData({ ...formData, disponibile: e.target.checked })}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.text.secondary }}>Disponibile</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ 
                backgroundColor: colors.button.success,
                color: 'white'
              }}
            >
              <Save className="w-4 h-4" />
              Salva
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ 
                backgroundColor: colors.bg.hover,
                color: colors.text.primary
              }}
            >
              <X className="w-4 h-4" />
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Lista Bottiglie per Categoria */}
      {categorieOrdinate.map((categoria, catIndex) => (
        <div key={categoria.nome} className="mb-8 sm:mb-10">
          {/* Header della categoria con stile migliorato */}
          <div className="flex items-center gap-3 mb-4 sm:mb-5 pb-2 border-b-2" 
            style={{ borderColor: categoria.colore }}
          >
            <span className="text-2xl sm:text-3xl">{categoria.icona}</span>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: colors.text.primary }}>
                {categoria.nome}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span 
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ 
                    backgroundColor: categoria.colore + '20',
                    color: categoria.colore,
                    border: `1px solid ${categoria.colore}`
                  }}
                >
                  {categoria.tipo}
                </span>
                <span 
                  className="text-xs sm:text-sm"
                  style={{ color: colors.text.muted }}
                >
                  {categoria.bottiglie.length} {categoria.bottiglie.length === 1 ? 'bottiglia' : 'bottiglie'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {categoria.bottiglie.map((bottiglia: any, index: number) => (
              <div
                key={bottiglia.id}
                className={`p-3 sm:p-4 rounded-lg shadow border-2 transition-all duration-300 ${
                  !bottiglia.disponibile ? 'opacity-60' : ''
                }`}
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary
                }}
              >
                {false ? (  // Disabilitiamo il form inline, usiamo sempre il form principale
                  // Form di modifica inline
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      style={{ 
                        backgroundColor: colors.bg.darker,
                        borderColor: colors.border.primary,
                        color: colors.text.primary
                      }}
                      placeholder="Nome"
                    />
                    <input
                      type="text"
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      style={{ 
                        backgroundColor: colors.bg.darker,
                        borderColor: colors.border.primary,
                        color: colors.text.primary
                      }}
                      placeholder="Marca"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.gradazioneAlcolica || ''}
                        onChange={(e) => setFormData({ ...formData, gradazioneAlcolica: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-1/2 px-2 py-1 border rounded text-sm"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          borderColor: colors.border.primary,
                          color: colors.text.primary
                        }}
                        placeholder="°"
                        step="0.1"
                      />
                      <input
                        type="number"
                        value={formData.costoPorzione}
                        onChange={(e) => setFormData({ ...formData, costoPorzione: parseFloat(e.target.value) || 0 })}
                        className="w-1/2 px-2 py-1 border rounded text-sm"
                        style={{ 
                          backgroundColor: colors.bg.darker,
                          borderColor: colors.border.primary,
                          color: colors.text.primary
                        }}
                        placeholder="€"
                        step="0.10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-2 py-1 rounded text-sm transition-opacity hover:opacity-90"
                        style={{ 
                          backgroundColor: colors.button.success,
                          color: 'white'
                        }}
                      >
                        Salva
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-2 py-1 rounded text-sm transition-opacity hover:opacity-90"
                        style={{ 
                          backgroundColor: colors.bg.hover,
                          color: colors.text.primary
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  // Vista normale
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-sm sm:text-base" style={{ color: colors.text.primary }}>
                          {bottiglia.nome}
                        </h3>
                        {bottiglia.marca && (
                          <p className="text-xs sm:text-sm" style={{ color: colors.text.muted }}>
                            {bottiglia.marca}
                          </p>
                        )}
                      </div>
                      {bottiglia.gradazioneAlcolica && (
                        <span 
                          className="text-xs sm:text-sm px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: colors.bg.hover,
                            color: colors.text.secondary
                          }}
                        >
                          {bottiglia.gradazioneAlcolica}°
                        </span>
                      )}
                    </div>
                    
                    {bottiglia.descrizione && (
                      <p className="text-xs mb-2" style={{ color: colors.text.secondary }}>
                        {bottiglia.descrizione}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <div className="flex flex-col items-start gap-1">
                        {bottiglia.costoPorzione > 0 && (
                          <span className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
                            €{bottiglia.costoPorzione.toFixed(2)}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          {bottiglia.mlPorzione && (
                            <span className="text-xs" style={{ color: colors.text.muted }}>
                              {bottiglia.mlPorzione}ml
                            </span>
                          )}
                          {bottiglia.ordinamento > 0 && (
                            <span className="text-xs px-1 rounded" 
                              style={{ 
                                backgroundColor: colors.bg.hover,
                                color: colors.text.muted 
                              }}
                              title="Posizione ordinamento"
                            >
                              #{bottiglia.ordinamento}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleDisponibilita(bottiglia)}
                          className="p-1 rounded transition-colors"
                          style={{ 
                            color: bottiglia.disponibile ? colors.text.success : colors.text.error
                          }}
                          title={bottiglia.disponibile ? 'Disponibile' : 'Non disponibile'}
                        >
                          {bottiglia.disponibile ? '✓' : '✗'}
                        </button>
                        <button
                          onClick={() => handleEdit(bottiglia)}
                          className="p-1 rounded transition-colors"
                          style={{ 
                            color: colors.button.primary
                          }}
                          title="Modifica"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bottiglia)}
                          className="p-1 rounded transition-colors"
                          style={{ 
                            color: colors.text.error
                          }}
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Separatore tra categorie */}
          {catIndex < categorieOrdinate.length - 1 && (
            <div className="mt-8 sm:mt-10" />
          )}
        </div>
      ))}

      {categorieOrdinate.length === 0 && (
        <div 
          className="text-center py-12 rounded-lg"
          style={{ backgroundColor: colors.bg.hover }}
        >
          <Wine className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" 
            style={{ color: colors.text.muted }} 
          />
          <p className="mb-4" style={{ color: colors.text.muted }}>
            {searchTerm || selectedCategoria
              ? 'Nessuna bottiglia trovata con i filtri selezionati'
              : 'Nessuna bottiglia configurata'}
          </p>
          {!searchTerm && !selectedCategoria && (
            <button
              onClick={handleNew}
              className="px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-opacity hover:opacity-90"
              style={{ 
                backgroundColor: colors.button.primary,
                color: colors.button.primaryText
              }}
            >
              <Plus className="w-5 h-5" />
              Aggiungi la prima bottiglia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BottigliePage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISORE']}>
      <BottiglieContent />
    </AuthGuard>
  );
}