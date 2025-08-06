'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, Plus, Minus, ShoppingCart, X, Hash, Clock, Check, ChevronUp, ChevronDown, Loader2, Copy, Edit2, Wine, NotebookPen, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useCart } from '@/contexts/cart-context'
import { cn } from '@/lib/utils'
import { createCustomerOrder } from '@/lib/actions/customer-orders'
import { getCategoryEmojis } from '@/lib/actions/get-category-emojis'
import { toast } from 'sonner'

interface Product {
  id: number
  nome: string
  prezzo: number | string
  categoria: string
  disponibile?: boolean
  terminato?: boolean
  postazione?: string | null
  requiresGlasses?: boolean
}

interface MenuGroup {
  id: string
  nome: string
  descrizione?: string | null
  icona?: string | null
  MenuCategories: MenuCategory[]
}

interface MenuCategory {
  id: string
  nome: string
  MenuItems: MenuItem[]
}

interface MenuItem {
  id: string
  nome: string
  descrizione?: string | null
  prezzoBase?: number | null
  MenuVariants: MenuVariant[]
}

interface MenuVariant {
  id: string
  nome: string
  prezzo: number
}

interface MenuClientProps {
  initialMenu: MenuGroup[]
  products: Product[]
}

interface OrderItem {
  prodotto: Product
  quantita: number
  note?: string
  glassesCount?: number
}

type ViewState = 'search' | 'categories' | 'products'

