'use client';

import { useRouter } from 'next/navigation';
import { Wine, Droplet, Coffee, FlaskConical, Plus, Settings, Database } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthGuard } from '@/components/auth-guard';

function MiscelatiDashboardContent() {
  const router = useRouter();
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const sections = [
    {
      title: 'Categorie Ingredienti',
      description: 'Gestisci le categorie di ingredienti (GIN, RUM, TONICHE, etc.)',
      icon: FlaskConical,
      href: '/dashboard/miscelati-v2/categorie',
      color: 'bg-purple-500',
      stats: 'Definisci i gruppi di ingredienti'
    },
    {
      title: 'Bottiglie',
      description: 'Configura le bottiglie disponibili per ogni categoria',
      icon: Wine,
      href: '/dashboard/miscelati-v2/bottiglie',
      color: 'bg-blue-500',
      stats: 'Aggiungi marche e costi'
    },
    {
      title: 'Ricette Miscelati',
      description: 'Crea e modifica le ricette dei cocktail',
      icon: Coffee,
      href: '/dashboard/miscelati-v2/ricette',
      color: 'bg-green-500',
      stats: 'Componi i tuoi cocktail'
    },
    {
      title: 'Test Composizione',
      description: 'Prova la composizione di un miscelato',
      icon: Droplet,
      href: '/dashboard/miscelati-v2/test',
      color: 'bg-orange-500',
      stats: 'Simula un ordine'
    }
  ];

  const quickActions = [
    {
      label: 'Inizializza Dati Demo',
      icon: Database,
      action: async () => {
        if (confirm('Vuoi inizializzare i dati di esempio? Questo creerà categorie e bottiglie di demo.')) {
          try {
            const { inizializzaDatiEsempio } = await import('@/lib/actions/sistema-miscelati-semplificato');
            const result = await inizializzaDatiEsempio();
            if (result.success) {
              alert('Dati di esempio inizializzati con successo!');
              window.location.reload();
            } else {
              alert(result.error || 'Errore nell\'inizializzazione');
            }
          } catch (error) {
            alert('Errore nell\'inizializzazione dei dati');
          }
        }
      },
      color: 'bg-indigo-500'
    },
    {
      label: 'Impostazioni Sistema',
      icon: Settings,
      action: () => router.push('/dashboard/miscelati-v2/impostazioni'),
      color: 'bg-gray-500'
    }
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2" style={{ color: colors.text.primary }}>Sistema Miscelati 2.0</h1>
        <p className="text-base sm:text-lg" style={{ color: colors.text.secondary }}>
          Gestione semplificata per cocktail e miscelati con selezione ingredienti
        </p>
      </div>

      {/* Workflow Steps */}
      <div className="rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-2" style={{ 
        backgroundColor: colors.bg.card, 
        borderColor: colors.border.primary 
      }}>
        <h2 className="font-bold text-base sm:text-lg mb-4" style={{ color: colors.text.primary }}>📋 Come funziona:</h2>
        <ol className="space-y-2" style={{ color: colors.text.secondary }}>
          <li className="flex items-start">
            <span className="font-bold mr-2">1.</span>
            <div>
              <strong>Crea le Categorie</strong> - Definisci i gruppi di ingredienti (GIN, VODKA, TONICHE, GARNISH, etc.)
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">2.</span>
            <div>
              <strong>Aggiungi le Bottiglie</strong> - Inserisci le bottiglie disponibili per ogni categoria con i costi al litro
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">3.</span>
            <div>
              <strong>Componi le Ricette</strong> - Crea ricette specificando quali categorie servono (es. 1 GIN + 1 TONICA + GARNISH opzionale)
            </div>
          </li>
          <li className="flex items-start">
            <span className="font-bold mr-2">4.</span>
            <div>
              <strong>Il cliente ordina</strong> - Seleziona una bottiglia da ogni categoria richiesta e il prezzo si calcola automaticamente
            </div>
          </li>
        </ol>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.href}
              onClick={() => router.push(section.href)}
              className="rounded-lg shadow-lg p-4 sm:p-6 hover:shadow-xl transition-all duration-300 text-left group"
              style={{ 
                backgroundColor: colors.bg.card,
                borderWidth: '1px',
                borderColor: colors.border.primary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.button.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border.primary;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`${section.color} p-3 rounded-lg text-white group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8" />
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ color: colors.text.primary }}>{section.title}</h3>
              <p className="text-sm sm:text-base mb-3" style={{ color: colors.text.secondary }}>{section.description}</p>
              <p className="text-xs sm:text-sm" style={{ color: colors.text.muted }}>{section.stats}</p>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg p-4 sm:p-6" style={{ backgroundColor: colors.bg.hover }}>
        <h2 className="font-bold text-base sm:text-lg mb-4" style={{ color: colors.text.primary }}>Azioni Rapide</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.action}
                className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 text-sm sm:text-base"
                style={{ 
                  backgroundColor: colors.button.primary,
                  color: colors.button.primaryText
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <Icon className="w-5 h-5" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Example */}
      <div className="mt-6 sm:mt-8 rounded-lg p-4 sm:p-6 border-2" style={{ 
        backgroundColor: colors.bg.card,
        borderColor: colors.border.success
      }}>
        <h2 className="font-bold text-base sm:text-lg mb-4" style={{ color: colors.text.primary }}>🍸 Esempio Pratico: Gin Tonic</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ color: colors.text.secondary }}>
          <div>
            <strong className="block mb-2 text-sm sm:text-base" style={{ color: colors.text.primary }}>Categorie:</strong>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>• GIN (Alcolico)</li>
              <li>• TONICHE (Mixer)</li>
              <li>• GARNISH (Decorazioni)</li>
            </ul>
          </div>
          <div>
            <strong className="block mb-2 text-sm sm:text-base" style={{ color: colors.text.primary }}>Ricetta:</strong>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>• 1 selezione da GIN (obblig.)</li>
              <li>• 1 selezione da TONICHE (obblig.)</li>
              <li>• 0-2 da GARNISH (opzionale)</li>
            </ul>
          </div>
          <div>
            <strong className="block mb-2 text-sm sm:text-base" style={{ color: colors.text.primary }}>Cliente sceglie:</strong>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>• Hendricks (€25/L)</li>
              <li>• Fever-Tree (€8/L)</li>
              <li>• Rosmarino (€2/L)</li>
              <li className="font-bold">→ Totale: Costo + Margine</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MiscelatiDashboard() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'SUPERVISORE']}>
      <MiscelatiDashboardContent />
    </AuthGuard>
  );
}