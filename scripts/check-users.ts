import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Controllo utenti nel database...\n");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      ruolo: true,
      attivo: true,
      ultimoAccesso: true
    },
    orderBy: {
      ruolo: 'asc'
    }
  });

  if (users.length === 0) {
    console.log("❌ Nessun utente trovato nel database!");
  } else {
    console.log(`✅ Trovati ${users.length} utenti:\n`);
    
    users.forEach(user => {
      console.log(`👤 ${user.nome}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Ruolo: ${user.ruolo}`);
      console.log(`   Attivo: ${user.attivo ? '✅' : '❌'}`);
      console.log(`   Ultimo accesso: ${user.ultimoAccesso ? user.ultimoAccesso.toLocaleString() : 'Mai'}`);
      console.log('');
    });
  }

  // Conta per ruolo
  const countByRole = await prisma.user.groupBy({
    by: ['ruolo'],
    _count: true
  });

  console.log('\n📊 Utenti per ruolo:');
  countByRole.forEach(({ ruolo, _count }) => {
    console.log(`   ${ruolo}: ${_count}`);
  });
}

main()
  .catch((e) => {
    console.error("❌ Errore:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });