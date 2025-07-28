#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

async function seedUsers() {
  try {
    // Definisci gli utenti con password = nome
    const users = [
      { nome: "Antonio", password: "Antonio", ruolo: "ADMIN", cognome: "Colaizzi" },
      { nome: "Filippo", password: "Filippo", ruolo: "MANAGER", cognome: "Rossi" },
      { nome: "Giulio", password: "Giulio", ruolo: "SUPERVISORE", cognome: "Bianchi" },
      { nome: "Giovanni", password: "Giovanni", ruolo: "OPERATORE", cognome: "Verdi" },
      { nome: "Giacomo", password: "Giacomo", ruolo: "OPERATORE", cognome: "Neri" },
      { nome: "Marco", password: "Marco", ruolo: "CAMERIERE", cognome: "Ferrari" },
      { nome: "Luca", password: "Luca", ruolo: "CAMERIERE", cognome: "Romano" },
      { nome: "Matteo", password: "Matteo", ruolo: "CAMERIERE", cognome: "Ricci" },
      { nome: "Andrea", password: "Andrea", ruolo: "PREPARA", cognome: "Marino" },
      { nome: "Sara", password: "Sara", ruolo: "PREPARA", cognome: "Greco" },
      { nome: "Elena", password: "Elena", ruolo: "BANCO", cognome: "Bruno" },
      { nome: "Laura", password: "Laura", ruolo: "BANCO", cognome: "Gallo" },
      { nome: "Chiara", password: "Chiara", ruolo: "CUCINA", cognome: "Conti" },
      { nome: "Francesca", password: "Francesca", ruolo: "CUCINA", cognome: "De Luca" },
      { nome: "Paola", password: "Paola", ruolo: "CASSA", cognome: "Mancini" },
      { nome: "Marta", password: "Marta", ruolo: "CASSA", cognome: "Costa" },
    ];

    console.log("🔐 Inizializzazione utenti Bar Roxy...\n");

    for (const userData of users) {
      try {
        // Verifica se l'utente esiste già
        const existingUser = await prisma.user.findFirst({
          where: { 
            nome: userData.nome
          },
        });

        if (existingUser) {
          console.log(`⏭️  ${userData.nome} (${userData.ruolo}) - già esistente`);
          continue;
        }

        // Hash della password
        const hashedPassword = await hash(userData.password, 12);
        
        // Crea l'utente
        await prisma.user.create({
          data: {
            email: `${userData.nome.toLowerCase()}@barroxy.local`,
            nome: userData.nome,
            cognome: userData.cognome,
            password: hashedPassword,
            ruolo: userData.ruolo,
            attivo: true,
          },
        });

        console.log(`✅ ${userData.nome} (${userData.ruolo}) - creato`);
      } catch (error) {
        console.error(`❌ Errore per ${userData.nome}:`, error);
      }
    }

    console.log("\n🎉 Inizializzazione completata!");
    console.log("\n📋 Utenti disponibili:");
    console.log("================================");
    users.forEach((u) => {
      console.log(`${u.nome.padEnd(12)} → ${u.ruolo.padEnd(12)} (password: ${u.password})`);
    });
    console.log("================================");

  } catch (error) {
    console.error("❌ Errore durante l'inizializzazione:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  seedUsers().catch(console.error);
}

module.exports = { seedUsers };