-- Creazione tabelle per prodotti configurabili (miscelati)
-- Eseguire questo script sul database PostgreSQL

-- Enum per tipo prodotto configurabile
CREATE TYPE "TipoProdottoConfigurabile" AS ENUM ('COCKTAIL', 'LONGDRINK', 'SHOTS', 'MOCKTAILS', 'VINI', 'ALTRO');

-- Tabella prodotti configurabili
CREATE TABLE IF NOT EXISTS "ProdottoConfigurabile" (
    "id" TEXT NOT NULL,
    "prodottoId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProdottoConfigurabile" NOT NULL DEFAULT 'COCKTAIL',
    "richiedeScelta" BOOLEAN NOT NULL DEFAULT true,
    "sceltaMultipla" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdottoConfigurabile_pkey" PRIMARY KEY ("id")
);

-- Tabella gruppi di ingredienti
CREATE TABLE IF NOT EXISTS "GruppoIngredienti" (
    "id" TEXT NOT NULL,
    "prodottoConfigurableId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "obbligatorio" BOOLEAN NOT NULL DEFAULT true,
    "minimoSelezioni" INTEGER NOT NULL DEFAULT 1,
    "massimoSelezioni" INTEGER NOT NULL DEFAULT 1,
    "ordinamento" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GruppoIngredienti_pkey" PRIMARY KEY ("id")
);

-- Tabella ingredienti
CREATE TABLE IF NOT EXISTS "Ingrediente" (
    "id" TEXT NOT NULL,
    "gruppoIngredientiId" TEXT,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "prezzoExtra" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disponibile" BOOLEAN NOT NULL DEFAULT true,
    "ordinamento" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingrediente_pkey" PRIMARY KEY ("id")
);

-- Tabella configurazioni per righe ordine
CREATE TABLE IF NOT EXISTS "ConfigurazioneRigaOrdine" (
    "id" TEXT NOT NULL,
    "rigaOrdineId" INTEGER NOT NULL,
    "gruppoIngredientiId" TEXT NOT NULL,
    "ingredientiSelezionati" TEXT NOT NULL,
    "prezzoTotale" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurazioneRigaOrdine_pkey" PRIMARY KEY ("id")
);

-- Indici
CREATE UNIQUE INDEX "ProdottoConfigurabile_prodottoId_key" ON "ProdottoConfigurabile"("prodottoId");
CREATE INDEX "GruppoIngredienti_prodottoConfigurableId_idx" ON "GruppoIngredienti"("prodottoConfigurableId");
CREATE INDEX "Ingrediente_gruppoIngredientiId_idx" ON "Ingrediente"("gruppoIngredientiId");
CREATE INDEX "ConfigurazioneRigaOrdine_rigaOrdineId_idx" ON "ConfigurazioneRigaOrdine"("rigaOrdineId");

-- Foreign keys
ALTER TABLE "ProdottoConfigurabile" 
    ADD CONSTRAINT "ProdottoConfigurabile_prodottoId_fkey" 
    FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GruppoIngredienti" 
    ADD CONSTRAINT "GruppoIngredienti_prodottoConfigurableId_fkey" 
    FOREIGN KEY ("prodottoConfigurableId") REFERENCES "ProdottoConfigurabile"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ingrediente" 
    ADD CONSTRAINT "Ingrediente_gruppoIngredientiId_fkey" 
    FOREIGN KEY ("gruppoIngredientiId") REFERENCES "GruppoIngredienti"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfigurazioneRigaOrdine" 
    ADD CONSTRAINT "ConfigurazioneRigaOrdine_rigaOrdineId_fkey" 
    FOREIGN KEY ("rigaOrdineId") REFERENCES "RigaOrdine"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfigurazioneRigaOrdine" 
    ADD CONSTRAINT "ConfigurazioneRigaOrdine_gruppoIngredientiId_fkey" 
    FOREIGN KEY ("gruppoIngredientiId") REFERENCES "GruppoIngredienti"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;