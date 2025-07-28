const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createMaraUser() {
  try {
    // Hash della password "mara"
    const hashedPassword = await bcrypt.hash('mara', 12);
    
    // Crea l'utente Mara
    const mara = await prisma.user.create({
      data: {
        email: 'mara@bar.com',
        password: hashedPassword,
        nome: 'Mara',
        cognome: 'Utente',
        ruolo: 'CAMERIERE', // Puoi cambiare il ruolo se necessario
        attivo: true,
        bloccato: false
      }
    });
    
    console.log('✅ Utente Mara creato con successo');
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

createMaraUser();