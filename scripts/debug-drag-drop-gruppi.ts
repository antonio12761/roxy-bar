import { prisma } from '@/lib/db'

async function debugDragDropGruppi() {
  try {
    console.log('=== DEBUG DRAG&DROP GRUPPI ===\n')
    
    // 1. Mostra lo stato attuale
    console.log('1. STATO ATTUALE DEI GRUPPI:')
    const gruppiAttuali = await prisma.gruppoTavoli.findMany({
      where: { attivo: true },
      orderBy: { ordinamento: 'asc' },
      select: { id: true, nome: true, ordinamento: true }
    })
    
    gruppiAttuali.forEach(gruppo => {
      console.log(`   ID: ${gruppo.id}, Nome: ${gruppo.nome}, Ordinamento: ${gruppo.ordinamento}`)
    })
    
    // 2. Simula un drag&drop - spostiamo "Piazza" (ordinamento=4) al primo posto
    console.log('\n2. SIMULAZIONE DRAG&DROP: Sposto "Piazza" al primo posto')
    
    // Trova l'ID di Piazza
    const piazza = gruppiAttuali.find(g => g.nome === 'Piazza')
    if (!piazza) {
      console.log('   Gruppo "Piazza" non trovato!')
      return
    }
    
    // Riordina come farebbe il componente (usando indici 0-based)
    const oldIndex = gruppiAttuali.findIndex(g => g.id === piazza.id)
    const newIndex = 0
    
    // Simula arrayMove
    const newGruppi = [...gruppiAttuali]
    const [removed] = newGruppi.splice(oldIndex, 1)
    newGruppi.splice(newIndex, 0, removed)
    
    console.log('\n   Nuovo ordine dopo arrayMove:')
    newGruppi.forEach((gruppo, index) => {
      console.log(`   Posizione ${index}: ${gruppo.nome}`)
    })
    
    // 3. Prepara l'aggiornamento come fa il componente
    const gruppiOrdinamento = newGruppi.map((gruppo, index) => ({
      id: gruppo.id,
      ordinamento: index  // Usa indici 0-based!
    }))
    
    console.log('\n3. AGGIORNAMENTI CHE VERREBBERO INVIATI AL DB:')
    gruppiOrdinamento.forEach(update => {
      const gruppo = gruppiAttuali.find(g => g.id === update.id)
      console.log(`   ${gruppo?.nome}: ordinamento ${gruppo?.ordinamento} -> ${update.ordinamento}`)
    })
    
    // 4. Verifica come vengono recuperati dal cameriere
    console.log('\n4. QUERY CAMERIERE (getTavoli):')
    const tavoliCameriere = await prisma.tavolo.findMany({
      where: {
        attivo: true,
        visibile: true,
        GruppoTavoli: {
          visibile: true
        }
      },
      include: {
        GruppoTavoli: true
      },
      orderBy: [
        { GruppoTavoli: { ordinamento: 'asc' } },
        { ordinamento: 'asc' },
        { numero: 'asc' }
      ],
      take: 10  // Solo primi 10 per debug
    })
    
    // Mostra l'ordine dei gruppi come appaiono nei tavoli
    const gruppiOrdineCameriere: string[] = []
    const gruppiVisti = new Set<string>()
    
    tavoliCameriere.forEach(tavolo => {
      const nomeGruppo = tavolo.GruppoTavoli?.nome || 'Senza Gruppo'
      if (!gruppiVisti.has(nomeGruppo)) {
        gruppiVisti.add(nomeGruppo)
        gruppiOrdineCameriere.push(`${nomeGruppo} (ordinamento=${tavolo.GruppoTavoli?.ordinamento})`)
      }
    })
    
    console.log('\n   Ordine gruppi visto dal cameriere:')
    gruppiOrdineCameriere.forEach((gruppo, index) => {
      console.log(`   ${index + 1}. ${gruppo}`)
    })
    
    // 5. Suggerimento per il fix
    console.log('\n5. POSSIBILE SOLUZIONE:')
    console.log('   Il problema potrebbe essere che l\'admin usa indici 0-based (0,1,2,3)')
    console.log('   mentre il DB attualmente ha valori 1-based (1,2,3,4).')
    console.log('   Opzioni:')
    console.log('   A) Modificare handleDragEnd per usare (index + 1) invece di index')
    console.log('   B) Normalizzare tutti i valori di ordinamento a 0-based nel DB')
    console.log('   C) Assicurarsi che entrambe le interfacce usino la stessa convenzione')
    
  } catch (error) {
    console.error('Errore durante il debug:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugDragDropGruppi()