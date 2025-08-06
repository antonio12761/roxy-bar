import { prisma } from '@/lib/db'

async function syncCategoryIcons() {
  try {
    console.log('🎨 Sincronizzazione icone categorie...')
    
    // Ottieni tutte le categorie uniche dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      where: { disponibile: true },
      select: { categoria: true }
    })
    
    const categorie = [...new Set(prodotti.map(p => p.categoria))].sort()
    
    console.log(`📦 Trovate ${categorie.length} categorie nei prodotti`)
    
    // Emoji di default per categorie
    const defaultIcons: Record<string, string> = {
      'CAFFETTERIA': '☕',
      'BIRRE': '🍺',
      'BIRRA': '🍺',
      'BIRRASPINA': '🍺',
      'COCKTAIL': '🍹',
      'MIXCOCKTAIL': '🍹',
      'APERITIVI': '🥂',
      'ALCOLICI': '🥃',
      'BIBITE': '🥤',
      'PANINI': '🥪',
      'GELATI': '🍨',
      'LIQUORI': '🥃',
      'DISTILLATI': '🥃',
      'VINI&SPUMANTI': '🍷',
      'SNACK&CO.': '🍿',
      'DOLCIUMI': '🍬',
      'CARAMELLE&GOMME': '🍬',
      // Sottocategorie distillati
      'DISTILLATI>GIN': '🥃',
      'DISTILLATI>VODKA': '🥃',
      'DISTILLATI>WHISKY': '🥃',
      'DISTILLATI>GRAPPA': '🥃',
      'DISTILLATI>BRANDY': '🥃',
      'LIQUORI>AMARI': '🌿'
    }
    
    // Colori di default
    const defaultColors: Record<string, string> = {
      'CAFFETTERIA': '#6B4423',
      'BIRRE': '#F59E0B',
      'BIRRA': '#F59E0B',
      'BIRRASPINA': '#F59E0B',
      'COCKTAIL': '#EC4899',
      'MIXCOCKTAIL': '#EC4899',
      'APERITIVI': '#F59E0B',
      'ALCOLICI': '#9333EA',
      'BIBITE': '#3B82F6',
      'PANINI': '#84CC16',
      'GELATI': '#06B6D4',
      'LIQUORI': '#B45309',
      'DISTILLATI': '#B45309',
      'VINI&SPUMANTI': '#991B1B',
      'SNACK&CO.': '#F97316',
      'DOLCIUMI': '#EC4899',
      'CARAMELLE&GOMME': '#EC4899'
    }
    
    let created = 0
    let updated = 0
    
    for (const categoria of categorie) {
      const categoriaUpper = categoria.toUpperCase()
      
      // Controlla se esiste già
      const existing = await prisma.categoryIcon.findUnique({
        where: { categoryName: categoria }
      })
      
      if (existing) {
        // Aggiorna solo se mancano icona o colore
        if (!existing.icon || !existing.color) {
          await prisma.categoryIcon.update({
            where: { id: existing.id },
            data: {
              icon: existing.icon || defaultIcons[categoriaUpper] || '🍽️',
              color: existing.color || defaultColors[categoriaUpper.split('>')[0]] || '#6B7280',
              updatedAt: new Date()
            }
          })
          updated++
          console.log(`✅ Aggiornata: ${categoria}`)
        }
      } else {
        // Crea nuova
        await prisma.categoryIcon.create({
          data: {
            categoryName: categoria,
            icon: defaultIcons[categoriaUpper] || '🍽️',
            iconType: 'emoji',
            color: defaultColors[categoriaUpper.split('>')[0]] || '#6B7280'
          }
        })
        created++
        console.log(`✨ Creata: ${categoria}`)
      }
    }
    
    console.log(`\n📊 Riepilogo:`)
    console.log(`   - Create: ${created}`)
    console.log(`   - Aggiornate: ${updated}`)
    
    // Mostra tutte le icone
    const allIcons = await prisma.categoryIcon.findMany({
      orderBy: { categoryName: 'asc' }
    })
    
    console.log('\n📋 Icone categorie:')
    allIcons.forEach(cat => {
      console.log(`   ${cat.icon} ${cat.categoryName}`)
    })
    
  } catch (error) {
    console.error('❌ Errore:', error)
  } finally {
    await prisma.$disconnect()
  }
}

syncCategoryIcons()