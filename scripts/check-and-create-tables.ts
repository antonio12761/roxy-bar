import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Checking tables in database...");
  
  // Count total tables
  const totalTables = await prisma.tavolo.count();
  console.log(`Total tables: ${totalTables}`);
  
  // Count active tables
  const activeTables = await prisma.tavolo.count({
    where: { attivo: true }
  });
  console.log(`Active tables: ${activeTables}`);
  
  // Show some sample tables
  const sampleTables = await prisma.tavolo.findMany({
    take: 5,
    orderBy: { numero: 'asc' }
  });
  console.log("Sample tables:", sampleTables);
  
  // If no active tables, create some default ones
  if (activeTables === 0) {
    console.log("No active tables found. Creating default tables...");
    
    const tablesToCreate = [
      { numero: "1", zona: "Dentro", attivo: true },
      { numero: "2", zona: "Dentro", attivo: true },
      { numero: "3", zona: "Dentro", attivo: true },
      { numero: "4", zona: "Dentro", attivo: true },
      { numero: "5", zona: "Marciapiede", attivo: true },
      { numero: "6", zona: "Marciapiede", attivo: true },
      { numero: "7", zona: "Marciapiede", attivo: true },
      { numero: "8", zona: "Marciapiede", attivo: true },
    ];
    
    for (const table of tablesToCreate) {
      try {
        await prisma.tavolo.create({
          data: table
        });
        console.log(`Created table ${table.numero}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`Table ${table.numero} already exists, activating it...`);
          await prisma.tavolo.update({
            where: { numero: table.numero },
            data: { attivo: true }
          });
        } else {
          console.error(`Error creating table ${table.numero}:`, error.message);
        }
      }
    }
    
    console.log("Default tables created!");
  } else if (activeTables > 0 && totalTables > activeTables) {
    console.log("Some tables are inactive. Activating all tables...");
    await prisma.tavolo.updateMany({
      data: { attivo: true }
    });
    console.log("All tables activated!");
  }
  
  // Show final count
  const finalCount = await prisma.tavolo.count({
    where: { attivo: true }
  });
  console.log(`Final active tables count: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });