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
  BarChart3
} from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth-guard";

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState("overview");

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
        { label: "Tutti i Prodotti", href: "/dashboard/prodotti", icon: Coffee },
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
      id: "settings",
      label: "Impostazioni",
      icon: Settings,
      href: "/dashboard/impostazioni"
    }
  ];

  const quickStats = [
    { label: "Prodotti Attivi", value: "156", color: "bg-white/10" },
    { label: "Categorie", value: "8", color: "bg-white/10" },
    { label: "Ordini Oggi", value: "43", color: "bg-white/15" },
    { label: "Incasso Giornaliero", value: "€1,234", color: "bg-purple-500" }
  ];

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-background border-r border-slate-700 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Coffee className="h-6 w-6 text-white/70" />
            Bar Roxy Admin
          </h1>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <div key={item.id}>
              {item.subItems ? (
                <div>
                  <button
                    onClick={() => setActiveSection(activeSection === item.id ? "" : item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${activeSection === item.id ? "rotate-90" : ""}`} />
                  </button>
                  {activeSection === item.id && (
                    <div className="ml-8 mt-2 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <subItem.icon className="h-4 w-4" />
                          {subItem.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard Amministratore</h2>
          <p className="text-muted-foreground">Benvenuto nel pannello di amministrazione</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat) => (
            <div key={stat.label} className="bg-card border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">{stat.label}</span>
                <div className={`w-2 h-2 rounded-full ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-slate-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">Azioni Rapide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/dashboard/categorie"
              className="p-4 bg-white/20 hover:bg-white/25-700 text-white rounded-lg transition-colors flex items-center gap-3"
            >
              <Tag className="h-5 w-5" />
              <div>
                <div className="font-semibold">Gestisci Categorie</div>
                <div className="text-sm opacity-90">Riorganizza categorie prodotti</div>
              </div>
            </Link>
            <Link
              href="/dashboard/menu-builder"
              className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-3"
            >
              <Menu className="h-5 w-5" />
              <div>
                <div className="font-semibold">Menu Builder</div>
                <div className="text-sm opacity-90">Crea e personalizza il menu</div>
              </div>
            </Link>
            <Link
              href="/dashboard/statistiche"
              className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-3"
            >
              <BarChart3 className="h-5 w-5" />
              <div>
                <div className="font-semibold">Statistiche</div>
                <div className="text-sm opacity-90">Analisi e report prodotti</div>
              </div>
            </Link>
            <Link
              href="/dashboard/utenti"
              className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-3"
            >
              <Users className="h-5 w-5" />
              <div>
                <div className="font-semibold">Gestisci Utenti</div>
                <div className="text-sm opacity-90">Operatori e permessi</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}