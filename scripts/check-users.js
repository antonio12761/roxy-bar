#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { attivo: true },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
        attivo: true,
      },
      orderBy: { ruolo: 'asc' }
    });

    console.log("\n👥 UTENTI ATTIVI NEL DATABASE:");
    console.log("================================\n");
    
    const usersByRole = {};
    users.forEach(user => {
      if (!usersByRole[user.ruolo]) {
        usersByRole[user.ruolo] = [];
      }
      usersByRole[user.ruolo].push(user);
    });

    Object.entries(usersByRole).forEach(([role, roleUsers]) => {
      console.log(`\n📌 ${role}:`);
      roleUsers.forEach(user => {
        console.log(`   - ${user.nome} ${user.cognome} (${user.email})`);
      });
    });

    console.log(`\n\nTotale utenti attivi: ${users.length}`);
    
    // Check for PREPARA users specifically
    const preparaUsers = users.filter(u => u.ruolo === 'PREPARA');
    if (preparaUsers.length === 0) {
      console.log("\n⚠️  ATTENZIONE: Nessun utente PREPARA trovato!");
      console.log("   Esegui 'npm run seed:users' per creare gli utenti di default");
    }

  } catch (error) {
    console.error("Errore:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();