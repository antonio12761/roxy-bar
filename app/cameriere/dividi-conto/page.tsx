"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { ArrowLeft, Split, Users, Euro, Plus, Minus, Check, X, MapPin, Calculator } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useCameriere } from "@/contexts/cameriere-context";
import { getOrdinazioniDaDividere, dividiConto } from "@/lib/actions/dividi-conto";
import { toast } from "@/lib/toast";
import { useEnhancedSSE } from "@/hooks/useEnhancedSSE";
import { ConnectionStatusIndicator } from "@/components/ConnectionStatusIndicator";

interface RigaOrdine {
  id: string;
  prodotto: { nome: string };
  quantita: number;
  prezzo: number;
  isPagato: boolean;
}

interface Ordinazione {
  id: string;
  tavolo: { numero: string } | null;
  totale: number;
  righe: RigaOrdine[];
  cameriere: { nome: string };
  dataOra: string;
}

interface PersonaSplit {
  id: string;
  nome: string;
  items: Array<{
    rigaId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totale: number;
}

export default function DividiContoPage() {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [ordinazioni, setOrdinazioni] = useState<Ordinazione[]>([]);
  const [persone, setPersone] = useState<PersonaSplit[]>([
    { id: '1', nome: 'Persona 1', items: [], totale: 0 }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [isDividing, setIsDividing] = useState(false);
  const [divisionMode, setDivisionMode] = useState<'manual' | 'equal'>('manual');
  
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode === 'system' ? 'dark' : themeMode];
  const { setIsConnected } = useCameriere();

  // SSE for real-time updates
  const { isConnected, connectionHealth } = useEnhancedSSE({
    clientId: "cameriere-dividi-conto",
    userRole: "CAMERIERE",
    onNotification: (notification) => {
      if (notification.type === "order:updated" || notification.type === "payment_completed") {
        if (selectedTable) {
          loadOrdinazioni(selectedTable);
        }
      }
    }
  });

  useEffect(() => {
    setIsConnected(isConnected);
  }, [isConnected, setIsConnected]);

  useEffect(() => {
    loadAvailableTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadOrdinazioni(selectedTable);
    }
  }, [selectedTable]);

  const loadAvailableTables = async () => {
    try {
      const data = await getOrdinazioniDaDividere();
      const tables = [...new Set(data
        .filter(o => o.tavolo?.numero)
        .map(o => o.tavolo!.numero))];
      setAvailableTables(tables);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast.error("Errore nel caricamento dei tavoli");
    }
  };

  const loadOrdinazioni = async (tableNumber: string) => {
    setIsLoading(true);
    try {
      const data = await getOrdinazioniDaDividere();
      const tableOrders = data.filter(o => o.tavolo?.numero === tableNumber)
        .map(o => ({
          ...o,
          totale: typeof o.totale === 'object' ? (o.totale as any).toNumber() : o.totale
        }));
      setOrdinazioni(tableOrders as Ordinazione[]);
      
      // Reset persone when changing table
      setPersone([{ id: '1', nome: 'Persona 1', items: [], totale: 0 }]);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Errore nel caricamento degli ordini");
    } finally {
      setIsLoading(false);
    }
  };

  const addPersona = () => {
    const newId = (persone.length + 1).toString();
    setPersone([...persone, {
      id: newId,
      nome: `Persona ${persone.length + 1}`,
      items: [],
      totale: 0
    }]);
  };

  const removePersona = (id: string) => {
    if (persone.length <= 1) return;
    
    const personaToRemove = persone.find(p => p.id === id);
    if (personaToRemove && personaToRemove.items.length > 0) {
      toast.error("Rimuovi prima tutti i prodotti assegnati");
      return;
    }
    
    setPersone(persone.filter(p => p.id !== id));
  };

  const updatePersonaName = (id: string, nome: string) => {
    setPersone(persone.map(p => 
      p.id === id ? { ...p, nome } : p
    ));
  };

  const assignItemToPerson = (personaId: string, riga: RigaOrdine, quantity: number = 1) => {
    if (riga.isPagato) return;
    
    // Check if item is already fully assigned
    const totalAssigned = persone.reduce((sum, p) => {
      const item = p.items.find(i => i.rigaId === riga.id);
      return sum + (item?.quantity || 0);
    }, 0);
    
    if (totalAssigned + quantity > riga.quantita) {
      toast.error("Quantità non disponibile");
      return;
    }
    
    setPersone(persone.map(p => {
      if (p.id === personaId) {
        const existingItem = p.items.find(i => i.rigaId === riga.id);
        
        if (existingItem) {
          const newItems = p.items.map(i => 
            i.rigaId === riga.id 
              ? { ...i, quantity: i.quantity + quantity, totalPrice: (i.quantity + quantity) * i.unitPrice }
              : i
          );
          const newTotale = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
          return { ...p, items: newItems, totale: newTotale };
        } else {
          const newItem = {
            rigaId: riga.id,
            productName: riga.prodotto.nome,
            quantity,
            unitPrice: riga.prezzo,
            totalPrice: quantity * riga.prezzo
          };
          const newItems = [...p.items, newItem];
          const newTotale = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
          return { ...p, items: newItems, totale: newTotale };
        }
      }
      return p;
    }));
  };

  const removeItemFromPerson = (personaId: string, rigaId: string) => {
    setPersone(persone.map(p => {
      if (p.id === personaId) {
        const newItems = p.items.filter(i => i.rigaId !== rigaId);
        const newTotale = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
        return { ...p, items: newItems, totale: newTotale };
      }
      return p;
    }));
  };

  const adjustItemQuantity = (personaId: string, rigaId: string, delta: number) => {
    const persona = persone.find(p => p.id === personaId);
    const item = persona?.items.find(i => i.rigaId === rigaId);
    if (!item) return;
    
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      removeItemFromPerson(personaId, rigaId);
      return;
    }
    
    // Check if new quantity is valid
    const riga = ordinazioni.flatMap(o => o.righe).find(r => r.id === rigaId);
    if (!riga) return;
    
    const totalAssigned = persone.reduce((sum, p) => {
      const pItem = p.items.find(i => i.rigaId === rigaId);
      return sum + (pItem?.quantity || 0);
    }, 0) - item.quantity + newQuantity;
    
    if (totalAssigned > riga.quantita) {
      toast.error("Quantità non disponibile");
      return;
    }
    
    setPersone(persone.map(p => {
      if (p.id === personaId) {
        const newItems = p.items.map(i => 
          i.rigaId === rigaId 
            ? { ...i, quantity: newQuantity, totalPrice: newQuantity * i.unitPrice }
            : i
        );
        const newTotale = newItems.reduce((sum, i) => sum + i.totalPrice, 0);
        return { ...p, items: newItems, totale: newTotale };
      }
      return p;
    }));
  };

