"use client";

import { Coffee, ShoppingCart, FileText, Users, CreditCard } from "lucide-react";
import Link from "next/link";

export default function CameriereLandingPage() {
  
  const menuItems = [
    {
      title: "Nuova Ordinazione",
      description: "Crea un nuovo ordine per un tavolo",
      icon: ShoppingCart,
      href: "/cameriere/nuova-ordinazione",
      color: "bg-green-600 hover:bg-green-700"
    },
    {
      title: "Conti Clienti",
      description: "Gestisci i conti dei clienti",
      icon: Users,
      href: "/cameriere/conti",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "Ordini in Corso",
      description: "Visualizza gli ordini attivi",
      icon: FileText,
      href: "/cameriere/ordini-in-corso",
      color: "bg-white/20 hover:bg-white/25-700"
    },
    {
      title: "Conti Scalari",
      description: "Gestisci conti scalari e pagamenti",
      icon: CreditCard,
      href: "/cameriere/conti-scalari",
      color: "bg-indigo-600 hover:bg-indigo-700"
    },
    {
      title: "Cronologia",
      description: "Storico ordini e transazioni",
      icon: Coffee,
      href: "/cameriere/cronologia",
      color: "bg-purple-600 hover:bg-purple-700"
    }
  ];

  return (
    <>

      {/* Buttons Grid - Responsive layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group relative overflow-hidden rounded-xl ${item.color} p-6 md:p-8 text-white transition-all duration-300 transform hover:scale-105 hover:shadow-2xl`}
            >
              <div className="relative z-10">
                <Icon className="h-10 w-10 md:h-12 md:w-12 mb-3 md:mb-4" />
                <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">{item.title}</h2>
                <p className="text-sm md:text-base text-white/80">{item.description}</p>
              </div>
              
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          );
        })}
      </div>
    </>
  );
}