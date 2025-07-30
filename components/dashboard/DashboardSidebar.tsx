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
  Sheet
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["products"]);

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
        { label: "Vista Griglia", href: "/dashboard/products-table", icon: Grid3X3 },
        { label: "Vista Foglio Calcolo", href: "/dashboard/products-spreadsheet", icon: Sheet },
        { label: "Statistiche", href: "/dashboard/statistiche", icon: BarChart3 },
        { label: "Menu Builder", href: "/dashboard/menu-builder", icon: Menu }
      ]
    },
    {
      id: "users",
      label: "Utenti",
      icon: Users,
      href: "/dashboard/utenti"
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
    <div className="bg-gray-900 text-white w-64 min-h-screen">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Bar Roxy Admin</h2>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <div key={item.id}>
              {item.subItems ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    {expandedItems.includes(item.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedItems.includes(item.id) && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                            pathname === subItem.href
                              ? "bg-blue-600 text-white"
                              : "hover:bg-gray-800"
                          }`}
                        >
                          <subItem.icon className="w-4 h-4" />
                          <span className="text-sm">{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-800"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}