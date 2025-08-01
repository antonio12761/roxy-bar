"use client";

import { 
  Utensils,
  ClipboardList,
  CreditCard,
  Zap,
  BarChart3,
  ArrowLeftRight,
  Split,
  Bell,
  X,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

interface MenuItem {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
}

interface CameriereSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CameriereSidebar({ isOpen, onClose }: CameriereSidebarProps) {
  const pathname = usePathname();
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const menuItems: MenuItem[] = [
    {
      title: "🍽️ Tavoli & Ordini",
      description: "Gestisci tavoli e crea nuovi ordini",
      icon: Utensils,
      href: "/cameriere/nuova-ordinazione"
    },
    {
      title: "📋 Ordini Attivi",
      description: "Monitora ordini in corso",
      icon: ClipboardList,
      href: "/cameriere/ordini-in-corso"
    },
    {
      title: "💳 Gestione Conti",
      description: "Conti clienti e pagamenti",
      icon: CreditCard,
      href: "/cameriere/gestione-conti"
    },
    {
      title: "⚡ Azioni Rapide",
      description: "Scorciatoie per azioni frequenti",
      icon: Zap,
      href: "/cameriere/azioni-rapide"
    },
    {
      title: "📊 Riepilogo Turno",
      description: "Statistiche e riepilogo del turno",
      icon: BarChart3,
      href: "/cameriere/riepilogo-turno"
    },
    {
      title: "🔄 Cambia Tavolo",
      description: "Sposta clienti tra tavoli",
      icon: ArrowLeftRight,
      href: "/cameriere/cambia-tavolo"
    },
    {
      title: "➗ Dividi Conto",
      description: "Dividi il conto tra più persone",
      icon: Split,
      href: "/cameriere/dividi-conto"
    },
    {
      title: "🚨 Richiedi Aiuto",
      description: "Invia notifica a colleghi",
      icon: Bell,
      href: "/cameriere/richiedi-aiuto"
    }
  ];

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-0 z-50 transition-transform duration-300 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          w-full h-full overflow-auto
        `}
        style={{
          backgroundColor: colors.bg.card
        }}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div 
            className="px-5 py-6 border-b"
            style={{ borderColor: colors.border.primary }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>
                Menu Cameriere
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bg.hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
              </button>
            </div>
          </div>

          {/* Navigation Items - Centered */}
          <nav className="flex-1 flex items-center justify-center p-4">
            <ul className="space-y-4 w-full max-w-md">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-4 px-4 py-4 rounded-xl
                      transition-all duration-200
                      ${isActive ? 'font-medium' : ''}
                    `}
                    style={{
                      backgroundColor: isActive ? colors.bg.hover : 'transparent',
                      color: isActive ? colors.text.primary : colors.text.secondary
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = colors.bg.hover;
                        e.currentTarget.style.color = colors.text.primary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = colors.text.secondary;
                      }
                    }}
                  >
                    <Icon className="h-6 w-6 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <div className="text-base font-medium">{item.title}</div>
                      <div 
                        className="text-sm mt-0.5"
                        style={{ 
                          color: isActive ? colors.text.secondary : colors.text.muted 
                        }}
                      >
                        {item.description}
                      </div>
                    </div>
                    {isActive && (
                      <ChevronRight 
                        className="h-4 w-4 flex-shrink-0" 
                        style={{ color: colors.text.primary }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}