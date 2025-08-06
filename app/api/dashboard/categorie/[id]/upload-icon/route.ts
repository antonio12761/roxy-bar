import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)
    
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

    // Genera un nome file unico
    const timestamp = Date.now()
    const fileExt = path.extname(file.name)
    const fileName = `category-${id}-${timestamp}${fileExt}`
    const filePath = path.join(uploadDir, fileName)

    // Salva il file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // URL pubblico del file
    const iconUrl = `/category-icons/${fileName}`

    // Aggiorna il database con l'URL dell'icona
    const categoria = await prisma.categoriaMenu.update({
      where: { id },
      data: {
        emoji: iconUrl, // Salviamo l'URL nel campo emoji
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      iconUrl,
      categoria
    })
  } catch (error) {
    console.error('Errore nell\'upload dell\'icona:', error)
    return NextResponse.json(
      { error: 'Errore nell\'upload dell\'icona' },
      { status: 500 }
    )
  }
}