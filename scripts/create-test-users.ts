import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🔄 Creazione utenti di test...');

    // Prima verifica se esiste un tenant di default
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'default' }
    });

    if (!tenant) {
      console.log('📦 Creazione tenant di default...');
      tenant = await prisma.tenant.create({
        data: {
          id: nanoid(),
          name: 'Bar Roxy',
          slug: 'default',
          isActive: true,
          settings: {},
          updatedAt: new Date()
        }
      });
      console.log('✅ Tenant creato');
    }

    // Password di default per tutti gli utenti di test
    const defaultPassword = 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Crea utenti per ogni ruolo
    const users = [
      {
        id: nanoid(),
        email: 'admin@barroxy.com',
        username: 'admin',
        password: hashedPassword,
        nome: 'Admin',
        cognome: 'Test',
        ruolo: 'ADMIN',
        attivo: true,
        tenantId: tenant.id,
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        email: 'supervisore@barroxy.com',
        username: 'supervisore',
        password: hashedPassword,
        nome: 'Supervisore',
        cognome: 'Test',
        ruolo: 'SUPERVISORE',
        attivo: true,
        tenantId: tenant.id,
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        email: 'cassa@barroxy.com',
        username: 'cassa',
        password: hashedPassword,
        nome: 'Cassa',
        cognome: 'Test',
        ruolo: 'CASSA',
        attivo: true,
        tenantId: tenant.id,
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        email: 'cameriere@barroxy.com',
        username: 'cameriere',
        password: hashedPassword,
        nome: 'Cameriere',
        cognome: 'Test',
        ruolo: 'CAMERIERE',
        attivo: true,
        tenantId: tenant.id,
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        email: 'prepara@barroxy.com',
        username: 'prepara',
        password: hashedPassword,
        nome: 'Prepara',
        cognome: 'Test',
        ruolo: 'PREPARA',
        attivo: true,
        tenantId: tenant.id,
        updatedAt: new Date()
      }
    ];

    for (const userData of users) {
      try {
        const user = await prisma.user.create({
          data: userData
        });
        console.log(`✅ Creato utente: ${user.username} (${user.ruolo})`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⚠️  Utente ${userData.username} già esistente`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n📋 Credenziali di accesso:');
    console.log('------------------------');
    users.forEach(user => {
      console.log(`${user.ruolo}: ${user.username} / ${defaultPassword}`);
    });

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui lo script
createTestUsers();