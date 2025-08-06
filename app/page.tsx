'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Loader2 } from 'lucide-react'

export default function MaintenancePage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is coming from /ordine
    const referrer = document.referrer
    const fromOrdine = referrer.includes('/ordine') || 
                       window.location.search.includes('from=ordine')
    
    if (fromOrdine) {
      // Redirect to login if coming from /ordine
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center px-6 py-12 max-w-2xl">
        {/* Animated maintenance icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-orange-500/20 rounded-full animate-pulse"></div>
          </div>
          <Wrench className="relative w-24 h-24 mx-auto text-orange-500 animate-spin-slow" />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
          Sito in Manutenzione
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          Stiamo lavorando per migliorare la tua esperienza.
          <br />
          Torneremo online il prima possibile.
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-full rounded-full animate-progress" 
               style={{ width: '65%' }}></div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="text-3xl mb-2">🔧</div>
            <h3 className="text-white font-semibold mb-1">Aggiornamenti</h3>
            <p className="text-gray-400 text-sm">Nuove funzionalità in arrivo</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-white font-semibold mb-1">Performance</h3>
            <p className="text-gray-400 text-sm">Ottimizzazioni in corso</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <div className="text-3xl mb-2">🛡️</div>
            <h3 className="text-white font-semibold mb-1">Sicurezza</h3>
            <p className="text-gray-400 text-sm">Protezione avanzata</p>
          </div>
        </div>

        {/* Contact info */}
        <div className="text-gray-400 text-sm">
          <p className="mb-2">Per urgenze, contattaci:</p>
          <a href="mailto:support@barroxy.com" className="text-orange-500 hover:text-orange-400 transition-colors">
            support@barroxy.com
          </a>
        </div>

        {/* Loading spinner */}
        <div className="mt-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Controllo stato...</span>
        </div>
      </div>

      {/* Add custom styles */}
      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .animate-progress {
          animation: progress 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}