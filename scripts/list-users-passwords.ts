import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listUsersAndPasswords() {
  console.log('📋 Lista utenti e password\n')
  console.log('═══════════════════════════════════════════════════════════════')
  
  try {
    const users = await prisma.user.findMany({
      select: {
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
        attivo: true
      },
      orderBy: {
        nome: 'asc'
      }
    })
    
    // Password di default per ruolo
    const defaultPasswords: Record<string, string> = {
      'ADMIN': 'admin123',
      'MANAGER': 'manager123',
      'SUPERVISORE': 'supervisore123',
      'CAMERIERE': 'cameriere123',
      'PREPARA': 'bar123',
      'BANCO': 'banco123',
      'CUCINA': 'cucina123',
      'CASSA': 'cassa123'
    }
    
    console.log(`Totale utenti: ${users.length}\n`)
    
    users.forEach(user => {
      const password = defaultPasswords[user.ruolo] || 'password123'
      const status = user.attivo ? '✅' : '❌'
      
      console.log(`${status} ${user.nome} ${user.cognome || ''}`)
      console.log(`   📧 Email: ${user.email}`)
      console.log(`   👤 Ruolo: ${user.ruolo}`)
      console.log(`   🔑 Password: ${password}`)
      console.log('───────────────────────────────────────────────────────────────')
    })
    
    console.log('\n📌 Note:')
    console.log('- Queste sono le password di default basate sul ruolo')
    console.log('- Gli utenti potrebbero aver cambiato la password dopo il primo accesso')
    console.log('- ✅ = Utente attivo, ❌ = Utente disattivato')
    
  } catch (error) {
    console.error('❌ Errore:', error)
  } finally {
    await prisma.$disconnect()
  }
}

listUsersAndPasswords()