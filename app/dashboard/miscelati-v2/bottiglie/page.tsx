'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Search, Save, X, Wine, Droplet } from 'lucide-react';
import { getBottiglie, saveBottiglia, getCategorieIngredienti } from '@/lib/actions/sistema-miscelati-semplificato';
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
    prezzoExtra: 0,
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
      gradazioneAlcolica: bottiglia.gradazioneAlcolica?.toNumber(),
      prezzoExtra: bottiglia.prezzoExtra?.toNumber() || 0,
      disponibile: bottiglia.disponibile,
      ordinamento: bottiglia.ordinamento
    });
    setEditingId(bottiglia.id);
    setShowNewForm(false);
  };

  const handleNew = () => {
    setFormData({
      categoriaId: selectedCategoria || categorie[0]?.id || '',
      nome: '',
      marca: '',
      descrizione: '',
      gradazioneAlcolica: undefined,
      prezzoExtra: 0,
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
        prezzoExtra: 0,
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

  // Filtra bottiglie
  const filteredBottiglie = bottiglie.filter(b => {
    const matchCategoria = !selectedCategoria || b.categoriaId === selectedCategoria;
    const matchSearch = !searchTerm || 
      b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.marca?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategoria && matchSearch;
  });

  // Raggruppa per categoria
  const bottigliePerCategoria = filteredBottiglie.reduce((acc, bottiglia) => {
    const cat = bottiglia.categoria?.nome || 'Senza Categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(bottiglia);
    return acc;
  }, {} as Record<string, any[]>);

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
                backgroundColor: colors.bg.primary,
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
            backgroundColor: colors.bg.primary,
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

      {/* Form Nuova Bottiglia */}
      {showNewForm && (
        <div 
          className="p-4 sm:p-6 rounded-lg shadow-lg mb-4 sm:mb-6 border-2"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.button.primary
          }}
        >
          <h2 className="text-lg sm:text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
            Nuova Bottiglia
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
                  backgroundColor: colors.bg.primary,
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
                  backgroundColor: colors.bg.primary,
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
                  backgroundColor: colors.bg.primary,
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
                  backgroundColor: colors.bg.primary,
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
                Prezzo Extra (€)
              </label>
              <input
                type="number"
                value={formData.prezzoExtra}
                onChange={(e) => setFormData({ ...formData, prezzoExtra: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.primary,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="0.00"
                step="0.50"
                min="0"
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
                  backgroundColor: colors.bg.primary,
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
                  backgroundColor: colors.bg.primary,
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
                backgroundColor: colors.success.main,
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
      {Object.entries(bottigliePerCategoria).map(([categoria, bottiglieCategoria]) => (
        <div key={categoria} className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold" style={{ color: colors.text.primary }}>
              {categoria}
            </h2>
            <span 
              className="px-2 py-1 rounded-full text-xs sm:text-sm"
              style={{ 
                backgroundColor: colors.bg.secondary,
                color: colors.text.secondary
              }}
            >
              {bottiglieCategoria.length} bottiglie
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {bottiglieCategoria.map(bottiglia => (
              <div
                key={bottiglia.id}
                className={`p-3 sm:p-4 rounded-lg shadow border-2 transition-all duration-300 ${
                  !bottiglia.disponibile ? 'opacity-60' : ''
                }`}
                style={{ 
                  backgroundColor: colors.bg.card,
                  borderColor: editingId === bottiglia.id ? colors.button.primary : colors.border.primary
                }}
              >
                {editingId === bottiglia.id ? (
                  // Form di modifica inline
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      style={{ 
                        backgroundColor: colors.bg.primary,
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
                        backgroundColor: colors.bg.primary,
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
                          backgroundColor: colors.bg.primary,
                          borderColor: colors.border.primary,
                          color: colors.text.primary
                        }}
                        placeholder="°"
                        step="0.1"
                      />
                      <input
                        type="number"
                        value={formData.prezzoExtra}
                        onChange={(e) => setFormData({ ...formData, prezzoExtra: parseFloat(e.target.value) || 0 })}
                        className="w-1/2 px-2 py-1 border rounded text-sm"
                        style={{ 
                          backgroundColor: colors.bg.primary,
                          borderColor: colors.border.primary,
                          color: colors.text.primary
                        }}
                        placeholder="€"
                        step="0.50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-2 py-1 rounded text-sm transition-opacity hover:opacity-90"
                        style={{ 
                          backgroundColor: colors.success.main,
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
                            backgroundColor: colors.bg.secondary,
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
                      <div>
                        {bottiglia.prezzoExtra > 0 && (
                          <span className="text-sm font-semibold" style={{ color: colors.success.main }}>
                            +€{bottiglia.prezzoExtra.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleDisponibilita(bottiglia)}
                          className="p-1 rounded transition-colors"
                          style={{ 
                            color: bottiglia.disponibile ? colors.success.main : colors.error.main
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
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(bottigliePerCategoria).length === 0 && (
        <div 
          className="text-center py-12 rounded-lg"
          style={{ backgroundColor: colors.bg.secondary }}
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