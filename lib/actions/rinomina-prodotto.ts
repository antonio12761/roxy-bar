"use server";

import { prisma } from "@/lib/db";

export async function rinominaProdotto(id: number, nuovoNome: string) {
  try {
    console.log(`🔄 Rinominando prodotto ID ${id} → "${nuovoNome}"`);
    
    if (!nuovoNome.trim()) {
      return {
        success: false,
        error: "Il nome del prodotto non può essere vuoto"
      };
    }
    
    // Verifica che il prodotto esista
    const prodottoEsistente = await prisma.prodotto.findUnique({
      where: { id },
      select: { nome: true, categoria: true }
    });
    
    if (!prodottoEsistente) {
      return {
        success: false,
        error: "Prodotto non trovato"
      };
    }
    
    console.log(`📊 Prodotto trovato: "${prodottoEsistente.nome}" in categoria "${prodottoEsistente.categoria}"`);
    
    // Aggiorna il nome del prodotto
    const prodottoAggiornato = await prisma.prodotto.update({
      where: { id },
      data: { nome: nuovoNome.trim() }
    });
    
    console.log(`✅ Prodotto rinominato con successo: "${prodottoAggiornato.nome}"`);
    
    return {
      success: true,
      message: `Prodotto rinominato da "${prodottoEsistente.nome}" a "${nuovoNome}"`,
      prodotto: prodottoAggiornato
    };
    
  } catch (error) {
    console.error("Errore durante la modifica del prodotto:", error);
    return {
      success: false,
      error: `Errore durante la modifica: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
    };
  }
}