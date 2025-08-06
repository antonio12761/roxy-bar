-- Crea enum per tipo prodotto configurabile
CREATE TYPE "TipoProdottoConfigurabile" AS ENUM ('COCKTAIL', 'BEVANDA', 'PANINO', 'ALTRO');

-- Tabella per i prodotti configurabili
CREATE TABLE "ProdottoConfigurabile" (
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

-- Tabella per i gruppi di ingredienti
CREATE TABLE "GruppoIngredienti" (
    "id" TEXT NOT NULL,
    "prodottoConfigurableId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "obbligatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordinamento" INTEGER NOT NULL DEFAULT 0,
    "minimoSelezioni" INTEGER NOT NULL DEFAULT 1,
    "massimoSelezioni" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GruppoIngredienti_pkey" PRIMARY KEY ("id")
);

-- Tabella per gli ingredienti
CREATE TABLE "Ingrediente" (
    "id" TEXT NOT NULL,
    "gruppoIngredientiId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "prezzoExtra" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disponibile" BOOLEAN NOT NULL DEFAULT true,
    "ordinamento" INTEGER NOT NULL DEFAULT 0,
    "prodottoRiferimentoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingrediente_pkey" PRIMARY KEY ("id")
);

-- Tabella per salvare le configurazioni delle righe ordine
CREATE TABLE "ConfigurazioneRigaOrdine" (
    "id" TEXT NOT NULL,
    "rigaOrdinazioneId" TEXT NOT NULL,
    "configurazione" JSONB NOT NULL,
    "prezzoFinale" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurazioneRigaOrdine_pkey" PRIMARY KEY ("id")
);

-- Indici
CREATE UNIQUE INDEX "ProdottoConfigurabile_prodottoId_key" ON "ProdottoConfigurabile"("prodottoId");
CREATE INDEX "ProdottoConfigurabile_prodottoId_idx" ON "ProdottoConfigurabile"("prodottoId");
CREATE INDEX "ProdottoConfigurabile_tipo_idx" ON "ProdottoConfigurabile"("tipo");

CREATE INDEX "GruppoIngredienti_prodottoConfigurableId_ordinamento_idx" ON "GruppoIngredienti"("prodottoConfigurableId", "ordinamento");

CREATE INDEX "Ingrediente_gruppoIngredientiId_ordinamento_idx" ON "Ingrediente"("gruppoIngredientiId", "ordinamento");
CREATE INDEX "Ingrediente_prodottoRiferimentoId_idx" ON "Ingrediente"("prodottoRiferimentoId");
CREATE INDEX "Ingrediente_disponibile_idx" ON "Ingrediente"("disponibile");

CREATE UNIQUE INDEX "ConfigurazioneRigaOrdine_rigaOrdinazioneId_key" ON "ConfigurazioneRigaOrdine"("rigaOrdinazioneId");
CREATE INDEX "ConfigurazioneRigaOrdine_rigaOrdinazioneId_idx" ON "ConfigurazioneRigaOrdine"("rigaOrdinazioneId");

-- Foreign Keys
ALTER TABLE "ProdottoConfigurabile" ADD CONSTRAINT "ProdottoConfigurabile_prodottoId_fkey" 
    FOREIGN KEY ("prodottoId") REFERENCES "Prodotto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GruppoIngredienti" ADD CONSTRAINT "GruppoIngredienti_prodottoConfigurableId_fkey" 
    FOREIGN KEY ("prodottoConfigurableId") REFERENCES "ProdottoConfigurabile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ingrediente" ADD CONSTRAINT "Ingrediente_gruppoIngredientiId_fkey" 
    FOREIGN KEY ("gruppoIngredientiId") REFERENCES "GruppoIngredienti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ingrediente" ADD CONSTRAINT "Ingrediente_prodottoRiferimentoId_fkey" 
    FOREIGN KEY ("prodottoRiferimentoId") REFERENCES "Prodotto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConfigurazioneRigaOrdine" ADD CONSTRAINT "ConfigurazioneRigaOrdine_rigaOrdinazioneId_fkey" 
    FOREIGN KEY ("rigaOrdinazioneId") REFERENCES "RigaOrdinazione"("id") ON DELETE CASCADE ON UPDATE CASCADE;