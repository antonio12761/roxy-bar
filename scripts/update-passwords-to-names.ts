import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function updatePasswordsToNames() {
  console.log('🔐 Aggiornamento password con i nomi degli utenti...\n')
  
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true
      }
    })
    
    for (const user of users) {
      // Usa il nome in minuscolo come password
      const newPassword = user.nome.toLowerCase()
      const hashedPassword = await bcrypt.hash(newPassword, 12)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      })
      
      console.log(`✅ ${user.nome} (${user.ruolo})`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Password: ${newPassword}`)
      console.log('───────────────────────────────────────')
    }
    
    console.log('\n✅ Tutte le password sono state aggiornate!')
    console.log('\n📋 RIEPILOGO PASSWORD:')
    console.log('════════════════════════')
    
    users.forEach(user => {
      console.log(`${user.nome}: ${user.nome.toLowerCase()}`)
    })
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePasswordsToNames()