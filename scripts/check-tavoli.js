const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkTavoli() {
  try {
    const tavoli = await prisma.tavolo.findMany({
      orderBy: [{ zona: 'asc' }, { numero: 'asc' }]
    });
    
    console.log('📊 TAVOLI ATTUALI NEL DATABASE:');
    console.log('==============================');
    
    const zoneCount = {};
    tavoli.forEach(t => {
      const zona = t.zona || 'Senza zona';
      if (!zoneCount[zona]) {
        zoneCount[zona] = [];
      }
      zoneCount[zona].push(t.numero);
    });
    
    Object.keys(zoneCount).forEach(zona => {
      console.log(`${zona}: ${zoneCount[zona].length} tavoli - [${zoneCount[zona].join(', ')}]`);
    });
    
    console.log(`\nTotale tavoli: ${tavoli.length}`);
    
  } catch (error) {
    console.error('Errore:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTavoli();