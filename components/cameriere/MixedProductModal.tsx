'use client';

import { useState, useEffect } from 'react';
import { X, Wine, Droplet, Coffee, Check, AlertCircle } from 'lucide-react';
import { getRicettaByProdottoId, getBottigliePerCategoria } from '@/lib/actions/sistema-miscelati-semplificato';

interface MixedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    nome: string;
    prezzo: number;
  };
  onConfirm: (selections: any) => void;
}

interface Componente {
  id: string;
  categoriaId: string;
  obbligatorio: boolean;
  quantitaML?: number;
  maxSelezioni: number;
  categoria: {
    id: string;
    nome: string;
    icona: string;
    colore: string;
    tipo: string;
  };
}

interface Bottiglia {
  id: string;
  nome: string;
  marca?: string | null;
  costoPorzione: number;
  mlPorzione: number;
  disponibile: boolean;
  gradazioneAlcolica?: number | null;
}

export function MixedProductModal({ isOpen, onClose, product, onConfirm }: MixedProductModalProps) {
  // Colori coerenti con la pagina menu
  const colors = {
    primary: '#D97B34',
    secondary: '#FFF5EB',
    text: {
      primary: '#1A1A1A',
      secondary: '#6B6B6B',
      muted: '#9B9B9B',
      error: '#F44336',
      accent: '#D97B34'
    },
    bg: {
      main: '#FAFAF9',
      card: '#FFFFFF',
      hover: '#F5F5F4',
      input: '#FFFFFF'
    },
    border: {
      primary: '#E5E5E5'
    },
    button: {
      primary: '#D97B34',
      primaryText: '#FFFFFF',
      primaryHover: '#B85C1C'
    }
  };
  
  const [loading, setLoading] = useState(true);
  const [ricetta, setRicetta] = useState<any>(null);
  const [bottigliePerCategoria, setBottigliePerCategoria] = useState<Record<string, Bottiglia[]>>({});
  const [selezioni, setSelezioni] = useState<Record<string, string[]>>({});
  const [prezzoTotale, setPrezzoTotale] = useState(product.prezzo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product.id) {
      loadData();
    }
  }, [isOpen, product.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Carica la ricetta
      const ricettaRes = await getRicettaByProdottoId(product.id);
      if (!ricettaRes.success || !ricettaRes.data) {
        setError('Ricetta non trovata');
        setLoading(false);
        return;
      }
      
      setRicetta(ricettaRes.data);
      
      // Carica le bottiglie per ogni categoria richiesta
      const bottiglie: Record<string, Bottiglia[]> = {};
      for (const componente of ricettaRes.data.Componenti) {
        const bottiglieRes = await getBottigliePerCategoria(componente.categoriaId);
        if (bottiglieRes.success) {
          bottiglie[componente.categoriaId] = bottiglieRes.data || [];
        }
      }
      
      setBottigliePerCategoria(bottiglie);
      
      // Inizializza selezioni con le bottiglie base o valori predefiniti
      const selezioniIniziali: Record<string, string[]> = {};
      for (const componente of ricettaRes.data.Componenti) {
        // Prima prova a usare le bottiglie base definite nella ricetta
        if (componente.bottiglieBaseIds && componente.bottiglieBaseIds.length > 0) {
          // Filtra solo le bottiglie base che sono ancora disponibili
          const bottiglieBaseDisponibili = componente.bottiglieBaseIds.filter((id: string) => 
            bottiglie[componente.categoriaId]?.find((b: Bottiglia) => b.id === id && b.disponibile)
          );
          
          if (bottiglieBaseDisponibili.length > 0) {
            selezioniIniziali[componente.categoriaId] = bottiglieBaseDisponibili;
          } else if (componente.obbligatorio && bottiglie[componente.categoriaId]?.length > 0) {
            // Se le bottiglie base non sono disponibili ma il componente è obbligatorio,
            // seleziona la prima disponibile
            const primaDisponibile = bottiglie[componente.categoriaId].find((b: Bottiglia) => b.disponibile);
            if (primaDisponibile) {
              selezioniIniziali[componente.categoriaId] = [primaDisponibile.id];
            }
          }
        } else if (componente.obbligatorio && bottiglie[componente.categoriaId]?.length > 0) {
          // Se non ci sono bottiglie base ma il componente è obbligatorio
          const primaDisponibile = bottiglie[componente.categoriaId].find((b: Bottiglia) => b.disponibile);
          if (primaDisponibile) {
            selezioniIniziali[componente.categoriaId] = [primaDisponibile.id];
          }
        } else {
          selezioniIniziali[componente.categoriaId] = [];
        }
      }
      setSelezioni(selezioniIniziali);
      
    } catch (error) {
      console.error('Errore caricamento dati miscelato:', error);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleSelezione = (categoriaId: string, bottigliaId: string, componente: Componente) => {
    setSelezioni(prev => {
      const selezioniCategoria = prev[categoriaId] || [];
      
      if (componente.maxSelezioni === 1) {
        // Radio: una sola selezione
        return {
          ...prev,
          [categoriaId]: [bottigliaId]
        };
      } else {
        // Checkbox: selezioni multiple
        if (selezioniCategoria.includes(bottigliaId)) {
          return {
            ...prev,
            [categoriaId]: selezioniCategoria.filter((id: string) => id !== bottigliaId)
          };
        } else if (selezioniCategoria.length < componente.maxSelezioni) {
          return {
            ...prev,
            [categoriaId]: [...selezioniCategoria, bottigliaId]
          };
        }
        return prev;
      }
    });
  };

  const calcolaPrezzoTotale = () => {
    // Il prezzo è SEMPRE: costo ingredienti + margine
    let costoIngredienti = 0;
    
    // Calcola il costo degli ingredienti selezionati
    Object.entries(selezioni).forEach(([categoriaId, bottiglieIds]) => {
      bottiglieIds.forEach(bottigliaId => {
        const bottiglia = bottigliePerCategoria[categoriaId]?.find((b: Bottiglia) => b.id === bottigliaId);
        if (bottiglia) {
          const componente = ricetta?.Componenti.find((c: any) => c.categoriaId === categoriaId);
          if (componente?.quantitaML && bottiglia.mlPorzione) {
            const numPorzioni = componente.quantitaML / bottiglia.mlPorzione;
            costoIngredienti += bottiglia.costoPorzione * numPorzioni;
          } else {
            costoIngredienti += bottiglia.costoPorzione;
          }
        }
      });
    });
    
    // Aggiungi il margine (se presente)
    const margine = ricetta?.margineExtra || 0;
    
    return costoIngredienti + margine;
  };

  const isValid = () => {
    if (!ricetta) return false;
    
    // Verifica che tutti i componenti obbligatori abbiano almeno una selezione
    for (const componente of ricetta.Componenti) {
      if (componente.obbligatorio) {
        const selezioniComponente = selezioni[componente.categoriaId] || [];
        if (selezioniComponente.length === 0) {
          return false;
        }
      }
    }
    
    return true;
  };

  const handleConfirm = () => {
    if (!isValid()) {
      setError('Seleziona tutti gli ingredienti obbligatori');
      return;
    }
    
    // Prepara i dati delle selezioni per l'ordine
    const selezioniFinali = Object.entries(selezioni).reduce((acc, [categoriaId, bottiglieIds]) => {
      const componente = ricetta.Componenti.find((c: any) => c.categoriaId === categoriaId);
      const bottiglie = bottiglieIds.map((id: string) => {
        const bottiglia = bottigliePerCategoria[categoriaId]?.find((b: Bottiglia) => b.id === id);
        return {
          bottigliaId: id,
          nome: bottiglia?.nome || '',
          marca: bottiglia?.marca,
          costoCalcolato: bottiglia?.costoPorzione || 0
        };
      });
      
      if (bottiglie.length > 0) {
        acc.push({
          categoriaId,
          categoriaNome: componente?.categoria.nome || '',
          bottiglie
        });
      }
      
      return acc;
    }, [] as any[]);
    
    onConfirm({
      ricettaId: ricetta.id,
      selezioni: selezioniFinali,
      prezzoTotale: calcolaPrezzoTotale()
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ 
        pointerEvents: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
    >
      <div 
        className="absolute inset-0"
        onClick={onClose}
        style={{ 
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
      />
      
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        style={{ 
          backgroundColor: colors.bg.card,
          pointerEvents: 'auto',
          WebkitOverflowScrolling: 'touch',
          cursor: 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between p-4 border-b"
          style={{ 
            backgroundColor: colors.bg.card,
            borderColor: colors.border.primary 
          }}
        >
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
              🍸 Componi {product.nome}
            </h2>
            {ricetta?.descrizione && (
              <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                {ricetta.descrizione}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary 
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-lg" style={{ color: colors.text.secondary }}>
                Caricamento ingredienti...
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" style={{ color: colors.text.error }} />
              <div style={{ color: colors.text.error }}>{error}</div>
            </div>
          ) : ricetta ? (
            <div className="space-y-6">
              {ricetta.Componenti.map((componente: Componente) => {
                const bottiglie = bottigliePerCategoria[componente.categoriaId] || [];
                const selezioniComponente = selezioni[componente.categoriaId] || [];
                
                return (
                  <div key={componente.id}>
                    {/* Categoria Header */}
                    <div 
                      className="flex items-center gap-2 mb-3 pb-2 border-b"
                      style={{ borderColor: componente.categoria.colore }}
                    >
                      <span className="text-2xl">{componente.categoria.icona}</span>
                      <div className="flex-1">
                        <h3 className="font-bold" style={{ color: colors.text.primary }}>
                          {componente.categoria.nome}
                          {componente.obbligatorio && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.secondary }}>
                          {componente.quantitaML && (
                            <span>{componente.quantitaML}ml</span>
                          )}
                          {componente.maxSelezioni > 1 && (
                            <span>Max {componente.maxSelezioni} selezioni</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottiglie Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {bottiglie.map(bottiglia => {
                        const isSelected = selezioniComponente.includes(bottiglia.id);
                        // Per selezione singola (radio), non disabilitare le altre opzioni
                        // Per selezione multipla (checkbox), disabilita solo se hai raggiunto il massimo E non è già selezionata
                        const isDisabled = !bottiglia.disponibile || 
                          (componente.maxSelezioni > 1 && !isSelected && selezioniComponente.length >= componente.maxSelezioni);
                        
                        return (
                          <button
                            key={bottiglia.id}
                            onClick={() => !isDisabled && handleSelezione(componente.categoriaId, bottiglia.id, componente)}
                            disabled={isDisabled}
                            className={`
                              p-3 rounded-lg border-2 transition-all
                              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                            `}
                            style={{
                              backgroundColor: isSelected ? componente.categoria.colore + '20' : colors.bg.hover,
                              borderColor: isSelected ? componente.categoria.colore : colors.border.primary,
                              color: colors.text.primary
                            }}
                          >
                            <div className="text-sm font-medium">{bottiglia.nome}</div>
                            {bottiglia.marca && (
                              <div className="text-xs opacity-75">{bottiglia.marca}</div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs">
                                €{bottiglia.costoPorzione.toFixed(2)}
                              </span>
                              {bottiglia.gradazioneAlcolica && (
                                <span className="text-xs opacity-75">
                                  {bottiglia.gradazioneAlcolica}°
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 mx-auto mt-1" style={{ color: componente.categoria.colore }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && !error && ricetta && (
          <div 
            className="sticky bottom-0 p-4 border-t"
            style={{ 
              backgroundColor: colors.bg.card,
              borderColor: colors.border.primary 
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold" style={{ color: colors.text.primary }}>
                Prezzo Totale:
              </span>
              <span className="text-xl font-bold" style={{ color: colors.text.accent }}>
                €{calcolaPrezzoTotale().toFixed(2)}
              </span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors border hover:bg-gray-50"
                style={{ 
                  borderColor: colors.border.primary,
                  backgroundColor: 'white',
                  color: colors.text.primary 
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirm}
                disabled={!isValid()}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 ${
                  !isValid() ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                }`}
              >
                Conferma Ordine
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}