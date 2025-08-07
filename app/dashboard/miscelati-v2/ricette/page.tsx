'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Coffee, Wine } from 'lucide-react';
import { 
  getRicetteMiscelate, 
  saveRicettaMiscelata,
  getCategorieIngredienti,
  getBottiglie 
} from '@/lib/actions/sistema-miscelati-semplificato';
import type { RicettaMiscelataData, ComponenteMiscelatoData } from '@/lib/actions/sistema-miscelati-semplificato';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/auth-guard';

const BICCHIERI = [
  'Tumbler Basso', 'Tumbler Alto', 'Collins', 'Highball', 'Martini', 
  'Coupe', 'Flute', 'Balloon', 'Mug', 'Shot'
];

function RicetteContent() {
  const [ricette, setRicette] = useState<any[]>([]);
  const [categorie, setCategorie] = useState<any[]>([]);
  const [bottiglie, setBottiglie] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedRicetta, setExpandedRicetta] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<RicettaMiscelataData>({
    nome: '',
    descrizione: '',
    istruzioni: '',
    bicchiere: 'Tumbler Basso',
    ghiaccio: true,
    componenti: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [ricetteRes, categorieRes, bottiglieRes] = await Promise.all([
      getRicetteMiscelate(),
      getCategorieIngredienti(),
      getBottiglie()
    ]);
    
    if (ricetteRes.success) {
      setRicette(ricetteRes.data || []);
    }
    if (categorieRes.success) {
      setCategorie(categorieRes.data || []);
    }
    if (bottiglieRes.success) {
      setBottiglie(bottiglieRes.data || []);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setFormData({
      nome: '',
      descrizione: '',
      istruzioni: '',
      bicchiere: 'Tumbler Basso',
      ghiaccio: true,
      componenti: []
    });
    setShowNewForm(true);
    setEditingId(null);
  };

  const handleEdit = (ricetta: any) => {
    setFormData({
      id: ricetta.id,
      prodottoId: ricetta.prodottoId,
      nome: ricetta.nome,
      descrizione: ricetta.descrizione || '',
      istruzioni: ricetta.istruzioni || '',
      componenteBaseId: ricetta.componenteBaseId,
      bicchiere: ricetta.bicchiere || 'Tumbler Basso',
      ghiaccio: ricetta.ghiaccio,
      componenti: ricetta.Componenti.map((c: any) => ({
        categoriaId: c.categoriaId,
        obbligatorio: c.obbligatorio,
        quantitaML: c.quantitaML,
        proporzione: c.proporzione,
        note: c.note,
        maxSelezioni: c.maxSelezioni || 1
      }))
    });
    setEditingId(ricetta.id);
    setShowNewForm(false);
  };

  const handleSave = async () => {
    if (!formData.nome) {
      alert('Inserisci il nome della ricetta');
      return;
    }
    if (formData.componenti.length === 0) {
      alert('Aggiungi almeno un componente alla ricetta');
      return;
    }

    const result = await saveRicettaMiscelata(formData);
    if (result.success) {
      loadData();
      setEditingId(null);
      setShowNewForm(false);
    } else {
      alert(result.error || 'Errore nel salvataggio');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowNewForm(false);
  };

  const addComponente = () => {
    setFormData({
      ...formData,
      componenti: [
        ...formData.componenti,
        {
          categoriaId: categorie[0]?.id || '',
          obbligatorio: true,
          quantitaML: undefined,
          proporzione: '',
          note: '',
          maxSelezioni: 1
        }
      ]
    });
  };

  const updateComponente = (index: number, field: keyof ComponenteMiscelatoData, value: any) => {
    const newComponenti = [...formData.componenti];
    newComponenti[index] = { ...newComponenti[index], [field]: value };
    setFormData({ ...formData, componenti: newComponenti });
  };

  const removeComponente = (index: number) => {
    setFormData({
      ...formData,
      componenti: formData.componenti.filter((_, i) => i !== index)
    });
  };

  const moveComponente = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= formData.componenti.length) return;
    
    const newComponenti = [...formData.componenti];
    [newComponenti[index], newComponenti[newIndex]] = [newComponenti[newIndex], newComponenti[index]];
    setFormData({ ...formData, componenti: newComponenti });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Ricette Miscelati</h1>
        <p className="text-gray-600">Configura le ricette dei cocktail e miscelati</p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleNew}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600"
        >
          <Plus className="w-5 h-5" />
          Nuova Ricetta
        </button>
      </div>

      {/* Form Nuova/Modifica Ricetta */}
      {(showNewForm || editingId) && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border-2 border-blue-500">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? 'Modifica Ricetta' : 'Nuova Ricetta'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Nome Cocktail *</label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Es. Gin Tonic Premium"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bicchiere</label>
              <select
                value={formData.bicchiere}
                onChange={(e) => setFormData({ ...formData, bicchiere: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {BICCHIERI.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrizione</label>
              <textarea
                value={formData.descrizione}
                onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
                placeholder="Descrizione del cocktail..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Istruzioni Preparazione</label>
              <textarea
                value={formData.istruzioni}
                onChange={(e) => setFormData({ ...formData, istruzioni: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="1. Riempire il bicchiere di ghiaccio\n2. Versare il gin\n3. Aggiungere la tonica..."
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ghiaccio}
                  onChange={(e) => setFormData({ ...formData, ghiaccio: e.target.checked })}
                  className="w-5 h-5"
                />
                <span>Con ghiaccio</span>
              </label>
            </div>
          </div>

          {/* Componenti Ricetta */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Componenti Ricetta</h3>
              <button
                onClick={addComponente}
                className="bg-green-500 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-green-600"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Componente
              </button>
            </div>
            
            {formData.componenti.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-2">Nessun componente configurato</p>
                <button
                  onClick={addComponente}
                  className="text-blue-600 hover:underline"
                >
                  Aggiungi il primo componente
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.componenti.map((comp, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Categoria</label>
                        <select
                          value={comp.categoriaId}
                          onChange={(e) => updateComponente(index, 'categoriaId', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          {categorie.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icona} {cat.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Quantità (ML)</label>
                        <input
                          type="number"
                          value={comp.quantitaML || ''}
                          onChange={(e) => updateComponente(index, 'quantitaML', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Es. 50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Proporzione</label>
                        <input
                          type="text"
                          value={comp.proporzione || ''}
                          onChange={(e) => updateComponente(index, 'proporzione', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Es. 1 parte"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Max Selezioni</label>
                        <input
                          type="number"
                          value={comp.maxSelezioni}
                          onChange={(e) => updateComponente(index, 'maxSelezioni', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          min="1"
                          max="5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Note</label>
                        <input
                          type="text"
                          value={comp.note || ''}
                          onChange={(e) => updateComponente(index, 'note', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Note..."
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={comp.obbligatorio}
                            onChange={(e) => updateComponente(index, 'obbligatorio', e.target.checked)}
                            className="w-4 h-4"
                          />
                          Obbligatorio
                        </label>
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => moveComponente(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveComponente(index, 'down')}
                            disabled={index === formData.componenti.length - 1}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeComponente(index)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-600"
            >
              <Save className="w-4 h-4" />
              Salva Ricetta
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-600"
            >
              <X className="w-4 h-4" />
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Lista Ricette */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ricette.map(ricetta => (
          <div key={ricetta.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedRicetta(expandedRicetta === ricetta.id ? null : ricetta.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Wine className="w-8 h-8 text-blue-500" />
                  <div>
                    <h3 className="font-bold text-lg">{ricetta.nome}</h3>
                    <p className="text-sm text-gray-600">
                      {ricetta.Componenti.length} componenti • {ricetta.bicchiere}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(ricetta);
                  }}
                  className="p-2 hover:bg-blue-100 rounded text-blue-600"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {expandedRicetta === ricetta.id && (
              <div className="px-4 pb-4 border-t">
                {ricetta.descrizione && (
                  <p className="text-sm text-gray-600 mt-3">{ricetta.descrizione}</p>
                )}
                
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Componenti:</h4>
                  <div className="space-y-2">
                    {ricetta.Componenti.map((comp: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{comp.categoria?.icona}</span>
                          <span className="font-medium">{comp.categoria?.nome}</span>
                          {comp.quantitaML && (
                            <span className="text-sm text-gray-500">({comp.quantitaML}ml)</span>
                          )}
                          {comp.proporzione && (
                            <span className="text-sm text-gray-500">- {comp.proporzione}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {comp.maxSelezioni > 1 && (
                            <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                              Max {comp.maxSelezioni}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${
                            comp.obbligatorio 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-gray-200 text-gray-600'
                          }`}>
                            {comp.obbligatorio ? 'Obbligatorio' : 'Opzionale'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {ricetta.istruzioni && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Preparazione:</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{ricetta.istruzioni}</p>
                  </div>
                )}
                
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                  <span>🥃 {ricetta.bicchiere}</span>
                  {ricetta.ghiaccio && <span>🧊 Con ghiaccio</span>}
                  {ricetta.prodotto && (
                    <span className="ml-auto">
                      €{ricetta.prodotto.prezzo?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {ricette.length === 0 && !showNewForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Coffee className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">Nessuna ricetta configurata</p>
          <button
            onClick={handleNew}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 hover:bg-blue-600"
          >
            <Plus className="w-5 h-5" />
            Crea la prima ricetta
          </button>
        </div>
      )}
    </div>
  );
}

export default function RicetteMiscelatePage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISORE']}>
      <RicetteContent />
    </AuthGuard>
  );
}