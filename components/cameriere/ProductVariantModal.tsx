'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check } from 'lucide-react';
import { getProdottoConfigurabile, calcolaPrezzoConfigurazione, type ProdottoConfigurabileFull } from '@/lib/actions/prodotti-configurabili';

interface ProductVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  prodotto: {
    id: number;
    nome: string;
    prezzo: number;
  };
  onConfirm: (configurazione: any, prezzoFinale: number) => void;
}

interface SelectedIngredient {
  gruppoId: string;
  ingredienteId: string;
  nome: string;
  prezzoExtra: number;
}

export default function ProductVariantModal({ isOpen, onClose, prodotto, onConfirm }: ProductVariantModalProps) {
  const [loading, setLoading] = useState(true);
  const [configData, setConfigData] = useState<ProdottoConfigurabileFull | null>(null);
  const [selectedIngredienti, setSelectedIngredienti] = useState<Map<string, SelectedIngredient[]>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [prezzoTotale, setPrezzoTotale] = useState(prodotto.prezzo);

  useEffect(() => {
    if (isOpen) {
      loadConfigData();
    } else {
      // Reset stato quando si chiude
      setSelectedIngredienti(new Map());
      setErrors([]);
      setPrezzoTotale(prodotto.prezzo);
    }
  }, [isOpen, prodotto.id]);

  useEffect(() => {
    // Ricalcola prezzo quando cambiano le selezioni
    calcolaPrezzoTotale();
  }, [selectedIngredienti]);

  const loadConfigData = async () => {
    setLoading(true);
    try {
      const data = await getProdottoConfigurabile(prodotto.id);
      if (data) {
        setConfigData(data);
        // Pre-seleziona ingredienti default se richiesto
        if (data.richiedeScelta) {
          const defaultSelections = new Map<string, SelectedIngredient[]>();
          data.gruppiIngredienti.forEach(gruppo => {
            if (gruppo.obbligatorio && gruppo.minimoSelezioni === 1 && gruppo.ingredienti.length > 0) {
              // Seleziona il primo ingrediente disponibile
              const firstIngredient = gruppo.ingredienti[0];
              defaultSelections.set(gruppo.id, [{
                gruppoId: gruppo.id,
                ingredienteId: firstIngredient.id,
                nome: firstIngredient.nome,
                prezzoExtra: firstIngredient.prezzoExtra
              }]);
            }
          });
          setSelectedIngredienti(defaultSelections);
        }
      }
    } catch (error) {
      console.error('Errore caricamento configurazione:', error);
      setErrors(['Errore nel caricamento della configurazione']);
    } finally {
      setLoading(false);
    }
  };

  const calcolaPrezzoTotale = () => {
    let totale = prodotto.prezzo;
    selectedIngredienti.forEach(ingredients => {
      ingredients.forEach(ing => {
        totale += ing.prezzoExtra;
      });
    });
    setPrezzoTotale(totale);
  };

  const handleIngredientSelect = (gruppo: any, ingrediente: any) => {
    const newSelections = new Map(selectedIngredienti);
    
    if (gruppo.massimoSelezioni === 1) {
      // Radio selection
      newSelections.set(gruppo.id, [{
        gruppoId: gruppo.id,
        ingredienteId: ingrediente.id,
        nome: ingrediente.nome,
        prezzoExtra: ingrediente.prezzoExtra
      }]);
    } else {
      // Checkbox selection
      const currentSelections = newSelections.get(gruppo.id) || [];
      const existingIndex = currentSelections.findIndex(s => s.ingredienteId === ingrediente.id);
      
      if (existingIndex >= 0) {
        // Rimuovi se già selezionato
        currentSelections.splice(existingIndex, 1);
      } else {
        // Aggiungi se non supera il massimo
        if (currentSelections.length < gruppo.massimoSelezioni) {
          currentSelections.push({
            gruppoId: gruppo.id,
            ingredienteId: ingrediente.id,
            nome: ingrediente.nome,
            prezzoExtra: ingrediente.prezzoExtra
          });
        }
      }
      
      if (currentSelections.length > 0) {
        newSelections.set(gruppo.id, currentSelections);
      } else {
        newSelections.delete(gruppo.id);
      }
    }
    
    setSelectedIngredienti(newSelections);
  };

  const validateSelection = (): boolean => {
    if (!configData) return false;
    
    const newErrors: string[] = [];
    
    configData.gruppiIngredienti.forEach(gruppo => {
      const selections = selectedIngredienti.get(gruppo.id) || [];
      
      if (gruppo.obbligatorio && selections.length < gruppo.minimoSelezioni) {
        newErrors.push(`Seleziona almeno ${gruppo.minimoSelezioni} opzione(i) per ${gruppo.nome}`);
      }
      
      if (selections.length > gruppo.massimoSelezioni) {
        newErrors.push(`Puoi selezionare massimo ${gruppo.massimoSelezioni} opzione(i) per ${gruppo.nome}`);
      }
    });
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleConfirm = () => {
    if (!validateSelection()) return;
    
    // Prepara configurazione da salvare
    const configurazione = {
      prodottoId: prodotto.id,
      prodottoNome: prodotto.nome,
      prezzoBase: prodotto.prezzo,
      gruppi: Array.from(selectedIngredienti.entries()).map(([gruppoId, ingredienti]) => ({
        gruppoId,
        ingredienti: ingredienti.map(ing => ({
          id: ing.ingredienteId,
          nome: ing.nome,
          prezzoExtra: ing.prezzoExtra
        }))
      }))
    };
    
    onConfirm(configurazione, prezzoTotale);
    onClose();
  };

  const isIngredientSelected = (gruppoId: string, ingredienteId: string): boolean => {
    const selections = selectedIngredienti.get(gruppoId) || [];
    return selections.some(s => s.ingredienteId === ingredienteId);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caricamento...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (!configData) {
    // Prodotto non configurabile, procedi normalmente
    onConfirm(null, prodotto.prezzo);
    onClose();
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{prodotto.nome}</DialogTitle>
          <DialogDescription>
            Seleziona gli ingredienti per personalizzare il prodotto
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-4">
            {configData.gruppiIngredienti.map((gruppo) => (
              <Card key={gruppo.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{gruppo.nome}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {gruppo.obbligatorio ? 'Obbligatorio' : 'Opzionale'}
                      {gruppo.massimoSelezioni > 1 && ` • Max ${gruppo.massimoSelezioni}`}
                    </span>
                  </CardTitle>
                  {gruppo.descrizione && (
                    <p className="text-sm text-muted-foreground">{gruppo.descrizione}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {gruppo.massimoSelezioni === 1 ? (
                    <RadioGroup
                      value={selectedIngredienti.get(gruppo.id)?.[0]?.ingredienteId || ''}
                      onValueChange={(value) => {
                        const ingrediente = gruppo.ingredienti.find(i => i.id === value);
                        if (ingrediente) {
                          handleIngredientSelect(gruppo, ingrediente);
                        }
                      }}
                    >
                      {gruppo.ingredienti.map((ingrediente) => (
                        <div key={ingrediente.id} className="flex items-center space-x-2 py-1">
                          <RadioGroupItem value={ingrediente.id} id={ingrediente.id} />
                          <Label 
                            htmlFor={ingrediente.id} 
                            className="flex-1 cursor-pointer flex items-center justify-between"
                          >
                            <span>{ingrediente.nome}</span>
                            {ingrediente.prezzoExtra > 0 && (
                              <span className="text-sm text-muted-foreground">
                                +€{ingrediente.prezzoExtra.toFixed(2)}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="space-y-2">
                      {gruppo.ingredienti.map((ingrediente) => (
                        <div key={ingrediente.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={ingrediente.id}
                            checked={isIngredientSelected(gruppo.id, ingrediente.id)}
                            onCheckedChange={(checked) => {
                              if (checked || isIngredientSelected(gruppo.id, ingrediente.id)) {
                                handleIngredientSelect(gruppo, ingrediente);
                              }
                            }}
                            disabled={
                              !isIngredientSelected(gruppo.id, ingrediente.id) &&
                              (selectedIngredienti.get(gruppo.id)?.length || 0) >= gruppo.massimoSelezioni
                            }
                          />
                          <Label 
                            htmlFor={ingrediente.id} 
                            className="flex-1 cursor-pointer flex items-center justify-between"
                          >
                            <span>{ingrediente.nome}</span>
                            {ingrediente.prezzoExtra > 0 && (
                              <span className="text-sm text-muted-foreground">
                                +€{ingrediente.prezzoExtra.toFixed(2)}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="text-lg font-semibold">
            Totale: €{prezzoTotale.toFixed(2)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button onClick={handleConfirm} disabled={errors.length > 0}>
              <Check className="mr-2 h-4 w-4" />
              Conferma
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}