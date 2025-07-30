'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrderZones } from '@/components/OrderZones'
import { useStationSSE } from '@/hooks/useStationSSE'
import { StationType } from '@/lib/sse/station-filters'
import { aggiornaStatoOrdinazione } from '@/lib/actions/ordinazioni'
import { toast } from '@/lib/toast'
import type { Ordinazione, RigaOrdinazione, Prodotto, Tavolo } from '@prisma/client'

type OrdinazioneCompleta = Ordinazione & {
  righe: (RigaOrdinazione & {
    prodotto: Prodotto
  })[]
  tavolo?: Tavolo | null
}

interface PageWrapperProps {
  initialOrdinazioni: OrdinazioneCompleta[]
}

export function PageWrapper({ initialOrdinazioni }: PageWrapperProps) {
  const [ordinazioni, setOrdinazioni] = useState(initialOrdinazioni)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  
  const loadOrders = useCallback(async () => {
    try {
      const { getOrdinazioniPerStato } = await import('@/lib/actions/ordinazioni')
      const data = await getOrdinazioniPerStato()
      setOrdinazioni(data)
    } catch (error) {
      console.error('Errore caricamento ordini:', error)
    }
  }, [])

  // Use optimized SSE hook for supervisor
  const { 
    connectionHealth,
    eventQueue,
    clearEventQueue 
  } = useStationSSE({
    stationType: StationType.SUPERVISORE,
    userId: 'supervisor', // TODO: get actual user ID
    enableCache: true,
    autoReconnect: true
  })

  // Process SSE events
  useEffect(() => {
    eventQueue.forEach(({ event, data }) => {
      console.log(`[Supervisore] Processing event: ${event}`, data);
      // All events should trigger reload for supervisor view
      loadOrders();
    });
    
    clearEventQueue();
  }, [eventQueue, clearEventQueue, loadOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setIsUpdating(orderId)
    try {
      const validStatuses = ['ORDINATO', 'IN_PREPARAZIONE', 'PRONTO', 'CONSEGNATO', 'RICHIESTA_CONTO', 'PAGATO'] as const
      if (!validStatuses.includes(newStatus as any)) {
        return
      }

      const result = await aggiornaStatoOrdinazione(orderId, newStatus as any)
      
      if (result.success) {
        // Aggiorna ottimisticamente lo stato locale
        setOrdinazioni(prev => prev.map(ord => 
          ord.id === orderId 
            ? { ...ord, stato: newStatus as any }
            : ord
        ))
        
        // Poi ricarica per sincronizzare con il server
        setTimeout(loadOrders, 500)
      } else {
        toast.error(`Errore: ${result.error}`)
      }
    } catch (error) {
      console.error('Errore aggiornamento stato:', error)
      toast.error('Errore durante l\'aggiornamento dello stato')
    } finally {
      setIsUpdating(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Gestione Ordini per Zone
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Visualizza e gestisci gli ordini organizzati per stato
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadOrders}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Aggiorna
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${connectionHealth.status === 'connected' ? 'bg-green-500' : connectionHealth.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                {connectionHealth.status === 'connected' ? 'Connesso' : connectionHealth.status === 'connecting' ? 'Connessione...' : 'Disconnesso'}
              </span>
            </div>
          </div>
        </div>

        <OrderZones 
          ordinazioni={ordinazioni} 
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  )
}