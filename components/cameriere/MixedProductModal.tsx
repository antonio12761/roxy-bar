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
          className="sticky top-0 z-10 flex items-center justify-between p-3 border-b bg-gradient-to-r from-orange-50 via-white to-orange-50"
          style={{ 
            borderColor: colors.border.primary
          }}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg">
              <span className="text-xl">🍸</span>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: colors.primary }}>
                {product.nome}
              </h2>
              {ricetta?.descrizione && (
                <p className="text-xs" style={{ color: colors.text.secondary }}>
                  {ricetta.descrizione}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-all hover:scale-110 active:scale-95"
            style={{ 
              color: colors.text.secondary 
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
            <div className="space-y-4">
              {ricetta.Componenti.map((componente: Componente) => {
                const bottiglie = bottigliePerCategoria[componente.categoriaId] || [];
                const selezioniComponente = selezioni[componente.categoriaId] || [];
                
                return (
                  <div key={componente.id}>
                    {/* Categoria Header */}
                    <div 
                      className="flex items-center gap-2 mb-2 pb-1.5 border-b"
                      style={{ borderColor: colors.border.primary }}
                    >
                      <div className="p-1.5 rounded-md bg-gradient-to-br from-orange-50 to-orange-100">
                        <span className="text-lg">{componente.categoria.icona}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm" style={{ color: colors.text.primary }}>
                            {componente.categoria.nome}
                            {componente.obbligatorio && (
                              <span className="text-orange-500 ml-0.5 text-xs">*</span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2">
                            {componente.quantitaML && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                                {componente.quantitaML}ml
                              </span>
                            )}
                            {componente.maxSelezioni > 1 && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
                                Max {componente.maxSelezioni}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottiglie Grid con Separatori */}
                    <div className="space-y-3">
                      {(() => {
                        // Raggruppa le bottiglie per marca o per disponibilità
                        const disponibili = bottiglie.filter(b => b.disponibile);
                        const nonDisponibili = bottiglie.filter(b => !b.disponibile);
                        
                        // Raggruppa le disponibili per marca
                        const bottigliePerMarca = disponibili.reduce((acc, bottiglia) => {
                          const key = bottiglia.marca || 'Altre';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(bottiglia);
                          return acc;
                        }, {} as Record<string, typeof bottiglie>);
                        
                        // Ordina le marche alfabeticamente
                        const marche = Object.keys(bottigliePerMarca).sort((a, b) => {
                          if (a === 'Altre') return 1;
                          if (b === 'Altre') return -1;
                          return a.localeCompare(b);
                        });
                        
                        return (
                          <>
                            {marche.map((marca, marcaIndex) => (
                              <div key={marca}>
                                {/* Separator con nome marca */}
                                {bottigliePerMarca[marca].length > 0 && (
                                  <>
                                    {marcaIndex > 0 && (
                                      <div className="h-px bg-gray-200 my-2" />
                                    )}
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full">
                                        {marca}
                                      </span>
                                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                                    </div>
                                  </>
                                )}
                                
                                {/* Grid delle bottiglie per questa marca */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {bottigliePerMarca[marca]
                                    .sort((a, b) => {
                                      // Ordina per gradazione alcolica (se presente) poi per nome
                                      if (a.gradazioneAlcolica && b.gradazioneAlcolica) {
                                        return a.gradazioneAlcolica - b.gradazioneAlcolica;
                                      }
                                      return a.nome.localeCompare(b.nome);
                                    })
                                    .map(bottiglia => {
                                      const isSelected = selezioniComponente.includes(bottiglia.id);
                                      const isDisabled = !bottiglia.disponibile || 
                                        (componente.maxSelezioni > 1 && !isSelected && selezioniComponente.length >= componente.maxSelezioni);
                                      
                                      return (
                                        <button
                                          key={bottiglia.id}
                                          onClick={() => !isDisabled && handleSelezione(componente.categoriaId, bottiglia.id, componente)}
                                          disabled={isDisabled}
                                          className={`
                                            relative p-3 rounded-lg border transition-all duration-200
                                            ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:shadow-lg hover:scale-105 active:scale-95'}
                                            ${isSelected ? 'shadow-md transform scale-105' : 'hover:border-orange-300'}
                                          `}
                                          style={{
                                            backgroundColor: isSelected 
                                              ? `linear-gradient(135deg, #FFF5EB 0%, #FFEEDD 100%)` 
                                              : 'white',
                                            borderColor: isSelected ? colors.primary : '#E5E5E5',
                                            borderWidth: isSelected ? '2px' : '1px',
                                            background: isSelected 
                                              ? 'linear-gradient(135deg, #FFF5EB 0%, #FFEEDD 100%)'
                                              : 'white'
                                          }}
                                        >
                                          {/* Selected Badge */}
                                          {isSelected && (
                                            <div className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white rounded-full p-1 shadow-sm z-10">
                                              <Check className="w-3.5 h-3.5" />
                                            </div>
                                          )}
                                          
                                          {/* Content */}
                                          <div className="space-y-1.5">
                                            <div className="text-sm font-bold leading-tight line-clamp-2" style={{ color: colors.text.primary }}>
                                              {bottiglia.nome}
                                            </div>
                                            
                                            {bottiglia.marca && (
                                              <div className="text-xs leading-tight opacity-70" style={{ color: colors.text.secondary }}>
                                                {bottiglia.marca}
                                              </div>
                                            )}
                                            
                                            <div className="pt-1 space-y-0.5">
                                              <div className="text-sm font-bold" style={{ color: isSelected ? colors.primary : '#D97B34' }}>
                                                €{bottiglia.costoPorzione.toFixed(2)}
                                              </div>
                                              
                                              {bottiglia.gradazioneAlcolica && (
                                                <div className="text-xs" style={{ color: colors.text.muted }}>
                                                  {bottiglia.gradazioneAlcolica}°
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                            
                            {/* Sezione prodotti non disponibili */}
                            {nonDisponibili.length > 0 && (
                              <div>
                                {disponibili.length > 0 && (
                                  <>
                                    <div className="h-px bg-gray-200 my-2" />
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                                        NON DISPONIBILI
                                      </span>
                                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                                    </div>
                                  </>
                                )}
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 opacity-50">
                                  {nonDisponibili.map(bottiglia => (
                                    <button
                                      key={bottiglia.id}
                                      disabled
                                      className="relative p-3 rounded-lg border bg-gray-50 cursor-not-allowed"
                                      style={{
                                        borderColor: '#E5E5E5'
                                      }}
                                    >
                                      <div className="space-y-1.5">
                                        <div className="text-sm font-bold leading-tight line-clamp-2 text-gray-400">
                                          {bottiglia.nome}
                                        </div>
                                        
                                        {bottiglia.marca && (
                                          <div className="text-xs leading-tight opacity-70 text-gray-400">
                                            {bottiglia.marca}
                                          </div>
                                        )}
                                        
                                        <div className="pt-1">
                                          <div className="text-sm text-gray-400">
                                            €{bottiglia.costoPorzione.toFixed(2)}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="absolute inset-0 bg-gray-100 bg-opacity-60 rounded-lg flex items-center justify-center">
                                        <span className="text-xs font-bold text-red-600 bg-white px-2 py-1 rounded">
                                          ESAURITO
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
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
            className="sticky bottom-0 p-3 border-t bg-white"
            style={{ 
              borderColor: colors.border.primary
            }}
          >
            <div className="flex items-center justify-between mb-2.5 px-2">
              <span className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                Totale
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold" style={{ color: colors.primary }}>
                  €{calcolaPrezzoTotale().toFixed(2)}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border hover:bg-gray-50 active:scale-95"
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
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-orange-500 to-orange-600 text-white active:scale-95 ${
                  !isValid() ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:from-orange-600 hover:to-orange-700'
                }`}
              >
                Conferma
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}