  const divideEqually = () => {
    if (persone.length === 0) return;
    
    // Reset all assignments
    const resetPersone: PersonaSplit[] = persone.map(p => ({ ...p, items: [], totale: 0 }));
    
    // Get all unpaid items
    const allItems = ordinazioni.flatMap(o => 
      o.righe.filter(r => !r.isPagato)
    );
    
    // Calculate total
    const total = allItems.reduce((sum, item) => sum + (item.quantita * item.prezzo), 0);
    const perPersonTotal = total / persone.length;
    
    // Simple equal division - each person gets the same total amount
    toast.info(`Ogni persona dovrebbe pagare €${perPersonTotal.toFixed(2)}`);
    
    // For UI purposes, assign items sequentially
    let personIndex = 0;
    const updatedPersone: PersonaSplit[] = [...resetPersone];
    
    allItems.forEach(riga => {
      for (let i = 0; i < riga.quantita; i++) {
        const persona = updatedPersone[personIndex % persone.length];
        
        const existingItem = persona.items.find(item => item.rigaId === riga.id);
        if (existingItem) {
          existingItem.quantity++;
          existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
        } else {
          persona.items.push({
            rigaId: riga.id,
            productName: riga.prodotto.nome,
            quantity: 1,
            unitPrice: riga.prezzo,
            totalPrice: riga.prezzo
          });
        }
        
        personIndex++;
      }
    });
    
    // Update totals
    updatedPersone.forEach(p => {
      p.totale = p.items.reduce((sum, i) => sum + i.totalPrice, 0);
    });
    
    setPersone(updatedPersone);
  };

