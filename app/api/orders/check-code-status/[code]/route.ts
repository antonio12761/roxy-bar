import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// In-memory cache to track used order codes
const usedCodesCache = new Map<string, {
  usedAt: Date
  processedBy?: string
}>()

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params
    
    if (!code) {
      return NextResponse.json(
        { error: 'Codice ordine mancante' },
        { status: 400 }
      )
    }

    // Check if code is marked as used in memory cache
    const usedCode = usedCodesCache.get(code)
    if (usedCode) {
      return NextResponse.json({
        used: true,
        exists: true,
        usedAt: usedCode.usedAt.toISOString(),
        orderCode: code
      })
    }

    // Check if order was processed by checking Ordinazione table
    const processedOrder = await db.ordinazione.findFirst({
      where: {
        // NOTE: customerOrderCode field doesn't exist in schema yet
        // This might need to be implemented or use a different field
        id: code // Temporary fix - may need proper implementation
      },
      select: {
        id: true,
        createdAt: true,
        User: {
          select: {
            nome: true
          }
        }
      }
    })

    if (processedOrder) {
      // Mark as used in cache for future checks
      usedCodesCache.set(code, {
        usedAt: processedOrder.createdAt,
        processedBy: processedOrder.User.nome
      })

      return NextResponse.json({
        used: true,
        exists: true,
        usedAt: processedOrder.createdAt.toISOString(),
        orderCode: code,
        processedBy: processedOrder.User.nome
      })
    }

    return NextResponse.json({
      used: false,
      exists: true,
      orderCode: code
    })

  } catch (error) {
    console.error('Error checking code status:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

// Optional: Clean up old entries every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  for (const [code, data] of usedCodesCache.entries()) {
    if (data.usedAt < oneHourAgo) {
      usedCodesCache.delete(code)
    }
  }
}, 60 * 60 * 1000)