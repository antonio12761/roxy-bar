import { prisma } from '@/lib/db'

async function checkCategories() {
  try {
    // Ottieni tutte le categorie uniche dai prodotti
    const prodotti = await prisma.prodotto.findMany({
      where: { disponibile: true },
      select: { categoria: true },
      distinct: ['categoria']
    })
    
    const categorie = [...new Set(prodotti.map(p => p.categoria))].sort()
    
    console.log('📦 Categorie trovate nei prodotti:')
    console.log('================================')
    categorie.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat}`)
    })
    console.log('================================')
    console.log(`Totale: ${categorie.length} categorie`)
    
  } catch (error) {
    console.error('Errore:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCategories()