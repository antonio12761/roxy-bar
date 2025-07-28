const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        cognome: true,
        ruolo: true,
        email: true,
        attivo: true
      },
      orderBy: { nome: 'asc' }
    });
    
    console.log('📋 Utenti nel database:');
    users.forEach(user => {
      console.log(`- ${user.nome} ${user.cognome} (${user.ruolo}) - ${user.email} - Attivo: ${user.attivo}`);
    });
  } catch (error) {
    console.error('Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();