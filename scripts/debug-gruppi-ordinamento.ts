import { prisma } from '@/lib/db'

async function debugGruppiOrdinamento() {
  try {
    console.log('=== DEBUG ORDINAMENTO GRUPPI TAVOLI ===\n')
    
    // 1. Verifica i gruppi nel database
    const gruppi = await prisma.gruppoTavoli.findMany({
      orderBy: { ordinamento: 'asc' },
      include: {
        _count: {
          select: { Tavolo: true }
        }
      }
    })
    
    console.log('Gruppi nel database:')
    gruppi.forEach(gruppo => {
      console.log(`- ${gruppo.nome}: ordinamento=${gruppo.ordinamento}, id=${gruppo.id}, tavoli=${gruppo._count.Tavolo}`)
    })
    
    // 2. Verifica se ci sono duplicati nell'ordinamento
    const ordinamenti = gruppi.map(g => g.ordinamento)
    const duplicati = ordinamenti.filter((item, index) => ordinamenti.indexOf(item) !== index)
    if (duplicati.length > 0) {
      console.log('\n⚠️  ATTENZIONE: Trovati valori di ordinamento duplicati:', duplicati)
    }
    
    // 3. Verifica se ci sono gap nell'ordinamento
    const ordinamentiOrdinati = [...ordinamenti].sort((a, b) => a - b)
    const gaps = []
    for (let i = 0; i < ordinamentiOrdinati.length - 1; i++) {
      if (ordinamentiOrdinati[i + 1] - ordinamentiOrdinati[i] > 1) {
        gaps.push(`Gap tra ${ordinamentiOrdinati[i]} e ${ordinamentiOrdinati[i + 1]}`)
      }
    }
    if (gaps.length > 0) {
      console.log('\n⚠️  ATTENZIONE: Trovati gap nell\'ordinamento:', gaps)
    }
    
    // 4. Verifica i tavoli con i loro gruppi
    console.log('\n\nTavoli per gruppo:')
    for (const gruppo of gruppi) {
      const tavoli = await prisma.tavolo.findMany({
        where: { gruppoId: gruppo.id },
        orderBy: { numero: 'asc' },
        select: { id: true, numero: true }
      })
      
      console.log(`\n${gruppo.nome} (ordinamento=${gruppo.ordinamento}):`)
      tavoli.forEach(tavolo => {
        console.log(`  - Tavolo ${tavolo.numero}`)
      })
    }
    
  } catch (error) {
    console.error('Errore durante il debug:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugGruppiOrdinamento()