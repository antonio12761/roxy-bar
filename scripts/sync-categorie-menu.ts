import { prisma } from '@/lib/db'

async function syncCategorieMenu() {
  try {
    console.log('📦 Sincronizzazione categorie menu...')
    
    // Ottieni tutte le categorie uniche dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      where: { disponibile: true },
      select: { categoria: true }
    })
    
    // Estrai categorie uniche (sia principali che sottocategorie)
    const categorieSet = new Set<string>()
    const categorieMap = new Map<string, { principale: string, sub?: string }>()
    
    prodotti.forEach(p => {
      const categoria = p.categoria
      
      // Gestisci categorie con sottocategorie (formato: "CATEGORIA > SOTTOCATEGORIA")
      if (categoria.includes('>')) {
        const [principale, sub] = categoria.split('>').map(s => s.trim())
        categorieSet.add(principale)
        categorieMap.set(principale, { principale })
      } else {
        categorieSet.add(categoria)
        categorieMap.set(categoria, { principale: categoria })
      }
    })
    
    console.log(`📊 Trovate ${categorieSet.size} categorie uniche`)
    
    // Emoji di default per categorie comuni
    const defaultEmojis: Record<string, string> = {
      'CAFFETTERIA': '☕',
      'CAFFE': '☕',
      'BIRRE': '🍺',
      'COCKTAIL': '🍹',
      'APERITIVI': '🥂',
      'VINI': '🍷',
      'BIBITE': '🥤',
      'PANINI': '🥪',
      'PIZZA': '🍕',
      'DOLCI': '🍰',
      'GELATI': '🍨',
      'SUPERALCOLICI': '🥃',
      'LIQUORI': '🥃',
      'AMARI': '🥃',
      'DISTILLATI': '🥃',
      'ALCOLICI': '🍸',
      'SFIZIOSITA': '🍟',
      'SNACK': '🍿'
    }
    
    // Colori di default per categorie
    const defaultColors: Record<string, string> = {
      'CAFFETTERIA': '#6B4423',
      'CAFFE': '#6B4423',
      'BIRRE': '#F59E0B',
      'COCKTAIL': '#EC4899',
      'APERITIVI': '#F59E0B',
      'VINI': '#991B1B',
      'BIBITE': '#3B82F6',
      'PANINI': '#84CC16',
      'PIZZA': '#EF4444',
      'DOLCI': '#EC4899',
      'GELATI': '#06B6D4',
      'SUPERALCOLICI': '#B45309',
      'LIQUORI': '#B45309',
      'AMARI': '#059669',
      'DISTILLATI': '#B45309',
      'ALCOLICI': '#9333EA',
      'SFIZIOSITA': '#F97316',
      'SNACK': '#FBBF24'
    }
    
    let created = 0
    let updated = 0
    
    // Sincronizza ogni categoria
    for (const nomeCategoria of Array.from(categorieSet)) {
      const nomeUpper = nomeCategoria.toUpperCase()
      
      // Crea nome display formattato
      const nomeDisplay = nomeCategoria
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
      
      const existing = await prisma.categoriaMenu.findUnique({
        where: { nome: nomeUpper }
      })
      
      if (existing) {
        // Aggiorna solo se mancano emoji o colore
        if (!existing.emoji || !existing.coloreHex) {
          await prisma.categoriaMenu.update({
            where: { id: existing.id },
            data: {
              emoji: existing.emoji || defaultEmojis[nomeUpper] || '🍽️',
              coloreHex: existing.coloreHex || defaultColors[nomeUpper] || '#6B7280',
              nomeDisplay: existing.nomeDisplay || nomeDisplay,
              updatedAt: new Date()
            }
          })
          updated++
          console.log(`✅ Aggiornata categoria: ${nomeUpper}`)
        }
      } else {
        // Crea nuova categoria
        await prisma.categoriaMenu.create({
          data: {
            nome: nomeUpper,
            nomeDisplay,
            emoji: defaultEmojis[nomeUpper] || '🍽️',
            coloreHex: defaultColors[nomeUpper] || '#6B7280',
            descrizione: `Categoria ${nomeDisplay}`,
            ordinamento: Object.keys(defaultEmojis).indexOf(nomeUpper) >= 0 
              ? Object.keys(defaultEmojis).indexOf(nomeUpper) 
              : 99,
            attiva: true,
            updatedAt: new Date()
          }
        })
        created++
        console.log(`✨ Creata nuova categoria: ${nomeUpper}`)
      }
    }
    
    console.log(`\n📊 Riepilogo:`)
    console.log(`   - Categorie create: ${created}`)
    console.log(`   - Categorie aggiornate: ${updated}`)
    console.log(`   - Totale categorie: ${categorieSet.size}`)
    
    // Mostra tutte le categorie nel database
    const allCategories = await prisma.categoriaMenu.findMany({
      orderBy: { ordinamento: 'asc' }
    })
    
    console.log('\n📋 Categorie nel database:')
    allCategories.forEach(cat => {
      console.log(`   ${cat.emoji} ${cat.nomeDisplay} (${cat.nome})`)
    })
    
  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Esegui lo script
syncCategorieMenu()
  .then(() => {
    console.log('\n✅ Sincronizzazione completata!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error)
    process.exit(1)
  })