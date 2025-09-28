import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function unlockUser(username: string) {
  try {
    console.log(`🔓 Sblocco utente: ${username}...`)
    
    const user = await prisma.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      console.log(`❌ Utente ${username} non trovato`)
      return
    }
    
    // Resetta i tentativi falliti e rimuove il blocco
    await prisma.user.update({
      where: { username },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    })
    
    console.log(`✅ Utente ${username} sbloccato con successo!`)
    
    // Verifica lo stato aggiornato
    const updatedUser = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        nome: true,
        failedLoginAttempts: true,
        lockedUntil: true
      }
    })
    
    console.log('\n📋 Stato utente:')
    console.log(`   Nome: ${updatedUser?.nome}`)
    console.log(`   Tentativi falliti: ${updatedUser?.failedLoginAttempts}`)
    console.log(`   Bloccato fino a: ${updatedUser?.lockedUntil || 'Non bloccato'}`)
    
  } catch (error) {
    console.error('❌ Errore:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Sblocca l'utente specificato o cameriere di default
const username = process.argv[2] || 'cameriere'
unlockUser(username)