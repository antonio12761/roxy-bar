'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Wine, Coffee, Beaker } from 'lucide-react';
import { getIngredienti, createIngrediente, updateIngrediente, deleteIngrediente } from '@/lib/actions/ingredienti-miscelati';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Ingrediente {
  id: string;
  nome: string;
  categoria: string;
  prezzoBase: number;
  unitaMisura: string;
  disponibile: boolean;
}

export default function IngredientiPage() {
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('tutti');
  const [showModal, setShowModal] = useState(false);
  const [editingIngrediente, setEditingIngrediente] = useState<Ingrediente | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'ALCOLICI',
    prezzoBase: '',
    unitaMisura: 'ML',
    disponibile: true
  });

  const categorie = [
    { value: 'ALCOLICI', label: 'Alcolici', icon: Wine },
    { value: 'ANALCOLICI', label: 'Analcolici', icon: Coffee },
    { value: 'MIXER', label: 'Mixer e Toniche', icon: Beaker },
    { value: 'SCIROPPI', label: 'Sciroppi', icon: Beaker },
    { value: 'ALTRO', label: 'Altro', icon: Beaker }
  ];

  const unitaMisura = [
    { value: 'ML', label: 'Millilitri (ml)' },
    { value: 'CL', label: 'Centilitri (cl)' },
    { value: 'PZ', label: 'Pezzi' },
    { value: 'DASH', label: 'Dash' }
  ];

  // Carica ingredienti dal database
  useEffect(() => {
    loadIngredienti();
  }, []);

  const loadIngredienti = async () => {
    const result = await getIngredienti();
    if (result.success && result.data) {
      setIngredienti(result.data);
    }
  };

  const filteredIngredienti = ingredienti.filter(ing => {
    const matchSearch = ing.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = selectedCategoria === 'tutti' || ing.categoria === selectedCategoria;
    return matchSearch && matchCategoria;
  });

  const handleSave = async () => {
    if (editingIngrediente) {
      // Update existing
      const result = await updateIngrediente(editingIngrediente.id, {
        ...formData,
        prezzoBase: parseFloat(formData.prezzoBase)
      });
      if (result.success) {
        await loadIngredienti();
      } else {
        alert(result.error || 'Errore durante l\'aggiornamento');
      }
    } else {
      // Add new
      const result = await createIngrediente({
        ...formData,
        prezzoBase: parseFloat(formData.prezzoBase)
      });
      if (result.success) {
        await loadIngredienti();
      } else {
        alert(result.error || 'Errore durante la creazione');
      }
    }
    handleCloseModal();
  };

  const handleEdit = (ingrediente: Ingrediente) => {
    setEditingIngrediente(ingrediente);
    setFormData({
      nome: ingrediente.nome,
      categoria: ingrediente.categoria,
      prezzoBase: ingrediente.prezzoBase.toString(),
      unitaMisura: ingrediente.unitaMisura,
      disponibile: ingrediente.disponibile
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo ingrediente?')) {
      const result = await deleteIngrediente(id);
      if (result.success) {
        await loadIngredienti();
      } else {
        alert(result.error || 'Errore durante l\'eliminazione');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingIngrediente(null);
    setFormData({
      nome: '',
      categoria: 'ALCOLICI',
      prezzoBase: '',
      unitaMisura: 'ML',
      disponibile: true
    });
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SUPERVISORE"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gestione Ingredienti
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Gestisci gli ingredienti base per i prodotti miscelati
            </p>
          </div>

          {/* Filtri e Ricerca */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Cerca ingrediente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutte le categorie</SelectItem>
                {categorie.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Ingrediente
            </Button>
          </div>

          {/* Statistiche */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {categorie.slice(0, 4).map(cat => {
              const count = ingredienti.filter(ing => ing.categoria === cat.value).length;
              const Icon = cat.icon;
              return (
                <Card key={cat.value}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{cat.label}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                      <Icon className="h-8 w-8 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lista Ingredienti */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIngredienti.map(ingrediente => (
              <Card key={ingrediente.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{ingrediente.nome}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {categorie.find(c => c.value === ingrediente.categoria)?.label}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      ingrediente.disponibile 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {ingrediente.disponibile ? 'Disponibile' : 'Non disponibile'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Prezzo base:</span>
                      <span className="font-semibold">
                        €{ingrediente.prezzoBase.toFixed(2)}/{ingrediente.unitaMisura}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(ingrediente)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(ingrediente.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredIngredienti.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nessun ingrediente trovato</p>
            </div>
          )}
        </div>

        {/* Modal Nuovo/Modifica Ingrediente */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingIngrediente ? 'Modifica Ingrediente' : 'Nuovo Ingrediente'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="es. Bombay Sapphire"
                />
              </div>
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select 
                  value={formData.categoria} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorie.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prezzoBase">Prezzo Base (€)</Label>
                  <Input
                    id="prezzoBase"
                    type="number"
                    step="0.01"
                    value={formData.prezzoBase}
                    onChange={(e) => setFormData(prev => ({ ...prev, prezzoBase: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="unitaMisura">Unità di Misura</Label>
                  <Select 
                    value={formData.unitaMisura} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unitaMisura: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitaMisura.map(um => (
                        <SelectItem key={um.value} value={um.value}>
                          {um.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="disponibile"
                  checked={formData.disponibile}
                  onChange={(e) => setFormData(prev => ({ ...prev, disponibile: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="disponibile">Ingrediente disponibile</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleCloseModal}>
                Annulla
              </Button>
              <Button onClick={handleSave}>
                {editingIngrediente ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}