import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    const categorie = await db.categoriaMenu.findMany({
      orderBy: [
        { ordinamento: 'asc' },
        { nome: 'asc' }
      ],
      select: {
        id: true,
        nome: true,
        nomeDisplay: true,
        emoji: true,
        coloreHex: true,
        ordinamento: true,
        attiva: true
      }
    })

    return NextResponse.json(categorie)
  } catch (error) {
    console.error('Errore nel caricamento delle categorie:', error)
    return NextResponse.json(
      { error: 'Errore nel caricamento delle categorie' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, nomeDisplay, emoji, coloreHex } = body

    const categoria = await db.categoriaMenu.create({
      data: {
        nome,
        nomeDisplay,
        emoji,
        coloreHex,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(categoria)
  } catch (error) {
    console.error('Errore nella creazione della categoria:', error)
    return NextResponse.json(
      { error: 'Errore nella creazione della categoria' },
      { status: 500 }
    )
  }
}