const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateMaraPassword() {
  try {
    // Hash della password "mara"
    const hashedPassword = await bcrypt.hash('mara', 12);
    
    // Cerca l'utente Mara
    const mara = await prisma.user.findFirst({
      where: { 
        nome: { equals: 'Mara', mode: 'insensitive' }
      }
    });
    
    if (mara) {
      // Aggiorna la password
      await prisma.user.update({
        where: { id: mara.id },
        data: { password: hashedPassword }
      });
      
      console.log('✅ Password "mara" aggiunta per l\'utente Mara');
    } else {
      console.log('❌ Utente Mara non trovato nel database');
    }
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMaraPassword();