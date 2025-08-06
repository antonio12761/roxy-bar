'use client'

import { useState, useEffect, useRef } from 'react'
import { Hash, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCustomerOrder } from '@/lib/actions/customer-orders'
import { toast } from '@/lib/toast'

interface OrderCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onOrderImported: (items: Array<{
    prodottoId: number
    nome: string
    quantita: number
    prezzo: number | string
    note?: string
  }>) => void
}

export function QRScannerModal({ isOpen, onClose, onOrderImported }: OrderCodeModalProps) {
  const [orderCode, setOrderCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleOrderCodeSubmit = async () => {
    if (!orderCode.trim()) {
      setError('Inserisci il codice ordine')
      return
    }

    // Format code (remove spaces and dashes)
    const cleanCode = orderCode.trim().replace(/[-\s]/g, '')
    
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Il codice deve essere di 6 cifre')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Get order from server
      const result = await getCustomerOrder(cleanCode)
      
      if (result.success && result.data) {
        // Import the order items
        onOrderImported(result.data.items.map((item: any) => ({
          prodottoId: item.id,
          nome: item.nome,
          quantita: item.quantita,
          prezzo: item.prezzo,
          note: item.note,
          glassesCount: item.glassesCount
        })))
        
        toast.success(`Ordine importato: ${result.data.items.length} prodotti`)
        setOrderCode('')
        onClose()
      } else {
        setError(result.error || 'Ordine non trovato o scaduto')
      }
    } catch (error) {
      console.error('Error importing order:', error)
      setError('Errore durante l\'importazione dell\'ordine')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Importa Ordine Cliente
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Inserisci il codice a 6 cifre fornito dal cliente per importare il suo ordine.
          </p>

          <div>
            <label htmlFor="order-code" className="block text-sm font-medium text-gray-700 mb-1">
              Codice Ordine
            </label>
            <input
              ref={inputRef}
              id="order-code"
              type="text"
              value={orderCode}
              onChange={(e) => {
                // Allow only numbers, spaces and dashes
                const value = e.target.value.replace(/[^\d\s-]/g, '')
                setOrderCode(value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleOrderCodeSubmit()
                }
              }}
              placeholder="123-456 o 123456"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-wider border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={isLoading}
              maxLength={7} // 6 digits + 1 dash
            />
            {error && (
              <p className="mt-1 text-sm text-red-600 text-center">{error}</p>
            )}
          </div>

          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Formato:</strong> Il codice è di 6 cifre (es. 123-456)
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button
              onClick={handleOrderCodeSubmit}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isLoading || !orderCode.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Importa Ordine
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}