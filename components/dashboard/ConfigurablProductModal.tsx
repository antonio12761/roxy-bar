'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, GripVertical, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getProdottoConfigurabile,
  upsertProdottoConfigurabile,
  addGruppoIngredienti,
  addIngrediente,
  updateIngrediente,
  deleteIngrediente,
  deleteGruppoIngredienti,
  type ProdottoConfigurabileFull,
  type GruppoIngredientiConfig
} from '@/lib/actions/prodotti-configurabili';

interface ConfigurableProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  prodotto: {
    id: number;
    nome: string;
    prezzo: number;
  };
}

export default function ConfigurableProductModal({ isOpen, onClose, prodotto }: ConfigurableProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [configData, setConfigData] = useState<ProdottoConfigurabileFull | null>(null);
  const [isConfigurabile, setIsConfigurabile] = useState(false);
  const [richiedeScelta, setRichiedeScelta] = useState(true);
  const [sceltaMultipla, setSceltaMultipla] = useState(false);
  const [tipo, setTipo] = useState('COCKTAIL');
  
  // Stato per nuovo gruppo
  const [showNewGruppo, setShowNewGruppo] = useState(false);
  const [newGruppoNome, setNewGruppoNome] = useState('');
  const [newGruppoObbligatorio, setNewGruppoObbligatorio] = useState(true);
  const [newGruppoMin, setNewGruppoMin] = useState(1);
  const [newGruppoMax, setNewGruppoMax] = useState(1);
  
  // Stato per nuovo ingrediente
  const [selectedGruppoId, setSelectedGruppoId] = useState<string | null>(null);
  const [showNewIngrediente, setShowNewIngrediente] = useState(false);
  const [newIngredienteNome, setNewIngredienteNome] = useState('');
  const [newIngredientePrezzoExtra, setNewIngredientePrezzoExtra] = useState(0);
  
  // Stato per editing ingrediente
  const [editingIngrediente, setEditingIngrediente] = useState<{id: string; nome: string; prezzoExtra: number} | null>(null);

  useEffect(() => {
    loadConfigData();
  }, [prodotto.id]);

  const loadConfigData = async () => {
    setLoading(true);
    try {
      const data = await getProdottoConfigurabile(prodotto.id);
      if (data) {
        setConfigData(data);
        setIsConfigurabile(true);
        setRichiedeScelta(data.richiedeScelta);
        setSceltaMultipla(data.sceltaMultipla);
        setTipo(data.tipo);
      }
    } catch (error) {
      console.error('Errore caricamento configurazione:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const result = await upsertProdottoConfigurabile(prodotto.id, {
        nome: prodotto.nome,
        tipo,
        richiedeScelta,
        sceltaMultipla
      });
      
      if (result.success) {
        toast.success('Configurazione salvata');
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore nel salvataggio');
      }
    } catch (error) {
      toast.error('Errore nel salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGruppo = async () => {
    if (!newGruppoNome || !configData) return;
    
    setLoading(true);
    try {
      const result = await addGruppoIngredienti(configData.id, {
        nome: newGruppoNome,
        obbligatorio: newGruppoObbligatorio,
        minimoSelezioni: newGruppoMin,
        massimoSelezioni: newGruppoMax,
        ordinamento: configData.gruppiIngredienti.length
      });
      
      if (result.success) {
        toast.success('Gruppo aggiunto');
        setNewGruppoNome('');
        setShowNewGruppo(false);
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore');
      }
    } catch (error) {
      toast.error('Errore aggiunta gruppo');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngrediente = async () => {
    if (!newIngredienteNome || !selectedGruppoId) return;
    
    setLoading(true);
    try {
      const result = await addIngrediente(selectedGruppoId, {
        nome: newIngredienteNome,
        prezzoExtra: newIngredientePrezzoExtra,
        ordinamento: 0
      });
      
      if (result.success) {
        toast.success('Ingrediente aggiunto');
        setNewIngredienteNome('');
        setNewIngredientePrezzoExtra(0);
        setShowNewIngrediente(false);
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore');
      }
    } catch (error) {
      toast.error('Errore aggiunta ingrediente');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateIngrediente = async () => {
    if (!editingIngrediente) return;
    
    setLoading(true);
    try {
      const result = await updateIngrediente(editingIngrediente.id, {
        nome: editingIngrediente.nome,
        prezzoExtra: editingIngrediente.prezzoExtra
      });
      
      if (result.success) {
        toast.success('Ingrediente aggiornato');
        setEditingIngrediente(null);
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore');
      }
    } catch (error) {
      toast.error('Errore aggiornamento');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIngrediente = async (ingredienteId: string) => {
    if (!confirm('Eliminare questo ingrediente?')) return;
    
    setLoading(true);
    try {
      const result = await deleteIngrediente(ingredienteId);
      
      if (result.success) {
        toast.success('Ingrediente eliminato');
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore');
      }
    } catch (error) {
      toast.error('Errore eliminazione');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGruppo = async (gruppoId: string) => {
    if (!confirm('Eliminare questo gruppo e tutti i suoi ingredienti?')) return;
    
    setLoading(true);
    try {
      const result = await deleteGruppoIngredienti(gruppoId);
      
      if (result.success) {
        toast.success('Gruppo eliminato');
        await loadConfigData();
      } else {
        toast.error(result.error || 'Errore');
      }
    } catch (error) {
      toast.error('Errore eliminazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurazione Prodotto: {prodotto.nome}</DialogTitle>
          <DialogDescription>
            Gestisci le varianti e gli ingredienti configurabili per questo prodotto
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config">Configurazione Base</TabsTrigger>
            <TabsTrigger value="ingredienti" disabled={!isConfigurabile}>
              Ingredienti e Varianti
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={isConfigurabile}
                onCheckedChange={setIsConfigurabile}
              />
              <Label>Prodotto Configurabile</Label>
            </div>

            {isConfigurabile && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo Prodotto</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COCKTAIL">Cocktail</SelectItem>
                        <SelectItem value="BEVANDA">Bevanda</SelectItem>
                        <SelectItem value="PANINO">Panino</SelectItem>
                        <SelectItem value="ALTRO">Altro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={richiedeScelta}
                        onCheckedChange={setRichiedeScelta}
                      />
                      <Label>Richiede Scelta Obbligatoria</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={sceltaMultipla}
                        onCheckedChange={setSceltaMultipla}
                      />
                      <Label>Permetti Scelte Multiple</Label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveConfig} disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  Salva Configurazione Base
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="ingredienti" className="space-y-4">
            {configData && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Gruppi di Ingredienti</h3>
                  <Button
                    size="sm"
                    onClick={() => setShowNewGruppo(true)}
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Aggiungi Gruppo
                  </Button>
                </div>

                {showNewGruppo && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Nuovo Gruppo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Nome Gruppo (es. "Scelta Gin")</Label>
                        <Input
                          value={newGruppoNome}
                          onChange={(e) => setNewGruppoNome(e.target.value)}
                          placeholder="Nome del gruppo"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={newGruppoObbligatorio}
                          onCheckedChange={setNewGruppoObbligatorio}
                        />
                        <Label>Gruppo Obbligatorio</Label>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Minimo Selezioni</Label>
                          <Input
                            type="number"
                            min="0"
                            value={newGruppoMin}
                            onChange={(e) => setNewGruppoMin(parseInt(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label>Massimo Selezioni</Label>
                          <Input
                            type="number"
                            min="1"
                            value={newGruppoMax}
                            onChange={(e) => setNewGruppoMax(parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={handleAddGruppo} disabled={loading}>
                          Salva Gruppo
                        </Button>
                        <Button variant="outline" onClick={() => setShowNewGruppo(false)}>
                          Annulla
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {configData.gruppiIngredienti.map((gruppo) => (
                    <Card key={gruppo.id}>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base">{gruppo.nome}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {gruppo.obbligatorio ? 'Obbligatorio' : 'Opzionale'} • 
                            Selezioni: {gruppo.minimoSelezioni}-{gruppo.massimoSelezioni}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedGruppoId(gruppo.id);
                              setShowNewIngrediente(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteGruppo(gruppo.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {selectedGruppoId === gruppo.id && showNewIngrediente && (
                          <div className="mb-4 p-4 border rounded space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Nome ingrediente"
                                value={newIngredienteNome}
                                onChange={(e) => setNewIngredienteNome(e.target.value)}
                              />
                              <Input
                                type="number"
                                step="0.50"
                                placeholder="Prezzo extra"
                                value={newIngredientePrezzoExtra}
                                onChange={(e) => setNewIngredientePrezzoExtra(parseFloat(e.target.value))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleAddIngrediente}>
                                Aggiungi
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setShowNewIngrediente(false);
                                  setNewIngredienteNome('');
                                  setNewIngredientePrezzoExtra(0);
                                }}
                              >
                                Annulla
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          {gruppo.ingredienti.map((ing) => (
                            <div key={ing.id} className="flex items-center justify-between p-2 border rounded">
                              {editingIngrediente?.id === ing.id ? (
                                <div className="flex gap-2 flex-1">
                                  <Input
                                    value={editingIngrediente.nome}
                                    onChange={(e) => setEditingIngrediente({
                                      ...editingIngrediente,
                                      nome: e.target.value
                                    })}
                                  />
                                  <Input
                                    type="number"
                                    step="0.50"
                                    value={editingIngrediente.prezzoExtra}
                                    onChange={(e) => setEditingIngrediente({
                                      ...editingIngrediente,
                                      prezzoExtra: parseFloat(e.target.value)
                                    })}
                                    className="w-24"
                                  />
                                  <Button size="sm" onClick={handleUpdateIngrediente}>
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setEditingIngrediente(null)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <span>{ing.nome}</span>
                                    {ing.prezzoExtra > 0 && (
                                      <span className="text-sm text-muted-foreground">
                                        (+€{ing.prezzoExtra.toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingIngrediente({
                                        id: ing.id,
                                        nome: ing.nome,
                                        prezzoExtra: ing.prezzoExtra
                                      })}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteIngrediente(ing.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}