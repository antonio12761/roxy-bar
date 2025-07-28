-- Crea la tabella CategoriaGestione se non esiste
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "CategoriaGestione_parentId_fkey" 
        FOREIGN KEY ("parentId") REFERENCES "CategoriaGestione"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS "CategoriaGestione_parentId_idx" ON "CategoriaGestione"("parentId");
CREATE INDEX IF NOT EXISTS "CategoriaGestione_livello_idx" ON "CategoriaGestione"("livello");
CREATE INDEX IF NOT EXISTS "CategoriaGestione_ordinamento_idx" ON "CategoriaGestione"("ordinamento");
CREATE INDEX IF NOT EXISTS "CategoriaGestione_attiva_idx" ON "CategoriaGestione"("attiva");

-- Crea trigger per aggiornare updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_categoria_gestione_updated_at 
    BEFORE UPDATE ON "CategoriaGestione" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();