  const handleDividiConto = async () => {
    // Validate that all items are assigned
    const allItems = ordinazioni.flatMap(o => o.righe.filter(r => !r.isPagato));
    const assignedItems = new Map<string, number>();
    
    persone.forEach(p => {
      p.items.forEach(item => {
        assignedItems.set(item.rigaId, (assignedItems.get(item.rigaId) || 0) + item.quantity);
      });
    });
    
    const allAssigned = allItems.every(riga => 
      assignedItems.get(riga.id) === riga.quantita
    );
    
    if (!allAssigned) {
      toast.error("Assegna tutti i prodotti prima di dividere il conto");
      return;
    }
    
    // Validate person names
    if (persone.some(p => !p.nome.trim())) {
      toast.error("Inserisci il nome di tutte le persone");
      return;
    }
    
    setIsDividing(true);
    try {
      const result = await dividiConto(selectedTable, persone);
      
      if (result.success) {
        toast.success("Conto diviso con successo!");
        setSelectedTable("");
        setOrdinazioni([]);
        setPersone([{ id: '1', nome: 'Persona 1', items: [], totale: 0 }]);
        await loadAvailableTables();
      } else {
        toast.error(result.error || "Errore durante la divisione del conto");
      }
    } catch (error) {
      console.error("Error splitting bill:", error);
      toast.error("Errore durante la divisione del conto");
    } finally {
      setIsDividing(false);
    }
  };