export default function MenuClient({ initialMenu, products }: MenuClientProps) {
  const [viewState, setViewState] = useState<ViewState>('categories')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderItem[]>([])
  const [drawerExpanded, setDrawerExpanded] = useState(false)
  const [showOrderCodeModal, setShowOrderCodeModal] = useState(false)
  const [generatedOrderCode, setGeneratedOrderCode] = useState<string | null>(null)
  const [hasCompletedOrder, setHasCompletedOrder] = useState(false)
  const [completedOrderData, setCompletedOrderData] = useState<OrderItem[]>([])
  const [completedOrderTotal, setCompletedOrderTotal] = useState(0)
  const [orderModified, setOrderModified] = useState(false)
  const [orderExpiryTimer, setOrderExpiryTimer] = useState<NodeJS.Timeout | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [codeUsedByWaiter, setCodeUsedByWaiter] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [selectedQuantities, setSelectedQuantities] = useState<{[key: number]: number}>({})
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showGlassesModal, setShowGlassesModal] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<{product: Product, quantity: number, note?: string} | null>(null)
  const [glassesCount, setGlassesCount] = useState(0)
  const [currentNote, setCurrentNote] = useState('')
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [showAddedConfirm, setShowAddedConfirm] = useState(false)
  const [addedProductName, setAddedProductName] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [showCustomerNameModal, setShowCustomerNameModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerSurname, setCustomerSurname] = useState('')
  const [categoryEmojis, setCategoryEmojis] = useState<{[key: string]: {emoji: string | null, color: string | null, iconType?: string}}>({})
  
  // Load category emojis on mount
  useEffect(() => {
    const loadEmojis = async () => {
      const emojis = await getCategoryEmojis()
      setCategoryEmojis(emojis)
    }
    loadEmojis()
  }, [])

  // Theme colors (Anthropic style)
  const colors = {
    primary: '#D97B34',
    secondary: '#FFF5EB',
    background: '#FAFAF9',
    cardBg: '#FFFFFF',
    text: {
      primary: '#1A1A1A',
      secondary: '#6B6B6B',
      muted: '#9B9B9B'
    },
    bg: {
      main: '#FAFAF9',
      card: '#FFFFFF',
      darker: '#F5F5F4',
      hover: '#EEEEEC',
      input: '#FFFFFF'
    },
    border: {
      primary: '#E5E5E5'
    },
    button: {
      primary: '#D97B34',
      primaryHover: '#B85C1C',
      success: '#4CAF50',
      successHover: '#45A049',
      danger: '#F44336',
      dangerHover: '#D32F2F'
    }
  }

  // Initialize quantities
  useEffect(() => {
    const initialQuantities: {[key: number]: number} = {}
    products.forEach((p: Product) => {
      initialQuantities[p.id] = 1
    })
    setSelectedQuantities(initialQuantities)
  }, [products])

  // Search functionality (fuzzy search like cameriere)
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    
    // Se la ricerca è vuota, torna alle categorie
    if (!query.trim()) {
      setSearchResults([])
      setViewState('categories')
      return
    }
    
    // Imposta la vista su search quando si digita
    setViewState('search')
    
    const searchTerm = query.toLowerCase().trim()
    const results = products
      .filter((p: Product) => p.disponibile !== false && !p.terminato) // Only show available products
      .map((p: Product) => {
        const productName = p.nome.toLowerCase()
        let score = 0
        
        // Exact match
        if (productName === searchTerm) score = 100
        // Starts with
        else if (productName.startsWith(searchTerm)) score = 90
        // Contains
        else if (productName.includes(searchTerm)) score = 80
        // Fuzzy match - più restrittivo
        else {
          const searchChars = searchTerm.split('')
          let lastIndex = -1
          let matches = 0
          
          for (const char of searchChars) {
            const index = productName.indexOf(char, lastIndex + 1)
            if (index > lastIndex) {
              matches++
              lastIndex = index
            }
          }
          
          // Aumentato soglia da 0.7 a 0.9 per essere più selettivo
          if (matches >= searchChars.length * 0.9) {
            score = 30 + (matches / searchChars.length) * 10
          }
        }
        
        return { product: p, score }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product)
      
    setSearchResults(results)
  }, [products])

  // Add to order
  const addToOrder = useCallback((product: Product, quantity: number, glasses?: number, note?: string) => {
    setOrder(prev => {
      const existingItem = prev.find(item => item.prodotto.id === product.id)
      if (existingItem) {
        return prev.map(item =>
          item.prodotto.id === product.id
            ? { ...item, quantita: item.quantita + quantity }
            : item
        )
      }
      return [...prev, { 
        prodotto: product, 
        quantita: quantity,
        glassesCount: glasses,
        note: note
      }]
    })
  }, [])

  // Remove from order
  const removeFromOrder = useCallback((productId: number) => {
    setOrder(prev => prev.filter(item => item.prodotto.id !== productId))
  }, [])

  // Update quantity in order
  const updateOrderQuantity = useCallback((productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromOrder(productId)
    } else {
      setOrder(prev => prev.map(item =>
        item.prodotto.id === productId
          ? { ...item, quantita: newQuantity }
          : item
      ))
    }
  }, [removeFromOrder])

  // Calculate total
  const getTotalOrder = useCallback(() => {
    return order.reduce((total, item) => {
      const price = typeof item.prodotto.prezzo === 'string' 
        ? parseFloat(item.prodotto.prezzo) 
        : item.prodotto.prezzo
      return total + (price * item.quantita)
    }, 0)
  }, [order])

  // Start order code generation (show customer name modal first)
  const startOrderCodeGeneration = useCallback(() => {
    setShowCustomerNameModal(true)
  }, [])

  // Generate Order Code (after customer name is provided)
  const generateOrderCode = useCallback(async () => {
    if (!customerName.trim() || !customerSurname.trim()) {
      toast.error('Nome e cognome sono obbligatori')
      return
    }

    setGeneratingCode(true)
    try {
      const orderData = {
        timestamp: Date.now(),
        customerName: customerName.trim(),
        customerSurname: customerSurname.trim(),
        items: order.map(item => ({
          id: item.prodotto.id,
          nome: item.prodotto.nome,
          quantita: item.quantita,
          prezzo: item.prodotto.prezzo,
          note: item.note,
          glassesCount: item.glassesCount
        })),
        totale: getTotalOrder()
      }
      
      // Create order on server with rate limiting
      const result = await createCustomerOrder(orderData)
      
      if (result.success && result.orderCode) {
        setGeneratedOrderCode(result.orderCode)
        setCompletedOrderData([...order])
        setCompletedOrderTotal(getTotalOrder())
        setHasCompletedOrder(true)
        setOrderModified(false)
        setShowCustomerNameModal(false)
        setShowOrderCodeModal(true)
        toast.success('Codice ordine generato con successo!')
      } else {
        toast.error(result.error || 'Errore nella generazione del codice')
      }
    } catch (error) {
      console.error('Error generating order code:', error)
      toast.error('Errore nella generazione del codice ordine')
    } finally {
      setGeneratingCode(false)
    }
  }, [order, getTotalOrder, customerName, customerSurname])
  
  // Copy code to clipboard
  const copyCodeToClipboard = useCallback(() => {
    if (generatedOrderCode) {
      navigator.clipboard.writeText(generatedOrderCode)
      toast.success('Codice copiato negli appunti!')
    }
  }, [generatedOrderCode])
  
  // Reopen order modal
  const reopenOrderModal = useCallback(() => {
    if (generatedOrderCode && hasCompletedOrder) {
      setShowOrderCodeModal(true)
    }
  }, [generatedOrderCode, hasCompletedOrder])
  
  // Update completed order quantity
  const updateCompletedOrderQuantity = useCallback((productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      // Remove item from completed order
      setCompletedOrderData(prev => prev.filter(item => item.prodotto.id !== productId))
    } else {
      // Update quantity
      setCompletedOrderData(prev => prev.map(item =>
        item.prodotto.id === productId
          ? { ...item, quantita: newQuantity }
          : item
      ))
    }
    // Recalculate total
    const newTotal = completedOrderData.reduce((total, item) => {
      if (item.prodotto.id === productId) {
        if (newQuantity <= 0) return total // Item will be removed
        const price = typeof item.prodotto.prezzo === 'string' 
          ? parseFloat(item.prodotto.prezzo) 
          : item.prodotto.prezzo
        return total + (price * newQuantity)
      }
      const price = typeof item.prodotto.prezzo === 'string' 
        ? parseFloat(item.prodotto.prezzo) 
        : item.prodotto.prezzo
      return total + (price * item.quantita)
    }, 0)
    setCompletedOrderTotal(newTotal)
    setOrderModified(true)
  }, [completedOrderData])
  
  // Remove item from completed order
  const removeFromCompletedOrder = useCallback((productId: number) => {
    setCompletedOrderData(prev => prev.filter(item => item.prodotto.id !== productId))
    // Recalculate total
    const newTotal = completedOrderData.reduce((total, item) => {
      if (item.prodotto.id === productId) return total // Item will be removed
      const price = typeof item.prodotto.prezzo === 'string' 
        ? parseFloat(item.prodotto.prezzo) 
        : item.prodotto.prezzo
      return total + (price * item.quantita)
    }, 0)
    setCompletedOrderTotal(newTotal)
    setOrderModified(true)
  }, [completedOrderData])
  
  // Regenerate order code for modified order
  const regenerateOrderCode = useCallback(async () => {
    setGeneratingCode(true)
    try {
      const orderData = {
        timestamp: Date.now(),
        items: completedOrderData.map(item => ({
          id: item.prodotto.id,
          nome: item.prodotto.nome,
          quantita: item.quantita,
          prezzo: item.prodotto.prezzo,
          note: item.note,
          glassesCount: item.glassesCount
        })),
        totale: completedOrderTotal
      }
      
      const result = await createCustomerOrder(orderData)
      
      if (result.success && result.orderCode) {
        setGeneratedOrderCode(result.orderCode)
        setOrderModified(false)
        toast.success('Nuovo codice ordine generato!')
      } else {
        toast.error(result.error || 'Errore nella generazione del codice')
      }
    } catch (error) {
      console.error('Error regenerating order code:', error)
      toast.error('Errore nella generazione del nuovo codice')
    } finally {
      setGeneratingCode(false)
    }
  }, [completedOrderData, completedOrderTotal])
  
  // Clear completed order data
  const clearCompletedOrder = useCallback(() => {
    setHasCompletedOrder(false)
    setCompletedOrderData([])
    setCompletedOrderTotal(0)
    setGeneratedOrderCode(null)
    setOrderModified(false)
    setTimeRemaining(null)
    setCodeUsedByWaiter(false)
    setCustomerName('')
    setCustomerSurname('')
    if (orderExpiryTimer) {
      clearTimeout(orderExpiryTimer)
      setOrderExpiryTimer(null)
    }
    toast.info('Ordine processato dal cameriere e rimosso')
  }, [orderExpiryTimer])
  
  // Start cleanup timer after waiter uses code (1 minute = 60000 ms)
  const startCleanupTimer = useCallback(() => {
    // Clear any existing timer
    if (orderExpiryTimer) {
      clearTimeout(orderExpiryTimer)
    }
    
    // Set initial time remaining (1 minute = 60 seconds)
    setTimeRemaining(60)
    setCodeUsedByWaiter(true)
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval)
          return null
        }
        return prev - 1
      })
    }, 1000)
    
    // Set main cleanup timer (1 minute)
    const timer = setTimeout(() => {
      clearInterval(countdownInterval)
      clearCompletedOrder()
    }, 60000) // 1 minute
    
    setOrderExpiryTimer(timer)
    
    // Cleanup interval on component unmount
    return () => {
      clearInterval(countdownInterval)
      if (timer) clearTimeout(timer)
    }
  }, [orderExpiryTimer, clearCompletedOrder])
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (orderExpiryTimer) {
        clearTimeout(orderExpiryTimer)
      }
    }
  }, [orderExpiryTimer])
  
  // Check if order code was used by waiter (polling every 5 seconds)
  useEffect(() => {
    if (!generatedOrderCode || codeUsedByWaiter) return
    
    const checkCodeStatus = async () => {
      try {
        // TODO: Replace with actual API call to check if code was used
        const response = await fetch(`/api/orders/check-code-status/${generatedOrderCode}`)
        const data = await response.json()
        
        if (data.used) {
          startCleanupTimer()
          toast.success('Ordine ricevuto dal cameriere!')
        }
      } catch (error) {
        // Silently fail - code checking is not critical
        console.log('Code status check failed:', error)
      }
    }
    
    const pollInterval = setInterval(checkCodeStatus, 5000) // Check every 5 seconds
    
    return () => clearInterval(pollInterval)
  }, [generatedOrderCode, codeUsedByWaiter, startCleanupTimer])
  
  // Handle product add with options
  const handleProductAdd = useCallback((product: Product, quantity: number) => {
    // Check if product requires glasses
    if (product.requiresGlasses) {
      setPendingProduct({ product, quantity })
      setGlassesCount(quantity)
      setShowGlassesModal(true)
    } else {
      // Show notes modal for all products
      setPendingProduct({ product, quantity })
      setCurrentNote('')
      setShowNotesModal(true)
    }
  }, [])
  
  // Confirm glasses selection
  const handleGlassesConfirm = useCallback(() => {
    if (pendingProduct) {
      // After glasses, show notes modal
      setShowGlassesModal(false)
      setCurrentNote('')
      setShowNotesModal(true)
    }
  }, [pendingProduct])
  
  // Confirm note and add to order
  const handleNoteConfirm = useCallback(() => {
    if (pendingProduct) {
      addToOrder(
        pendingProduct.product, 
        pendingProduct.quantity,
        pendingProduct.product.requiresGlasses ? glassesCount : undefined,
        currentNote || undefined
      )
      // Show confirmation
      setAddedProductName(`${pendingProduct.quantity}x ${pendingProduct.product.nome}`)
      setShowAddedConfirm(true)
      setTimeout(() => setShowAddedConfirm(false), 2000)
      // Reset states
      setPendingProduct(null)
      setCurrentNote('')
      setShowNotesModal(false)
      setGlassesCount(0)
      // Reset quantity selector
      setSelectedQuantities(prev => ({ ...prev, [pendingProduct.product.id]: 1 }))
    }
  }, [pendingProduct, glassesCount, currentNote, addToOrder])
  
  // Skip notes and add directly
  const handleSkipNotes = useCallback(() => {
    if (pendingProduct) {
      addToOrder(
        pendingProduct.product, 
        pendingProduct.quantity,
        pendingProduct.product.requiresGlasses ? glassesCount : undefined
      )
      // Show confirmation
      setAddedProductName(`${pendingProduct.quantity}x ${pendingProduct.product.nome}`)
      setShowAddedConfirm(true)
      setTimeout(() => setShowAddedConfirm(false), 2000)
      // Reset states
      setPendingProduct(null)
      setCurrentNote('')
      setShowNotesModal(false)
      setGlassesCount(0)
      // Reset quantity selector
      setSelectedQuantities(prev => ({ ...prev, [pendingProduct.product.id]: 1 }))
    }
  }, [pendingProduct, glassesCount, addToOrder])
  
  // Handle edit item click
  const handleEditItemClick = useCallback((item: OrderItem) => {
    setEditingItem(item)
    setShowEditModal(true)
  }, [])
  
  // Handle edit glasses
  const handleEditGlasses = useCallback(() => {
    if (editingItem && editingItem.prodotto.requiresGlasses) {
      setShowEditModal(false)
      setPendingProduct({ product: editingItem.prodotto, quantity: editingItem.quantita })
      setGlassesCount(editingItem.glassesCount || editingItem.quantita)
      setShowGlassesModal(true)
    }
  }, [editingItem])
  
  // Handle edit notes
  const handleEditNotes = useCallback(() => {
    if (editingItem) {
      setShowEditModal(false)
      setPendingProduct({ product: editingItem.prodotto, quantity: editingItem.quantita })
      setCurrentNote(editingItem.note || '')
      setShowNotesModal(true)
      setEditingItemIndex(order.findIndex(item => item.prodotto.id === editingItem.prodotto.id))
    }
  }, [editingItem, order])
  
  // Update existing item after edit
  const handleUpdateItem = useCallback(() => {
    if (pendingProduct && editingItemIndex !== null) {
      setOrder(prev => prev.map((item, index) => 
        index === editingItemIndex 
          ? { 
              ...item, 
              note: currentNote || undefined,
              glassesCount: pendingProduct.product.requiresGlasses ? glassesCount : undefined
            }
          : item
      ))
      // Reset states
      setPendingProduct(null)
      setCurrentNote('')
      setShowNotesModal(false)
      setShowGlassesModal(false)
      setGlassesCount(0)
      setEditingItemIndex(null)
      // Show confirmation
      setAddedProductName('Modificato!')
      setShowAddedConfirm(true)
      setTimeout(() => setShowAddedConfirm(false), 1500)
    }
  }, [pendingProduct, editingItemIndex, currentNote, glassesCount])

  // Parse categories and subcategories
  const categoriesData = useMemo(() => {
    const categoryMap = new Map<string, Set<string>>()
    
    // Only include available products
    products.filter(p => p.disponibile !== false && !p.terminato).forEach(product => {
      const parts = product.categoria.split('>')
      if (parts.length === 2) {
        // Has subcategory
        const [mainCat, subCat] = parts.map(p => p.trim())
        if (!categoryMap.has(mainCat)) {
          categoryMap.set(mainCat, new Set())
        }
        categoryMap.get(mainCat)!.add(subCat)
      } else {
        // No subcategory
        const mainCat = product.categoria.trim()
        if (!categoryMap.has(mainCat)) {
          categoryMap.set(mainCat, new Set())
        }
      }
    })
    
    return categoryMap
  }, [products])
  
  // Get main categories
  const mainCategories = Array.from(categoriesData.keys()).sort()
  
  // Get subcategories for selected category
  const getSubcategories = (category: string) => {
    const subs = categoriesData.get(category)
    return subs ? Array.from(subs).sort() : []
  }
  
  // Get products for current selection
  const getFilteredProducts = () => {
    const baseFilter = (p: Product) => p.disponibile !== false && !p.terminato // Only available products
    
    if (selectedSubcategory && selectedCategory) {
      return products.filter(p => p.categoria === `${selectedCategory}>${selectedSubcategory}` && baseFilter(p))
    } else if (selectedCategory) {
      // Check if category has subcategories
      const subcats = getSubcategories(selectedCategory)
      if (subcats.length > 0) {
        // Don't show products, show subcategories instead
        return []
      }
      // Show products for category without subcategories
      return products.filter(p => p.categoria === selectedCategory && baseFilter(p))
    }
    return []
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b" style={{ 
        backgroundColor: colors.cardBg,
        borderColor: colors.border.primary 
      }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: colors.primary }}>
              Menu Bar Roxy
            </h1>
            
            {/* Order History Icon */}
            {hasCompletedOrder && generatedOrderCode && (
              <button
                onClick={reopenOrderModal}
                className="relative p-2 rounded-lg transition-colors hover:bg-orange-50 flex items-center gap-2"
                title="Visualizza ultimo ordine"
              >
                <Receipt className="h-6 w-6" style={{ color: colors.primary }} />
                {timeRemaining !== null && codeUsedByWaiter && (
                  <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-600 rounded-full">
                    {timeRemaining}s
                  </span>
                )}
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center ${
                  codeUsedByWaiter ? 'bg-green-500' : 'bg-orange-500'
                }`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content with padding for drawer */}
      <div className="container mx-auto px-4 py-4" style={{ paddingBottom: '120px' }}>
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cosa desideri oggi?"
            className="w-full pl-12 pr-4 py-4 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:shadow-xl transition-all text-lg"
            style={{
              backgroundColor: colors.bg.input,
              color: colors.text.primary,
            }}
            autoFocus
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && viewState === 'search' && (
          <div className="mt-6 max-w-2xl mx-auto space-y-2">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Risultati ricerca</h3>
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: colors.text.primary }}>
                    {product.nome}
                  </div>
                  <div className="text-sm" style={{ color: colors.text.secondary }}>
                    {product.categoria} • €{typeof product.prezzo === 'string' ? product.prezzo : product.prezzo.toFixed(2)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedQuantities(prev => ({
                        ...prev,
                        [product.id]: Math.max(1, (prev[product.id] || 1) - 1)
                      }))}
                      className="p-1.5 rounded bg-gray-700 hover:bg-gray-800 transition-colors text-white"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-gray-900">
                      {selectedQuantities[product.id] || 1}
                    </span>
                    <button
                      onClick={() => setSelectedQuantities(prev => ({
                        ...prev,
                        [product.id]: (prev[product.id] || 1) + 1
                      }))}
                      className="p-1.5 rounded bg-gray-700 hover:bg-gray-800 transition-colors text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                    onClick={() => handleProductAdd(product, selectedQuantities[product.id] || 1)}
                  >
                    Aggiungi
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {searchQuery.trim() && searchResults.length === 0 && (
          <div className="mt-4 p-4 text-center rounded-lg" style={{
            backgroundColor: colors.bg.darker,
            color: colors.text.muted
          }}>
            Nessun prodotto trovato
          </div>
        )}


        {/* Subcategories View */}
        {viewState === 'categories' && selectedCategory && getSubcategories(selectedCategory).length > 0 && (
          <div className="mt-6 max-w-4xl mx-auto">
            <button
              onClick={() => {
                setSelectedCategory(null)
                setSelectedSubcategory(null)
              }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-4 transition-colors"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              Torna alle categorie
            </button>
            
            <h2 className="text-2xl font-bold mb-4 text-gray-800">{selectedCategory}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {getSubcategories(selectedCategory).map((subcategory) => {
                const productCount = products.filter(p => 
                  p.categoria === `${selectedCategory}>${subcategory}` && p.disponibile !== false && !p.terminato
                ).length
                
                // Don't show subcategory if no available products
                if (productCount === 0) return null
                
                return (
                  <button
                    key={subcategory}
                    onClick={() => {
                      setSelectedSubcategory(subcategory)
                      setViewState('products')
                    }}
                    className="p-4 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300"
                  >
                    <div className="font-medium text-gray-800">{subcategory}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {productCount} prodotti
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Main Categories View */}
        {viewState === 'categories' && !selectedCategory && (
          <div className="mt-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Categorie</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {mainCategories.map((category) => {
                // Usa icone personalizzate dal database o default
                const categoryData = categoryEmojis[category.toUpperCase()] || categoryEmojis[category]
                const icon = categoryData?.emoji || '🍽️'
                const isImageIcon = categoryData?.iconType === 'image'
                
                const subcats = getSubcategories(category)
                const productCount = products.filter(p => 
                  (p.categoria === category || p.categoria.startsWith(`${category}>`)) && p.disponibile !== false && !p.terminato
                ).length
                
                // Don't show category if no available products
                if (productCount === 0) return null
                
                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category)
                      setSelectedSubcategory(null)
                      // If has subcategories, stay in categories view, else go to products
                      if (subcats.length === 0) {
                        setViewState('products')
                      }
                    }}
                    className="group p-6 rounded-2xl bg-white shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="mb-2">
                      {isImageIcon ? (
                        <img 
                          src={icon} 
                          alt={category}
                          className="w-12 h-12 mx-auto object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-3xl text-center">{icon}</div>
                      )}
                    </div>
                    <div className="font-semibold text-gray-800 text-lg">{category}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {subcats.length > 0 ? `${subcats.length} sottocategorie` : `${productCount} prodotti`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Products View */}
        {viewState === 'products' && selectedCategory && (
          <div className="mt-6 max-w-2xl mx-auto">
            <button
              onClick={() => {
                if (selectedSubcategory) {
                  setSelectedSubcategory(null)
                  setViewState('categories')
                } else {
                  setSelectedCategory(null)
                  setViewState('categories')
                }
              }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-4 transition-colors"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              Torna {selectedSubcategory ? 'alle sottocategorie' : 'alle categorie'}
            </button>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {selectedSubcategory ? `${selectedCategory} - ${selectedSubcategory}` : selectedCategory}
            </h2>
            
            <div className="space-y-3">
              {getFilteredProducts()
                .map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {product.nome}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-orange-600">
                          €{typeof product.prezzo === 'string' ? product.prezzo : product.prezzo.toFixed(2)}
                        </span>
                        {product.terminato && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                            Esaurito
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedQuantities(prev => ({
                            ...prev,
                            [product.id]: Math.max(1, (prev[product.id] || 1) - 1)
                          }))}
                          className="p-1 rounded bg-gray-700 hover:bg-gray-800 transition-colors text-white"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-gray-900">
                          {selectedQuantities[product.id] || 1}
                        </span>
                        <button
                          onClick={() => setSelectedQuantities(prev => ({
                            ...prev,
                            [product.id]: (prev[product.id] || 1) + 1
                          }))}
                          className="p-1 rounded bg-gray-700 hover:bg-gray-800 transition-colors text-white"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                        onClick={() => handleProductAdd(product, selectedQuantities[product.id] || 1)}
                      >
                        Aggiungi
                      </Button>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Drawer - Order Summary */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 shadow-2xl",
        drawerExpanded ? "h-[60vh]" : order.length > 0 ? "h-32" : "h-20"
      )} style={{
        background: 'linear-gradient(to top, #ffffff, #fafafa)',
        borderTop: '1px solid #e5e7eb'
      }}>
        {/* Drawer Header */}
        <div 
          className="flex items-center justify-between px-6 h-20 cursor-pointer relative"
          onClick={() => setDrawerExpanded(!drawerExpanded)}
        >
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full"></div>
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <ShoppingCart className="h-5 w-5" style={{ color: colors.primary }} />
            </div>
            <div>
              <div className="font-semibold text-gray-800">
                Il tuo ordine
              </div>
              <div className="text-xs text-gray-500">
                {order.length} {order.length === 1 ? 'prodotto' : 'prodotti'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">Totale</div>
              <div className="font-bold text-xl" style={{ color: colors.primary }}>
                €{getTotalOrder().toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-100 p-2 rounded-lg">
              {drawerExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        </div>
        
        {/* Quick Generate Button - Always visible when there are items */}
        {!drawerExpanded && order.length > 0 && (
          <div className="px-4 pb-2">
            <Button
              onClick={startOrderCodeGeneration}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white"
              size="sm"
              disabled={generatingCode}
            >
              {generatingCode ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generazione...
                </>
              ) : (
                <>
                  <Hash className="h-4 w-4 mr-2" />
                  Genera Codice Ordine
                </>
              )}
            </Button>
          </div>
        )}

        {/* Show Completed Order Button */}
        {!drawerExpanded && order.length === 0 && hasCompletedOrder && generatedOrderCode && (
          <div className="px-4 pb-2">
            <Button
              onClick={reopenOrderModal}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white"
              size="sm"
            >
              <Clock className="h-4 w-4 mr-2" />
              Mostra Ultimo Ordine
            </Button>
          </div>
        )}

        {/* Drawer Content */}
        {drawerExpanded && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {order.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" style={{ color: colors.text.muted }} />
                  <p style={{ color: colors.text.muted }}>Nessun prodotto nell'ordine</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {order.map((item) => (
                    <div
                      key={item.prodotto.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-200 transition-colors"
                      style={{ backgroundColor: '#f3f4f6' }}
                    >
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => handleEditItemClick(item)}
                      >
                        <div className="font-semibold text-gray-800">
                          {item.prodotto.nome}
                        </div>
                        <div className="text-sm text-gray-700 font-medium">
                          €{typeof item.prodotto.prezzo === 'string' ? item.prodotto.prezzo : item.prodotto.prezzo.toFixed(2)} x {item.quantita}
                        </div>
                        {item.note && (
                          <div className="text-xs text-gray-800 mt-1 italic">
                            📝 {item.note}
                          </div>
                        )}
                        {item.glassesCount !== undefined && (
                          <div className="text-xs text-gray-600 mt-1">
                            🥃 {item.glassesCount} bicchieri
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateOrderQuantity(item.prodotto.id, item.quantita - 1)
                            }}
                            className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-gray-800">
                            {item.quantita}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateOrderQuantity(item.prodotto.id, item.quantita + 1)
                            }}
                            className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFromOrder(item.prodotto.id)
                          }}
                          className="p-1 rounded text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {order.length > 0 && (
              <div className="p-4 border-t" style={{ borderColor: colors.border.primary }}>
                <Button
                  onClick={startOrderCodeGeneration}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                  size="lg"
                  disabled={generatingCode}
                >
                  {generatingCode ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generazione in corso...
                    </>
                  ) : (
                    <>
                      <Hash className="h-5 w-5 mr-2" />
                      Genera Codice Ordine
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Show Completed Order Button in expanded drawer */}
            {order.length === 0 && hasCompletedOrder && generatedOrderCode && (
              <div className="p-4 border-t" style={{ borderColor: colors.border.primary }}>
                <Button
                  onClick={reopenOrderModal}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white"
                  size="lg"
                >
                  <Clock className="h-5 w-5 mr-2" />
                  Mostra Ultimo Ordine ({generatedOrderCode.slice(0, 3)}-{generatedOrderCode.slice(3)})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Toast */}
      {showAddedConfirm && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span className="font-medium">Aggiunto: {addedProductName}</span>
          </div>
        </div>
      )}

      {/* Glasses Modal */}
      {showGlassesModal && pendingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center text-black">
              Numero di Bicchieri
            </h2>
            
            <p className="text-sm text-gray-600 mb-4">
              Hai ordinato {pendingProduct.quantity} {pendingProduct.product.nome}.
              Quanti bicchieri servono?
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={() => setGlassesCount(Math.max(1, glassesCount - 1))}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
              >
                <Minus className="h-5 w-5" />
              </button>
              
              <span className="text-3xl font-bold w-16 text-center" style={{ color: colors.primary }}>
                {glassesCount}
              </span>
              
              <button
                onClick={() => setGlassesCount(glassesCount + 1)}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowGlassesModal(false)
                  setPendingProduct(null)
                  setGlassesCount(0)
                }}
              >
                Annulla
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleGlassesConfirm}
              >
                Continua
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && pendingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center">
              Aggiungi Note (Opzionale)
            </h2>
            
            <p className="text-sm text-gray-600 mb-4">
              Aggiungi note per {pendingProduct.quantity}x {pendingProduct.product.nome}
              {pendingProduct.product.requiresGlasses && ` con ${glassesCount} bicchieri`}
            </p>
            
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              placeholder="Es: Senza ghiaccio, poco zucchero..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows={3}
            />
            
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSkipNotes}
              >
                Salta
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleNoteConfirm}
              >
                Aggiungi all'ordine
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Name Modal */}
      {showCustomerNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center text-black">
              Dati Cliente
            </h2>
            
            <p className="text-sm text-gray-600 mb-4 text-center">
              Inserisci i tuoi dati per generare il codice ordine
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Inserisci il tuo nome"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                  maxLength={50}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  value={customerSurname}
                  onChange={(e) => setCustomerSurname(e.target.value)}
                  placeholder="Inserisci il tuo cognome"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-black"
                  maxLength={50}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCustomerNameModal(false)
                  setCustomerName('')
                  setCustomerSurname('')
                }}
              >
                Annulla
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                onClick={generateOrderCode}
                disabled={!customerName.trim() || !customerSurname.trim() || generatingCode}
              >
                {generatingCode ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generazione...
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4 mr-2" />
                    Genera Codice
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Order Code Modal */}
      {showOrderCodeModal && generatedOrderCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-2 text-center" style={{ color: colors.text.primary }}>
              Il tuo codice ordine
            </h2>
            
            {customerName && customerSurname && (
              <p className="text-sm text-center mb-4" style={{ color: colors.text.secondary }}>
                Cliente: <span className="font-medium">{customerName} {customerSurname}</span>
              </p>
            )}
            
            <div className="bg-gradient-to-r from-orange-100 to-orange-50 p-8 rounded-lg mb-4">
              <div className="text-5xl font-bold text-center tracking-wider" style={{ color: colors.primary }}>
                {generatedOrderCode.slice(0, 3)}-{generatedOrderCode.slice(3)}
              </div>
            </div>
            
            <button
              onClick={copyCodeToClipboard}
              className="w-full mb-4 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-2 transition-colors text-black"
            >
              <Copy className="h-4 w-4" />
              <span className="text-sm font-medium">Copia codice</span>
            </button>
            
            <p className="text-sm text-center mb-4" style={{ color: colors.text.secondary }}>
              Comunica questo codice al cameriere per confermare il tuo ordine
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg mb-4">
              {!codeUsedByWaiter ? (
                <p className="text-xs text-center" style={{ color: colors.text.muted }}>
                  ⏱️ Il codice è valido per 15 minuti
                </p>
              ) : (
                <>
                  <p className="text-xs text-center text-green-600 font-medium mb-2">
                    ✅ Ordine ricevuto dal cameriere!
                  </p>
                  {timeRemaining !== null && (
                    <div className="text-center">
                      <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-600 rounded-full">
                        Rimozione automatica tra {timeRemaining} secondi
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm" style={{ color: colors.text.primary }}>
                Riepilogo ordine:
              </div>
              <div className="text-sm space-y-2" style={{ color: colors.text.primary }}>
                {(hasCompletedOrder ? completedOrderData : order).map((item) => (
                  <div key={item.prodotto.id} className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{item.quantita}x {item.prodotto.nome}</span>
                        {hasCompletedOrder && !codeUsedByWaiter && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateCompletedOrderQuantity(item.prodotto.id, item.quantita - 1)}
                              className="p-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => updateCompletedOrderQuantity(item.prodotto.id, item.quantita + 1)}
                              className="p-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeFromCompletedOrder(item.prodotto.id)}
                              className="p-0.5 rounded text-red-500 hover:bg-red-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {item.note && (
                        <div className="text-xs text-gray-600 italic mt-1">
                          📝 {item.note}
                        </div>
                      )}
                    </div>
                    <span>€{(typeof item.prodotto.prezzo === 'string' 
                      ? parseFloat(item.prodotto.prezzo) * item.quantita
                      : item.prodotto.prezzo * item.quantita).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t font-bold flex justify-between" style={{ color: colors.text.primary }}>
                <span>Totale:</span>
                <span style={{ color: colors.primary }}>€{(hasCompletedOrder ? completedOrderTotal : getTotalOrder()).toFixed(2)}</span>
              </div>
            </div>
            
            {hasCompletedOrder && orderModified && !codeUsedByWaiter && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700 text-center mb-3">
                  ⚠️ Ordine modificato - genera un nuovo codice
                </p>
                <Button
                  onClick={regenerateOrderCode}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                  disabled={generatingCode}
                >
                  {generatingCode ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <Hash className="h-4 w-4 mr-2" />
                      Genera Nuovo Codice
                    </>
                  )}
                </Button>
              </div>
            )}
            
            <Button
              onClick={() => setShowOrderCodeModal(false)}
              className="w-full mt-4"
              variant="outline"
            >
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4 text-center">
              Modifica Prodotto
            </h2>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-800">{editingItem.prodotto.nome}</div>
              <div className="text-sm text-gray-600 mt-1">
                Quantità: {editingItem.quantita} • €{typeof editingItem.prodotto.prezzo === 'string' 
                  ? editingItem.prodotto.prezzo 
                  : editingItem.prodotto.prezzo.toFixed(2)} cad.
              </div>
              {editingItem.glassesCount !== undefined && (
                <div className="text-sm text-gray-600 mt-1">
                  🥃 {editingItem.glassesCount} bicchieri
                </div>
              )}
              {editingItem.note && (
                <div className="text-sm text-gray-600 mt-1 italic">
                  📝 {editingItem.note}
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {editingItem.prodotto.requiresGlasses && (
                <Button
                  onClick={handleEditGlasses}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  size="lg"
                >
                  <Wine className="h-4 w-4 mr-2" />
                  Modifica Bicchieri
                </Button>
              )}
              
              <Button
                onClick={handleEditNotes}
                className="w-full bg-green-500 hover:bg-green-600 text-white"
                size="lg"
              >
                <NotebookPen className="h-4 w-4 mr-2" />
                {editingItem.note ? 'Modifica Note' : 'Aggiungi Note'}
              </Button>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowEditModal(false)
                  setEditingItem(null)
                }}
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}