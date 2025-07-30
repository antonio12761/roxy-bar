"use server";

import { prisma } from "@/lib/db";

/**
 * Script per aggiornare tutte le destinazioni da BAR a PREPARA
 * e verificare che i prodotti abbiano le destinazioni corrette
 */
export async function fixBarDestinations() {
  try {
    console.log("🔧 Inizio fix destinazioni BAR -> PREPARA");
    
    // 1. Conta quante righe hanno postazione BAR
    const righeWithBar = await prisma.rigaOrdinazione.count({
      where: {
        postazione: "BAR" as any // Cast necessario perché BAR non è più nell'enum
      }
    });
    
    console.log(`📊 Trovate ${righeWithBar} righe con postazione BAR`);
    
    if (righeWithBar > 0) {
      // 2. Aggiorna tutte le righe da BAR a PREPARA
      const updateResult = await prisma.rigaOrdinazione.updateMany({
        where: {
          postazione: "BAR" as any
        },
        data: {
          postazione: "PREPARA"
        }
      });
      
      console.log(`✅ Aggiornate ${updateResult.count} righe da BAR a PREPARA`);
    }
    
    // 3. Conta e mostra le destinazioni attuali
    const destinazioni = await prisma.rigaOrdinazione.groupBy({
      by: ['postazione'],
      _count: {
        postazione: true
      }
    });
    
    console.log("📊 Distribuzione destinazioni attuali:");
    destinazioni.forEach(d => {
      console.log(`  - ${d.postazione}: ${d._count.postazione} righe`);
    });
    
    // 4. Aggiorna i prodotti che hanno postazione null o vuota
    const prodottiSenzaPostazione = await prisma.prodotto.count({
      where: {
        OR: [
          { postazione: null },
          { postazione: "" as any }
        ]
      }
    });
    
    if (prodottiSenzaPostazione > 0) {
      console.log(`⚠️ Trovati ${prodottiSenzaPostazione} prodotti senza postazione`);
      
      // Aggiorna prodotti senza postazione a PREPARA come default
      const updateProdotti = await prisma.prodotto.updateMany({
        where: {
          OR: [
            { postazione: null },
            { postazione: "" as any }
          ]
        },
        data: {
          postazione: "PREPARA"
        }
      });
      
      console.log(`✅ Aggiornati ${updateProdotti.count} prodotti con postazione PREPARA`);
    }
    
    return {
      success: true,
      righeAggiornate: righeWithBar,
      prodottiAggiornati: prodottiSenzaPostazione
    };
    
  } catch (error) {
    console.error("❌ Errore durante il fix delle destinazioni:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto"
    };
  }
}