  const getUnassignedItems = () => {
    const allItems = ordinazioni.flatMap(o => o.righe.filter(r => !r.isPagato));
    const assignedQuantities = new Map<string, number>();
    
    persone.forEach(p => {
      p.items.forEach(item => {
        assignedQuantities.set(item.rigaId, (assignedQuantities.get(item.rigaId) || 0) + item.quantity);
      });
    });
    
    return allItems.filter(riga => {
      const assigned = assignedQuantities.get(riga.id) || 0;
      return assigned < riga.quantita;
    }).map(riga => ({
      ...riga,
      remainingQuantity: riga.quantita - (assignedQuantities.get(riga.id) || 0)
    }));
  };

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/cameriere" 
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft className="h-6 w-6" style={{ color: colors.text.secondary }} />
            </Link>
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Dividi Conto
            </h1>
          </div>
          <ConnectionStatusIndicator connectionHealth={connectionHealth} />
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Table Selection */}
        {!selectedTable ? (
          <div>
            <h2 className="text-lg font-medium mb-4" style={{ color: colors.text.primary }}>
              Seleziona il tavolo
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {availableTables.map((table) => (
                <button
                  key={table}
                  onClick={() => setSelectedTable(table)}
                  className="p-6 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.bg.card,
                    borderColor: colors.border.primary,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.bg.card;
                  }}
                >
                  <MapPin className="h-8 w-8 mx-auto mb-2" style={{ color: colors.accent }} />
                  <p className="font-medium" style={{ color: colors.text.primary }}>
                    Tavolo {table}
                  </p>
                </button>
              ))}
            </div>
            
            {availableTables.length === 0 && (
              <div className="text-center py-12">
                <Split className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: colors.text.muted }} />
                <p style={{ color: colors.text.muted }}>Nessun tavolo con ordini da dividere</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Unassigned Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Prodotti da assegnare - Tavolo {selectedTable}
                </h2>
                <button
                  onClick={() => setSelectedTable("")}
                  className="text-sm px-3 py-1 rounded-lg"
                  style={{
                    backgroundColor: colors.bg.card,
                    color: colors.text.secondary,
                    border: `1px solid ${colors.border.primary}`
                  }}
                >
                  Cambia tavolo
                </button>
              </div>
              
              {/* Division Mode Toggle */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setDivisionMode('manual')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors`}
                  style={{
                    backgroundColor: divisionMode === 'manual' ? colors.accent : colors.bg.card,
                    color: divisionMode === 'manual' ? colors.button.primaryText : colors.text.secondary,
                    border: `1px solid ${divisionMode === 'manual' ? colors.accent : colors.border.primary}`
                  }}
                >
                  Divisione Manuale
                </button>
                <button
                  onClick={() => {
                    setDivisionMode('equal');
                    divideEqually();
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
                  style={{
                    backgroundColor: divisionMode === 'equal' ? colors.accent : colors.bg.card,
                    color: divisionMode === 'equal' ? colors.button.primaryText : colors.text.secondary,
                    border: `1px solid ${divisionMode === 'equal' ? colors.accent : colors.border.primary}`
                  }}
                >
                  <Calculator className="h-4 w-4" />
                  Dividi Equamente
                </button>
              </div>
              
              {isLoading ? (
                <div className="text-center py-8">
                  <p style={{ color: colors.text.muted }}>Caricamento ordini...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getUnassignedItems().map((riga) => (
                    <div 
                      key={riga.id}
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor: colors.bg.card,
                        borderColor: colors.border.primary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium" style={{ color: colors.text.primary }}>
                            {riga.prodotto.nome}
                          </p>
                          <p className="text-sm" style={{ color: colors.text.muted }}>
                            {riga.remainingQuantity}x disponibili • €{riga.prezzo.toFixed(2)} cad.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {persone.map((persona) => (
                            <button
                              key={persona.id}
                              onClick={() => assignItemToPerson(persona.id, riga, 1)}
                              className="px-3 py-1 text-sm rounded-lg"
                              style={{
                                backgroundColor: colors.accent,
                                color: colors.button.primaryText
                              }}
                              title={`Assegna a ${persona.nome}`}
                            >
                              → {persona.nome.split(' ')[1] || persona.nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {getUnassignedItems().length === 0 && (
                    <div className="text-center py-8">
                      <Check className="h-8 w-8 mx-auto mb-2" style={{ color: colors.text.success }} />
                      <p style={{ color: colors.text.success }}>Tutti i prodotti sono stati assegnati!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Right: People and their assignments */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium" style={{ color: colors.text.primary }}>
                  Persone ({persone.length})
                </h2>
                <button
                  onClick={addPersona}
                  className="flex items-center gap-2 px-3 py-1 rounded-lg"
                  style={{
                    backgroundColor: colors.accent,
                    color: colors.button.primaryText
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi persona
                </button>
              </div>
              
              <div className="space-y-4">
                {persone.map((persona) => (
                  <div 
                    key={persona.id}
                    className="p-4 rounded-lg"
                    style={{
                      backgroundColor: colors.bg.card,
                      borderColor: colors.border.primary,
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        value={persona.nome}
                        onChange={(e) => updatePersonaName(persona.id, e.target.value)}
                        className="font-medium bg-transparent border-b px-1 focus:outline-none"
                        style={{
                          color: colors.text.primary,
                          borderColor: colors.border.secondary
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: colors.accent }}>
                          €{persona.totale.toFixed(2)}
                        </span>
                        {persone.length > 1 && (
                          <button
                            onClick={() => removePersona(persona.id)}
                            className="p-1 rounded hover:bg-opacity-80"
                            style={{ backgroundColor: colors.bg.hover }}
                          >
                            <X className="h-4 w-4" style={{ color: colors.text.error }} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {persona.items.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: colors.text.muted }}>
                        Nessun prodotto assegnato
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {persona.items.map((item) => (
                          <div 
                            key={item.rigaId}
                            className="flex items-center justify-between p-2 rounded"
                            style={{ backgroundColor: colors.bg.darker }}
                          >
                            <div className="flex-1">
                              <p className="text-sm" style={{ color: colors.text.primary }}>
                                {item.productName}
                              </p>
                              <p className="text-xs" style={{ color: colors.text.muted }}>
                                €{item.unitPrice.toFixed(2)} × {item.quantity} = €{item.totalPrice.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => adjustItemQuantity(persona.id, item.rigaId, -1)}
                                className="p-1 rounded"
                                style={{ backgroundColor: colors.bg.hover }}
                              >
                                <Minus className="h-3 w-3" style={{ color: colors.text.secondary }} />
                              </button>
                              <span className="w-8 text-center text-sm" style={{ color: colors.text.primary }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => adjustItemQuantity(persona.id, item.rigaId, 1)}
                                className="p-1 rounded"
                                style={{ backgroundColor: colors.bg.hover }}
                              >
                                <Plus className="h-3 w-3" style={{ color: colors.text.secondary }} />
                              </button>
                              <button
                                onClick={() => removeItemFromPerson(persona.id, item.rigaId)}
                                className="p-1 rounded ml-2"
                                style={{ backgroundColor: colors.bg.hover }}
                              >
                                <X className="h-3 w-3" style={{ color: colors.text.error }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Summary */}
              <div className="mt-6 p-4 rounded-lg" style={{
                backgroundColor: colors.bg.darker,
                borderColor: colors.border.secondary,
                borderWidth: '1px',
                borderStyle: 'solid'
              }}>
                <div className="flex justify-between items-center">
                  <span className="font-medium" style={{ color: colors.text.primary }}>
                    Totale conto
                  </span>
                  <span className="text-xl font-bold" style={{ color: colors.accent }}>
                    €{persone.reduce((sum, p) => sum + p.totale, 0).toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Action Button */}
              <button
                onClick={handleDividiConto}
                disabled={getUnassignedItems().length > 0 || isDividing}
                className="w-full mt-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: colors.accent,
                  color: colors.button.primaryText
                }}
              >
                {isDividing ? (
                  <>
                    <Split className="h-5 w-5 animate-pulse" />
                    Divisione in corso...
                  </>
                ) : (
                  <>
                    <Split className="h-5 w-5" />
                    Conferma divisione conto
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}