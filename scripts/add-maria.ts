import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function addMaria() {
  console.log('👩‍🍳 Aggiunta utente Maria (CUCINA)...')
  
  try {
    // Hash della password
    const hashedPassword = await bcrypt.hash('cucina123', 12)
    
    // Crea l'utente Maria
    const maria = await prisma.user.create({
      data: {
        email: 'maria@bar.com',
        password: hashedPassword,
        nome: 'Maria',
        cognome: 'Rossi',
        ruolo: 'CUCINA',
        attivo: true
      }
    })
    
    console.log('✅ Utente Maria creato con successo:')
    console.log(`  - Nome: ${maria.nome} ${maria.cognome}`)
    console.log(`  - Email: ${maria.email}`)
    console.log(`  - Ruolo: ${maria.ruolo}`)
    console.log(`  - Password: cucina123`)
    
    // Mostra tutti gli utenti
    const allUsers = await prisma.user.findMany({
      select: {
        nome: true,
        ruolo: true,
        email: true
      },
      orderBy: {
        nome: 'asc'
      }
    })
    
    console.log('\n📋 Lista completa utenti:')
    allUsers.forEach(u => {
      console.log(`  - ${u.nome} (${u.ruolo}) - ${u.email}`)
    })
    
  } catch (error) {
    console.error('❌ Errore durante la creazione:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addMaria()