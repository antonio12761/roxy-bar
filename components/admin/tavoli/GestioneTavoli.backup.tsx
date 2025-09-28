'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Square, Circle, Folder, FolderOpen, Table, ArrowLeft, Home, Utensils, Coffee, Trees, Sun, Moon, Star, Wine, Beer, Martini, Users, Store, Building, Palmtree, Umbrella, Mountain, Waves, Sofa, Music, Cigarette, GlassWater, Soup, Pizza, IceCream, Cake, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getTavoliAdmin, creaTavolo, aggiornaTavolo, eliminaTavolo, aggiornaVisibilitaTavolo } from '@/lib/actions/tavoli';
import { getGruppiTavoli, creaGruppoTavoli, aggiornaGruppoTavoli, eliminaGruppoTavoli, aggiornaVisibilitaGruppo } from '@/lib/actions/gruppi-tavoli';

interface Tavolo {
  id: number;
  numero: string;
  nome?: string;
  zona?: string;
  stato: 'LIBERO' | 'OCCUPATO' | 'RISERVATO' | 'IN_PULIZIA';
  forma: 'QUADRATO' | 'ROTONDO';
  gruppoId?: number;
  posizioneX: number;
  posizioneY: number;
  ordinamento: number;
  visibile?: boolean;
  GruppoTavoli?: GruppoTavoli;
  Ordinazione?: any[];
}

interface GruppoTavoli {
  id: number;
  nome: string;
  descrizione?: string;
  colore?: string;
  icona?: string;
  ordinamento: number;
  visibile?: boolean;
  _count?: {
    Tavolo: number;
  };
  Tavolo?: Tavolo[];
}

// Icon mapping
const iconMap: Record<string, any> = {
  Coffee, Wine, Beer, Martini, GlassWater, 
  Home, Store, Building, Sofa, Music,
  Umbrella, Sun, Trees, Palmtree,
  Utensils, Pizza, Soup, IceCream, Cake,
  Users, Star, Moon, Waves
};

const availableIcons = [
  // Bevande
  { name: 'Coffee', label: 'Caffè' },
  { name: 'Wine', label: 'Vino' },
  { name: 'Beer', label: 'Birra' },
  { name: 'Martini', label: 'Cocktail' },
  { name: 'GlassWater', label: 'Bicchiere' },
  
  // Sale e ambienti
  { name: 'Home', label: 'Sala Interna' },
  { name: 'Store', label: 'Bancone' },
  { name: 'Building', label: 'Veranda' },
  { name: 'Sofa', label: 'Lounge' },
  { name: 'Music', label: 'Area Musica' },
  
  // Esterni
  { name: 'Umbrella', label: 'Dehors' },
  { name: 'Sun', label: 'Terrazza' },
  { name: 'Trees', label: 'Giardino' },
  { name: 'Palmtree', label: 'Area Estiva' },
  
  // Cibo
  { name: 'Utensils', label: 'Ristorante' },
  { name: 'Pizza', label: 'Pizzeria' },
  { name: 'Soup', label: 'Primi' },
  { name: 'IceCream', label: 'Gelateria' },
  { name: 'Cake', label: 'Pasticceria' },
  
  // Altri
  { name: 'Users', label: 'Area Gruppi' },
  { name: 'Star', label: 'VIP' },
  { name: 'Moon', label: 'Serale' },
  { name: 'Waves', label: 'Piscina' }
];

