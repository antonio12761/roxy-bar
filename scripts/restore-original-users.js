const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function restoreOriginalUsers() {
  console.log('🔐 Ripristino utenti originali con password = nome...\n');
  
  try {
    // Utenti originali dal log che hai mostrato
    const originalUsers = [
      { nome: 'Anastasia', ruolo: 'CAMERIERE', email: 'anastasia@bar.com' },
      { nome: 'Antonio', ruolo: 'ADMIN', email: 'antonio@bar.com' },
      { nome: 'Filippo', ruolo: 'MANAGER', email: 'filippo@bar.com' },
      { nome: 'Gaia', ruolo: 'CAMERIERE', email: 'gaia@bar.com' },
      { nome: 'Giulio', ruolo: 'SUPERVISORE', email: 'giulio@bar.com' },
      { nome: 'Linda', ruolo: 'BANCO', email: 'linda@bar.com' },
      { nome: 'Mara', ruolo: 'CASSA', email: 'mara@bar.com' },
      { nome: 'Maria', ruolo: 'CUCINA', email: 'maria@bar.com' },
      { nome: 'MarioC', ruolo: 'PREPARA', email: 'marioc@bar.com' },
      { nome: 'MarioM', ruolo: 'CAMERIERE', email: 'mariom@bar.com' }
    ];

    // Prima elimina tutti gli utenti esistenti
    await prisma.user.deleteMany({});
    console.log('🗑️ Utenti esistenti eliminati');

    for (const userData of originalUsers) {
      // Password = nome in minuscolo
      const password = userData.nome.toLowerCase();
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Deriva cognome dal nome (semplificato)
      const cognome = userData.nome === 'MarioC' ? 'Prepara' : 
                     userData.nome === 'MarioM' ? 'Cameriere' :
                     userData.nome === 'Giulio' ? 'Supervisore' :
                     userData.nome === 'Antonio' ? 'Admin' :
                     userData.nome === 'Filippo' ? 'Manager' :
                     userData.ruolo.charAt(0) + userData.ruolo.slice(1).toLowerCase();
      
      await prisma.user.create({
        data: {
          email: userData.email,
          nome: userData.nome,
          cognome: cognome,
          password: hashedPassword,
          ruolo: userData.ruolo,
          attivo: true,
        },
      });

      console.log(`✅ ${userData.nome} (${userData.ruolo})`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Password: ${password}`);
      console.log('───────────────────────────────────────');
    }
    
    console.log('\n✅ Tutti gli utenti originali sono stati ripristinati!');
    console.log('\n📋 RIEPILOGO PASSWORD:');
    console.log('════════════════════════');
    
    originalUsers.forEach(user => {
      console.log(`${user.nome.padEnd(12)} → ${user.nome.toLowerCase()}`);
    });
    
  } catch (error) {
    console.error('❌ Errore durante il ripristino:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreOriginalUsers();