const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🏠 Aggiornamento struttura tavoli ROXY BAR...");

  // Prima rimuoviamo tutti i tavoli esistenti
  console.log("🗑️ Rimozione tavoli esistenti...");
  await prisma.tavolo.deleteMany({});

  // Definisco la nuova struttura tavoli
  const nuoviTavoli = [
    // 🏠 TAVOLI DENTRO (t1-t6)
    { numero: "t1", zona: "Dentro", posti: 1 },
    { numero: "t2", zona: "Dentro", posti: 1 },
    { numero: "t3", zona: "Dentro", posti: 1 },
    { numero: "t4", zona: "Dentro", posti: 1 },
    { numero: "t5", zona: "Dentro", posti: 1 },
    { numero: "t6", zona: "Dentro", posti: 1 },

    // 🚶 TAVOLI MARCIAPIEDE (m1-m6)
    { numero: "m1", zona: "Marciapiede", posti: 1 },
    { numero: "m2", zona: "Marciapiede", posti: 1 },
    { numero: "m3", zona: "Marciapiede", posti: 1 },
    { numero: "m4", zona: "Marciapiede", posti: 1 },
    { numero: "m5", zona: "Marciapiede", posti: 1 },
    { numero: "m6", zona: "Marciapiede", posti: 1 },

    // 🥇 PRIMA FILA (11-15)
    { numero: "11", zona: "Prima Fila", posti: 1 },
    { numero: "12", zona: "Prima Fila", posti: 1 },
    { numero: "13", zona: "Prima Fila", posti: 1 },
    { numero: "14", zona: "Prima Fila", posti: 1 },
    { numero: "15", zona: "Prima Fila", posti: 1 },

    // 🥈 SECONDA FILA (21-25)
    { numero: "21", zona: "Seconda Fila", posti: 1 },
    { numero: "22", zona: "Seconda Fila", posti: 1 },
    { numero: "23", zona: "Seconda Fila", posti: 1 },
    { numero: "24", zona: "Seconda Fila", posti: 1 },
    { numero: "25", zona: "Seconda Fila", posti: 1 },

    // 🥉 TERZA FILA (31-35)
    { numero: "31", zona: "Terza Fila", posti: 1 },
    { numero: "32", zona: "Terza Fila", posti: 1 },
    { numero: "33", zona: "Terza Fila", posti: 1 },
    { numero: "34", zona: "Terza Fila", posti: 1 },
    { numero: "35", zona: "Terza Fila", posti: 1 },

    // 🅿️ PIAZZA (P1-P4)
    { numero: "P1", zona: "Piazza", posti: 1 },
    { numero: "P2", zona: "Piazza", posti: 1 },
    { numero: "P3", zona: "Piazza", posti: 1 },
    { numero: "P4", zona: "Piazza", posti: 1 },
  ];

  console.log(`🏗️ Creazione ${nuoviTavoli.length} nuovi tavoli...`);

  // Crea tutti i tavoli
  for (const tavolo of nuoviTavoli) {
    await prisma.tavolo.create({
      data: {
        numero: tavolo.numero,
        zona: tavolo.zona,
        posti: tavolo.posti,
        stato: "LIBERO",
        attivo: true,
      },
    });
    console.log(
      `✅ Creato tavolo ${tavolo.numero} (${tavolo.zona}, ${tavolo.posti} cliente)`
    );
  }

  // Statistiche finali
  const count = await prisma.tavolo.count();
  const byZone = await prisma.tavolo.groupBy({
    by: ["zona"],
    _count: { numero: true },
  });

  console.log("\n📊 STATISTICHE FINALI:");
  console.log(`🏠 Totale tavoli: ${count}`);
  byZone.forEach((zona) => {
    console.log(`   ${zona.zona}: ${zona._count.numero} tavoli`);
  });

  console.log("\n🎉 Aggiornamento tavoli completato!");
}

main()
  .catch((e) => {
    console.error("❌ Errore:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });