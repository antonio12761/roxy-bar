const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateMariaPassword() {
  try {
    // Hash della password "mara"
    const hashedPassword = await bcrypt.hash('mara', 12);
    
    // Cerca l'utente Maria
    const maria = await prisma.user.findFirst({
      where: { 
        nome: { equals: 'Maria', mode: 'insensitive' }
      }
    });
    
    if (maria) {
      // Aggiorna la password
      await prisma.user.update({
        where: { id: maria.id },
        data: { password: hashedPassword }
      });
      
      console.log('✅ Password "mara" aggiunta per l\'utente Maria');
    } else {
      console.log('❌ Utente Maria non trovato nel database');
    }
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMariaPassword();