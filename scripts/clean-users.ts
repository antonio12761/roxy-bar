import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanUsers() {
  console.log('🧹 Inizio pulizia utenti...')
  
  const usersToKeep = ['Antonio', 'Filippo', 'Giulio', 'Linda', 'MarioC', 'MarioM', 'Gaia', 'Anastasia']
  
  try {
    // Prima mostra tutti gli utenti
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true
      }
    })
    
    console.log(`📊 Utenti totali nel database: ${allUsers.length}`)
    console.log('👥 Lista utenti:', allUsers.map(u => u.nome))
    
    // Elimina le sessioni degli utenti che verranno rimossi
    const usersToDelete = allUsers.filter(u => !usersToKeep.includes(u.nome))
    const userIdsToDelete = usersToDelete.map(u => u.id)
    
    console.log(`🗑️  Utenti da eliminare: ${usersToDelete.map(u => u.nome).join(', ')}`)
    console.log(`✅ Utenti da mantenere: ${usersToKeep.join(', ')}`)
    
    // Elimina prima le sessioni
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        userId: {
          in: userIdsToDelete
        }
      }
    })
    
    console.log(`🔐 Sessioni eliminate: ${deletedSessions.count}`)
    
    // Poi elimina gli utenti
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        nome: {
          notIn: usersToKeep
        }
      }
    })
    
    console.log(`✅ Utenti eliminati: ${deletedUsers.count}`)
    
    // Verifica utenti rimanenti
    const remainingUsers = await prisma.user.findMany({
      select: {
        nome: true,
        email: true,
        ruolo: true
      }
    })
    
    console.log('\n📋 Utenti rimanenti:')
    remainingUsers.forEach(u => {
      console.log(`  - ${u.nome} (${u.ruolo}) - ${u.email}`)
    })
    
  } catch (error) {
    console.error('❌ Errore durante la pulizia:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanUsers()