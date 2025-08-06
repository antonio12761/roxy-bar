import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixClienteSchema() {
  try {
    console.log("Inizio fix schema Cliente...");
    
    // Prima ottieni un tenant valido (il primo disponibile)
    const defaultTenant = await prisma.tenant.findFirst();
    
    if (!defaultTenant) {
      console.error("Nessun tenant trovato. Creazione tenant di default...");
      const newTenant = await prisma.tenant.create({
        data: {
          id: "default-tenant",
          nome: "Default Tenant",
          dominio: "default.local",
          attivo: true
        }
      });
      console.log("Tenant di default creato:", newTenant.id);
    }
    
    const tenantId = defaultTenant?.id || "default-tenant";
    
    // Aggiungi manualmente la colonna cognome e tenantId se mancano
    try {
      // Prima prova ad aggiungere la colonna cognome se non esiste
      await prisma.$executeRaw`
        ALTER TABLE "Cliente" 
        ADD COLUMN IF NOT EXISTS "cognome" TEXT;
      `;
      console.log("Colonna cognome aggiunta o già esistente");
    } catch (error) {
      console.log("Colonna cognome probabilmente già esiste:", error);
    }
    
    try {
      // Poi aggiungi tenantId con un valore di default
      await prisma.$executeRaw`
        ALTER TABLE "Cliente" 
        ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
      `;
      console.log("Colonna tenantId aggiunta o già esistente");
      
      // Aggiorna tutti i record esistenti con il tenantId di default
      await prisma.$executeRawUnsafe(`
        UPDATE "Cliente" 
        SET "tenantId" = $1 
        WHERE "tenantId" IS NULL;
      `, tenantId);
      console.log("TenantId aggiornato per i record esistenti");
      
      // Ora rendi la colonna NOT NULL
      await prisma.$executeRaw`
        ALTER TABLE "Cliente" 
        ALTER COLUMN "tenantId" SET NOT NULL;
      `;
      console.log("Colonna tenantId resa obbligatoria");
    } catch (error) {
      console.log("Errore nell'aggiornamento tenantId:", error);
    }
    
    // Aggiungi le altre colonne opzionali se mancano
    const columnsToAdd = [
      { name: "telefono", type: "TEXT" },
      { name: "email", type: "TEXT" },
      { name: "codiceFiscale", type: "TEXT" },
      { name: "partitaIva", type: "TEXT" },
      { name: "indirizzo", type: "TEXT" },
      { name: "citta", type: "TEXT" },
      { name: "cap", type: "TEXT" },
      { name: "provincia", type: "TEXT" },
      { name: "dataNascita", type: "TIMESTAMP(3)" },
      { name: "tags", type: "TEXT[]", default: "ARRAY[]::TEXT[]" },
      { name: "preferenze", type: "JSONB" },
      { name: "note", type: "TEXT" },
      { name: "attivo", type: "BOOLEAN", default: "true" },
      { name: "createdAt", type: "TIMESTAMP(3)", default: "CURRENT_TIMESTAMP" },
      { name: "updatedAt", type: "TIMESTAMP(3)", default: "CURRENT_TIMESTAMP" }
    ];
    
    for (const column of columnsToAdd) {
      try {
        const defaultClause = column.default ? `DEFAULT ${column.default}` : "";
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Cliente" 
          ADD COLUMN IF NOT EXISTS "${column.name}" ${column.type} ${defaultClause};
        `);
        console.log(`Colonna ${column.name} aggiunta o già esistente`);
      } catch (error) {
        console.log(`Colonna ${column.name} probabilmente già esiste:`, error);
      }
    }
    
    // Verifica i clienti esistenti
    const clienti = await prisma.cliente.findMany();
    console.log(`\nClienti nel database: ${clienti.length}`);
    
    for (const cliente of clienti) {
      console.log(`- ${cliente.nome} (tenant: ${cliente.tenantId})`);
    }
    
    console.log("\nSchema Cliente sistemato con successo!");
    console.log("\nOra puoi eseguire: npx prisma db push");
    
  } catch (error) {
    console.error("Errore durante il fix dello schema:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixClienteSchema().catch(console.error);