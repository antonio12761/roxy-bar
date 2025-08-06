'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Wine, Settings, ChevronRight, X, GripVertical } from 'lucide-react';
import { getProdottiMiscelati, saveProdottoMiscelato, deleteProdottoMiscelato } from '@/lib/actions/prodotti-miscelati';
import { getIngredienti } from '@/lib/actions/ingredienti-miscelati';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface GruppoIngredienti {
  id: string;
  nome: string;
  obbligatorio: boolean;
  minimoSelezioni: number;
  massimoSelezioni: number;
  ingredienti: string[];
}

interface ProdottoMiscelato {
  id: string;
  nome: string;
  categoria: string;
  prezzoBase: number;
  descrizione: string;
  attivo: boolean;
  gruppiIngredienti: GruppoIngredienti[];
}

export default function ProdottiMiscelatiPage() {
  const [prodotti, setProdotti] = useState<ProdottoMiscelato[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('tutti');
  const [showModal, setShowModal] = useState(false);
  const [editingProdotto, setEditingProdotto] = useState<ProdottoMiscelato | null>(null);
  const [activeTab, setActiveTab] = useState('info');
  
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'COCKTAIL',
    prezzoBase: '',
    descrizione: '',
    attivo: true
  });
  
  const [gruppiTemp, setGruppiTemp] = useState<GruppoIngredienti[]>([]);
  const [showNewGruppo, setShowNewGruppo] = useState(false);
  const [newGruppo, setNewGruppo] = useState({
    nome: '',
    obbligatorio: true,
    minimoSelezioni: 1,
    massimoSelezioni: 1
  });

  const categorie = [
    { value: 'COCKTAIL', label: 'Cocktails' },
    { value: 'LONGDRINK', label: 'Long Drinks' },
    { value: 'SHOTS', label: 'Shots' },
    { value: 'MOCKTAILS', label: 'Mocktails (Analcolici)' },
    { value: 'VINI', label: 'Vini Miscelati' },
    { value: 'ALTRO', label: 'Altro' }
  ];

  const [ingredientiDisponibili, setIngredientiDisponibili] = useState<Record<string, string[]>>({});

  // Carica dati dal database
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Carica prodotti miscelati
    const prodottiResult = await getProdottiMiscelati();
    if (prodottiResult.success && prodottiResult.data) {
      setProdotti(prodottiResult.data);
    }

    // Carica ingredienti disponibili
    const ingredientiResult = await getIngredienti();
    if (ingredientiResult.success && ingredientiResult.data) {
      const grouped = ingredientiResult.data.reduce((acc: Record<string, string[]>, ing: any) => {
        const categoria = ing.categoria || 'ALTRO';
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(ing.nome);
        return acc;
      }, {});
      setIngredientiDisponibili(grouped);
    }
  };

  const filteredProdotti = prodotti.filter(prod => {
    const matchSearch = prod.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = selectedCategoria === 'tutti' || prod.categoria === selectedCategoria;
    return matchSearch && matchCategoria;
  });

  const handleSave = async () => {
    const data = {
      id: editingProdotto?.id,
      nome: formData.nome,
      categoria: formData.categoria,
      prezzoBase: parseFloat(formData.prezzoBase),
      descrizione: formData.descrizione,
      attivo: formData.attivo,
      gruppiIngredienti: gruppiTemp
    };

    const result = await saveProdottoMiscelato(data);
    if (result.success) {
      await loadData();
      handleCloseModal();
    } else {
      alert(result.error || 'Errore durante il salvataggio');
    }
  };

  const handleEdit = (prodotto: ProdottoMiscelato) => {
    setEditingProdotto(prodotto);
    setFormData({
      nome: prodotto.nome,
      categoria: prodotto.categoria,
      prezzoBase: prodotto.prezzoBase.toString(),
      descrizione: prodotto.descrizione,
      attivo: prodotto.attivo
    });
    setGruppiTemp([...prodotto.gruppiIngredienti]);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo prodotto miscelato?')) {
      const result = await deleteProdottoMiscelato(id);
      if (result.success) {
        await loadData();
      } else {
        alert(result.error || 'Errore durante l\'eliminazione');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProdotto(null);
    setFormData({
      nome: '',
      categoria: 'COCKTAIL',
      prezzoBase: '',
      descrizione: '',
      attivo: true
    });
    setGruppiTemp([]);
    setActiveTab('info');
  };

  const handleAddGruppo = () => {
    const gruppo: GruppoIngredienti = {
      id: Date.now().toString(),
      nome: newGruppo.nome,
      obbligatorio: newGruppo.obbligatorio,
      minimoSelezioni: newGruppo.minimoSelezioni,
      massimoSelezioni: newGruppo.massimoSelezioni,
      ingredienti: []
    };
    setGruppiTemp(prev => [...prev, gruppo]);
    setNewGruppo({
      nome: '',
      obbligatorio: true,
      minimoSelezioni: 1,
      massimoSelezioni: 1
    });
    setShowNewGruppo(false);
  };

  const handleDeleteGruppo = (gruppoId: string) => {
    setGruppiTemp(prev => prev.filter(g => g.id !== gruppoId));
  };

  const handleToggleIngredient = (gruppoId: string, ingrediente: string) => {
    setGruppiTemp(prev => prev.map(gruppo => {
      if (gruppo.id === gruppoId) {
        const ingredienti = gruppo.ingredienti.includes(ingrediente)
          ? gruppo.ingredienti.filter(i => i !== ingrediente)
          : [...gruppo.ingredienti, ingrediente];
        return { ...gruppo, ingredienti };
      }
      return gruppo;
    }));
  };

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SUPERVISORE"]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Prodotti Miscelati
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Configura i prodotti con ingredienti personalizzabili
            </p>
            <div className="mt-4">
              <Link href="/dashboard/miscelati/ingredienti">
                <Button variant="outline" size="sm">
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Gestisci Ingredienti Base
                </Button>
              </Link>
            </div>
          </div>

          {/* Filtri e Ricerca */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Cerca prodotto..."
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
              Nuovo Prodotto Miscelato
            </Button>
          </div>

          {/* Lista Prodotti */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProdotti.map(prodotto => (
              <Card key={prodotto.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{prodotto.nome}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {categorie.find(c => c.value === prodotto.categoria)?.label}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      prodotto.attivo 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {prodotto.attivo ? 'Attivo' : 'Inattivo'}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {prodotto.descrizione}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Prezzo base:</span>
                      <span className="font-semibold">€{prodotto.prezzoBase.toFixed(2)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Gruppi configurabili:</span>
                      <div className="mt-1 space-y-1">
                        {prodotto.gruppiIngredienti.map(gruppo => (
                          <div key={gruppo.id} className="flex items-center gap-1">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                              {gruppo.nome}
                            </span>
                            {gruppo.obbligatorio && (
                              <span className="text-xs text-red-500">*</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(prodotto)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configura
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(prodotto.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProdotti.length === 0 && (
            <div className="text-center py-12">
              <Wine className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nessun prodotto miscelato trovato</p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crea il primo prodotto
              </Button>
            </div>
          )}
        </div>

        {/* Modal Configurazione Prodotto */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProdotto ? 'Modifica Prodotto Miscelato' : 'Nuovo Prodotto Miscelato'}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Informazioni Base</TabsTrigger>
                <TabsTrigger value="ingredienti">Configurazione Ingredienti</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome Prodotto</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="es. Gin Tonic Premium"
                  />
                </div>
                
                <div>
                  <Label htmlFor="descrizione">Descrizione</Label>
                  <Input
                    id="descrizione"
                    value={formData.descrizione}
                    onChange={(e) => setFormData(prev => ({ ...prev, descrizione: e.target.value }))}
                    placeholder="Breve descrizione del prodotto"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
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
                  
                  <div>
                    <Label htmlFor="prezzoBase">Prezzo Base (€)</Label>
                    <Input
                      id="prezzoBase"
                      type="number"
                      step="0.50"
                      value={formData.prezzoBase}
                      onChange={(e) => setFormData(prev => ({ ...prev, prezzoBase: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.attivo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, attivo: checked }))}
                  />
                  <Label>Prodotto attivo</Label>
                </div>
              </TabsContent>
              
              <TabsContent value="ingredienti" className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Gruppi di Ingredienti</h3>
                  <Button 
                    size="sm" 
                    onClick={() => setShowNewGruppo(true)}
                    disabled={showNewGruppo}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi Gruppo
                  </Button>
                </div>
                
                {showNewGruppo && (
                  <Card className="p-4 bg-gray-50 dark:bg-gray-800">
                    <div className="space-y-3">
                      <Input
                        placeholder="Nome gruppo (es. Scelta Gin)"
                        value={newGruppo.nome}
                        onChange={(e) => setNewGruppo(prev => ({ ...prev, nome: e.target.value }))}
                      />
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newGruppo.obbligatorio}
                            onCheckedChange={(checked) => setNewGruppo(prev => ({ ...prev, obbligatorio: checked }))}
                          />
                          <Label>Obbligatorio</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Min:</Label>
                          <Input
                            type="number"
                            min="0"
                            max="10"
                            value={newGruppo.minimoSelezioni}
                            onChange={(e) => setNewGruppo(prev => ({ ...prev, minimoSelezioni: parseInt(e.target.value) }))}
                            className="w-16"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Max:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={newGruppo.massimoSelezioni}
                            onChange={(e) => setNewGruppo(prev => ({ ...prev, massimoSelezioni: parseInt(e.target.value) }))}
                            className="w-16"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddGruppo}>
                          Salva Gruppo
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setShowNewGruppo(false);
                            setNewGruppo({
                              nome: '',
                              obbligatorio: true,
                              minimoSelezioni: 1,
                              massimoSelezioni: 1
                            });
                          }}
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
                
                <div className="space-y-3">
                  {gruppiTemp.map((gruppo, index) => (
                    <Card key={gruppo.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <div>
                            <h4 className="font-semibold">{gruppo.nome}</h4>
                            <p className="text-xs text-gray-500">
                              {gruppo.obbligatorio ? 'Obbligatorio' : 'Opzionale'} • 
                              Selezioni: {gruppo.minimoSelezioni}-{gruppo.massimoSelezioni}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteGruppo(gruppo.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Seleziona gli ingredienti disponibili per questo gruppo:
                        </p>
                        {Object.entries(ingredientiDisponibili).map(([categoria, ingredienti]) => (
                          <div key={categoria}>
                            <p className="text-xs font-semibold text-gray-500 mb-1">{categoria}</p>
                            <div className="flex flex-wrap gap-2">
                              {ingredienti.map(ing => (
                                <button
                                  key={ing}
                                  type="button"
                                  onClick={() => handleToggleIngredient(gruppo.id, ing)}
                                  className={`px-2 py-1 text-xs rounded transition-colors ${
                                    gruppo.ingredienti.includes(ing)
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                  }`}
                                >
                                  {ing}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
                
                {gruppiTemp.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nessun gruppo configurato</p>
                    <p className="text-sm mt-1">Aggiungi gruppi per definire le opzioni personalizzabili</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleCloseModal}>
                Annulla
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.nome || !formData.prezzoBase}
              >
                {editingProdotto ? 'Aggiorna' : 'Crea'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}