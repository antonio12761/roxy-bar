const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateMaraRole() {
  try {
    // Aggiorna il ruolo di Mara
    const mara = await prisma.user.update({
      where: { 
        nome: 'Mara'
      },
      data: { 
        ruolo: 'CASSA'
      }
    });
    
    console.log('✅ Ruolo di Mara aggiornato con successo');
    console.log(`- Nome: ${mara.nome} ${mara.cognome}`);
    console.log(`- Email: ${mara.email}`);
    console.log(`- Ruolo: ${mara.ruolo}`);
    console.log(`- Password: mara`);
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMaraRole();