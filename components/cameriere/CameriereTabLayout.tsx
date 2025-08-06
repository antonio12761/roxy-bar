"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  Coffee, 
  ShoppingCart, 
  FileText, 
  Users, 
  CreditCard
} from "lucide-react";
import { TabBookmarks, TabContentCard } from "@/components/ui/tab-bookmarks";

interface CameriereTabLayoutProps {
  children: React.ReactNode;
}

export default function CameriereTabLayout({ children }: CameriereTabLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      id: "nuova-ordinazione",
      title: "Nuova Ordinazione",
      icon: ShoppingCart,
      href: "/cameriere/nuova-ordinazione",
      isActive: pathname === "/cameriere/nuova-ordinazione"
    },
    {
      id: "gestione-conti",
      title: "Gestione Conti", 
      icon: CreditCard,
      href: "/cameriere/gestione-conti",
      isActive: pathname === "/cameriere/gestione-conti"
    },
    {
      id: "ordini-in-corso",
      title: "Ordini in Corso",
      icon: FileText,
      href: "/cameriere/ordini-in-corso", 
      isActive: pathname === "/cameriere/ordini-in-corso"
    },
    {
      id: "riepilogo-turno",
      title: "Riepilogo Turno",
      icon: Coffee,
      href: "/cameriere/riepilogo-turno", 
      isActive: pathname === "/cameriere/riepilogo-turno"
    }
  ];

  const handleTabClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen p-4 space-y-0">
      {/* Tab bookmarks */}
      <TabBookmarks 
        tabs={tabs.map(tab => ({
          ...tab,
          onClick: () => handleTabClick(tab.href)
        }))}
        className="px-2"
      />
      
      {/* Content card that connects with active tab */}
      <TabContentCard className="p-6 min-h-[calc(100vh-120px)]">
        {children}
      </TabContentCard>
    </div>
  );
}