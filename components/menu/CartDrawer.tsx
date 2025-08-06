'use client'

import { useCart } from '@/contexts/cart-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { ShoppingCart, X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    updateNote,
    clearCart,
    getTotalItems,
    getTotalPrice
  } = useCart()

  const [editingNote, setEditingNote] = useState<string | null>(null)

  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span>Il tuo ordine</span>
              {totalItems > 0 && (
                <Badge className="bg-orange-500 text-white">
                  {totalItems}
                </Badge>
              )}
            </div>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Svuota
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
              <ShoppingBag className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium">Il carrello è vuoto</p>
              <p className="text-sm">Aggiungi prodotti dal menu</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-lg p-4 space-y-3"
                >
                  {/* Header prodotto */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.nome}
                      </h4>
                      {item.variantName && (
                        <p className="text-sm text-gray-500">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-orange-600 mt-1">
                        €{item.prezzo.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600 -mt-2 -mr-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Controlli quantità */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantita - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-12 text-center font-medium">
                        {item.quantita}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.id, item.quantita + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-semibold">
                      €{(item.prezzo * item.quantita).toFixed(2)}
                    </span>
                  </div>

                  {/* Note */}
                  {editingNote === item.id ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Aggiungi una nota (es. senza ghiaccio)"
                        defaultValue={item.note}
                        className="text-sm"
                        rows={2}
                        onBlur={(e) => {
                          updateNote(item.id, e.target.value)
                          setEditingNote(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            updateNote(item.id, e.currentTarget.value)
                            setEditingNote(null)
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                      onClick={() => setEditingNote(item.id)}
                    >
                      {item.note ? (
                        <span className="italic">"{item.note}"</span>
                      ) : (
                        '+ Aggiungi nota'
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <div className="w-full space-y-4">
              {/* Totale */}
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Totale</span>
                <span className="text-2xl text-orange-600">
                  €{totalPrice.toFixed(2)}
                </span>
              </div>

              {/* Bottoni azione */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={closeCart}
                >
                  Continua shopping
                </Button>
                <Button
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
                  onClick={() => {
                    // TODO: Implementare invio ordine
                    alert('Funzionalità in arrivo!')
                  }}
                >
                  Invia ordine
                </Button>
              </div>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Floating Cart Button
export function FloatingCartButton() {
  const { openCart, getTotalItems } = useCart()
  const totalItems = getTotalItems()

  return (
    <button
      onClick={openCart}
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "bg-gradient-to-r from-orange-500 to-orange-600",
        "text-white rounded-full p-4 shadow-lg",
        "hover:from-orange-600 hover:to-orange-700",
        "transition-all duration-300 hover:scale-110",
        "flex items-center justify-center"
      )}
    >
      <ShoppingCart className="h-6 w-6" />
      {totalItems > 0 && (
        <Badge
          className="absolute -top-2 -right-2 bg-red-500 text-white border-0 h-6 w-6 p-0 flex items-center justify-center"
        >
          {totalItems}
        </Badge>
      )}
    </button>
  )
}