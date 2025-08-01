import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrazione: Aggiunta campo username...');

  try {
    // 1. Aggiungi il campo username (nullable inizialmente)
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT`;
    
    // 2. Popola username per utenti esistenti
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      // Genera username dal nome (es: "Marco Rossi" -> "marco.rossi")
      const username = user.nome.toLowerCase().replace(/\s+/g, '.');
      
      // Gestisci duplicati aggiungendo un numero
      let finalUsername = username;
      let counter = 1;
      
      while (true) {
        const existing = await prisma.user.findFirst({
          where: { 
            username: finalUsername,
            NOT: { id: user.id }
          }
        });
        
        if (!existing) break;
        
        finalUsername = `${username}${counter}`;
        counter++;
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { username: finalUsername }
      });
      
      console.log(`✅ Utente ${user.nome}: username = ${finalUsername}`);
    }
    
    // 3. Rendi il campo NOT NULL e UNIQUE
    await prisma.$executeRaw`ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL`;
    await prisma.$executeRaw`ALTER TABLE "User" ADD CONSTRAINT "User_username_key" UNIQUE ("username")`;
    
    // 4. Rimuovi il vincolo UNIQUE dal campo nome
    await prisma.$executeRaw`ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_nome_key"`;
    
    console.log('✅ Migrazione completata con successo!');
  } catch (error) {
    console.error('❌ Errore durante la migrazione:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });