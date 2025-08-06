import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Ottieni tutte le categorie dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      where: { disponibile: true },
      select: { categoria: true },
      distinct: ['categoria']
    })
    
    const categorieFromProducts = [...new Set(prodotti.map(p => p.categoria))].sort()
    
    // Ottieni le icone salvate
    const savedIcons = await prisma.categoryIcon.findMany()
    const iconMap = new Map(savedIcons.map(icon => [icon.categoryName, icon]))
    
    // Combina le informazioni
    const result = categorieFromProducts.map(categoria => {
      const saved = iconMap.get(categoria)
      return {
        id: saved?.id || 0,
        categoryName: categoria,
        icon: saved?.icon || null,
        iconType: saved?.iconType || 'emoji',
        color: saved?.color || null
      }
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Errore nel caricamento delle icone:', error)
    return NextResponse.json(
      { error: 'Errore nel caricamento delle icone' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { categoryName, icon, iconType, color } = body
    
    // Upsert: crea o aggiorna
    const result = await prisma.categoryIcon.upsert({
      where: { categoryName },
      update: {
        icon,
        iconType,
        color,
        updatedAt: new Date()
      },
      create: {
        categoryName,
        icon,
        iconType,
        color
      }
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Errore nel salvataggio:', error)
    return NextResponse.json(
      { error: 'Errore nel salvataggio' },
      { status: 500 }
    )
  }
}