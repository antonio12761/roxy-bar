"use client";

import { useState } from "react";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  FileText,
  Settings,
  Coffee,
  Tag,
  ChevronRight,
  Menu,
  Table,
  BarChart3,
  ChevronDown,
  Grid3X3,
  Sheet,
  ChevronLeft,
  Shield,
  ChefHat
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

import { useSidebar } from "@/app/dashboard/layout-client";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["products"]);
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { currentTheme, themeMode } = useTheme();
  const colors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];

  const menuItems = [
    {
      id: "overview",
      label: "Panoramica",
      icon: LayoutDashboard,
      href: "/dashboard"
    },
    {
      id: "products",
      label: "Prodotti",
      icon: Package,
      subItems: [
        { label: "Gestione Categorie", href: "/dashboard/categorie", icon: Tag },
        { label: "Tutti i Prodotti", href: "/dashboard/products", icon: Coffee },
        { label: "Procedure Preparazione", href: "/dashboard/procedures", icon: ChefHat },
        { label: "Statistiche", href: "/dashboard/statistiche", icon: BarChart3 },
        { label: "Menu Builder", href: "/dashboard/menu-builder", icon: Menu }
      ]
    },
    {
      id: "users",
      label: "Utenti",
      icon: Users,
      subItems: [
        { label: "Gestione Utenti", href: "/dashboard/users", icon: Users },
        { label: "Gestione Ruoli", href: "/dashboard/roles", icon: Shield }
      ]
    },
    {
      id: "orders",
      label: "Ordini",
      icon: ShoppingCart,
      href: "/dashboard/ordini"
    },
    {
      id: "reports",
      label: "Report",
      icon: FileText,
      href: "/dashboard/report"
    },
    {
      id: "tables",
      label: "Tavoli",
      icon: Table,
      href: "/dashboard/tavoli"
    },
    {
      id: "settings",
      label: "Impostazioni",
      icon: Settings,
      href: "/dashboard/impostazioni"
    }
  ];

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  return (
    <div 
      className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} border-r`}
      style={{ 
        backgroundColor: colors.bg.card,
        color: colors.text.primary,
        borderColor: colors.border.primary
      }}
    >
      <div className={`${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-4 min-h-[40px] relative`}>
          <h2 
            className={`font-bold transition-all duration-300 ${isCollapsed ? 'text-2xl' : 'text-xl'}`}
            style={{ color: colors.text.primary }}
          >
            {isCollapsed ? 'S' : 'Siplit'}
          </h2>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg transition-all duration-300 hover:opacity-80 cursor-pointer hidden lg:block ${isCollapsed ? 'absolute right-2' : ''}`}
            style={{ 
              backgroundColor: colors.bg.hover,
              color: colors.text.primary,
              border: `1px solid ${colors.border.primary}`
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
            aria-label={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <div key={item.id}>
              {item.subItems ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-3 py-3 rounded-lg transition-colors duration-300`}
                    title={isCollapsed ? item.label : undefined}
                    style={{ 
                      backgroundColor: 'transparent',
                      color: colors.text.primary
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.bg.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5" />
                      </div>
                      {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    {!isCollapsed && (
                      expandedItems.includes(item.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )
                    )}
                  </button>
                  {expandedItems.includes(item.id) && !isCollapsed && (
                    <div className="mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className="flex items-center gap-3 px-3 py-2 pl-12 rounded-lg transition-colors duration-300"
                          style={{
                            backgroundColor: pathname === subItem.href ? colors.button.primary : 'transparent',
                            color: pathname === subItem.href ? colors.button.primaryText : colors.text.secondary
                          }}
                          onMouseEnter={(e) => {
                            if (pathname !== subItem.href) {
                              e.currentTarget.style.backgroundColor = colors.bg.hover;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (pathname !== subItem.href) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <subItem.icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm">{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg transition-colors duration-300`}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    backgroundColor: pathname === item.href ? colors.button.primary : 'transparent',
                    color: pathname === item.href ? colors.button.primaryText : colors.text.primary
                  }}
                  onMouseEnter={(e) => {
                    if (pathname !== item.href) {
                      e.currentTarget.style.backgroundColor = colors.bg.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pathname !== item.href) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}