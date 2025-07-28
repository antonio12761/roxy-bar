const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Avvio migrazione database...');

    // Leggi il file SQL
    const sqlPath = path.join(__dirname, 'create-categories-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Separa i comandi SQL ed eseguili uno per uno
    console.log('📋 Creazione tabella CategoriaGestione...');
    
    // Crea tabella
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CategoriaGestione" (
          "id" SERIAL PRIMARY KEY,
          "nome" VARCHAR(255) NOT NULL UNIQUE,
          "nomeDisplay" VARCHAR(255),
          "parentId" INTEGER,
          "livello" INTEGER NOT NULL DEFAULT 1,
          "ordinamento" INTEGER NOT NULL DEFAULT 0,
          "emoji" VARCHAR(10),
          "colore" VARCHAR(50),
          "descrizione" TEXT,
          "attiva" BOOLEAN NOT NULL DEFAULT true,
          "prodottiCount" INTEGER NOT NULL DEFAULT 0,
          "prodottiDirettiCount" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Crea indici
    console.log('📊 Creazione indici...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoriaGestione_parentId_idx" ON "CategoriaGestione"("parentId")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoriaGestione_livello_idx" ON "CategoriaGestione"("livello")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoriaGestione_ordinamento_idx" ON "CategoriaGestione"("ordinamento")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "CategoriaGestione_attiva_idx" ON "CategoriaGestione"("attiva")`;

    // Aggiungi foreign key constraint se non esiste
    console.log('🔗 Aggiunta constraint...');
    try {
      await prisma.$executeRaw`
        ALTER TABLE "CategoriaGestione" 
        ADD CONSTRAINT "CategoriaGestione_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "CategoriaGestione"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE
      `;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Constraint già esiste');
      } else {
        console.log('⚠️  Avviso constraint:', error.message);
      }
    }

    console.log('✅ Tabella CategoriaGestione creata con successo!');

    // Verifica che la tabella sia stata creata
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'CategoriaGestione'
    `;

    if (result.length > 0) {
      console.log('✅ Verifica tabella: CategoriaGestione esiste nel database');
    } else {
      console.log('❌ Errore: Tabella CategoriaGestione non trovata');
    }

  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tabella CategoriaGestione già esiste');
    } else {
      console.error('❌ Errore durante la migrazione:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration().catch((error) => {
  console.error('💥 Migrazione fallita:', error);
  process.exit(1);
});