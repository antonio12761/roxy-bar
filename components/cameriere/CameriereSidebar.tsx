"use client";

import { useState } from "react";
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const menuItems: MenuItem[] = [
    {
      title: "Tavoli",
      description: "Gestisci tavoli",
      icon: Utensils,
      href: "/cameriere/nuova-ordinazione"
    },
    {
      title: "Ordini",
      description: "In corso",
      icon: ClipboardList,
      href: "/cameriere/ordini-in-corso"
    },
    {
      title: "Conti",
      description: "Pagamenti",
      icon: CreditCard,
      href: "/cameriere/gestione-conti"
    },
    {
      title: "Rapide",
      description: "Scorciatoie",
      icon: Zap,
      href: "/cameriere/azioni-rapide"
    },
    {
      title: "Riepilogo",
      description: "Statistiche",
      icon: BarChart3,
      href: "/cameriere/riepilogo-turno"
    },
    {
      title: "Sposta",
      description: "Cambia tavolo",
      icon: ArrowLeftRight,
      href: "/cameriere/cambia-tavolo"
    },
    {
      title: "Dividi",
      description: "Split conto",
      icon: Split,
      href: "/cameriere/dividi-conto"
    },
    {
      title: "Aiuto",
      description: "Assistenza",
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

          {/* Navigation Items - Grid Layout */}
          <nav className="flex-1 p-6">
            <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const isHovered = hoveredItem === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex flex-col items-center justify-center p-4 rounded-xl
                      transition-all duration-200 border-2
                      ${isActive ? 'shadow-lg' : 'hover:shadow-md'}
                    `}
                    style={{
                      backgroundColor: isActive ? colors.bg.hover : (isHovered ? colors.bg.hover : colors.bg.light),
                      borderColor: isActive ? colors.border.primary : (isHovered ? colors.border.primary : colors.border.secondary),
                      transform: isHovered && !isActive ? 'scale(1.02)' : 'scale(1)'
                    }}
                    onMouseEnter={() => setHoveredItem(item.href)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <Icon 
                      className="h-8 w-8 mb-2 transition-colors" 
                      style={{ 
                        color: isActive || isHovered ? colors.text.primary : colors.text.secondary 
                      }}
                    />
                    <div className="text-center">
                      <div 
                        className="text-sm font-semibold transition-colors"
                        style={{ 
                          color: isActive || isHovered ? colors.text.primary : colors.text.secondary 
                        }}
                      >
                        {item.title}
                      </div>
                      <div 
                        className="text-xs mt-0.5 transition-colors"
                        style={{ 
                          color: isActive ? colors.text.secondary : (isHovered ? colors.text.secondary : colors.text.muted)
                        }}
                      >
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}