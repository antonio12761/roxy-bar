'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Save, X } from 'lucide-react';
import { getCategorieIngredienti, saveCategoriaIngrediente } from '@/lib/actions/sistema-miscelati-semplificato';
import type { CategoriaIngredienteData } from '@/lib/actions/sistema-miscelati-semplificato';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/auth-guard';

const TIPI_CATEGORIA = [
  { value: 'ALCOLICO', label: 'Alcolico', emoji: '🥃' },
  { value: 'MIXER', label: 'Mixer', emoji: '🥤' },
  { value: 'SCIROPPO', label: 'Sciroppo', emoji: '🍯' },
  { value: 'SUCCO', label: 'Succo', emoji: '🧃' },
  { value: 'GARNISH', label: 'Garnish', emoji: '🌿' },
  { value: 'BITTER', label: 'Bitter', emoji: '🍷' },
  { value: 'LIQUORE', label: 'Liquore', emoji: '🍾' },
  { value: 'ALTRO', label: 'Altro', emoji: '📦' }
];

const EMOJI_SUGGESTIONS = ['🍸', '🥃', '🍹', '🍷', '🥂', '🍾', '🧊', '💧', '🌿', '🍋', '🍊', '🥒'];
const COLOR_SUGGESTIONS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

function CategorieIngredientiContent() {
  const [categorie, setCategorie] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const [formData, setFormData] = useState<CategoriaIngredienteData>({
    nome: '',
    descrizione: '',
    tipo: 'ALCOLICO',
    icona: '🍸',
    colore: '#3B82F6',
    ordinamento: 0,
    attivo: true
  });

  useEffect(() => {
    loadCategorie();
  }, []);

  const loadCategorie = async () => {
    setLoading(true);
    const result = await getCategorieIngredienti();
    if (result.success) {
      setCategorie(result.data || []);
    }
    setLoading(false);
  };

  const handleEdit = (categoria: any) => {
    setFormData({
      id: categoria.id,
      nome: categoria.nome,
      descrizione: categoria.descrizione || '',
      tipo: categoria.tipo,
      icona: categoria.icona || '🍸',
      colore: categoria.colore || '#3B82F6',
      ordinamento: categoria.ordinamento,
      attivo: categoria.attivo
    });
    setEditingId(categoria.id);
    setShowNewForm(false);
  };

  const handleNew = () => {
    setFormData({
      nome: '',
      descrizione: '',
      tipo: 'ALCOLICO',
      icona: '🍸',
      colore: '#3B82F6',
      ordinamento: categorie.length,
      attivo: true
    });
    setShowNewForm(true);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.nome) {
      alert('Inserisci il nome della categoria');
      return;
    }

    const result = await saveCategoriaIngrediente(formData);
    if (result.success) {
      loadCategorie();
      setEditingId(null);
      setShowNewForm(false);
      setFormData({
        nome: '',
        descrizione: '',
        tipo: 'ALCOLICO',
        icona: '🍸',
        colore: '#3B82F6',
        ordinamento: 0,
        attivo: true
      });
    } else {
      alert(result.error || 'Errore nel salvataggio');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowNewForm(false);
    setFormData({
      nome: '',
      descrizione: '',
      tipo: 'ALCOLICO',
      icona: '🍸',
      colore: '#3B82F6',
      ordinamento: 0,
      attivo: true
    });
  };

  const moveCategory = async (categoria: any, direction: 'up' | 'down') => {
    const currentIndex = categorie.findIndex(c => c.id === categoria.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= categorie.length) return;
    
    const newCategorie = [...categorie];
    const temp = newCategorie[currentIndex];
    newCategorie[currentIndex] = newCategorie[newIndex];
    newCategorie[newIndex] = temp;
    
    for (let i = 0; i < newCategorie.length; i++) {
      await saveCategoriaIngrediente({
        id: newCategorie[i].id,
        nome: newCategorie[i].nome,
        tipo: newCategorie[i].tipo,
        ordinamento: i
      });
    }
    
    loadCategorie();
  };

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
          Categorie Ingredienti
        </h1>
        <p className="text-sm sm:text-base" style={{ color: colors.text.secondary }}>
          Gestisci le categorie di ingredienti per i miscelati (GIN, RUM, TONICHE, etc.)
        </p>
      </div>

      {/* Pulsante Nuova Categoria */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={handleNew}
          className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300"
          style={{ 
            backgroundColor: colors.button.primary,
            color: colors.button.primaryText
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nuova Categoria</span>
          <span className="sm:hidden">Nuova</span>
        </button>
      </div>

      {/* Form Nuova Categoria */}
      {showNewForm && (
        <div 
          className="p-4 sm:p-6 rounded-lg shadow-lg mb-4 sm:mb-6 border-2"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.button.primary
          }}
        >
          <h2 className="text-lg sm:text-xl font-bold mb-4" style={{ color: colors.text.primary }}>
            Nuova Categoria
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Nome *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.primary,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Es. GIN, VODKA, TONICHE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Tipo
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.primary,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
              >
                {TIPI_CATEGORIA.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.emoji} {tipo.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Descrizione
              </label>
              <input
                type="text"
                value={formData.descrizione}
                onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ 
                  backgroundColor: colors.bg.primary,
                  borderColor: colors.border.primary,
                  color: colors.text.primary
                }}
                placeholder="Es. Selezione di Gin Premium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Icona
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.icona}
                  onChange={(e) => setFormData({ ...formData, icona: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg text-2xl text-center"
                  style={{ 
                    backgroundColor: colors.bg.primary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary
                  }}
                />
                <div className="hidden sm:flex gap-1">
                  {EMOJI_SUGGESTIONS.slice(0, 4).map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setFormData({ ...formData, icona: emoji })}
                      className="w-10 h-10 border rounded hover:opacity-80 text-xl transition-opacity"
                      style={{ 
                        backgroundColor: colors.bg.secondary,
                        borderColor: colors.border.primary
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                Colore
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.colore}
                  onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                  className="w-20 h-10 border rounded-lg cursor-pointer"
                  style={{ borderColor: colors.border.primary }}
                />
                <div className="hidden sm:flex gap-1">
                  {COLOR_SUGGESTIONS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, colore: color })}
                      className="w-10 h-10 rounded border-2 transition-transform hover:scale-110"
                      style={{ 
                        backgroundColor: color,
                        borderColor: colors.border.primary
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.attivo}
                  onChange={(e) => setFormData({ ...formData, attivo: e.target.checked })}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.text.secondary }}>Categoria Attiva</span>
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

      {/* Lista Categorie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorie.map((categoria, index) => (
          <div
            key={categoria.id}
            className={`p-4 rounded-lg shadow-lg border-2 transition-all duration-300`}
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: editingId === categoria.id ? colors.button.primary : colors.border.primary
            }}
          >
            {editingId === categoria.id ? (
              // Form di modifica
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                  style={{ 
                    backgroundColor: colors.bg.primary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary
                  }}
                />
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ 
                    backgroundColor: colors.bg.primary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary
                  }}
                >
                  {TIPI_CATEGORIA.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.emoji} {tipo.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.descrizione}
                  onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ 
                    backgroundColor: colors.bg.primary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary
                  }}
                  placeholder="Descrizione"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.icona}
                    onChange={(e) => setFormData({ ...formData, icona: e.target.value })}
                    className="w-16 px-2 py-1 border rounded text-center text-2xl"
                    style={{ 
                      backgroundColor: colors.bg.primary,
                      borderColor: colors.border.primary,
                      color: colors.text.primary
                    }}
                  />
                  <input
                    type="color"
                    value={formData.colore}
                    onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                    className="w-16 h-8 border rounded cursor-pointer"
                    style={{ borderColor: colors.border.primary }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 rounded flex items-center gap-1 text-sm transition-opacity hover:opacity-90"
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
                    className="px-3 py-1 rounded flex items-center gap-1 text-sm transition-opacity hover:opacity-90"
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
            ) : (
              // Vista normale
              <>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-3xl">{categoria.icona || '📦'}</span>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg" style={{ color: colors.text.primary }}>
                        {categoria.nome}
                      </h3>
                      <span
                        className="text-xs px-2 py-1 rounded-full text-white"
                        style={{ backgroundColor: categoria.colore || '#6B7280' }}
                      >
                        {TIPI_CATEGORIA.find(t => t.value === categoria.tipo)?.label || categoria.tipo}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveCategory(categoria, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded disabled:opacity-50 transition-colors"
                      style={{ 
                        backgroundColor: colors.bg.hover,
                        color: colors.text.primary
                      }}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveCategory(categoria, 'down')}
                      disabled={index === categorie.length - 1}
                      className="p-1 rounded disabled:opacity-50 transition-colors"
                      style={{ 
                        backgroundColor: colors.bg.hover,
                        color: colors.text.primary
                      }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {categoria.descrizione && (
                  <p className="text-xs sm:text-sm mb-2" style={{ color: colors.text.secondary }}>
                    {categoria.descrizione}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t" 
                  style={{ borderColor: colors.border.primary }}
                >
                  <span className="text-xs sm:text-sm" style={{ color: colors.text.muted }}>
                    {categoria._count?.Bottiglie || 0} bottiglie
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(categoria)}
                      className="p-2 rounded transition-colors"
                      style={{ 
                        backgroundColor: colors.bg.hover,
                        color: colors.button.primary
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!categoria.attivo && (
                      <span className="text-xs px-2 py-1" style={{ color: colors.error.main }}>
                        Disattiva
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {categorie.length === 0 && !showNewForm && (
        <div 
          className="text-center py-12 rounded-lg"
          style={{ backgroundColor: colors.bg.secondary }}
        >
          <p className="mb-4" style={{ color: colors.text.muted }}>
            Nessuna categoria configurata
          </p>
          <button
            onClick={handleNew}
            className="px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{ 
              backgroundColor: colors.button.primary,
              color: colors.button.primaryText
            }}
          >
            <Plus className="w-5 h-5" />
            Crea la prima categoria
          </button>
        </div>
      )}
    </div>
  );
}

export default function CategorieIngredientiPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISORE']}>
      <CategorieIngredientiContent />
    </AuthGuard>
  );
}