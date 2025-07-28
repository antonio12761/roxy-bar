const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixMariaPassword() {
  try {
    // Hash della password "maria"
    const hashedPassword = await bcrypt.hash('maria', 12);
    
    // Aggiorna la password di Maria
    const maria = await prisma.user.update({
      where: { 
        nome: 'Maria'
      },
      data: { password: hashedPassword }
    });
    
    console.log('✅ Password "maria" aggiornata per l\'utente Maria');
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMariaPassword();