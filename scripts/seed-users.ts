#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

async function seedUsers() {
  try {
    // Definisci gli utenti con password = nome
    const users = [
      { nome: "Antonio", password: "antonio", ruolo: "ADMIN", cognome: "Colaizzi" },
      { nome: "Filippo", password: "filippo", ruolo: "MANAGER", cognome: "Rossi" },
      { nome: "Giulio", password: "giulio", ruolo: "SUPERVISORE", cognome: "Bianchi" },
      { nome: "Mara", password: "mara", ruolo: "CASSA", cognome: "Costa" },
      { nome: "Linda", password: "linda", ruolo: "BANCO", cognome: "Bruno" },
      { nome: "Maria", password: "maria", ruolo: "CUCINA", cognome: "Conti" },
      { nome: "MarioC", password: "marioc", ruolo: "PREPARA", cognome: "Marino" },
      { nome: "MarioM", password: "mariom", ruolo: "CAMERIERE", cognome: "Romano" },
      { nome: "Gaia", password: "gaia", ruolo: "CAMERIERE", cognome: "Ferrari" },
      { nome: "Anastasia", password: "anastasia", ruolo: "CAMERIERE", cognome: "Ricci" },
    ];

    console.log("🔐 Inizializzazione utenti Siplit...\n");

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