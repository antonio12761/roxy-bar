'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface CartItem {
  id: string
  menuItemId: string
  variantId?: string
  nome: string
  variantName?: string
  prezzo: number
  quantita: number
  note?: string
}

interface CartContextType {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: Omit<CartItem, 'id' | 'quantita'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantita: number) => void
  updateNote: (id: string, note: string) => void
  clearCart: () => void
  toggleCart: () => void
  openCart: () => void
  closeCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('menu-cart')
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart))
      } catch (error) {
        console.error('Error loading cart:', error)
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('menu-cart', JSON.stringify(items))
  }, [items])

  const addItem = useCallback((newItem: Omit<CartItem, 'id' | 'quantita'>) => {
    setItems(currentItems => {
      // Check if item already exists (same product and variant)
      const existingItem = currentItems.find(
        item => item.menuItemId === newItem.menuItemId && item.variantId === newItem.variantId
      )

      if (existingItem) {
        // Increase quantity
        return currentItems.map(item =>
          item.id === existingItem.id
            ? { ...item, quantita: item.quantita + 1 }
            : item
        )
      }

      // Add new item
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return [...currentItems, { ...newItem, id, quantita: 1 }]
    })

    // Show cart briefly when adding item
    setIsOpen(true)
    setTimeout(() => setIsOpen(false), 2000)
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, quantita: number) => {
    if (quantita <= 0) {
      removeItem(id)
      return
    }
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === id ? { ...item, quantita } : item
      )
    )
  }, [removeItem])

  const updateNote = useCallback((id: string, note: string) => {
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === id ? { ...item, note } : item
      )
    )
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setIsOpen(false)
  }, [])

  const toggleCart = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  const openCart = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeCart = useCallback(() => {
    setIsOpen(false)
  }, [])

  const getTotalItems = useCallback(() => {
    return items.reduce((total, item) => total + item.quantita, 0)
  }, [items])

  const getTotalPrice = useCallback(() => {
    return items.reduce((total, item) => total + (item.prezzo * item.quantita), 0)
  }, [items])

  const value: CartContextType = {
    items,
    isOpen,
    addItem,
    removeItem,
    updateQuantity,
    updateNote,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    getTotalItems,
    getTotalPrice
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}