"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { ArrowLeft, Zap, Coffee, Users, MapPin, Clock, FileText, CreditCard, Bell, ArrowLeftRight, Split, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "@/lib/toast";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  action: () => void;
  category: 'ordini' | 'pagamenti' | 'gestione' | 'supporto';
}

export default function AzioniRapidePage() {
  const router = useRouter();
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];
  const [selectedCategory, setSelectedCategory] = useState<string>('tutti');

  const quickActions: QuickAction[] = [
    // Ordini
    {
      id: 'nuovo-ordine',
      title: 'Nuovo Ordine Veloce',
      description: 'Crea un ordine senza selezionare tavolo',
      icon: Coffee,
      color: colors.accent || colors.text.accent,
      action: () => router.push('/cameriere/nuova-ordinazione?quick=true'),
      category: 'ordini'
    },
    {
      id: 'ordini-pronti',
      title: 'Ordini Pronti',
      description: 'Visualizza ordini da servire',
      icon: Package,
      color: colors.text.success,
      action: () => router.push('/cameriere/ordini-in-corso?filter=pronti'),
      category: 'ordini'
    },
    {
      id: 'ordini-ritardo',
      title: 'Ordini in Ritardo',
      description: 'Controlla ordini oltre i tempi',
      icon: Clock,
      color: colors.text.error,
      action: () => router.push('/cameriere/ordini-in-corso?filter=ritardo'),
      category: 'ordini'
    },
    
    // Pagamenti
    {
      id: 'pagamento-veloce',
      title: 'Pagamento Veloce',
      description: 'Incassa ultimo tavolo servito',
      icon: CreditCard,
      color: colors.accent || colors.text.accent,
      action: () => {
        // Get last served table from local storage or context
        const lastTable = localStorage.getItem('lastServedTable');
        if (lastTable) {
          router.push(`/cameriere/gestione-conti?table=${lastTable}&action=pay`);
        } else {
          toast.error('Nessun tavolo recente trovato');
        }
      },
      category: 'pagamenti'
    },
    {
      id: 'dividi-conto',
      title: 'Dividi Conto Rapido',
      description: 'Dividi equamente l\'ultimo conto',
      icon: Split,
      color: colors.status?.warning || colors.text.accent,
      action: () => router.push('/cameriere/dividi-conto'),
      category: 'pagamenti'
    },
    {
      id: 'scontrino-veloce',
      title: 'Richiedi Scontrino',
      description: 'Invia richiesta scontrino alla cassa',
      icon: FileText,
      color: colors.text.secondary,
      action: () => {
        toast.info('Seleziona un ordine dalla gestione conti');
        router.push('/cameriere/gestione-conti');
      },
      category: 'pagamenti'
    },
    
    // Gestione
    {
      id: 'cambia-tavolo',
      title: 'Sposta Ordine',
      description: 'Cambia tavolo a ordine attivo',
      icon: ArrowLeftRight,
      color: colors.accent || colors.text.accent,
      action: () => router.push('/cameriere/cambia-tavolo'),
      category: 'gestione'
    },
    {
      id: 'stato-tavoli',
      title: 'Vista Tavoli',
      description: 'Panoramica stato tavoli',
      icon: MapPin,
      color: colors.text.primary,
      action: () => router.push('/cameriere/nuova-ordinazione'),
      category: 'gestione'
    },
    {
      id: 'storico-ordini',
      title: 'Storico Recente',
      description: 'Ultimi 10 ordini completati',
      icon: Clock,
      color: colors.text.muted,
      action: () => router.push('/cameriere/riepilogo-turno?view=recent'),
      category: 'gestione'
    },
    
    // Supporto
    {
      id: 'chiama-cucina',
      title: 'Chiama Cucina',
      description: 'Sollecita ordine urgente',
      icon: Bell,
      color: colors.text.error,
      action: () => {
        router.push('/cameriere/richiedi-aiuto?preset=cucina-urgente');
      },
      category: 'supporto'
    },
    {
      id: 'aiuto-colleghi',
      title: 'Richiedi Supporto',
      description: 'Chiedi aiuto ai colleghi',
      icon: Users,
      color: colors.status?.warning || colors.text.accent,
      action: () => router.push('/cameriere/richiedi-aiuto'),
      category: 'supporto'
    },
  ];

  const categories = [
    { id: 'tutti', label: 'Tutte', color: colors.text.primary },
    { id: 'ordini', label: 'Ordini', color: colors.accent },
    { id: 'pagamenti', label: 'Pagamenti', color: colors.text.success },
    { id: 'gestione', label: 'Gestione', color: colors.status?.warning || colors.text.accent },
    { id: 'supporto', label: 'Supporto', color: colors.text.error },
  ];

  const filteredActions = selectedCategory === 'tutti' 
    ? quickActions 
    : quickActions.filter(a => a.category === selectedCategory);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg.main }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
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
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6" style={{ color: colors.accent }} />
            <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
              Azioni Rapide
            </h1>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors`}
                style={{
                  backgroundColor: selectedCategory === cat.id ? cat.color : colors.bg.card,
                  color: selectedCategory === cat.id ? 'white' : colors.text.secondary,
                  border: `1px solid ${selectedCategory === cat.id ? cat.color : colors.border.primary}`
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.action}
                className="p-6 rounded-lg text-left transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: colors.bg.card,
                  borderColor: colors.border.primary,
                  borderWidth: '1px',
                  borderStyle: 'solid'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${action.color}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border.primary;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: action.color + '20' }}
                  >
                    <Icon className="h-6 w-6" style={{ color: action.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-1" style={{ color: colors.text.primary }}>
                      {action.title}
                    </h3>
                    <p className="text-sm" style={{ color: colors.text.muted }}>
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 rounded-lg" style={{
          backgroundColor: colors.bg.darker,
          borderColor: colors.border.secondary,
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-5 w-5" style={{ color: colors.accent }} />
            <h3 className="font-medium" style={{ color: colors.text.primary }}>
              Suggerimenti
            </h3>
          </div>
          <ul className="space-y-1 text-sm" style={{ color: colors.text.muted }}>
            <li>• Usa le azioni rapide per velocizzare le operazioni più frequenti</li>
            <li>• Personalizza la dashboard aggiungendo le azioni che usi di più</li>
            <li>• Alcuni comandi supportano scorciatoie da tastiera (premi ? per vederle)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}