export default function GestioneTavoli() {
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  
  const renderIcon = (iconName: string, color: string) => {
    const Icon = iconMap[iconName] || Coffee;
    return <Icon className="w-6 h-6" style={{ color }} />;
  };
  
  const [gruppi, setGruppi] = useState<GruppoTavoli[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  
  // Dialog states
  const [showTavoloDialog, setShowTavoloDialog] = useState(false);
  const [showGruppoDialog, setShowGruppoDialog] = useState(false);
  const [editingTavolo, setEditingTavolo] = useState<Tavolo | null>(null);
  const [editingGruppo, setEditingGruppo] = useState<GruppoTavoli | null>(null);
  const [selectedGruppoId, setSelectedGruppoId] = useState<number | null>(null);
  
  // Form states
  const [tavoloForm, setTavoloForm] = useState({
    numero: '',
    nome: '',
    zona: '',
    forma: 'QUADRATO' as 'QUADRATO' | 'ROTONDO',
    gruppoId: null as number | null
  });
  
  const [gruppoForm, setGruppoForm] = useState({
    nome: '',
    descrizione: '',
    colore: '#3B82F6',
    icona: 'Coffee'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch gruppi with tavoli using server action
      console.log('Fetching gruppi tavoli...');
      const gruppiResult = await getGruppiTavoli();
      console.log('Risultato gruppi:', gruppiResult);
      
      if (gruppiResult.success && gruppiResult.gruppi) {
        console.log('Gruppi ricevuti:', gruppiResult.gruppi.length);
        setGruppi(gruppiResult.gruppi);
      } else {
        console.error('Errore nel caricamento:', gruppiResult.error);
        toast.error(gruppiResult.error || 'Errore nel caricamento dei dati');
      }
    } catch (error) {
      console.error('Errore nel caricamento:', error);
      toast.error('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTavolo = async () => {
    try {
      const result = await creaTavolo({
        ...tavoloForm,
        gruppoId: selectedGruppoId || undefined
      });
      
      if (result.success) {
        toast.success(result.message || 'Tavolo creato con successo');
        setShowTavoloDialog(false);
        resetTavoloForm();
        fetchData();
      } else {
        toast.error(result.error || 'Errore nella creazione');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleUpdateTavolo = async () => {
    if (!editingTavolo) return;
    
    try {
      const result = await aggiornaTavolo({
        id: editingTavolo.id,
        ...tavoloForm
      });
      
      if (result.success) {
        toast.success(result.message || 'Tavolo aggiornato con successo');
        setShowTavoloDialog(false);
        setEditingTavolo(null);
        resetTavoloForm();
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'aggiornamento');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleDeleteTavolo = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo tavolo?')) return;
    
    try {
      const result = await eliminaTavolo(id);
      
      if (result.success) {
        toast.success(result.message || 'Tavolo eliminato con successo');
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'eliminazione');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleCreateGruppo = async () => {
    try {
      const result = await creaGruppoTavoli(gruppoForm);
      
      if (result.success) {
        toast.success(result.message || 'Gruppo creato con successo');
        setShowGruppoDialog(false);
        resetGruppoForm();
        fetchData();
      } else {
        toast.error(result.error || 'Errore nella creazione');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleUpdateGruppo = async () => {
    if (!editingGruppo) return;
    
    try {
      const result = await aggiornaGruppoTavoli({
        id: editingGruppo.id,
        ...gruppoForm
      });
      
      if (result.success) {
        toast.success(result.message || 'Gruppo aggiornato con successo');
        setShowGruppoDialog(false);
        setEditingGruppo(null);
        resetGruppoForm();
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'aggiornamento');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleDeleteGruppo = async (id: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo gruppo?')) return;
    
    try {
      const result = await eliminaGruppoTavoli(id);
      
      if (result.success) {
        toast.success(result.message || 'Gruppo eliminato con successo');
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'eliminazione');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleToggleVisibilitaGruppo = async (id: number, visibile: boolean) => {
    try {
      const result = await aggiornaVisibilitaGruppo(id, visibile);
      
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'aggiornamento');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const handleToggleVisibilitaTavolo = async (id: number, visibile: boolean) => {
    try {
      const result = await aggiornaVisibilitaTavolo(id, visibile);
      
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.error || 'Errore nell\'aggiornamento');
      }
    } catch (error) {
      toast.error('Errore di connessione');
    }
  };

  const resetTavoloForm = () => {
    setTavoloForm({
      numero: '',
      nome: '',
      zona: '',
      forma: 'QUADRATO',
      gruppoId: null
    });
  };

  const resetGruppoForm = () => {
    setGruppoForm({
      nome: '',
      descrizione: '',
      colore: '#3B82F6',
      icona: 'Folder'
    });
  };
  
  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const openEditTavolo = (tavolo: Tavolo) => {
    setEditingTavolo(tavolo);
    setTavoloForm({
      numero: tavolo.numero,
      nome: tavolo.nome || '',
      zona: tavolo.zona || '',
      forma: tavolo.forma,
      gruppoId: tavolo.gruppoId ?? null
    });
    setShowTavoloDialog(true);
  };

  const openEditGruppo = (gruppo: GruppoTavoli) => {
    setEditingGruppo(gruppo);
    setGruppoForm({
      nome: gruppo.nome,
      descrizione: gruppo.descrizione || '',
      colore: gruppo.colore || '#3B82F6',
      icona: gruppo.icona || 'Folder'
    });
    setShowGruppoDialog(true);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen p-6" style={{ backgroundColor: colors.bg.dark }}>
        <div className="flex justify-center items-center h-64">
          <span style={{ color: colors.text.secondary }}>Caricamento...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.bg.dark }}>
      {/* Header with back button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link 
            href="/dashboard" 
            className="p-2 rounded-lg transition-colors duration-200"
            style={{ 
              backgroundColor: colors.bg.card,
              color: colors.text.primary
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.card}
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
              Gestione Tavoli
            </h1>
            <p style={{ color: colors.text.muted }}>Organizza i tavoli del tuo locale</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div 
        className="rounded-lg p-6" 
        style={{ 
          backgroundColor: colors.bg.card, 
          borderColor: colors.border.primary, 
          borderWidth: '1px', 
          borderStyle: 'solid' 
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold" style={{ color: colors.text.primary }}>
            Gruppi e Tavoli
          </h2>
          <button
            onClick={() => {
              setEditingGruppo(null);
              resetGruppoForm();
              setShowGruppoDialog(true);
            }}
            className="px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            style={{ 
              backgroundColor: colors.button.primary, 
              color: colors.button.primaryText 
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
          >
            <Plus className="w-4 h-4" />
            Nuovo Gruppo
          </button>
        </div>

        {gruppi.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 mx-auto mb-4" style={{ color: colors.text.muted }} />
            <p className="mb-4" style={{ color: colors.text.secondary }}>Nessun gruppo di tavoli creato</p>
            <p className="text-sm" style={{ color: colors.text.muted }}>Inizia creando un gruppo per organizzare i tuoi tavoli</p>
          </div>
        ) : (
          <div className="space-y-6">
            {gruppi.map(gruppo => (
              <div 
                key={gruppo.id} 
                className="rounded-lg p-4"
                style={{ 
                  backgroundColor: colors.bg.darker,
                  borderColor: colors.border.secondary, 
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleGroupCollapse(gruppo.id)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {collapsedGroups.has(gruppo.id) ? (
                        <ChevronRight className="w-5 h-5" style={{ color: colors.text.secondary }} />
                      ) : (
                        <ChevronDown className="w-5 h-5" style={{ color: colors.text.secondary }} />
                      )}
                    </button>
                    {renderIcon(gruppo.icona || 'Folder', gruppo.colore || '#3B82F6')}
                    <div>
                      <h3 className="text-xl font-semibold" style={{ color: colors.text.primary }}>{gruppo.nome}</h3>
                      {gruppo.descrizione && (
                        <p className="text-sm" style={{ color: colors.text.secondary }}>{gruppo.descrizione}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedGruppoId(gruppo.id);
                        setEditingTavolo(null);
                        resetTavoloForm();
                        setShowTavoloDialog(true);
                      }}
                      className="px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-1"
                      style={{ 
                        backgroundColor: 'transparent',
                        color: colors.text.primary,
                        borderColor: colors.border.primary, 
                        borderWidth: '1px', 
                        borderStyle: 'solid' 
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Plus className="w-4 h-4" />
                      Aggiungi Tavolo
                    </button>
                    <button
                      onClick={() => handleToggleVisibilitaGruppo(gruppo.id, !(gruppo.visibile !== false))}
                      className="p-2 rounded-lg transition-colors duration-200"
                      title={gruppo.visibile !== false ? "Nascondi gruppo" : "Mostra gruppo"}
                      style={{ 
                        backgroundColor: 'transparent',
                        color: gruppo.visibile !== false ? colors.text.primary : colors.text.muted
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {gruppo.visibile !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditGruppo(gruppo)}
                      className="p-2 rounded-lg transition-colors duration-200"
                      style={{ 
                        backgroundColor: 'transparent',
                        color: colors.text.primary
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGruppo(gruppo.id)}
                      className="p-2 rounded-lg transition-colors duration-200"
                      style={{ 
                        backgroundColor: 'transparent',
                        color: colors.text.error
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!collapsedGroups.has(gruppo.id) && (
                  gruppo.Tavolo && gruppo.Tavolo.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {gruppo.Tavolo.map(tavolo => (
                        const num = parseInt(t.numero);
                        return num >= 11 && num <= 15;
                      }).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 pl-2" style={{ color: colors.text.secondary }}>
                            Tavoli 11-15
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {gruppo.Tavolo.filter(t => {
                              const num = parseInt(t.numero);
                              return num >= 11 && num <= 15;
                            })
                            .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
                            .map(tavolo => (
                              <div
                                key={tavolo.id}
                                className="rounded-lg p-4 transition-all duration-200 hover:scale-105"
                                style={{ 
                                  backgroundColor: colors.bg.card,
                                  borderColor: colors.border.primary, 
                                  borderWidth: '1px', 
                                  borderStyle: 'solid' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.border.secondary}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border.primary}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    {tavolo.forma === 'ROTONDO' ? (
                                      <Circle className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    ) : (
                                      <Square className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    )}
                                    <h4 className="font-semibold" style={{ color: colors.text.primary }}>Tavolo {tavolo.numero}</h4>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleToggleVisibilitaTavolo(tavolo.id, !(tavolo.visibile !== false))}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      title={tavolo.visibile !== false ? "Nascondi tavolo" : "Mostra tavolo"}
                                      style={{ color: tavolo.visibile !== false ? colors.text.secondary : colors.text.muted }}
                                    >
                                      {tavolo.visibile !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => openEditTavolo(tavolo)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.secondary }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTavolo(tavolo.id)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.error }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                {tavolo.nome && (
                                  <p className="text-sm mb-1" style={{ color: colors.text.secondary }}>{tavolo.nome}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Sottogruppo 21-25 */}
                      {gruppo.Tavolo.filter(t => {
                        const num = parseInt(t.numero);
                        return num >= 21 && num <= 25;
                      }).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 pl-2" style={{ color: colors.text.secondary }}>
                            Tavoli 21-25
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {gruppo.Tavolo.filter(t => {
                              const num = parseInt(t.numero);
                              return num >= 21 && num <= 25;
                            })
                            .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
                            .map(tavolo => (
                              <div
                                key={tavolo.id}
                                className="rounded-lg p-4 transition-all duration-200 hover:scale-105"
                                style={{ 
                                  backgroundColor: colors.bg.card,
                                  borderColor: colors.border.primary, 
                                  borderWidth: '1px', 
                                  borderStyle: 'solid' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.border.secondary}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border.primary}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    {tavolo.forma === 'ROTONDO' ? (
                                      <Circle className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    ) : (
                                      <Square className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    )}
                                    <h4 className="font-semibold" style={{ color: colors.text.primary }}>Tavolo {tavolo.numero}</h4>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleToggleVisibilitaTavolo(tavolo.id, !(tavolo.visibile !== false))}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      title={tavolo.visibile !== false ? "Nascondi tavolo" : "Mostra tavolo"}
                                      style={{ color: tavolo.visibile !== false ? colors.text.secondary : colors.text.muted }}
                                    >
                                      {tavolo.visibile !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => openEditTavolo(tavolo)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.secondary }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTavolo(tavolo.id)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.error }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                {tavolo.nome && (
                                  <p className="text-sm mb-1" style={{ color: colors.text.secondary }}>{tavolo.nome}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Sottogruppo 31-35 */}
                      {gruppo.Tavolo.filter(t => {
                        const num = parseInt(t.numero);
                        return num >= 31 && num <= 35;
                      }).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3 pl-2" style={{ color: colors.text.secondary }}>
                            Tavoli 31-35
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {gruppo.Tavolo.filter(t => {
                              const num = parseInt(t.numero);
                              return num >= 31 && num <= 35;
                            })
                            .sort((a, b) => parseInt(a.numero) - parseInt(b.numero))
                            .map(tavolo => (
                              <div
                                key={tavolo.id}
                                className="rounded-lg p-4 transition-all duration-200 hover:scale-105"
                                style={{ 
                                  backgroundColor: colors.bg.card,
                                  borderColor: colors.border.primary, 
                                  borderWidth: '1px', 
                                  borderStyle: 'solid' 
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.border.secondary}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border.primary}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    {tavolo.forma === 'ROTONDO' ? (
                                      <Circle className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    ) : (
                                      <Square className="w-5 h-5" style={{ color: colors.text.secondary }} />
                                    )}
                                    <h4 className="font-semibold" style={{ color: colors.text.primary }}>Tavolo {tavolo.numero}</h4>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleToggleVisibilitaTavolo(tavolo.id, !(tavolo.visibile !== false))}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      title={tavolo.visibile !== false ? "Nascondi tavolo" : "Mostra tavolo"}
                                      style={{ color: tavolo.visibile !== false ? colors.text.secondary : colors.text.muted }}
                                    >
                                      {tavolo.visibile !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => openEditTavolo(tavolo)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.secondary }}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTavolo(tavolo.id)}
                                      className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                      style={{ color: colors.text.error }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                {tavolo.nome && (
                                  <p className="text-sm mb-1" style={{ color: colors.text.secondary }}>{tavolo.nome}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : gruppo.nome === "Gazebo" ? (
                    // Visualizzazione speciale per Gazebo con sottogruppi mantenuta nella vista cameriere
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {gruppo.Tavolo.map(tavolo => (
                        <div
                          key={tavolo.id}
                          className="rounded-lg p-4 transition-all duration-200 hover:scale-105"
                          style={{ 
                            backgroundColor: colors.bg.card,
                            borderColor: colors.border.primary, 
                            borderWidth: '1px', 
                            borderStyle: 'solid' 
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.border.secondary}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = colors.border.primary}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {tavolo.forma === 'ROTONDO' ? (
                                <Circle className="w-5 h-5" style={{ color: colors.text.secondary }} />
                              ) : (
                                <Square className="w-5 h-5" style={{ color: colors.text.secondary }} />
                              )}
                              <h4 className="font-semibold" style={{ color: colors.text.primary }}>Tavolo {tavolo.numero}</h4>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEditTavolo(tavolo)}
                                className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                style={{ color: colors.text.secondary }}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTavolo(tavolo.id)}
                                className="h-8 w-8 p-0 rounded transition-opacity duration-200 hover:opacity-80"
                                style={{ color: colors.text.error }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {tavolo.nome && (
                            <p className="text-sm mb-1" style={{ color: colors.text.secondary }}>{tavolo.nome}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 rounded-lg" style={{ backgroundColor: colors.bg.dark }}>
                    <Table className="w-12 h-12 mx-auto mb-2" style={{ color: colors.text.muted }} />
                    <p className="text-sm" style={{ color: colors.text.muted }}>Nessun tavolo in questo gruppo</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Tavolo */}
      {showTavoloDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div 
            className="p-6 rounded-lg w-full max-w-md"
            style={{ 
              backgroundColor: colors.bg.card, 
              borderColor: colors.border.primary, 
              borderWidth: '1px', 
              borderStyle: 'solid' 
            }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              {editingTavolo ? 'Modifica Tavolo' : 'Nuovo Tavolo'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="numero" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Numero Tavolo *
                </label>
                <input
                  id="numero"
                  type="text"
                  value={tavoloForm.numero}
                  onChange={(e) => setTavoloForm({ ...tavoloForm, numero: e.target.value })}
                  placeholder="Es: 1, 2A, Bar1"
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="nome" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Nome personalizzato (opzionale)
                </label>
                <input
                  id="nome"
                  type="text"
                  value={tavoloForm.nome}
                  onChange={(e) => setTavoloForm({ ...tavoloForm, nome: e.target.value })}
                  placeholder="Es: Tavolo VIP, Angolo romantico"
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="forma" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Forma
                </label>
                <select
                  id="forma"
                  value={tavoloForm.forma}
                  onChange={(e) => setTavoloForm({ ...tavoloForm, forma: e.target.value as 'QUADRATO' | 'ROTONDO' })}
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid' 
                  }}
                >
                  <option value="QUADRATO">Quadrato</option>
                  <option value="ROTONDO">Rotondo</option>
                </select>
              </div>
              
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowTavoloDialog(false)}
                className="px-4 py-2 rounded-lg transition-colors duration-200"
                style={{ 
                  backgroundColor: 'transparent',
                  color: colors.text.secondary,
                  borderColor: colors.border.primary, 
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Annulla
              </button>
              <button 
                onClick={editingTavolo ? handleUpdateTavolo : handleCreateTavolo}
                className="px-4 py-2 rounded-lg transition-colors duration-200"
                style={{ 
                  backgroundColor: colors.button.primary, 
                  color: colors.button.primaryText 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              >
                {editingTavolo ? 'Aggiorna' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Gruppo */}
      {showGruppoDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div 
            className="p-6 rounded-lg w-full max-w-md"
            style={{ 
              backgroundColor: colors.bg.card, 
              borderColor: colors.border.primary, 
              borderWidth: '1px', 
              borderStyle: 'solid' 
            }}
          >
            <h3 className="text-xl font-semibold mb-4" style={{ color: colors.text.primary }}>
              {editingGruppo ? 'Modifica Gruppo' : 'Nuovo Gruppo'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="nome-gruppo" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Nome Gruppo *
                </label>
                <input
                  id="nome-gruppo"
                  type="text"
                  value={gruppoForm.nome}
                  onChange={(e) => setGruppoForm({ ...gruppoForm, nome: e.target.value })}
                  placeholder="Es: Sala principale, Terrazza, Giardino"
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="descrizione" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Descrizione (opzionale)
                </label>
                <input
                  id="descrizione"
                  type="text"
                  value={gruppoForm.descrizione}
                  onChange={(e) => setGruppoForm({ ...gruppoForm, descrizione: e.target.value })}
                  placeholder="Descrizione del gruppo"
                  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.bg.input, 
                    borderColor: colors.border.primary, 
                    color: colors.text.primary, 
                    borderWidth: '1px', 
                    borderStyle: 'solid' 
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="colore" className="block text-sm font-medium mb-1" style={{ color: colors.text.secondary }}>
                  Colore
                </label>
                <div className="flex gap-2">
                  <input
                    id="colore"
                    type="color"
                    value={gruppoForm.colore}
                    onChange={(e) => setGruppoForm({ ...gruppoForm, colore: e.target.value })}
                    className="w-20 h-10 rounded cursor-pointer"
                    style={{ 
                      backgroundColor: colors.bg.input,
                      borderColor: colors.border.primary, 
                      borderWidth: '1px', 
                      borderStyle: 'solid' 
                    }}
                  />
                  <input
                    type="text"
                    value={gruppoForm.colore}
                    onChange={(e) => setGruppoForm({ ...gruppoForm, colore: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 p-2 rounded-lg focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.bg.input, 
                      borderColor: colors.border.primary, 
                      color: colors.text.primary, 
                      borderWidth: '1px', 
                      borderStyle: 'solid' 
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Icona
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg" 
                  style={{ backgroundColor: colors.bg.darker, borderColor: colors.border.secondary, borderWidth: '1px', borderStyle: 'solid' }}>
                  {availableIcons.map(({ name, label }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setGruppoForm({ ...gruppoForm, icona: name })}
                      className="p-3 rounded-lg transition-all duration-200 flex flex-col items-center gap-1"
                      style={{
                        backgroundColor: gruppoForm.icona === name ? colors.bg.hover : 'transparent',
                        borderColor: gruppoForm.icona === name ? colors.border.primary : colors.border.secondary,
                        borderWidth: '1px',
                        borderStyle: 'solid'
                      }}
                      onMouseEnter={(e) => {
                        if (gruppoForm.icona !== name) {
                          e.currentTarget.style.backgroundColor = colors.bg.hover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (gruppoForm.icona !== name) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {renderIcon(name, gruppoForm.colore || '#3B82F6')}
                      <span className="text-xs" style={{ color: colors.text.muted }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => {
                  setShowGruppoDialog(false);
                  setEditingGruppo(null);
                  resetGruppoForm();
                }}
                className="px-4 py-2 rounded-lg transition-colors duration-200"
                style={{ 
                  backgroundColor: 'transparent',
                  color: colors.text.secondary,
                  borderColor: colors.border.primary, 
                  borderWidth: '1px', 
                  borderStyle: 'solid' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Annulla
              </button>
              <button 
                onClick={editingGruppo ? handleUpdateGruppo : handleCreateGruppo}
                className="px-4 py-2 rounded-lg transition-colors duration-200"
                style={{ 
                  backgroundColor: colors.button.primary, 
                  color: colors.button.primaryText 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
              >
                {editingGruppo ? 'Aggiorna' : 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}