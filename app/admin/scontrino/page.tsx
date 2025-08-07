"use client";

import { Receipt } from "lucide-react";
import { Poppins, Inter } from "next/font/google";
import ImpostazioniScontrinoComponent from "@/components/supervisore/impostazioni-scontrino";

// Importa i font per renderli disponibili nella pagina
const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins'
});

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter'
});

export default function AdminScontrinoPage() {
  return (
    <>
      <style jsx global>{`
        .font-poppins {
          font-family: var(--font-poppins), sans-serif;
        }
        .font-inter {
          font-family: var(--font-inter), sans-serif;
        }
      `}</style>
      <div className={`min-h-screen bg-black p-8 ${poppins.variable} ${inter.variable}`}>
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Receipt className="h-8 w-8 text-amber-400" />
            <h1 className="text-3xl font-bold text-white">
              Configurazione Scontrino
            </h1>
          </div>
          <p className="text-gray-400">
            Personalizza l'aspetto e il contenuto degli scontrini stampati
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <ImpostazioniScontrinoComponent />
        </div>
      </div>
    </div>
    </>
  );
}