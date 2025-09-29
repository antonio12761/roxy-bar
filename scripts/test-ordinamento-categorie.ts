import { prisma } from '../lib/db'
import { getCategorieMenu, getProdotti } from '../lib/actions/ordinazioni/prodotti'

async function testOrdinamentoCategorie() {
  try {
    console.log('=== TEST ORDINAMENTO CATEGORIE ===\n')
    
    // 1. Recupera categorie dal database con ordinamento
    console.log('1. Categorie Menu dal database:')
    const categorieMenu = await getCategorieMenu()
    categorieMenu.forEach(cat => {
      console.log(`   ${cat.ordinamento} - ${cat.nome} (ID: ${cat.id})`)
    })
    
    // 2. Recupera prodotti
    console.log('\n2. Prodotti con categorie:')
    const prodotti = await getProdotti()
    
    // Raggruppa prodotti per categoria
    const prodottiPerCategoria = prodotti.reduce((acc, prod) => {
      if (!acc[prod.categoria]) {
        acc[prod.categoria] = []
      }
      acc[prod.categoria].push(prod)
      return acc
    }, {} as Record<string, typeof prodotti>)
    
    console.log('\nCategorie trovate nei prodotti:')
    Object.keys(prodottiPerCategoria).sort().forEach(cat => {
      const count = prodottiPerCategoria[cat].length
      const hasCategoriaMenu = prodottiPerCategoria[cat].some(p => p.categoriaMenuId)
      console.log(`   - ${cat} (${count} prodotti, ${hasCategoriaMenu ? 'con' : 'senza'} CategoriaMenu)`)
    })
    
    // 3. Simula l'ordinamento che verrà usato nell'interfaccia
    console.log('\n3. Ordinamento finale delle categorie (come apparirà nel cameriere):')
    
    // Create category order map
    const categoryOrder = new Map()
    categorieMenu.forEach((cat, index) => {
      categoryOrder.set(cat.nome, index)
    })
    
    // Get all unique categories and sort them
    const allCategories = Object.keys(prodottiPerCategoria)
    const sortedCategories = allCategories.sort((a, b) => {
      const orderA = categoryOrder.get(a)
      const orderB = categoryOrder.get(b)
      
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB
      }
      if (orderA !== undefined) return -1
      if (orderB !== undefined) return 1
      return a.localeCompare(b)
    })
    
    sortedCategories.forEach((cat, index) => {
      const order = categoryOrder.get(cat)
      console.log(`   ${index + 1}. ${cat} ${order !== undefined ? `(ordinamento: ${order + 1})` : '(non in CategoriaMenu)'}`)
    })
    
    // 4. Verifica prodotti senza categoria menu
    console.log('\n4. Prodotti senza associazione CategoriaMenu:')
    const prodottiSenzaCategoriaMenu = prodotti.filter(p => !p.categoriaMenuId)
    console.log(`   Totale: ${prodottiSenzaCategoriaMenu.length} prodotti`)
    
    if (prodottiSenzaCategoriaMenu.length > 0) {
      console.log('\n   Suggerimento: Per usare l\'ordinamento personalizzato, associa i prodotti alle CategoriaMenu')
      console.log('   tramite il campo categoriaMenuId.')
    }
    
  } catch (error) {
    console.error('Errore durante il test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testOrdinamentoCategorie()