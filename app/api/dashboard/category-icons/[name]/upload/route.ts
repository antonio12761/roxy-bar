import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const resolvedParams = await params
    const categoryName = decodeURIComponent(resolvedParams.name)
    
    const formData = await req.formData()
    const file = formData.get('icon') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'Nessun file caricato' },
        { status: 400 }
      )
    }

    // Verifica il tipo di file
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Il file deve essere un\'immagine' },
        { status: 400 }
      )
    }

    // Limita la dimensione del file (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Il file non può superare i 2MB' },
        { status: 400 }
      )
    }

    // Crea la directory se non esiste
    const uploadDir = path.join(process.cwd(), 'public', 'category-icons')
    await mkdir(uploadDir, { recursive: true })

    // Genera un nome file unico e sicuro
    const timestamp = Date.now()
    const fileExt = path.extname(file.name)
    const safeFileName = categoryName.replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `${safeFileName}-${timestamp}${fileExt}`
    const filePath = path.join(uploadDir, fileName)

    // Salva il file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // URL pubblico del file
    const iconUrl = `/category-icons/${fileName}`

    // Upsert nel database
    const result = await db.categoryIcon.upsert({
      where: { categoryName },
      update: {
        icon: iconUrl,
        iconType: 'image',
        updatedAt: new Date()
      },
      create: {
        categoryName,
        icon: iconUrl,
        iconType: 'image'
      }
    })

    return NextResponse.json({
      success: true,
      iconUrl,
      categoryIcon: result
    })
  } catch (error) {
    console.error('Errore nell\'upload dell\'icona:', error)
    return NextResponse.json(
      { error: 'Errore nell\'upload dell\'icona' },
      { status: 500 }
    )
  }
}