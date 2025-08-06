'use server'

// In-memory storage for customer orders (in production, use Redis or database)
const ordersCache = new Map<string, {
  data: any
  createdAt: Date
  expiresAt: Date
  ipAddress?: string
}>()

// Track order creation attempts per IP (rate limiting)
const rateLimitMap = new Map<string, {
  count: number
  resetAt: Date
}>()

// Clean expired orders and rate limits every 2 minutes
setInterval(() => {
  const now = new Date()
  
  // Clean expired orders
  for (const [key, value] of ordersCache.entries()) {
    if (value.expiresAt < now) {
      ordersCache.delete(key)
    }
  }
  
  // Clean expired rate limits
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key)
    }
  }
}, 2 * 60 * 1000)

// Generate 6-digit numeric code
function generateOrderCode(): string {
  // Generate a random 6-digit number (100000-999999)
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  
  // Check if code already exists (very unlikely but let's be safe)
  if (ordersCache.has(code)) {
    return generateOrderCode() // Recursive call to generate a new one
  }
  
  return code
}

export interface CustomerOrderData {
  timestamp: number
  items: {
    id: number
    nome: string
    quantita: number
    prezzo: number | string
    note?: string
    glassesCount?: number
  }[]
  totale: number
}

// Check rate limit for an identifier (IP or session)
function checkRateLimit(identifier: string): boolean {
  const now = new Date()
  const limit = rateLimitMap.get(identifier)
  
  if (!limit || limit.resetAt < now) {
    // Create new rate limit window (5 orders per 10 minutes)
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: new Date(now.getTime() + 10 * 60 * 1000)
    })
    return true
  }
  
  if (limit.count >= 5) {
    // Rate limit exceeded
    return false
  }
  
  // Increment count
  limit.count++
  return true
}

export async function createCustomerOrder(orderData: CustomerOrderData, ipAddress?: string) {
  try {
    // Check rate limit (use IP or a default identifier)
    const identifier = ipAddress || 'anonymous'
    if (!checkRateLimit(identifier)) {
      return {
        success: false,
        error: 'Troppi ordini creati. Riprova tra qualche minuto.'
      }
    }
    
    // Validate order data
    if (!orderData.items || orderData.items.length === 0) {
      return {
        success: false,
        error: 'L\'ordine è vuoto'
      }
    }
    
    if (orderData.items.length > 50) {
      return {
        success: false,
        error: 'Ordine troppo grande (massimo 50 prodotti)'
      }
    }
    
    // Generate 6-digit code
    const orderCode = generateOrderCode()
    
    // Store order with 15 minute expiration
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000)
    
    ordersCache.set(orderCode, {
      data: orderData,
      createdAt: now,
      expiresAt,
      ipAddress
    })
    
    return {
      success: true,
      orderCode,
      expiresAt: expiresAt.toISOString()
    }
  } catch (error) {
    console.error('Error creating customer order:', error)
    return {
      success: false,
      error: 'Errore nella creazione dell\'ordine'
    }
  }
}

export async function getCustomerOrder(orderCode: string) {
  try {
    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(orderCode)) {
      return {
        success: false,
        error: 'Codice non valido. Deve essere di 6 cifre.'
      }
    }
    
    const order = ordersCache.get(orderCode)
    
    if (!order) {
      return {
        success: false,
        error: 'Ordine non trovato o scaduto'
      }
    }
    
    // Check if order is expired
    if (order.expiresAt < new Date()) {
      ordersCache.delete(orderCode)
      return {
        success: false,
        error: 'L\'ordine è scaduto (valido per 15 minuti)'
      }
    }
    
    return {
      success: true,
      data: order.data,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString()
    }
  } catch (error) {
    console.error('Error getting customer order:', error)
    return {
      success: false,
      error: 'Errore nel recupero dell\'ordine'
    }
  }
}

export async function deleteCustomerOrder(orderCode: string) {
  try {
    const deleted = ordersCache.delete(orderCode)
    
    return {
      success: deleted,
      message: deleted ? 'Ordine eliminato' : 'Ordine non trovato'
    }
  } catch (error) {
    console.error('Error deleting customer order:', error)
    return {
      success: false,
      error: 'Errore nell\'eliminazione dell\'ordine'
    }
  }
}

// Get current orders count (for monitoring)
export async function getOrdersStats() {
  return {
    activeOrders: ordersCache.size,
    rateLimitedIPs: rateLimitMap.size
  }
}