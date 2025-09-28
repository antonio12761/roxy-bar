import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function debugLogin() {
  try {
    console.log('=== DEBUG LOGIN SYSTEM ===\n');

    // 1. Verifica connessione database
    console.log('1. Test connessione database...');
    await prisma.$connect();
    console.log('✅ Connessione al database OK\n');

    // 2. Conta utenti totali
    const userCount = await prisma.user.count();
    console.log(`2. Utenti totali nel database: ${userCount}\n`);

    // 3. Lista tutti gli utenti con info base
    console.log('3. Lista utenti:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        nome: true,
        cognome: true,
        ruolo: true,
        attivo: true,
        bloccato: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        tenantId: true,
        Tenant: {
          select: {
            name: true,
            slug: true,
            isActive: true
          }
        }
      }
    });

    if (users.length === 0) {
      console.log('❌ Nessun utente trovato nel database!');
      console.log('\nCreare utenti di test? Usa: npm run create-test-users');
      return;
    }

    users.forEach(user => {
      console.log(`\n   Username: ${user.username}`);
      console.log(`   Nome: ${user.nome} ${user.cognome}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Ruolo: ${user.ruolo}`);
      console.log(`   Attivo: ${user.attivo ? '✅' : '❌'}`);
      console.log(`   Bloccato: ${user.bloccato ? '🔒' : '🔓'}`);
      console.log(`   Tentativi falliti: ${user.failedLoginAttempts || 0}`);
      console.log(`   Bloccato fino a: ${user.lockedUntil || 'Non bloccato'}`);
      console.log(`   Tenant: ${user.Tenant.name} (${user.Tenant.slug})`);
      console.log(`   Tenant attivo: ${user.Tenant.isActive ? '✅' : '❌'}`);
    });

    // 4. Test password per utenti specifici
    console.log('\n\n4. Test password per utenti comuni:');
    const testUsers = [
      { username: 'admin', password: 'admin123' },
      { username: 'cameriere1', password: 'cameriere123' },
      { username: 'cassa1', password: 'cassa123' },
      { username: 'supervisore1', password: 'supervisore123' }
    ];

    for (const testUser of testUsers) {
      const user = await prisma.user.findUnique({
        where: { username: testUser.username }
      });

      if (user) {
        const isValid = await compare(testUser.password, user.password);
        console.log(`\n   ${testUser.username}: ${isValid ? '✅ Password corretta' : '❌ Password errata'}`);
      } else {
        console.log(`\n   ${testUser.username}: ❌ Utente non trovato`);
      }
    }

    // 5. Verifica tenants
    console.log('\n\n5. Lista Tenants:');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        plan: true,
        _count: {
          select: { User: true }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`\n   Nome: ${tenant.name}`);
      console.log(`   Slug: ${tenant.slug}`);
      console.log(`   Attivo: ${tenant.isActive ? '✅' : '❌'}`);
      console.log(`   Piano: ${tenant.plan}`);
      console.log(`   Utenti: ${tenant._count.User}`);
    });

    // 6. Verifica sessioni attive
    console.log('\n\n6. Sessioni attive:');
    const activeSessions = await prisma.session.findMany({
      where: {
        expires: { gt: new Date() }
      },
      include: {
        User: {
          select: {
            username: true,
            nome: true,
            cognome: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (activeSessions.length === 0) {
      console.log('   Nessuna sessione attiva');
    } else {
      activeSessions.forEach(session => {
        console.log(`\n   Utente: ${session.User.username} (${session.User.nome} ${session.User.cognome})`);
        console.log(`   Creata: ${session.createdAt}`);
        console.log(`   Scade: ${session.expires}`);
      });
    }

    // 7. Verifica problemi comuni
    console.log('\n\n7. Controllo problemi comuni:');
    
    // Utenti senza tenant
    const usersWithoutTenant = await prisma.user.count({
      where: {
        tenantId: null
      }
    });
    console.log(`   Utenti senza tenant: ${usersWithoutTenant === 0 ? '✅ Nessuno' : `❌ ${usersWithoutTenant}`}`);

    // Tenants non attivi
    const inactiveTenants = await prisma.tenant.count({
      where: { isActive: false }
    });
    console.log(`   Tenants non attivi: ${inactiveTenants === 0 ? '✅ Nessuno' : `⚠️  ${inactiveTenants}`}`);

    // Utenti bloccati
    const blockedUsers = await prisma.user.count({
      where: {
        OR: [
          { bloccato: true },
          { lockedUntil: { gt: new Date() } }
        ]
      }
    });
    console.log(`   Utenti bloccati: ${blockedUsers === 0 ? '✅ Nessuno' : `⚠️  ${blockedUsers}`}`);

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui debug
debugLogin().catch(console.error);