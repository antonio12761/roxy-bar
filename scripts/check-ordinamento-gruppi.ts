import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function analyzeOrdinamento(modelName: string, items: Array<{id: number, nome: string, ordinamento: number}>) {
  console.log(`\n${modelName}: ${items.length} elementi`)
  
  // Controlla duplicati
  const ordinamenti = items.map(g => g.ordinamento)
  const duplicati = ordinamenti.filter((item, index) => ordinamenti.indexOf(item) !== index)
  
  if (duplicati.length > 0) {
    console.log(`⚠️  ATTENZIONE: Valori ordinamento duplicati: ${[...new Set(duplicati)].join(', ')}`)
  }

  // Controlla gaps
  const ordinamentiOrdinati = [...new Set(ordinamenti)].sort((a, b) => a - b)
  const gaps = []
  for (let i = 1; i < ordinamentiOrdinati.length; i++) {
    if (ordinamentiOrdinati[i] - ordinamentiOrdinati[i-1] > 1) {
      gaps.push(`${ordinamentiOrdinati[i-1]} -> ${ordinamentiOrdinati[i]}`)
    }
  }
  
  if (gaps.length > 0) {
    console.log(`⚠️  ATTENZIONE: Gaps nell'ordinamento: ${gaps.join(', ')}`)
  }

  console.log(`Range ordinamento: ${Math.min(...ordinamenti)} - ${Math.max(...ordinamenti)}`)
  console.log(`Valori unici: ${[...new Set(ordinamenti)].length}`)
  
  // Mostra tutti gli elementi con il loro ordinamento
  console.log('\nDettaglio:')
  items
    .sort((a, b) => a.ordinamento - b.ordinamento)
    .forEach(item => {
      console.log(`  ${item.ordinamento.toString().padStart(3)} - ${item.nome} (ID: ${item.id})`)
    })
}

async function checkOrdinamentoGruppi() {
  try {
    console.log('=== CONTROLLO ORDINAMENTO MODELLI ===\n')
    
    // Controlla CategoriaMenu
    console.log('--- CategoriaMenu ---')
    const categorieMenu = await prisma.categoriaMenu.findMany({
      orderBy: {
        ordinamento: 'asc'
      },
      select: {
        id: true,
        nome: true,
        ordinamento: true,
        attiva: true
      }
    })
    
    if (categorieMenu.length > 0) {
      analyzeOrdinamento('CategoriaMenu', categorieMenu)
    } else {
      console.log('Nessuna categoria menu trovata')
    }

    // Controlla MenuCategory
    console.log('\n--- MenuCategory ---')
    const menuCategories = await prisma.menuCategory.findMany({
      orderBy: {
        ordinamento: 'asc'
      },
      select: {
        id: true,
        nome: true,
        ordinamento: true,
        groupId: true
      }
    })
    
    if (menuCategories.length > 0) {
      // Raggruppa per groupId
      const perGroup = menuCategories.reduce((acc, cat) => {
        if (!acc[cat.groupId || 'no-group']) {
          acc[cat.groupId || 'no-group'] = []
        }
        acc[cat.groupId || 'no-group'].push(cat)
        return acc
      }, {} as Record<string, typeof menuCategories>)
      
      Object.entries(perGroup).forEach(([groupId, cats]) => {
        console.log(`\nGruppo ID: ${groupId}`)
        analyzeOrdinamento(`MenuCategory (Group ${groupId})`, cats.map(c => ({
          id: c.id,
          nome: c.nome,
          ordinamento: c.ordinamento
        })))
      })
    } else {
      console.log('Nessuna MenuCategory trovata')
    }

    // Controlla CategoriaUnificata  
    console.log('\n--- CategoriaUnificata ---')
    const categorieUnificate = await prisma.categoriaUnificata.findMany({
      orderBy: {
        ordinamento: 'asc'
      },
      select: {
        id: true,
        nome: true,
        ordinamento: true,
        attiva: true
      }
    })
    
    if (categorieUnificate.length > 0) {
      analyzeOrdinamento('CategoriaUnificata', categorieUnificate)
    } else {
      console.log('Nessuna categoria unificata trovata')
    }


  } catch (error) {
    console.error('Errore durante il controllo:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkOrdinamentoGruppi()